# Shortlist

A job search assistant that runs on your own computer. It searches job boards and company career pages, reads every posting against your resume with AI, and keeps the ones you could actually get: the right role, the right level, and a place you can work from, visa included.

Built for people looking for their next job after a layoff, who don't have time to read four hundred postings to find the twelve worth applying to.

**Just want to see the UI first?** Open the hosted preview — it runs entirely in your browser with sample data, no install and no account needed: **https://jobhuntbyai.netlify.app/?preview=1**

## What it does

- **Reads your resume once** and pulls out your skills, experience and the titles you're suited for.
- **Asks what you want**, one question at a time: titles, remote or on-site, countries, visa sponsorship, salary floor, dealbreakers, and how close a match has to be before it's worth showing you.
- **Searches** remote job boards, Google for Jobs (JSearch), Jooble, Adzuna, company career pages, and optionally LinkedIn.
- **Ranks by reachability.** Jobs in your target countries and worldwide remote roles come first. An on-site role abroad that can't sponsor you is marked, not buried.
- **Explains each match**: which of your skills it wants, what you'd need to learn, whether it sponsors visas, what it pays when the posting says, and what to change on your resume for that specific job.
- **Scores your resume like an ATS would** — keywords, formatting, action verbs, quantified impact — and tells you exactly what to fix, on demand.
- **Emails you a daily shortlist** from your own Gmail, if you want.

## Privacy

Everything stays on your machine. API keys are written to `.env` in this folder, your profile and found jobs to `data/`. Both are in `.gitignore`. The server only listens on `127.0.0.1` and refuses requests from other websites. Your resume is sent to Groq, the AI provider you choose, and nowhere else.

## Get started

You need **Python 3.11+** and **Node.js 20+** installed on your machine before anything else. Check what you have:

```bash
python3 --version
node --version
```

Then, from a terminal:

```bash
git clone https://github.com/ZeeshanMustafaJumabhoy/JobHunt.git
cd JobHunt
python start.py
```

That one command does everything else for you: it creates a local Python environment in `.venv/`, installs the backend's dependencies into it, installs the frontend's dependencies into `frontend/node_modules/`, builds the interface, and opens `http://localhost:8421` in your browser. The on-screen setup walks you through the rest — connecting a free AI key, adding your resume, and picking what you're looking for.

Nothing is installed globally and nothing leaves this folder. Re-running `python start.py` later is instant — it only reinstalls when a dependency file has actually changed.

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

## How it works

Shortlist is two small programs that talk to each other over HTTP, both running on your own machine:

- **`backend/`** — a Python [FastAPI](https://fastapi.tiangolo.com/) server. It owns your profile, talks to the job sources and to Groq/OpenRouter, ranks and stores results in a local SQLite database (`data/shortlist.db`), and serves the built frontend. It only ever listens on `127.0.0.1`.
- **`frontend/`** — a [React](https://react.dev/) + [Vite](https://vite.dev/) single-page app: the setup wizard, the dashboard, the resume score page. It talks to the backend under `/api/*`.

A search run goes through the pipeline in `backend/shortlist/pipeline.py`:

1. **Search** every enabled source (`sources.py`) for your job titles.
2. **Filter** out duplicates, postings you've already seen, and ones that fail free rule checks (title excludes, years required, location) — before spending any AI budget on them.
3. **Bucket and prioritize** what's left by reachability (your target countries first, then worldwide remote, then home country, then everywhere else) and split your daily AI budget across those buckets.
4. **Score** each posting with the AI (`llm.py`): fit, seniority, sponsorship, salary, and specific resume tips for that job.
5. **Store** everything scoring above your match threshold (`store.py`), so the dashboard can show it and a later run never re-reads the same posting.

The resume score page (`ats.py`) is a separate, on-demand check: it reads your resume text once and scores it against standard ATS rules — keywords, formatting, action verbs, quantified impact, structure — independent of any specific job.

**Preview mode** (`frontend/src/preview/`) is a frontend-only way to click through every screen with sample data and no backend at all — that's what the hosted Netlify link above runs. Add `?preview=1` to any URL locally to try it the same way. It never calls a real API and never saves anything; without that flag the app behaves exactly as normal.

## Project layout

```
start.py                   one-command launcher: installs everything, builds, opens the browser
netlify.toml                build config for the static, backend-less hosted preview

backend/
  shortlist/
    api.py                  the local HTTP API and the daily scheduler
    pipeline.py              fetch, dedupe, filter, rank, score
    sources.py               every job source, plus career page URL parsing
    llm.py                   Groq and OpenRouter: resume reading and job scoring
    ats.py                   the ATS resume scanner
    countries.py             country names, cities and region words
    profile.py               the search profile saved in data/profile.json
    envfile.py               safe reads and writes of .env
    store.py                 SQLite storage for jobs, runs and resume scans
    resume.py, keys.py, notify.py, paths.py, text.py
  tests/                     pytest

frontend/
  src/
    App.tsx, api.ts          shell, routing and the typed API client
    setup/                   the step-by-step setup wizard
    jobs/                    the dashboard and job cards
    resume/                  the resume score page
    settings/                every setup answer, editable later
    preview/                 sample data and state for ?preview=1
    ui/                      shared components (buttons, fields, the loader, …)
  e2e/                       Playwright tests against a fake API
```

## Development

```bash
python start.py --dev          # Vite with hot reload on :5173, API on :8421

# backend
cd backend
../.venv/bin/python -m pip install -r requirements-dev.txt   # Windows: ..\.venv\Scripts\python
../.venv/bin/python -m pytest

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
- **Match threshold** (Settings, Preferences) sets the minimum score, from 40 to 90, a posting needs before it's shown at all.
- **AI budget** is the number of postings read per search (Settings, Recency). Each takes about three seconds on the free Groq plan.
- **Models** can be changed without code: set `GROQ_MODEL` or `OPENROUTER_MODELS` (comma separated, up to three) in `.env`.
- **Company career pages** are added by pasting the link to a company's job list. Greenhouse, Lever, Ashby, Workable, SmartRecruiters and Recruitee are supported.

## Contributing

Issues and pull requests are welcome. If something's broken, a job source stops working, or you have an idea for a better feature, please open an issue describing it. For a pull request:

1. Fork the repo and create a branch for your change.
2. Before opening the PR, run what CI runs: in `backend/`, `ruff check shortlist tests` and `pytest -q`; in `frontend/`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run test:e2e`.
3. Describe what changed and why in the PR description.

## License

MIT
