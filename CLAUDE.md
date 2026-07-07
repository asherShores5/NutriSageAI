# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this actually is

A single-page, client-side PWA for a small family (2 profiles now) to track daily food macros, with a single serverless backend that (1) estimates macros via Bedrock and (2) syncs each user's data across devices via DynamoDB. No build step. Frontend is plain HTML/CSS/JS in [docs/](docs/); backend is one AWS Lambda in [backend/](backend/).

## Architecture

- **Entry points**: root [index.html](index.html) is a meta-refresh redirect to [docs/index.html](docs/index.html), the real app. GitHub Pages serves both, so the redirect makes the bare project URL work.
- **App logic**: all in [docs/script.js](docs/script.js). **localStorage is the working copy; the server is the sync layer** — every mutation updates the per-user cache (`nutri:<user>`) instantly, then write-throughs to the API best-effort (offline still works locally). Flow on open: pick profile → paste access key once (cached) → `/pull` loads days + goals + shared meals. Rows/bars/chips are all built with `createElement`/`textContent` (never `innerHTML`) — food names are untrusted; keep it that way.
- **Macro helpers**: [docs/macros.js](docs/macros.js) (`num`, `sumMacros`, `dateKey`, `weekKeys`, `sumWeek`, `pct`) is pure, no DOM/network, shared with the Node test [docs/macros.test.js](docs/macros.test.js). Run `node docs/macros.test.js`.
- **Backend** ([backend/lambda_function.py](backend/lambda_function.py)), one Lambda, path-routed via the HTTP API's `$default`:
  - `POST /` — `{foodItem}` → macros via **Amazon Bedrock** (Claude Haiku 4.5, profile `us.anthropic.claude-haiku-4-5-20251001-v1:0`). No auth.
  - `POST /pull` / `POST /push` — per-user data sync, **secret-gated** (see Auth below).
  - `OPTIONS *` → 204 for the CORS preflight (quick-create routes ANY / here too).
- **Auth**: per-user shared secret. Only SHA-256 **hashes** live in the Lambda env var `USER_SECRETS` (`{user: sha256hex}`); the client sends the plaintext key, the Lambda hashes + constant-time compares. No passwords, no Cognito. Secrets are user-entered, cached in their localStorage, and **never** in the repo.
- **Data** (DynamoDB `nutrisageai-data`, on-demand): `pk=user, sk=date|goals`; shared meal library at `pk=household, sk=meals`. Each row's body is a JSON string in a `data` attribute (table is a dumb blob store — no Decimal/float juggling). Conflict strategy is **last-write-wins per day**.
- **PWA**: [docs/service-worker.js](docs/service-worker.js) is network-first for same-origin GETs, scope-relative paths. [docs/manifest.json](docs/manifest.json) has `id`/`scope`/`start_url`.

## Deploying

- **Frontend**: push to `main`. [.github/workflows/static.yml](.github/workflows/static.yml) uploads the **entire repo** to GitHub Pages — no build. Live at https://ashershores5.github.io/NutriSageAI.
- **Backend**: `cd backend && ./deploy.sh` (packages + updates the Lambda; role/API already exist).

## AWS backend (account 334772842524, us-east-1)

- Lambda `nutrisageai-macro`, HTTP API `nutrisageai-api` (id `q8f8dfzb0j`), DynamoDB `nutrisageai-data` (on-demand), IAM role `nutrisageai-macro-role` (least-privilege: `bedrock:InvokeModel` on the one model + `GetItem`/`PutItem`/`Query` on the one table + logging).
- **Adding a family member**: add the name to `PROFILES` in [docs/script.js](docs/script.js), generate a secret, and add its SHA-256 hash to the Lambda's `USER_SECRETS` env var. No schema change (new user = new `pk`).
- **Why API Gateway, not a Lambda Function URL**: an Organizations SCP blocks public Function URLs (they 403 even with a correct resource policy). API Gateway is allowed. Don't waste time re-trying Function URLs here.
- **Abuse controls**: HTTP API throttled to 5 req/s, burst 10; account Lambda concurrency cap is 10 (hard blast-radius limit); a $10 zero-spend AWS budget acts as a cost tripwire. CORS is locked to the GitHub Pages origin + localhost:8000.

## Gotchas that will bite you

- **API endpoint is hardcoded** as `API_URL` in [docs/script.js](docs/script.js) — no `.env`/config. If you redeploy the API and the ID changes, update this string. CORS is origin-locked, so `file://` won't work; serve over http on port 8000 when testing the fetch path.
- **Bedrock model access** is region- and account-gated and must be an *active* (non-legacy) inference profile — hence the `us.` prefix. On-demand invocation of the bare model ID fails; use the inference profile ID.
- **Model choice is cost-driven**: Haiku 4.5 ($1/$5 per Mtok) is the deliberate pick for this simple JSON-estimation task — a Sonnet/Opus upgrade lives in one env var (`MODEL_ID` in the Lambda) if quality ever needs it.
- The frontend keeps macro summing tolerant of junk API responses (`Number(x) || 0`); don't "simplify" that away — it prevents `NaN` totals.
