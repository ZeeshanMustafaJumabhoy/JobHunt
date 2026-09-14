# Shortlist

A job search assistant that runs on your own computer. It searches job boards and company career pages, reads every posting against your resume with AI, and keeps the ones you could actually get: the right role, the right level, and a place you can work from, visa included.

Built for people looking for their next job after a layoff, who don't have time to read four hundred postings to find the twelve worth applying to.

## What it does

- **Reads your resume once** and pulls out your skills, experience and the titles you're suited for.
- **Asks what you want**, one question at a time: titles, remote or on-site, countries, visa sponsorship, salary floor, dealbreakers.
- **Searches** remote job boards, Google for Jobs (JSearch), Jooble, Adzuna, company career pages, and optionally LinkedIn.
- **Ranks by reachability.** Jobs in your target countries and worldwide remote roles come first. An on-site role abroad that can't sponsor you is marked, not buried.
- **Explains each match**: which of your skills it wants, what you'd need to learn, whether it sponsors visas, and what it pays when the posting says.
- **Emails you a daily shortlist** from your own Gmail, if you want.

## Privacy

Everything stays on your machine. API keys are written to `.env` in this folder, your profile and found jobs to `data/`. Both are in `.gitignore`. The server only listens on `127.0.0.1` and refuses requests from other websites. Your resume is sent to Groq, the AI provider you choose, and nowhere else.

## Get started

You need **Python 3.11+** and **Node.js 20+**.

```bash
git clone https://github.com/<you>/shortlist.git
cd shortlist
python start.py
```

The first run installs everything into this folder and opens `http://localhost:8421`. Setup walks you through the rest.

### Keys you'll be asked for

| Service | Needed? | What it adds | Where to get it |
|---|---|---|---|
| Groq | Required | The AI that reads resumes and postings | [console.groq.com/keys](https://console.groq.com/keys) |
| OpenRouter | Optional | Backup AI when Groq's free limit runs out | [openrouter.ai/keys](https://openrouter.ai/keys) |
| RapidAPI (JSearch) | Optional | Google for Jobs: LinkedIn, Indeed, Glassdoor, local boards | [JSearch on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) |
| Jooble | Optional | Middle East, Asia, Eastern Europe | [jooble.org/api/about](https://jooble.org/api/about) |
| Adzuna | Optional | US, UK, Europe, India, Australia | [developer.adzuna.com](https://developer.adzuna.com/signup) |
| Gmail app password | Optional | Daily email digest | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |

All of them have free plans. Each key is tested against the real service before it's saved.

## A note on LinkedIn

The LinkedIn source reads LinkedIn's public, logged-out job search. LinkedIn's terms don't allow automated access, so it's **off by default** and you turn it on yourself. JSearch reaches most of the same postings through Google for Jobs.

## Project layout

```
start.py                 one-command launcher
backend/shortlist/
  api.py                 local HTTP API and the daily scheduler
  pipeline.py            fetch, dedupe, filter, rank, score
  sources.py             every job source, plus career page URL parsing
  llm.py                 Groq and OpenRouter: resume reading and job scoring
  countries.py           country names, cities and region words
  profile.py             the search profile saved in data/profile.json
  envfile.py             safe reads and writes of .env
  store.py               SQLite storage for jobs and runs
  resume.py, keys.py, notify.py
backend/tests/           pytest
frontend/src/
  setup/                 the step by step setup
  jobs/                  the shortlist
  settings/              every setup answer, editable later
frontend/e2e/            Playwright tests against a fake API
```

## Development

```bash
python start.py --dev          # Vite with hot reload on :5173, API on :8421

# backend
cd backend
../.venv/Scripts/python -m pip install -r requirements-dev.txt   # macOS/Linux: ../.venv/bin/python
../.venv/Scripts/python -m pytest

# frontend
cd frontend
npm test                       # unit tests
npx playwright install chromium
npm run test:e2e               # full setup flow and dashboard, desktop and mobile
npm run lint && npm run typecheck
```

The end-to-end tests never call real services: `frontend/e2e/fake-api.ts` stands in for the backend.

## Tuning

- **Search terms** are the first five job titles you pick. Similar titles are matched automatically.
- **AI budget** is the number of postings read per search (Settings, Recency). Each takes about three seconds on the free Groq plan.
- **Models** can be changed without code: set `GROQ_MODEL` or `OPENROUTER_MODELS` (comma separated, up to three) in `.env`.
- **Company career pages** are added by pasting the link to a company's job list. Greenhouse, Lever, Ashby, Workable, SmartRecruiters and Recruitee are supported.

## License

MIT
