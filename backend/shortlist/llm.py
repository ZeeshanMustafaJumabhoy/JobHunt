"""The AI layer: reading a resume, suggesting titles, and judging job postings.

Two providers, tried in order. Groq is required and fast; OpenRouter is an
optional backup on a separate free quota, so one provider's rate limit doesn't
end a run. Both speak the OpenAI chat-completions format.
"""

import json
import os
import re
import time
from dataclasses import dataclass, field

import requests

from .profile import Profile

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Overridable from .env, because free model rosters change faster than releases.
DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
# OpenRouter rejects more than three models in one request.
DEFAULT_OPENROUTER_MODELS = [
    "nex-agi/nex-n2.5-pro:free",
    "nex-agi/nex-n2.5-mini:free",
    "dots-studio/dots-3-note-preview:free",
]

MAX_RETRIES = 3
MAX_CONSECUTIVE_FAILURES = 5
REQUEST_TIMEOUT = 60

VISA_VALUES = ("yes", "no", "unclear")
REMOTE_VALUES = ("onsite", "hybrid", "remote_regional", "remote_worldwide", "unclear")


class LLMError(Exception):
    """A failure worth showing the user as-is."""


@dataclass
class Provider:
    name: str
    url: str
    key: str
    models: list[str]
    mode: str                      # json_schema | json_object | plain
    delay: float
    headers: dict = field(default_factory=dict)
    exhausted: bool = False
    failures: int = 0


def build_providers() -> list[Provider]:
    out = []
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    if groq_key:
        out.append(Provider(
            name="Groq", url=GROQ_URL, key=groq_key,
            models=[os.environ.get("GROQ_MODEL") or DEFAULT_GROQ_MODEL],
            # Groq 400s on strict json_schema for this model; json_object works.
            mode="json_object", delay=2.5))
    or_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if or_key:
        models = [m.strip() for m in (os.environ.get("OPENROUTER_MODELS") or "").split(",") if m.strip()]
        out.append(Provider(
            name="OpenRouter", url=OPENROUTER_URL, key=or_key,
            models=(models or DEFAULT_OPENROUTER_MODELS)[:3],
            mode="json_object", delay=4.0,
            headers={"X-Title": "Shortlist"}))
    return out


_FORMATS = {"json_object": {"type": "json_object"}, "plain": None}
_NEXT_MODE = {"json_object": "plain", "plain": None}


def _is_daily_limit(text: str) -> bool:
    t = (text or "").lower()
    return any(s in t for s in ("per-day", "per day", "daily", "quota", "insufficient"))


def _chat(provider: Provider, prompt: str, max_tokens: int, log=print) -> str | None:
    """One provider, with retries. Returns the reply text, or None when this
    provider can't answer; marks it exhausted when the reason is permanent."""
    for attempt in range(MAX_RETRIES):
        body = {
            "model": provider.models[0],
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
            "max_tokens": max_tokens,
        }
        if len(provider.models) > 1:
            body["models"] = provider.models
        fmt = _FORMATS.get(provider.mode)
        if fmt:
            body["response_format"] = fmt

        try:
            r = requests.post(provider.url, json=body, timeout=REQUEST_TIMEOUT, headers={
                "Authorization": f"Bearer {provider.key}",
                "Content-Type": "application/json", **provider.headers})
        except requests.RequestException as e:
            log(f"[{provider.name}] request failed: {e.__class__.__name__}")
            time.sleep(2 ** attempt)
            continue

        if r.status_code == 429:
            if _is_daily_limit(r.text):
                log(f"[{provider.name}] daily limit reached")
                provider.exhausted = True
                return None
            wait = float(r.headers.get("retry-after", 0) or 0) or (2 ** attempt) * 5
            log(f"[{provider.name}] rate limited, waiting {min(wait, 60):.0f}s")
            time.sleep(min(wait, 60))
            continue
        if r.status_code in (401, 402):
            log(f"[{provider.name}] key rejected or out of credit")
            provider.exhausted = True
            return None
        if r.status_code == 403:
            log(f"[{provider.name}] 403: {r.text[:120]}")
            return None
        if r.status_code == 400:
            nxt = _NEXT_MODE.get(provider.mode)
            if nxt and any(s in r.text.lower() for s in ("response_format", "json", "schema")):
                provider.mode = nxt
                continue
            log(f"[{provider.name}] 400: {r.text[:200]}")
            return None
        try:
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
        except (requests.RequestException, KeyError, IndexError, TypeError, ValueError) as e:
            log(f"[{provider.name}] bad response: {e.__class__.__name__}")
            time.sleep(2 ** attempt)
    return None


def _loads(content: str | None) -> dict | None:
    content = (content or "").strip()
    if content.startswith("```"):
        content = re.sub(r"^```[a-zA-Z]*\s*|\s*```$", "", content).strip()
    try:
        parsed = json.loads(content)
    except ValueError:
        # Models sometimes wrap the JSON in a sentence. Take the outermost object.
        m = re.search(r"\{.*\}", content, re.S)
        if not m:
            return None
        try:
            parsed = json.loads(m.group(0))
        except ValueError:
            return None
    return parsed if isinstance(parsed, dict) else None


def ask_json(prompt: str, providers: list[Provider] | None = None,
             max_tokens: int = 1500, log=print) -> tuple[dict, str]:
    """Ask each live provider in turn for a JSON object. Returns (data, provider name)."""
    providers = providers if providers is not None else build_providers()
    if not providers:
        raise LLMError("Add your Groq API key first.")
    for provider in providers:
        if provider.exhausted:
            continue
        data = _loads(_chat(provider, prompt, max_tokens, log))
        if data is None:
            provider.failures += 1
            if provider.failures >= MAX_CONSECUTIVE_FAILURES:
                provider.exhausted = True
            continue
        provider.failures = 0
        return data, provider.name
    if all(p.exhausted for p in providers):
        raise LLMError("The AI provider's free limit is used up for now. Try again later, "
                       "or add an OpenRouter key as a backup.")
    raise LLMError("The AI didn't return a usable answer. Try again.")


# ---------------- helpers for parsing model output ----------------

def _str_list(value, limit: int = 50, item_len: int = 80) -> list[str]:
    if not isinstance(value, list):
        return []
    seen, out = set(), []
    for v in value:
        s = re.sub(r"\s+", " ", str(v or "")).strip()[:item_len]
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out[:limit]


def _enum(value, allowed, default):
    v = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    return v if v in allowed else default


def _int_or_none(value, lo=0, hi=10_000_000):
    try:
        n = int(float(value))
    except (TypeError, ValueError):
        return None
    return n if lo <= n <= hi else None


# ---------------- resume ----------------

RESUME_CHAR_LIMIT = 14000


def analyze_resume(resume_text: str, providers=None) -> dict:
    """Pull the facts the search needs out of a resume."""
    prompt = f"""Read this resume and extract facts for a job search tool.

RESUME
{resume_text[:RESUME_CHAR_LIMIT]}

Return ONLY a JSON object with these fields:
{{
  "name": "full name, or empty string",
  "headline": "current role in under 8 words, e.g. 'Backend engineer, payments'",
  "summary": "3-5 sentences in third person: experience, strongest skills, domains, notable results. Factual, no praise.",
  "years_experience": <total professional years as a number, internships count as half>,
  "seniority": "entry | junior | mid | senior | lead | executive",
  "skills": ["up to 30 concrete skills, tools, languages and methods named or clearly shown in the resume"],
  "home_country": "ISO 3166-1 alpha-2 code of where the person lives now, or empty string",
  "suggested_titles": ["8 to 12 job titles this person could realistically apply for next, most likely first, including adjacent roles"],
  "title_keywords": ["15 to 25 short lowercase phrases that appear in the titles of relevant postings, e.g. 'data analyst', 'bi developer'"]
}}
Do not invent anything that isn't supported by the resume."""
    data, _ = ask_json(prompt, providers, max_tokens=3000)
    years = data.get("years_experience")
    try:
        years = round(max(0.0, min(60.0, float(years))), 1)
    except (TypeError, ValueError):
        years = None
    return {
        "name": str(data.get("name") or "").strip()[:120],
        "headline": str(data.get("headline") or "").strip()[:120],
        "summary": str(data.get("summary") or "").strip()[:1500],
        "years_experience": years,
        "seniority": _enum(data.get("seniority"), ("entry", "junior", "mid", "senior", "lead", "executive"), ""),
        "skills": _str_list(data.get("skills"), 30),
        "home_country": str(data.get("home_country") or "").strip().upper()[:2],
        "suggested_titles": _str_list(data.get("suggested_titles"), 12),
        "title_keywords": [k.lower() for k in _str_list(data.get("title_keywords"), 30)],
    }


def expand_titles(titles: list[str], providers=None) -> list[str]:
    """Title variants postings use for the same job, so the keyword filter doesn't
    throw away "Engineer in Test" when the user typed "SDET"."""
    if not titles:
        return []
    prompt = f"""A job seeker is looking for these roles: {json.dumps(titles)}

List the short lowercase phrases that appear in the TITLES of postings for these roles,
including common synonyms, abbreviations and regional variants. 15 to 30 phrases,
each 1 to 4 words. Don't include seniority words like senior or junior on their own.

Return ONLY JSON: {{"title_keywords": ["..."]}}"""
    data, _ = ask_json(prompt, providers, max_tokens=1200)
    return [k.lower() for k in _str_list(data.get("title_keywords"), 40)]


# ---------------- job scoring ----------------

def _candidate_block(profile: Profile) -> str:
    from .countries import name_of
    home = name_of(profile.home_country) if profile.home_country else "not stated"
    targets = ", ".join(name_of(c) for c in profile.target_countries) or "anywhere"
    modes = ", ".join(profile.work_modes) or "any"
    salary = "not stated"
    if profile.salary.minimum:
        salary = f"at least {profile.salary.minimum:,} {profile.salary.currency} per {profile.salary.period}"
    lines = [
        f"Headline: {profile.headline or 'not stated'}",
        f"Experience: {profile.years_experience if profile.years_experience is not None else 'unknown'} years, {profile.seniority or 'level unknown'}",
        f"Summary: {profile.summary or profile.resume_text[:1500]}",
        f"Skills: {', '.join(profile.skills) or 'not listed'}",
        f"Wants roles like: {', '.join(profile.titles) or 'not stated'}",
        f"Lives in: {home}",
        f"Target countries: {targets}",
        f"Cities of interest: {', '.join(profile.cities) or 'any'}",
        f"Work arrangements accepted: {modes}",
        f"Needs visa sponsorship to work outside {home}: {'yes' if profile.needs_visa else 'no'}",
        f"Willing to relocate: {'yes' if profile.willing_to_relocate else 'no'}",
        f"Minimum salary: {salary}",
    ]
    if profile.dealbreakers.strip():
        lines.append(f"Dealbreakers: {profile.dealbreakers.strip()[:500]}")
    return "\n".join(lines)


def job_prompt(job: dict, profile: Profile) -> str:
    return f"""You are a practical recruiter screening ONE job posting for ONE candidate.

CANDIDATE
{_candidate_block(profile)}

JOB POSTING
Title: {job.get('title')}
Company: {job.get('company')}
Location: {job.get('location')}
Description: {job.get('description') or '(no description available)'}

Think through:
1. ROLE: is this the kind of role the candidate wants, or a close neighbour?
2. SKILLS: how much of what the posting asks for does the candidate have?
3. SENIORITY: does the experience asked for fit? A few years of stretch is normal.
4. REACHABILITY: could this candidate actually take this job from where they live,
   given the work arrangement, the country, and whether they need sponsorship?
   A worldwide remote role needs no visa. A role that is remote but limited to one
   country or region is "remote_regional".
5. SPONSORSHIP: "yes" only if the posting offers visa sponsorship or relocation; "no"
   only if it requires existing work authorisation; otherwise "unclear".
6. SALARY: copy any salary the posting states. Don't guess one.
7. DEALBREAKERS: if the posting hits one, score it under 25.
8. RESUME FIT: what, specifically, would make the candidate's resume read as a better
   match for THIS posting? Think like an ATS scan: missing keywords the posting uses,
   a skill the candidate has but didn't list, or a bullet that needs a number.

Scoring guide:
  85-100 right role, strong skill overlap, right level, and reachable
  70-84  good role in range with small gaps or an unclear location story
  50-69  relevant but compromised: skill drift, stretch seniority, or hard to reach
  25-49  adjacent but a poor fit
  0-24   not a fit

Return ONLY a JSON object. "reason" is ONE plain sentence of at most 20 words.
{{"score": <0-100>, "reason": "...",
  "visa_sponsorship": "yes|no|unclear",
  "remote_type": "onsite|hybrid|remote_regional|remote_worldwide|unclear",
  "years_required": <int or null>,
  "salary_min": <int or null>, "salary_max": <int or null>,
  "salary_currency": "<ISO code or empty>", "salary_period": "hour|month|year|",
  "matched_skills": ["candidate skills this job asks for, spelled as in the candidate's list"],
  "missing_skills": ["up to 5 things the job wants that the candidate lacks"],
  "resume_tips": ["up to 3 concrete edits to the resume that would help for THIS job, one sentence each"]}}"""


def parse_verdict(data: dict, profile: Profile) -> dict:
    try:
        score = max(0, min(100, int(float(data.get("score", 0)))))
    except (TypeError, ValueError):
        score = 0
    own = {s.lower(): s for s in profile.skills}
    matched = [own[s.lower()] for s in _str_list(data.get("matched_skills"), 20) if s.lower() in own]
    missing = [s for s in _str_list(data.get("missing_skills"), 8) if s.lower() not in own][:5]
    period = str(data.get("salary_period") or "").lower()
    return {
        "score": score,
        "reason": str(data.get("reason") or "").strip()[:300],
        "visa_sponsorship": _enum(data.get("visa_sponsorship"), VISA_VALUES, "unclear"),
        "remote_type": _enum(data.get("remote_type"), REMOTE_VALUES, "unclear"),
        "years_required": _int_or_none(data.get("years_required"), 0, 40),
        "salary_min": _int_or_none(data.get("salary_min")),
        "salary_max": _int_or_none(data.get("salary_max")),
        "salary_currency": re.sub(r"[^A-Z]", "", str(data.get("salary_currency") or "").upper())[:3],
        "salary_period": period if period in ("hour", "month", "year") else "",
        "matched_skills": matched,
        "missing_skills": missing,
        "resume_tips": _str_list(data.get("resume_tips"), 3, item_len=200),
    }


def evaluate_job(job: dict, profile: Profile, providers: list[Provider], log=print) -> dict | None:
    """Score one posting. None means scoring failed, so the job should be retried
    on a later run rather than remembered as seen."""
    try:
        data, name = ask_json(job_prompt(job, profile), providers, max_tokens=900, log=log)
    except LLMError:
        return None
    verdict = parse_verdict(data, profile)
    verdict["scored_by"] = name
    return verdict


def scoring_delay(providers: list[Provider]) -> float:
    live = [p.delay for p in providers if not p.exhausted]
    return max(live) if live else 0.0
