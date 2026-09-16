"""Job sources. Every fetcher returns a list of plain job dicts:

    id, source, title, company, location, url, description, age_days, direct

Fetchers never raise. A source that is down or rate-limited logs one line and
returns what it has, because one flaky board must not cost the whole run.
"""

import html
import re
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from urllib.parse import urlparse

import requests

from . import countries, envfile
from .profile import CareerPage, Profile
from .text import clean_desc, days_old, norm, tidy

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/128.0 Safari/537.36"}
TIMEOUT = 20


# ---------------- title matching ----------------

class TitleMatcher:
    """Decides relevance from the job TITLE only. Descriptions mention every tool
    under the sun in passing, so matching them lets through unrelated roles."""

    def __init__(self, titles: list[str], keywords: list[str]):
        phrases = {norm(p) for p in keywords + titles if norm(p)}
        self.phrases = sorted(phrases, key=len, reverse=True)
        # Multi-word titles also match when all their words appear in any order,
        # so "Engineer, QA Automation" still counts for "QA Automation Engineer".
        self.word_sets = [set(norm(t).split()) for t in titles if len(norm(t).split()) >= 2]

    def __call__(self, title: str | None) -> bool:
        t = f" {norm(title)} "
        if t.strip() == "":
            return False
        if any(f" {p} " in t for p in self.phrases):
            return True
        words = set(t.split())
        return any(ws <= words for ws in self.word_sets)


@dataclass
class Context:
    profile: Profile
    log: Callable[[str], None] = print
    should_stop: Callable[[], bool] = lambda: False
    matcher: TitleMatcher = field(init=False)

    def __post_init__(self):
        self.matcher = TitleMatcher(self.profile.titles, self.profile.title_keywords)

    @property
    def queries(self) -> list[str]:
        return self.profile.titles[:5]

    @property
    def wants_remote(self) -> bool:
        return "remote" in self.profile.work_modes

    @property
    def place_codes(self) -> list[str]:
        codes = list(self.profile.target_countries)
        home = self.profile.home_country
        if home and home not in codes and ({"onsite", "hybrid"} & set(self.profile.work_modes)):
            codes.append(home)
        return codes


def _job(source, jid, title, company, location, url, description, raw_date, direct=False):
    return {
        "id": jid,
        "source": source,
        "title": tidy(title),
        "company": tidy(company) or "Unspecified",
        "location": tidy(location) or "Unspecified",
        "url": url or "",
        "description": clean_desc(description),
        "age_days": days_old(raw_date),
        "direct": direct,
    }


def _get_json(url, ctx: Context, label: str, **kwargs):
    try:
        r = requests.get(url, timeout=TIMEOUT, headers=kwargs.pop("headers", UA), **kwargs)
        r.raise_for_status()
        return r.json()
    except (requests.RequestException, ValueError) as e:
        ctx.log(f"{label}: skipped ({_why(e)})")
        return None


def _why(e: Exception) -> str:
    if isinstance(e, requests.HTTPError) and e.response is not None:
        return f"HTTP {e.response.status_code}"
    return e.__class__.__name__


# ---------------- remote job boards (no key) ----------------

def fetch_remoteok(ctx: Context) -> list[dict]:
    data = _get_json("https://remoteok.com/api", ctx, "RemoteOK")
    jobs = []
    for item in data or []:
        if not isinstance(item, dict) or "id" not in item:
            continue  # the first element is a legal notice
        if ctx.matcher(item.get("position")):
            jobs.append(_job("RemoteOK", f"remoteok-{item['id']}", item.get("position"),
                             item.get("company"), item.get("location") or "Remote",
                             item.get("url"), item.get("description"), item.get("date")))
    return jobs


def fetch_remotive(ctx: Context) -> list[dict]:
    jobs = []
    for q in ctx.queries[:4]:
        data = _get_json("https://remotive.com/api/remote-jobs", ctx, f"Remotive ({q})",
                         params={"search": q})
        for item in (data or {}).get("jobs", []):
            if ctx.matcher(item.get("title")):
                jobs.append(_job("Remotive", f"remotive-{item.get('id')}", item.get("title"),
                                 item.get("company_name"),
                                 item.get("candidate_required_location") or "Remote",
                                 item.get("url"), item.get("description"),
                                 item.get("publication_date")))
    return jobs


def fetch_arbeitnow(ctx: Context) -> list[dict]:
    data = _get_json("https://www.arbeitnow.com/api/job-board-api", ctx, "Arbeitnow")
    jobs = []
    for item in (data or {}).get("data", []):
        if ctx.matcher(item.get("title")):
            loc = item.get("location") or ("Remote" if item.get("remote") else "")
            if item.get("remote") and "remote" not in loc.lower():
                loc = f"{loc} (remote)".strip()
            jobs.append(_job("Arbeitnow", f"arbeitnow-{item.get('slug')}", item.get("title"),
                             item.get("company_name"), loc, item.get("url"),
                             item.get("description"), item.get("created_at")))
    return jobs


def fetch_himalayas(ctx: Context) -> list[dict]:
    jobs = []
    for q in ctx.queries[:3]:
        data = _get_json("https://himalayas.app/jobs/api/search", ctx, f"Himalayas ({q})",
                         params={"q": q, "sort": "recent"})
        items = data.get("jobs") if isinstance(data, dict) else data
        for item in items or []:
            if not ctx.matcher(item.get("title")):
                continue
            loc = ", ".join(item.get("locationRestrictions") or []) or "Remote, worldwide"
            jobs.append(_job("Himalayas", f"himalayas-{item.get('guid')}", item.get("title"),
                             item.get("companyName"), loc, item.get("applicationLink"),
                             item.get("description") or item.get("excerpt"), item.get("pubDate")))
    return jobs


# ---------------- keyed aggregators ----------------

def fetch_adzuna(ctx: Context) -> list[dict]:
    app_id, app_key = envfile.get("ADZUNA_APP_ID"), envfile.get("ADZUNA_APP_KEY")
    if not (app_id and app_key):
        return []
    markets = [c for c in ctx.place_codes if c in countries.ADZUNA_MARKETS]
    if not markets and ctx.wants_remote:
        markets = ["US", "GB"]
    jobs = []
    for code in markets[:6]:
        for q in ctx.queries[:3]:
            if ctx.should_stop():
                return jobs
            data = _get_json(f"https://api.adzuna.com/v1/api/jobs/{code.lower()}/search/1",
                             ctx, f"Adzuna ({code}, {q})", params={
                                 "app_id": app_id, "app_key": app_key, "what": q,
                                 "results_per_page": 50, "sort_by": "date",
                                 "max_days_old": ctx.profile.max_age_days})
            for item in (data or {}).get("results", []):
                if ctx.matcher(item.get("title")):
                    jobs.append(_job("Adzuna", f"adzuna-{item.get('id')}", item.get("title"),
                                     (item.get("company") or {}).get("display_name"),
                                     (item.get("location") or {}).get("display_name"),
                                     item.get("redirect_url"), item.get("description"),
                                     item.get("created")))
    return jobs


def fetch_jooble(ctx: Context) -> list[dict]:
    key = envfile.get("JOOBLE_API_KEY")
    if not key:
        return []
    locations = list(ctx.profile.cities) or [countries.name_of(c) for c in ctx.place_codes]
    if ctx.wants_remote:
        locations.append("Remote")
    jobs = []
    for loc in locations[:8]:
        for q in ctx.queries[:2]:
            if ctx.should_stop():
                return jobs
            try:
                r = requests.post(f"https://jooble.org/api/{key}", timeout=TIMEOUT,
                                  json={"keywords": q, "location": loc})
                r.raise_for_status()
                items = r.json().get("jobs", [])
            except (requests.RequestException, ValueError) as e:
                ctx.log(f"Jooble ({loc}, {q}): skipped ({_why(e)})")
                continue
            for item in items:
                if ctx.matcher(item.get("title")):
                    jobs.append(_job("Jooble", f"jooble-{item.get('id')}", item.get("title"),
                                     item.get("company"), item.get("location") or loc,
                                     item.get("link"), item.get("snippet"), item.get("updated")))
    return jobs


JSEARCH_HOST = "jsearch.p.rapidapi.com"
JSEARCH_REQUESTS_PER_RUN = 6


def fetch_jsearch(ctx: Context) -> list[dict]:
    """Google for Jobs through RapidAPI. The free plan is small (about 200 requests a
    month), so each run takes a different slice of the country and title matrix."""
    key = envfile.get("RAPIDAPI_KEY")
    if not key:
        return []
    codes = ctx.place_codes or (["US"] if ctx.wants_remote else [])
    pairs = [(c, q) for c in codes for q in ctx.queries[:3]]
    if len(pairs) > JSEARCH_REQUESTS_PER_RUN:
        offset = (datetime.now().timetuple().tm_yday * JSEARCH_REQUESTS_PER_RUN) % len(pairs)
        pairs = (pairs[offset:] + pairs[:offset])[:JSEARCH_REQUESTS_PER_RUN]
    jobs = []
    for code, q in pairs:
        if ctx.should_stop():
            break
        try:
            # search-v2, not search: RapidAPI now lists /search as the legacy
            # endpoint. v2 pages via a cursor instead of page/num_pages, but
            # a first request needs neither, so this asks for page one plain.
            r = requests.get(f"https://{JSEARCH_HOST}/search-v2", timeout=25, headers={
                "X-RapidAPI-Key": key, "X-RapidAPI-Host": JSEARCH_HOST}, params={
                "query": q, "country": code.lower(), "date_posted": "month"})
            if r.status_code == 429:
                ctx.log("JSearch: monthly quota used up, skipping the rest")
                break
            r.raise_for_status()
            data = r.json().get("data") or []
            items = data.get("jobs") if isinstance(data, dict) else data
        except (requests.RequestException, ValueError) as e:
            ctx.log(f"JSearch ({code}, {q}): skipped ({_why(e)})")
            continue
        for item in items or []:
            if not ctx.matcher(item.get("job_title")):
                continue
            loc = ", ".join(p for p in (item.get("job_city"), item.get("job_country")) if p)
            if item.get("job_is_remote"):
                loc = f"{loc} (remote)".strip()
            jobs.append(_job(f"JSearch · {item.get('job_publisher') or 'web'}",
                             f"jsearch-{item.get('job_id')}", item.get("job_title"),
                             item.get("employer_name"), loc, item.get("job_apply_link"),
                             item.get("job_description"), item.get("job_posted_at_timestamp")))
    return jobs


# ---------------- LinkedIn (opt-in) ----------------

LINKEDIN_DELAY = 1.5
LINKEDIN_MAX_DESCRIPTIONS = 15


def _li(pattern, blob):
    m = re.search(pattern, blob, re.S)
    return html.unescape(re.sub(r"\s+", " ", m.group(1)).strip()) if m else ""


def fetch_linkedin(ctx: Context) -> list[dict]:
    locations = [countries.name_of(c) for c in ctx.place_codes]
    if ctx.wants_remote and not locations:
        locations = ["Worldwide"]
    window = f"r{ctx.profile.max_age_days * 86400}"
    jobs, seen = [], set()
    for loc in locations[:6]:
        for q in ctx.queries[:3]:
            if ctx.should_stop():
                return jobs
            try:
                r = requests.get(
                    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                    params={"keywords": q, "location": loc, "start": 0, "f_TPR": window},
                    headers=UA, timeout=TIMEOUT)
            except requests.RequestException as e:
                ctx.log(f"LinkedIn ({loc}, {q}): skipped ({_why(e)})")
                continue
            if r.status_code != 200:
                ctx.log(f"LinkedIn ({loc}, {q}): skipped (HTTP {r.status_code})")
                continue
            for card in r.text.split("<li>")[1:]:
                jid = re.search(r"urn:li:jobPosting:(\d+)", card)
                title = _li(r'base-search-card__title">(.*?)</h3>', card)
                if not (jid and title) or jid.group(1) in seen or not ctx.matcher(title):
                    continue
                seen.add(jid.group(1))
                job = _job("LinkedIn", f"linkedin-{jid.group(1)}", title,
                           _li(r'base-search-card__subtitle".*?<a[^>]*>(.*?)</a>', card),
                           _li(r'job-search-card__location">(.*?)</span>', card) or loc,
                           f"https://www.linkedin.com/jobs/view/{jid.group(1)}", "",
                           _li(r'<time[^>]*datetime="([^"]+)"', card))
                job["_li_id"] = jid.group(1)
                jobs.append(job)
            time.sleep(LINKEDIN_DELAY)

    jobs.sort(key=lambda j: j["age_days"] if j["age_days"] is not None else 9999)
    for job in jobs[:LINKEDIN_MAX_DESCRIPTIONS]:
        if ctx.should_stop():
            break
        try:
            r = requests.get(f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job['_li_id']}",
                             headers=UA, timeout=TIMEOUT)
            m = re.search(r"show-more-less-html__markup[^>]*>(.*?)</div>", r.text, re.S)
            if r.status_code == 200 and m:
                job["description"] = clean_desc(m.group(1))
        except requests.RequestException:
            pass
        time.sleep(LINKEDIN_DELAY)
    for job in jobs:
        job.pop("_li_id", None)
    return jobs


# ---------------- company career pages (public ATS APIs) ----------------

def _greenhouse(slug):
    r = requests.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
                     params={"content": "true"}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json().get("jobs", []):
        yield (f"gh-{slug}-{j.get('id')}", j.get("title"), j.get("company_name"),
               (j.get("location") or {}).get("name"), j.get("absolute_url"),
               j.get("content"), j.get("first_published") or j.get("updated_at"))


def _lever(slug):
    r = requests.get(f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json"},
                     headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json():
        cats = j.get("categories") or {}
        loc = cats.get("location") or j.get("country")
        if (j.get("workplaceType") or "").lower() == "remote":
            loc = f"{loc or ''} (remote)".strip()
        yield (f"lever-{slug}-{j.get('id')}", j.get("text"), None, loc,
               j.get("hostedUrl") or j.get("applyUrl"),
               j.get("descriptionPlain") or j.get("description"), j.get("createdAt"))


def _ashby(slug):
    r = requests.get(f"https://api.ashbyhq.com/posting-api/job-board/{slug}", headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json().get("jobs", []):
        loc = j.get("location") or ""
        if j.get("isRemote") and "remote" not in loc.lower():
            loc = f"{loc} (remote)".strip()
        yield (f"ashby-{slug}-{j.get('id')}", j.get("title"), None, loc,
               j.get("jobUrl") or j.get("applyUrl"),
               j.get("descriptionPlain") or j.get("descriptionHtml"), j.get("publishedAt"))


def _workable(slug):
    r = requests.get(f"https://apply.workable.com/api/v1/widget/accounts/{slug}",
                     params={"details": "true"}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json().get("jobs", []):
        loc = ", ".join(p for p in (j.get("city"), j.get("country")) if p)
        if j.get("telecommuting"):
            loc = f"{loc} (remote)".strip()
        yield (f"workable-{slug}-{j.get('shortcode')}", j.get("title"), None, loc,
               j.get("url") or j.get("shortlink"), j.get("description"),
               j.get("published_on") or j.get("created_at"))


def _smartrecruiters(slug):
    r = requests.get(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings",
                     params={"limit": 100}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json().get("content", []):
        loc = j.get("location") or {}
        place = ", ".join(p for p in (loc.get("city"), loc.get("country")) if p)
        if loc.get("remote"):
            place = f"{place} (remote)".strip()
        yield (f"sr-{slug}-{j.get('id')}", j.get("name"), (j.get("company") or {}).get("name"),
               place, f"https://jobs.smartrecruiters.com/{slug}/{j.get('id')}", "",
               j.get("releasedDate"))


def _recruitee(slug):
    r = requests.get(f"https://{slug}.recruitee.com/api/offers/", headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    for j in r.json().get("offers", []):
        loc = j.get("location") or ", ".join(p for p in (j.get("city"), j.get("country")) if p)
        if j.get("remote"):
            loc = f"{loc} (remote)".strip()
        yield (f"recruitee-{slug}-{j.get('id')}", j.get("title"), j.get("company_name"), loc,
               j.get("careers_url"), j.get("description"),
               j.get("published_at") or j.get("created_at"))


ATS = {"greenhouse": _greenhouse, "lever": _lever, "ashby": _ashby, "workable": _workable,
       "smartrecruiters": _smartrecruiters, "recruitee": _recruitee}


def fetch_career_pages(ctx: Context) -> list[dict]:
    jobs = []
    for page in ctx.profile.career_pages:
        if ctx.should_stop():
            break
        try:
            for jid, title, company, loc, url, desc, date in ATS[page.provider](page.slug):
                if ctx.matcher(title):
                    jobs.append(_job(f"{page.company} careers", jid, title, company or page.company,
                                     loc, url, desc, date, direct=True))
        except (requests.RequestException, ValueError, AttributeError) as e:
            ctx.log(f"{page.company} careers: skipped ({_why(e)})")
    return jobs


_CAREER_URL_PATTERNS = [
    ("greenhouse", r"(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io/(?:embed/job_board\?for=)?([^/?#]+)"),
    ("lever", r"jobs(?:\.eu)?\.lever\.co/([^/?#]+)"),
    ("ashby", r"jobs\.ashbyhq\.com/([^/?#]+)"),
    ("workable", r"apply\.workable\.com/([^/?#]+)"),
    ("smartrecruiters", r"(?:jobs|careers)\.smartrecruiters\.com/([^/?#]+)"),
    ("recruitee", r"([a-z0-9-]+)\.recruitee\.com"),
]


def parse_career_url(url: str) -> CareerPage | None:
    """Turn a careers page link into a provider and slug, or None if the page isn't
    on a supported applicant tracking system."""
    raw = (url or "").strip()
    if not raw:
        return None
    if "://" not in raw:
        raw = "https://" + raw
    parsed = urlparse(raw)
    host_path = (parsed.netloc + parsed.path + ("?" + parsed.query if parsed.query else "")).lower()
    for provider, pattern in _CAREER_URL_PATTERNS:
        m = re.search(pattern, host_path)
        if m and re.fullmatch(r"[a-z0-9._-]+", m.group(1)) and m.group(1) not in ("www", "api"):
            slug = m.group(1)
            return CareerPage(provider=provider, slug=slug,
                              company=slug.replace("-", " ").replace("_", " ").title())
    return None


def check_career_page(page: CareerPage) -> int:
    """How many openings the board has right now. Raises if it can't be read."""
    return sum(1 for _ in ATS[page.provider](page.slug))


# ---------------- registry ----------------

@dataclass
class Source:
    key: str
    label: str
    fetch: Callable[[Context], list[dict]]
    enabled: Callable[[Profile], bool]


def _remote(p: Profile) -> bool:
    return p.sources.remote_boards and "remote" in p.work_modes


# Direct career pages first: when the same job appears twice, dedupe keeps the
# first copy, and the employer's own posting has the real link and description.
SOURCES = [
    Source("career_pages", "Company career pages", fetch_career_pages,
           lambda p: p.sources.career_pages and bool(p.career_pages)),
    Source("linkedin", "LinkedIn", fetch_linkedin, lambda p: p.sources.linkedin),
    Source("jsearch", "JSearch", fetch_jsearch,
           lambda p: p.sources.jsearch and bool(envfile.get("RAPIDAPI_KEY"))),
    Source("jooble", "Jooble", fetch_jooble,
           lambda p: p.sources.jooble and bool(envfile.get("JOOBLE_API_KEY"))),
    Source("adzuna", "Adzuna", fetch_adzuna,
           lambda p: p.sources.adzuna and bool(envfile.get("ADZUNA_APP_ID") and envfile.get("ADZUNA_APP_KEY"))),
    Source("himalayas", "Himalayas", fetch_himalayas, _remote),
    Source("remotive", "Remotive", fetch_remotive, _remote),
    Source("remoteok", "RemoteOK", fetch_remoteok, _remote),
    Source("arbeitnow", "Arbeitnow", fetch_arbeitnow, _remote),
]
