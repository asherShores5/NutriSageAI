# NutriSageAI Backend

A single AWS Lambda behind an HTTP API Gateway. Two jobs: estimate food macros with Amazon Bedrock,
and sync each family member's data across devices via DynamoDB. Bedrock auth is IAM; data-sync auth is a
per-user shared secret. No external API keys.

## Routes

All three hit the same Lambda (the HTTP API's `$default` route sends everything here). Base URL:
`https://q8f8dfzb0j.execute-api.us-east-1.amazonaws.com`

| Route | Auth | Body → Response |
|---|---|---|
| `POST /` | none | `{"foodItem":"1 medium banana"}` → `{"carbs":27,"protein":1,"fat":0,"calories":105}` |
| `POST /pull` | secret | `{"user","secret"}` → `{"days":{date:{entries,updatedAt}}, "goals":{...}, "meals":[...]}` |
| `POST /push` | secret | `{"user","secret","item":{...}}` → `{"ok":true}` — `item.type` is `day` \| `goals` \| `meals` |
| `OPTIONS *` | — | `204` (CORS preflight) |

Consumed by [../docs/script.js](../docs/script.js) (`API_URL`).

### Auth

Per-user shared secret. The env var `USER_SECRETS` holds only SHA-256 **hashes** (`{"asher":"<hex>","wife":"<hex>"}`).
The client sends the plaintext secret; the Lambda hashes it and constant-time compares. Secrets are handed to
each person out-of-band and cached in their browser's localStorage — never committed to the repo.

**Add / rotate a user:** generate a random secret, `sha256` it, and update the `USER_SECRETS` env var on the Lambda
(and add the name to `PROFILES` in the frontend). New user = new `pk`, no table change.

## Redeploy code changes

```bash
./deploy.sh          # packages lambda_function.py and updates the function (pinned to us-east-1)
```

## Resources (account 334772842524, us-east-1)

| Resource | Name |
|---|---|
| Lambda | `nutrisageai-macro` (python3.12, handler `lambda_function.handler`) |
| DynamoDB | `nutrisageai-data` (on-demand). `pk=user, sk=date\|goals`; shared library at `pk=household, sk=meals`. Row body is a JSON string in `data`. |
| IAM role | `nutrisageai-macro-role` — `bedrock:InvokeModel` on the Haiku model + `GetItem`/`PutItem`/`Query` on `nutrisageai-data` + logging |
| HTTP API | `nutrisageai-api` (id `q8f8dfzb0j`), CORS-locked to the GitHub Pages origin + localhost:8000 |
| Model | `us.anthropic.claude-haiku-4-5-20251001-v1:0` (Bedrock inference profile) |
| Env vars | `MODEL_ID`, `DATA_TABLE`, `USER_SECRETS` (hashes only) |

## Abuse / cost controls

- HTTP API `$default` stage throttled to **5 req/s, burst 10** (`ThrottlingRateLimit`/`ThrottlingBurstLimit`).
- Account-wide Lambda concurrency limit is **10** — a hard ceiling on how many invocations can run at once.
- A **$10 zero-spend AWS budget** on the account acts as a cost tripwire.
- CORS locked to the GitHub Pages origin + localhost.

## Notes

- **Why API Gateway, not a Lambda Function URL?** An Organizations SCP on this account blocks public
  Function URLs (they return 403 even with a correct resource policy). API Gateway is allowed, so we use it.
- **CORS** is set on the HTTP API. To add an allowed origin, update the API's CORS config (not the Lambda).
- **Model access** is region- and account-gated in Bedrock; the chosen model must be an active (non-legacy)
  inference profile, hence the `us.` prefix. Swap models by editing the `MODEL_ID` env var on the Lambda.
