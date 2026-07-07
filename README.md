# README - NutriSageAI Project
## Project Overview
NutriSageAI is a web-based AI-enabled fitness and nutrition service. It helps users track their nutrition information, discover meal ideas, and receive personalized workout plans. NutriSageAI integrates with the GPT API to interpret unformatted natural language inputs from users, then retrieves and displays corresponding nutritional information.

[Test Site](https://ashershores5.github.io/NutriSageAI)

![image](https://github.com/asherShores5/NutriSageAI/assets/71547146/393c3c4b-3d75-4f83-a535-4306ecbe26bf)


### Key Features
- Nutrition Tracker: Users can input their meals in unformatted natural language. The input is sent to an AI-backed API that returns estimated macros (carbs, protein, fat, calories). Entries and daily totals are saved locally in the browser.

### Planned / Not Yet Built
These are intended features that do **not** exist in the current codebase:
- Workout Planner: AI-suggested workout ideas and plans.
- User Accounts: registration and unlocking additional features.
- Server-side persistence: saving data beyond the local browser (would require a backend + database).

## Tech Stack
The frontend is a **static, client-side-only Progressive Web App**. The macro backend is a single
serverless function; its source lives in [backend/](backend/).

1. Frontend: HTML, CSS, JavaScript (vanilla), hosted on GitHub Pages (auto-deploy on push to `main`)
2. Storage: browser `localStorage` (per-device, no accounts yet)
3. Macro estimation: AWS Lambda + HTTP API Gateway, using Amazon Bedrock (Claude) — see [backend/README.md](backend/README.md)

## Contribute
Contributions to NutriSageAI are always welcome! Here's how you can help:

- Report bugs
- Suggest new features
- Write or update documentation
- Suggest bug fixes or identify potential issues
