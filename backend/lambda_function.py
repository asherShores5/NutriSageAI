"""NutriSageAI macro estimator.

Takes {"foodItem": "..."} and returns {"carbs","protein","fat","calories"} as numbers,
estimated by Bedrock Claude. Deployed as a Lambda Function URL (CORS handled by the URL config).
"""
import json
import os
import re
import boto3

MODEL_ID = os.environ.get("MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
bedrock = boto3.client("bedrock-runtime")

PROMPT = (
    "Estimate the macronutrients for this food. Reply with ONLY a JSON object, no prose, "
    "with numeric keys carbs, protein, fat (grams) and calories (kcal). "
    "If the food is unrecognizable, use 0 for all. Food: "
)


def _macros(food_item):
    body = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 200,
        "messages": [{"role": "user", "content": PROMPT + food_item}],
    }
    resp = bedrock.invoke_model(modelId=MODEL_ID, body=json.dumps(body))
    text = json.loads(resp["body"].read())["content"][0]["text"]
    # model usually returns bare JSON but may wrap it in prose/```json fences;
    # grab the first {...} block rather than trusting the whole string
    match = re.search(r"\{.*\}", text, re.DOTALL)
    data = json.loads(match.group(0) if match else text)
    # coerce to numbers; frontend also guards, but keep the contract clean here
    return {k: round(float(data.get(k, 0)), 1) for k in ("carbs", "protein", "fat", "calories")}


def handler(event, _context):
    try:
        raw = event.get("body") or "{}"
        food_item = (json.loads(raw).get("foodItem") or "").strip()
        if not food_item:
            return _reply(400, {"error": "foodItem is required"})
        return _reply(200, _macros(food_item))
    except Exception as exc:  # noqa: BLE001 - surface a clean error, log the detail
        print(f"error: {exc!r}")
        return _reply(502, {"error": "Could not estimate macros"})


def _reply(status, payload):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(payload),
    }
