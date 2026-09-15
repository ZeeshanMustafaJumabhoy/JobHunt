"""A resume health check against common ATS (Applicant Tracking System) rules.

The checklist here is the standard, widely published ATS guidance: standard
section headings, no tables/columns/images an ATS parser can't read, plain
fonts, keyword overlap with the roles the person wants, action verbs over
weak openers like "responsible for", and achievements backed by a number.
The model reads the resume once and scores it against that checklist; this
module builds the prompt and makes sense of what comes back.
"""

import re

from .llm import Provider, ask_json
from .profile import Profile

RESUME_CHAR_LIMIT = 14000
CATEGORIES = ("Keywords", "Formatting", "Impact and metrics", "Action verbs", "Structure and length")
STATUSES = ("good", "warning", "bad")


def _str_list(value, limit: int, item_len: int) -> list[str]:
    if not isinstance(value, list):
        return []
    seen, out = set(), []
    for v in value:
        s = re.sub(r"\s+", " ", str(v or "")).strip()[:item_len]
        if s and s.lower() not in seen:
            seen.add(s.lower())
            out.append(s)
    return out[:limit]


def scan_prompt(profile: Profile, job: dict | None = None) -> str:
    if job:
        target = f"""THE JOB TO TAILOR IT FOR
Title: {job.get('title')}
Company: {job.get('company')}
Description: {(job.get('description') or '')[:4000]}"""
    else:
        target = f"""THE ROLES THEY'RE APPLYING TO
{', '.join(profile.titles or profile.suggested_titles) or 'not stated'}
Key skills already on file: {', '.join(profile.skills) or 'not listed'}"""

    return f"""You are an ATS (Applicant Tracking System) resume checker and a practical
recruiter. Read this resume text exactly as an ATS parser would: linear, plain
text, no visual layout.

RESUME
{profile.resume_text[:RESUME_CHAR_LIMIT]}

{target}

Check it against these standard ATS rules:
1. KEYWORDS: does it use the terms this role/these roles are actually described with,
   in context (not stuffed)? Are acronyms spelled out at least once?
2. FORMATTING: standard section headings (Experience, Education, Skills, not creative
   ones)? Any sign of tables, columns or graphics that garbled the extracted text?
3. IMPACT AND METRICS: what share of bullets show a measurable result (a percentage,
   amount, volume, or time saved), rather than just a duty?
4. ACTION VERBS: does it lead with strong verbs (led, built, reduced, launched), or
   weak openers like "responsible for", "helped with", "assisted in"?
5. STRUCTURE AND LENGTH: sensible length for the experience shown, a clear summary,
   contact info, and no missing standard sections.

Score realistically: a resume with no numbers, generic verbs, or missing sections should
score under 60, even if it reads fine. Only strong, well-tailored resumes score 85+.

Return ONLY a JSON object:
{{"score": <0-100>,
  "summary": "one plain sentence verdict",
  "checks": [{{"category": "Keywords|Formatting|Impact and metrics|Action verbs|Structure and length",
               "status": "good|warning|bad", "note": "one short sentence, specific to this resume"}}],
  "suggestions": ["up to 6 concrete edits, each one sentence, each naming what to change and why"]}}
Include exactly one check per category, in that order."""


def _checks(value) -> list[dict]:
    if not isinstance(value, list):
        return []
    out = []
    seen = set()
    for item in value:
        if not isinstance(item, dict):
            continue
        cat = str(item.get("category") or "").strip()
        matched = next((c for c in CATEGORIES if c.lower() == cat.lower()), None)
        if not matched or matched in seen:
            continue
        seen.add(matched)
        status = str(item.get("status") or "").strip().lower()
        note = str(item.get("note") or "").strip()[:200]
        out.append({
            "category": matched,
            "status": status if status in STATUSES else "warning",
            "note": note,
        })
    return out


def parse_scan(data: dict) -> dict:
    try:
        score = max(0, min(100, int(float(data.get("score", 0)))))
    except (TypeError, ValueError):
        score = 0
    return {
        "score": score,
        "summary": str(data.get("summary") or "").strip()[:300],
        "checks": _checks(data.get("checks")),
        "suggestions": _str_list(data.get("suggestions"), limit=6, item_len=200),
    }


def scan_resume(profile: Profile, providers: list[Provider], job: dict | None = None) -> dict:
    data, _ = ask_json(scan_prompt(profile, job), providers, max_tokens=1400)
    return parse_scan(data)
