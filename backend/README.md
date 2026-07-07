# NutriSageAI Backend

A single AWS Lambda that estimates food macros with Amazon Bedrock (Claude Haiku 4.5) and returns
`{carbs, protein, fat, calories}`. Fronted by an HTTP API Gateway. No external API keys — auth is IAM.

## Live endpoint

`POST https://q8f8dfzb0j.execute-api.us-east-1.amazonaws.com/`
Body: `{"foodItem": "1 medium banana"}` → `{"carbs":27.0,"protein":1.0,"fat":0.0,"calories":105.0}`

Consumed by [../docs/script.js](../docs/script.js) (`API_URL`).

## Redeploy code changes

```bash
./deploy.sh          # packages lambda_function.py and updates the function
```

## Resources (account 334772842524, us-east-1)

| Resource | Name |
|---|---|
| Lambda | `nutrisageai-macro` (python3.12, handler `lambda_function.handler`) |
| IAM role | `nutrisageai-macro-role` — `bedrock:InvokeModel` on the Haiku model + basic logging |
| HTTP API | `nutrisageai-api` (id `q8f8dfzb0j`), CORS-locked to the GitHub Pages origin + localhost:8000 |
| Model | `us.anthropic.claude-haiku-4-5-20251001-v1:0` (Bedrock inference profile) |

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
