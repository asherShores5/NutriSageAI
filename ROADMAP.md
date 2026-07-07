# NutriSageAI — Roadmap / Future Updates

_Living planning doc. The app is a working single-user macro tracker; everything here is optional and ordered by value-for-effort. Replaces the old one-shot STATE_OF_REPO assessment._

Guiding constraint: **stay serverless and client-side.** Accounts + server-side saved data are explicitly deferred (see Phase 3) — don't build a backend/DB until there's a real multi-device or shared-data need.

## Now / done (for context)

- ✅ Frontend hardened: XSS-safe DOM rendering, error+loading UI, input preserved on failure, macro validation, Enter-to-submit, network-first service worker.
- ✅ Backend live: Lambda + HTTP API + Bedrock (Claude Haiku 4.5), source in [backend/](backend/).
- ✅ Abuse controls: API throttling (5 req/s), account concurrency cap (10), $10 budget tripwire, origin-locked CORS.

## Phase 1 — cheap hardening (low effort, do next)

- [ ] **CloudWatch alarm on Lambda errors + throttles** → SNS email. The budget catches cost; this catches breakage. ~15 min.
- [ ] **Cache identical lookups** — same `foodItem` string hits Bedrock every time today. A small `localStorage` cache on the client (keyed by normalized food string) cuts cost and latency for repeat entries. Client-side only, no infra.
- [ ] **Basic request validation in the Lambda** — cap `foodItem` length (e.g. 200 chars) before calling Bedrock, so a huge payload can't run up token cost. One `if` in [backend/lambda_function.py](backend/lambda_function.py).
- [ ] **Per-IP rate limit** — current throttle is global (one abuser can starve everyone). If abuse shows up, add a WAF rate-based rule or API Gateway usage plan keyed per IP. Skipped for now (YAGNI until traffic warrants it).

## Phase 2 — product polish (medium effort, when you want to grow usage)

- [ ] **Edit an entry** (fix a wrong macro / quantity) instead of remove-and-re-add.
- [ ] **Per-item quantity / serving size** — currently one food string = one lookup.
- [ ] **Daily goal targets** — let the user set carb/protein/fat/calorie goals and show progress vs. totals.
- [ ] **Multi-day history** — keep prior days in `localStorage` (still no backend) with a date switcher. This is the natural stepping stone before accounts.
- [ ] **Better model prompt** — return a confidence or "couldn't identify" signal so the UI can flag guesses, rather than silently returning zeros.

## Phase 3 — accounts + saved data (deferred, high effort)

Only start when there's a concrete need to sync across devices or share data. Options, cheapest first:

- **Static-friendly auth + storage**: a hosted BaaS (e.g. a serverless auth + document store) keeps the "no server to run" property. Least new infra.
- **Extend the existing AWS footprint**: Cognito (auth) + DynamoDB (per-user entries) + a couple more Lambda routes on the same HTTP API. More control, more to operate.

Migration note: today's `localStorage['foodEntries']` shape (`[{food, macros:{carbs,protein,fat,calories}}]`) is what any sync layer must import — keep it stable, or write a one-time migration.

## Explicitly NOT doing (YAGNI)

- Workout planner (README "planned feature") — no demand, large scope. Revisit only if requested.
- A build system / framework migration — 5 source files don't need one.
- Server-side rendering / SEO work — it's a personal tool, not a content site.
