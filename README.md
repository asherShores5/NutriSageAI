# README - NutriSageAI Project
## Project Overview
NutriSageAI is a Progressive Web App that helps a small family track daily food nutrition. You type a
meal in plain language ("2 eggs and toast"); Amazon Bedrock (Claude) estimates its nutrition and it's
logged. Data is cached locally for instant, offline-capable use and synced across devices per user.

[Live Site](https://ashershores5.github.io/NutriSageAI)

![image](https://github.com/asherShores5/NutriSageAI/assets/71547146/393c3c4b-3d75-4f83-a535-4306ecbe26bf)


### Key Features
- **Nutrition tracker** — natural-language food entry → AI-estimated `carbs, protein, fat, fiber` (g),
  `sodium, iron` (mg), and `calories`. Entries are grouped by meal (breakfast/lunch/dinner/snack) with an
  optional portion multiplier and one-tap quick-add of past foods.
- **Profiles** — per-family-member data, secret-gated. A device remembers keys it has seen, so switching
  profiles is one tap.
- **Progress & goals** — daily and weekly progress bars against per-nutrient goals (macros and
  micronutrients shown separately).
- **Week & Trends** — logging streak, daily averages, and a 30-day trend chart per nutrient.
- **Water tracking** — optional per-day cup count with a goal.
- **Cross-device sync** — every profile's data syncs via the backend; the app still works offline from the
  local cache.
- **Dark mode**, installable PWA.

### Not Yet Built
- Workout Planner: AI-suggested workout ideas and plans.
- Barcode scanning for packaged foods (under discussion).

## Tech Stack
The frontend is a **static, client-side-only Progressive Web App** (no build step). The backend is a single
serverless function; its source lives in [backend/](backend/).

1. Frontend: HTML, CSS, JavaScript (vanilla), hosted on GitHub Pages (auto-deploy on push to `main`)
2. Storage: browser `localStorage` as the working copy; per-user server sync via DynamoDB
3. AI + sync backend: AWS Lambda + HTTP API Gateway, using Amazon Bedrock (Claude) — see [backend/README.md](backend/README.md)

## For contributors / new sessions
Architecture, deploy steps, and gotchas are documented in [CLAUDE.md](CLAUDE.md) and
[backend/README.md](backend/README.md). Run the pure-logic tests with `node docs/macros.test.js`.

## Contribute
Contributions to NutriSageAI are always welcome! Here's how you can help:

- Report bugs
- Suggest new features
- Write or update documentation
- Suggest bug fixes or identify potential issues
