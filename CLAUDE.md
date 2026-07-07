# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this actually is

A single-page, client-side-only PWA for tracking daily food macros, plus a single serverless function that estimates the macros. No accounts, no database, no build step. Frontend is plain HTML/CSS/JS in [docs/](docs/); backend is one AWS Lambda in [backend/](backend/).

## Architecture

- **Entry points**: root [index.html](index.html) is a meta-refresh redirect to [docs/index.html](docs/index.html), the real app. GitHub Pages serves both, so the redirect makes the bare project URL work.
- **App logic**: all in [docs/script.js](docs/script.js). Flow: user submits a food → `getMacroData()` POSTs `{foodItem}` to the `API_URL` endpoint → returns `{carbs, protein, fat, calories}` → appended to `localStorage['foodEntries']` → table + totals re-render. Rows are built with `createElement`/`textContent` (never `innerHTML`) — food names are untrusted, so this is the XSS guard; keep it that way.
- **Macro helpers**: [docs/macros.js](docs/macros.js) (`num`, `sumMacros`) is pure, no DOM, shared with the Node test [docs/macros.test.js](docs/macros.test.js). Run `node docs/macros.test.js`.
- **Backend**: [backend/lambda_function.py](backend/lambda_function.py) calls **Amazon Bedrock** (Claude Haiku 4.5, inference profile `us.anthropic.claude-haiku-4-5-20251001-v1:0`) — no external API key, IAM handles auth. See [backend/README.md](backend/README.md) for the full resource list. Redeploy code with [backend/deploy.sh](backend/deploy.sh).
- **State**: `localStorage` only. No accounts, no sync. "Clear Day" wipes the key. (Accounts + saved data are deferred — not built.)
- **PWA**: [docs/service-worker.js](docs/service-worker.js) is network-first for same-origin GETs, scope-relative paths. [docs/manifest.json](docs/manifest.json) is the live manifest.

## Deploying

- **Frontend**: push to `main`. [.github/workflows/static.yml](.github/workflows/static.yml) uploads the **entire repo** to GitHub Pages — no build. Live at https://ashershores5.github.io/NutriSageAI.
- **Backend**: `cd backend && ./deploy.sh` (packages + updates the Lambda; role/API already exist).

## AWS backend (account 334772842524, us-east-1)

- Lambda `nutrisageai-macro`, HTTP API `nutrisageai-api` (id `q8f8dfzb0j`), IAM role `nutrisageai-macro-role` (least-privilege: `bedrock:InvokeModel` on the one model + logging).
- **Why API Gateway, not a Lambda Function URL**: an Organizations SCP blocks public Function URLs (they 403 even with a correct resource policy). API Gateway is allowed. Don't waste time re-trying Function URLs here.
- **Abuse controls**: HTTP API throttled to 5 req/s, burst 10; account Lambda concurrency cap is 10 (hard blast-radius limit); a $10 zero-spend AWS budget acts as a cost tripwire. CORS is locked to the GitHub Pages origin + localhost:8000.

## Gotchas that will bite you

- **API endpoint is hardcoded** as `API_URL` in [docs/script.js](docs/script.js) — no `.env`/config. If you redeploy the API and the ID changes, update this string. CORS is origin-locked, so `file://` won't work; serve over http on port 8000 when testing the fetch path.
- **Bedrock model access** is region- and account-gated and must be an *active* (non-legacy) inference profile — hence the `us.` prefix. On-demand invocation of the bare model ID fails; use the inference profile ID.
- **Model choice is cost-driven**: Haiku 4.5 ($1/$5 per Mtok) is the deliberate pick for this simple JSON-estimation task — a Sonnet/Opus upgrade lives in one env var (`MODEL_ID` in the Lambda) if quality ever needs it.
- The frontend keeps macro summing tolerant of junk API responses (`Number(x) || 0`); don't "simplify" that away — it prevents `NaN` totals.
