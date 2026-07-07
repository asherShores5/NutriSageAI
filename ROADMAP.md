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

## Phase 3 — multi-user sync + shared data (IN PROGRESS)

Decision made: it's a family tool (2 people now, maybe more), used across phone + laptop, so cross-device
sync now justifies a backend. Staying on the existing AWS footprint (extend the Lambda + one DynamoDB table)
rather than adding Cognito or a new vendor — Cognito is overkill for a handful of trusted users.

### Design

- **Auth = per-user shared secret (not a browser-side check).** A client-side "login" gates nothing —
  `script.js` is public and the DynamoDB-backed endpoint is public. The *Lambda* is the gate: each person
  has a random secret; only its SHA-256 hash is stored server-side (env var `USER_SECRETS`). "Login" = pick
  your name → paste the secret once → cached in localStorage. Every data request sends `{user, secret}`; the
  Lambda hashes + compares before touching the table. No passwords, no Cognito, no reset flow. Secrets are
  **never** committed to the repo (same rule as `keys.md`).
- **One DynamoDB table `nutrisageai-data`, on-demand billing** (pennies at family scale, mostly free tier):
  ```
  PK          SK            item
  asher       2026-07-07    { entries:[...], updatedAt }     ← a day's log
  asher       goals         { carbs, protein, fat, calories } ← current goals, synced
  aubyn       2026-07-07    { entries:[...], updatedAt }
  household   meals         { library:[ {name, macros}, ...] } ← SHARED meal library
  ```
  Per-person days are private; `household/meals` is the shared library both read + append to (one-tap re-add).
  Adding a family member later = a new PK, no schema change.
- **Shared-data model chosen: separate logs + shared meal library.** Each person logs their own day; both
  pull from and add to a common "meals we make" pool.
- **Same Lambda, path-routed:** keep `POST /` (macros); add `GET /data` + `PUT /data` (secret-gated sync).
- **Conflict strategy: last-write-wins per day.** Each save writes the whole day with `updatedAt`; editing the
  same date on two devices means the later save wins. `// ponytail: LWW per day; per-entry merge only if it
  ever actually collides.` Real merge is a lot of code for a problem two people rarely hit.
- **localStorage stays the working copy** (instant, offline-friendly); the server is the sync layer.
  Online write-through first; add an offline queue only if the pain is felt.

### Build order (each phase independently usable)

**Phase A — backend sync (new infra):**
- [ ] DynamoDB table `nutrisageai-data` (on-demand) + extend IAM role (read/write that one table).
- [ ] Generate 2 secrets; store SHA-256 hashes in Lambda env var `USER_SECRETS`; hand secrets over out-of-band.
- [ ] Lambda: path routing + auth check + `GET /data` / `PUT /data`; `user=household` for the shared library.

**Phase B — frontend login + sync:**
- [ ] Profile picker → paste-secret-once → cached in localStorage.
- [ ] Write-through save + load-on-open; localStorage remains the working copy.

**Phase C — the daily-tool features (mostly frontend, now that data syncs):**
- [ ] Multi-day history + date navigation.
- [ ] Favorites/recent + shared meal library (one-tap re-add).
- [ ] Per-person goals (synced) + **daily & weekly progress bars**.

### Deferred within Phase 3 (YAGNI until felt)

- Family-member management UI — adding a member is a config row, not an admin screen.
- Offline write queue / real per-entry merge / realtime push.

Migration note: the pre-sync `localStorage['foodEntries']` shape (`[{food, macros:{...}}]`) is imported as
today's day on first login.

## Explicitly NOT doing (YAGNI)

- Workout planner (README "planned feature") — no demand, large scope. Revisit only if requested.
- A build system / framework migration — 5 source files don't need one.
- Server-side rendering / SEO work — it's a personal tool, not a content site.
