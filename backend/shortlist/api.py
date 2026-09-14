"""The local HTTP API the frontend talks to.

It listens on 127.0.0.1 only. Because any website the user visits could still
try to call a localhost port, every API request must also:
  - carry a Host header of localhost/127.0.0.1 (blocks DNS rebinding), and
  - carry the X-Shortlist header, which a cross-site page can't add without a
    CORS preflight, and this server never approves one.
"""

import re
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, ValidationError

from . import countries, envfile, keys, llm, notify, pipeline, profile, resume, sources, store
from .paths import frontend_dist

runner = pipeline.Runner()


@asynccontextmanager
async def lifespan(_app):
    envfile.load_into_environ()
    store.mark_interrupted_runs()
    threading.Thread(target=_scheduler_loop, daemon=True).start()
    yield


app = FastAPI(title="Shortlist", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

_ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]"}
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@app.middleware("http")
async def local_only(request: Request, call_next):
    host = (request.headers.get("host") or "").rsplit(":", 1)[0].lower()
    if host not in _ALLOWED_HOSTS:
        return JSONResponse({"detail": "Shortlist only answers on localhost."}, status_code=403)
    if request.url.path.startswith("/api/"):
        if request.headers.get("x-shortlist") != "1":
            return JSONResponse({"detail": "Missing X-Shortlist header."}, status_code=403)
        origin = request.headers.get("origin")
        if origin and re.sub(r"^https?://", "", origin).rsplit(":", 1)[0].lower() not in _ALLOWED_HOSTS:
            return JSONResponse({"detail": "Cross-site requests are not allowed."}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def _bad(message: str, status: int = 400):
    raise HTTPException(status_code=status, detail=message)


# ---------------- state ----------------

def _public_profile(p: profile.Profile) -> dict:
    d = p.model_dump()
    d["has_resume"] = bool(d.pop("resume_text"))
    return d


@app.get("/api/state")
def get_state():
    p = profile.load()
    return {
        "keys": envfile.status(),
        "ai_ready": bool(llm.build_providers()),
        "profile": _public_profile(p),
        "run": runner.state.public(),
        "last_run": store.last_run(),
        "counts": store.counts(),
    }


@app.get("/api/reference")
def get_reference():
    return {"countries": countries.as_options(), "groups": countries.GROUPS}


# ---------------- keys ----------------

class KeyBody(BaseModel):
    key: str = Field(default="", max_length=300)
    app_id: str = Field(default="", max_length=100)
    app_key: str = Field(default="", max_length=100)
    address: str = Field(default="", max_length=200)
    app_password: str = Field(default="", max_length=100)
    recipient: str = Field(default="", max_length=200)


KeyName = Literal["groq", "openrouter", "adzuna", "jooble", "rapidapi", "gmail"]
_ENV_NAMES = {
    "groq": ["GROQ_API_KEY"], "openrouter": ["OPENROUTER_API_KEY"],
    "adzuna": ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"], "jooble": ["JOOBLE_API_KEY"],
    "rapidapi": ["RAPIDAPI_KEY"], "gmail": ["GMAIL_ADDRESS", "GMAIL_APP_PASSWORD", "RECIPIENT_EMAIL"],
}


@app.post("/api/keys/{name}")
def save_key(name: KeyName, body: KeyBody):
    b = body.model_copy(update={k: v.strip() for k, v in body.model_dump().items()})
    if name == "groq":
        if not b.key:
            _bad("Paste your Groq API key.")
        ok, message = keys.check_groq(b.key)
        updates = {"GROQ_API_KEY": b.key}
    elif name == "openrouter":
        if not b.key:
            _bad("Paste your OpenRouter API key.")
        ok, message = keys.check_openrouter(b.key)
        updates = {"OPENROUTER_API_KEY": b.key}
    elif name == "adzuna":
        if not (b.app_id and b.app_key):
            _bad("Adzuna needs both the app ID and the app key.")
        ok, message = keys.check_adzuna(b.app_id, b.app_key)
        updates = {"ADZUNA_APP_ID": b.app_id, "ADZUNA_APP_KEY": b.app_key}
    elif name == "jooble":
        if not b.key:
            _bad("Paste your Jooble API key.")
        ok, message = keys.check_jooble(b.key)
        updates = {"JOOBLE_API_KEY": b.key}
    elif name == "rapidapi":
        if not b.key:
            _bad("Paste your RapidAPI key.")
        ok, message = keys.check_rapidapi(b.key)
        updates = {"RAPIDAPI_KEY": b.key}
    else:
        if not _EMAIL_RE.match(b.address):
            _bad("Enter a valid Gmail address.")
        if b.recipient and not _EMAIL_RE.match(b.recipient):
            _bad("Enter a valid address to send the digest to, or leave it empty.")
        ok, message = keys.check_gmail(b.address, b.app_password)
        updates = {"GMAIL_ADDRESS": b.address, "GMAIL_APP_PASSWORD": b.app_password.replace(" ", ""),
                   "RECIPIENT_EMAIL": b.recipient or None}
    if not ok:
        return JSONResponse({"ok": False, "message": message}, status_code=422)
    envfile.write_env(updates)
    return {"ok": True, "message": message, "keys": envfile.status()}


@app.delete("/api/keys/{name}")
def delete_key(name: KeyName):
    if name == "groq" and profile.load().setup_complete:
        _bad("Groq is required. Save a new key instead of removing it.")
    envfile.write_env({k: None for k in _ENV_NAMES[name]})
    return {"ok": True, "keys": envfile.status()}


# ---------------- resume and titles ----------------

@app.post("/api/resume")
async def upload_resume(file: UploadFile = File(...)):
    if not llm.build_providers():
        _bad("Add your Groq API key first. Reading the resume needs it.")
    data = await file.read(resume.MAX_BYTES + 1)
    try:
        text = await run_in_threadpool(resume.extract_text, file.filename or "", data)
    except resume.ResumeError as e:
        _bad(str(e))
    try:
        facts = await run_in_threadpool(llm.analyze_resume, text)
    except llm.LLMError as e:
        _bad(str(e), 502)

    current = profile.load()
    years = facts["years_experience"]
    changes = {
        "resume_text": text,
        "name": facts["name"], "headline": facts["headline"], "summary": facts["summary"],
        "skills": facts["skills"], "years_experience": years, "seniority": facts["seniority"],
        "suggested_titles": facts["suggested_titles"], "title_keywords": facts["title_keywords"],
        "home_country": current.home_country or facts["home_country"],
        "exclude_title_words": current.exclude_title_words or profile.default_exclusions(years),
        "max_years_required": current.max_years_required or profile.default_max_years(years),
    }
    return _public_profile(profile.update(changes))


class TitlesBody(BaseModel):
    titles: list[str] = Field(max_length=15)


@app.post("/api/titles")
def save_titles(body: TitlesBody):
    titles = [t.strip()[:80] for t in body.titles if t.strip()]
    if not titles:
        _bad("Pick or add at least one job title.")
    current = profile.load()
    keywords = list(current.title_keywords)
    try:
        keywords = llm.expand_titles(titles) or keywords
    except llm.LLMError:
        pass  # the typed titles alone still work as keywords
    return _public_profile(profile.update({"titles": titles, "title_keywords": keywords}))


# ---------------- profile ----------------

_PATCHABLE = set(profile.Profile.model_fields) - {"resume_text", "suggested_titles"}


@app.patch("/api/profile")
async def patch_profile(request: Request):
    try:
        changes = await request.json()
    except ValueError:
        _bad("Expected a JSON body.")
    if not isinstance(changes, dict):
        _bad("Expected a JSON object.")
    unknown = set(changes) - _PATCHABLE
    if unknown:
        _bad(f"Unknown fields: {', '.join(sorted(unknown))}")
    try:
        updated = profile.update(changes)
    except ValidationError as e:
        first = e.errors()[0]
        field = ".".join(str(x) for x in first["loc"])
        _bad(f"{field}: {first['msg']}")
    return _public_profile(updated)


class CareerUrlBody(BaseModel):
    url: str = Field(max_length=500)


@app.post("/api/career-pages")
def add_career_page(body: CareerUrlBody):
    page = sources.parse_career_url(body.url)
    if not page:
        _bad("That link isn't a Greenhouse, Lever, Ashby, Workable, SmartRecruiters or Recruitee "
             "careers page. Open the company's job list and copy that address.")
    try:
        openings = sources.check_career_page(page)
    except Exception:
        _bad(f"Couldn't read the {page.provider.title()} board \"{page.slug}\". Check the link.")
    current = profile.load()
    pages = [p for p in current.career_pages if (p.provider, p.slug) != (page.provider, page.slug)]
    pages.append(page)
    updated = profile.update({"career_pages": [p.model_dump() for p in pages]})
    return {"profile": _public_profile(updated), "openings": openings, "page": page.model_dump()}


# ---------------- runs and jobs ----------------

def _email_matches(run_id: int, matches: list[dict]) -> None:
    try:
        notify.send_digest(matches)
        runner.log("Digest email sent.")
    except Exception as e:
        runner.log(f"Couldn't send the digest email: {e}")


@app.post("/api/run")
def start_run():
    p = profile.load()
    if not llm.build_providers():
        _bad("Add your Groq API key before searching.")
    if not p.titles:
        _bad("Add at least one job title before searching.")
    if not runner.start(p, "manual"):
        _bad("A search is already running.", 409)
    return runner.state.public()


@app.get("/api/run")
def run_status():
    return runner.state.public()


@app.post("/api/run/stop")
def stop_run():
    runner.stop()
    return runner.state.public()


@app.get("/api/jobs")
def get_jobs(min_score: int = 50, status: str | None = None, run_id: int | None = None):
    if status and status not in store.STATUSES:
        _bad("Unknown status.")
    return {"jobs": store.list_jobs(min_score=min_score, status=status, run_id=run_id)}


class StatusBody(BaseModel):
    status: Literal["new", "saved", "applied", "hidden"]


@app.patch("/api/jobs/{job_id}")
def set_job_status(job_id: str, body: StatusBody):
    if not store.set_status(job_id, body.status):
        _bad("Job not found.", 404)
    return {"ok": True}


@app.get("/api/runs")
def get_runs():
    return {"runs": store.list_runs()}


@app.post("/api/digest/test")
def test_digest():
    jobs = store.list_jobs(min_score=50, limit=10)
    try:
        notify.send_digest(jobs)
    except Exception as e:
        _bad(f"Couldn't send the email: {e}")
    return {"ok": True, "message": f"Sent a test digest with {len(jobs)} jobs."}


@app.post("/api/history/clear")
def clear_history():
    if runner.state.running:
        _bad("Stop the running search first.", 409)
    store.forget_all()
    return {"ok": True}


# ---------------- daily schedule ----------------

def _scheduler_loop():
    while True:
        time.sleep(30)
        try:
            p = profile.load()
            if not (p.setup_complete and p.digest_enabled) or runner.state.running:
                continue
            now = datetime.now()
            if now.strftime("%H:%M") < p.digest_time:
                continue
            last = store.last_run("scheduled")
            if last and datetime.fromisoformat(last["started_at"]).astimezone().date() == now.date():
                continue
            runner.start(p, "scheduled", on_done=_email_matches)
        except Exception as e:  # never let the scheduler thread die
            runner.log(f"Scheduler error: {e}")


# ---------------- frontend ----------------

@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    dist = frontend_dist().resolve()
    if path.startswith("api/"):
        _bad("Not found.", 404)
    target = (dist / path).resolve()
    if path and target.is_file() and dist in target.parents:
        return FileResponse(target)
    index = dist / "index.html"
    if index.exists():
        return FileResponse(index)
    return JSONResponse({"detail": "The frontend isn't built yet. Run: python start.py"}, status_code=503)
