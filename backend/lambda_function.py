"""NutriSageAI backend — macro estimation + family data sync.

Routes (HTTP API quick-create sends everything here via $default):
  POST /            -> {foodItem} -> {carbs,protein,fat,calories}  (Bedrock, no auth)
  POST /pull        -> {user,secret} -> {days:{date:{...}}, goals:{...}, meals:[...]}
  POST /push        -> {user,secret,item:{type,...}} -> {ok:true}
  OPTIONS *         -> 204 (CORS preflight; API Gateway attaches the headers)

Auth: per-user shared secret. Only SHA-256 hashes live in env var USER_SECRETS
(a JSON object {user: sha256hex}). The client sends the plaintext secret; we hash
and constant-time compare. Data rows store their body as a JSON string in `data`,
so DynamoDB stays a dumb blob store (no Decimal/float juggling).
"""
import hashlib
import hmac
import json
import os
import re
import boto3

# Sonnet 4.5 over Haiku 4.5: this is a knowledge-recall task (branded/restaurant nutrition
# facts), and Haiku systematically underestimated portions on brand items. Sonnet's recall is
# far better and still cheap at family volume. Swap here (env var) if that ever changes.
MODEL_ID = os.environ.get("MODEL_ID", "us.anthropic.claude-sonnet-4-5-20250929-v1:0")
TABLE = os.environ.get("DATA_TABLE", "nutrisageai-data")
USER_SECRETS = json.loads(os.environ.get("USER_SECRETS", "{}"))  # {user: sha256hex}
SHARED_PK = "household"  # shared meal library lives here

bedrock = boto3.client("bedrock-runtime")
ddb = boto3.client("dynamodb")

MAX_FOOD_LEN = 200        # cap the prompt so a huge body can't run up token cost
MAX_PAYLOAD_BYTES = 100_000  # cap a synced item (~a very long day) to bound writes
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

PROMPT = (
    "You are a nutrition estimator. Estimate macros for the food described. "
    "If it names a brand, store, or restaurant item (Costco, CLIF, Chipotle, etc.), use that "
    "product's ACTUAL published nutrition - these are usually larger than a generic portion, so "
    "do not shrink them. Treat 'one whole X' as the entire item. Account for cooking oils, cheese, "
    "sauces, and prep that add fat and calories. When unsure between portion sizes, choose the "
    "larger realistic one. Reply with ONLY a JSON object, no prose, numeric keys carbs, protein, "
    "fat, fiber (grams), sodium (milligrams), iron (milligrams) and calories (kcal). If truly "
    "unrecognizable, use 0 for all. Food: "
)


# ---- macro estimation -------------------------------------------------------

def _macros(food_item):
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 200,
        "messages": [{"role": "user", "content": PROMPT + food_item}],
    }
    resp = bedrock.invoke_model(modelId=MODEL_ID, body=json.dumps(body))
    text = json.loads(resp["body"].read())["content"][0]["text"]
    # model usually returns bare JSON but may wrap it in prose/```json fences
    match = re.search(r"\{.*\}", text, re.DOTALL)
    data = json.loads(match.group(0) if match else text)
    return {k: round(float(data.get(k, 0)), 1) for k in ("carbs", "protein", "fat", "fiber", "sodium", "iron", "calories")}


# ---- auth + data sync -------------------------------------------------------

def _authed(user, secret):
    expected = USER_SECRETS.get(user or "")
    if not expected or not secret:
        return False
    got = hashlib.sha256(secret.encode()).hexdigest()
    return hmac.compare_digest(got, expected)  # constant-time


def _pull(user):
    """Everything the user needs on open: their days, their goals, the shared meals."""
    days, goals = {}, {}
    resp = ddb.query(
        TableName=TABLE,
        KeyConditionExpression="pk = :u",
        ExpressionAttributeValues={":u": {"S": user}},
    )
    for item in resp.get("Items", []):
        sk = item["sk"]["S"]
        payload = json.loads(item.get("data", {}).get("S", "{}"))
        if sk == "goals":
            goals = payload
        elif DATE_RE.match(sk):
            days[sk] = payload

    shared = ddb.get_item(
        TableName=TABLE,
        Key={"pk": {"S": SHARED_PK}, "sk": {"S": "meals"}},
    )
    meals = json.loads(shared["Item"]["data"]["S"]).get("library", []) if "Item" in shared else []
    return {"days": days, "goals": goals, "meals": meals}


def _put_row(pk, sk, payload):
    blob = json.dumps(payload)
    if len(blob.encode()) > MAX_PAYLOAD_BYTES:
        raise ValueError("payload too large")
    ddb.put_item(TableName=TABLE, Item={"pk": {"S": pk}, "sk": {"S": sk}, "data": {"S": blob}})


def _push(user, item):
    """Write one item. LWW per row — a full-row put is the whole conflict strategy."""
    kind = item.get("type")
    if kind == "day":
        date = item.get("date", "")
        if not DATE_RE.match(date):
            raise ValueError("bad date")
        _put_row(user, date, {
            "entries": item.get("entries", []),
            "water": item.get("water", 0),
            "weight": item.get("weight", 0),
            "updatedAt": item.get("updatedAt"),
        })
    elif kind == "goals":
        _put_row(user, "goals", item.get("goals", {}))
    elif kind == "meals":  # shared library — any authed user may update
        _put_row(SHARED_PK, "meals", {"library": item.get("library", [])})
    else:
        raise ValueError("unknown item type")


# ---- routing ----------------------------------------------------------------

def handler(event, _context):
    ctx = event.get("requestContext", {}).get("http", {})
    method, path = ctx.get("method"), ctx.get("path", "/")

    # CORS preflight — quick-create routes ANY /, so OPTIONS reaches us too.
    if method == "OPTIONS":
        return _reply(204, None)

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _reply(400, {"error": "invalid JSON"})

    try:
        if path.endswith("/pull") or path.endswith("/push"):
            if not _authed(body.get("user"), body.get("secret")):
                return _reply(401, {"error": "unauthorized"})
            if path.endswith("/pull"):
                return _reply(200, _pull(body["user"]))
            _push(body["user"], body.get("item", {}))
            return _reply(200, {"ok": True})

        # default: macro estimation
        food_item = (body.get("foodItem") or "").strip()[:MAX_FOOD_LEN]
        if not food_item:
            return _reply(400, {"error": "foodItem is required"})
        return _reply(200, _macros(food_item))
    except ValueError as exc:
        return _reply(400, {"error": str(exc)})
    except Exception as exc:  # noqa: BLE001 - clean error out, detail to logs
        print(f"error: {exc!r}")
        return _reply(502, {"error": "server error"})


def _reply(status, payload):
    if payload is None:
        return {"statusCode": status}
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }
