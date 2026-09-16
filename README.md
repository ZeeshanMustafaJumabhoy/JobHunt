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

You need **Python 3.11+** and **Node.js 20+** installed on your machine before anything else — but they don't have to be the ones your terminal runs by default; see the note below. Check what you have:

```bash
python3 --version
node --version
```

Then, from a terminal:

```bash
git clone https://github.com/ZeeshanMustafaJumabhoy/JobHunt.git
cd JobHunt
python3 start.py
```

(On Windows, use `python start.py` — Windows installs Python as `python`, not `python3`.)

That one command does everything else for you: it creates a local Python environment in `.venv/`, installs the backend's dependencies into it, installs the frontend's dependencies into `frontend/node_modules/`, builds the interface, and opens `http://localhost:8421` in your browser. The on-screen setup walks you through the rest — connecting a free AI key, adding your resume, and picking what you're looking for.

Nothing is installed globally and nothing leaves this folder. Re-running `python3 start.py` later is instant — it only reinstalls when a dependency file has actually changed.

**If `python3 --version` shows something older than 3.11** (very common on macOS, which ships Python 3.9 with Xcode's command line tools): you don't need to fix that yourself. `start.py` looks for a newer Python already on your machine — for example one installed via `brew install python@3.13` — and uses that automatically, even though the command you typed was the older one. It only fails if there's truly no 3.11+ anywhere, in which case it tells you exactly what to install.

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

In plain words: Shortlist is really two small programs, both running on your own computer, that talk to each other.

- **The backend** is the "brain". It's a small Python program that remembers your resume and your answers, goes looking for jobs on your behalf, asks an AI to read each one, and saves the good ones. It never shows you anything directly — it just does the work.
- **The frontend** is the "face". It's what you actually see in your browser: the setup questions, the list of jobs, the resume score page. Every button you click sends a message to the backend and shows you what comes back.

When you run `python3 start.py`, both start together: the backend quietly starts listening in the background, and your browser opens showing the frontend, which talks to the backend behind the scenes.

When you click **Search now**, this is what happens, in order:

1. It looks for jobs matching your titles on every source you've turned on.
2. It throws away jobs you've already seen, and any that obviously don't fit (wrong title, asks for too many years, wrong country).
3. It sorts what's left by how reachable it actually is for you — your target countries first, then worldwide remote, then your home country, then everywhere else.
4. For each job, it asks the AI: "does this person fit this job, and why?" — and gets back a score, a reason, whether it sponsors visas, and specific tips for that job.
5. It saves every job that scores high enough to matter, so it shows up on your dashboard and a later search never wastes time reading it again.

The **Resume score** page works on its own: you click a button, it reads your resume once, and tells you how it would look to an automated résumé scanner (an ATS) — plus exactly what to fix.

For anyone digging into the code, here's where each piece of that actually lives:

| What | Where |
|---|---|
| The local API and the daily schedule | `backend/shortlist/api.py` |
| The steps above: search, filter, sort, score, save | `backend/shortlist/pipeline.py` |
| Every job source (boards, career pages) | `backend/shortlist/sources.py` |
| Talking to Groq/OpenRouter to read resumes and score jobs | `backend/shortlist/llm.py` |
| The resume-score checker | `backend/shortlist/ats.py` |
| Saved jobs and run history (SQLite) | `backend/shortlist/store.py` |
| The setup wizard, the dashboard, the resume score page | `frontend/src/setup/`, `frontend/src/jobs/`, `frontend/src/resume/` |

**Preview mode** (`frontend/src/preview/`) is a frontend-only way to click through every screen with made-up sample data and no backend at all — that's what the hosted Netlify link above runs. Add `?preview=1` to any local URL to try it the same way. It never calls a real API and never saves anything; without that flag the app behaves exactly as normal.

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

`python3 start.py` is enough for normal use. The steps below are for working on the code itself — running each side on its own, with hot reload, and running the test suites.

### The quick way: both sides at once

```bash
python3 start.py --dev          # frontend with hot reload on :5173, backend API on :8421
```

### Backend only

```bash
cd backend
../.venv/bin/python -m pip install -r requirements-dev.txt          # install dependencies (Windows: ..\.venv\Scripts\python)
../.venv/bin/python -m uvicorn shortlist.api:app --host 127.0.0.1 --port 8421 --reload   # run it
../.venv/bin/python -m pytest                                       # run its tests
../.venv/bin/python -m ruff check shortlist tests                   # lint it
```

### Frontend only

```bash
cd frontend
npm install                    # install dependencies
npm run dev                    # run it, hot reload on :5173
npm test                       # run its unit tests
npx playwright install chromium   # one-time setup, before the next command
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
