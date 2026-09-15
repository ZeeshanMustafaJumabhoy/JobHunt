"""One search run: fetch, dedupe, filter, rank, score, store.

Ranking is about reachability, not prestige. For each posting the question is
"could this person actually take this job from where they are?", which splits
the pool into buckets that each get a guaranteed share of the AI budget:

    0 target      in a country the user picked
    1 remote      remote and not fenced off to one country or region
    2 home        in the user's own country
    3 elsewhere   names some other country
    4 unclear     the posting doesn't say where

Stage 1 is free rules that only reject the unambiguous. Stage 2 is the AI
verdict on whatever survives, inside each bucket's share.
"""

import re
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field

from . import countries, llm, store
from .profile import Profile
from .sources import SOURCES, Context
from .text import min_years_required, norm

BUCKET_TARGET, BUCKET_REMOTE, BUCKET_HOME, BUCKET_ELSEWHERE, BUCKET_UNCLEAR = range(5)
BUCKET_SHARE = {BUCKET_TARGET: 0.45, BUCKET_REMOTE: 0.30, BUCKET_HOME: 0.15,
                BUCKET_ELSEWHERE: 0.05, BUCKET_UNCLEAR: 0.05}
MAX_PER_SOURCE = 25

_REMOTE_RE = re.compile(r"(?<![a-z])(remote|work from home|wfh|anywhere|distributed|telecommute|worldwide)(?![a-z])")
_LOCKED_RE = re.compile(
    r"(?<![a-z])(us only|u\.s\. only|usa only|uk only|eu only|europe only|emea only|canada only|"
    r"must be located|must reside|must be based|based in the us|authori[sz]ed to work in|"
    r"work authori[sz]ation|no sponsorship|without sponsorship|eligible to work in|"
    r"within the united states|within the eu|within europe)(?![a-z])")
_MODE_WORDS = re.compile(
    r"fully remote|remote-first|remote first|work from home|home based|home-based|telecommute|"
    r"distributed|remote|anywhere|worldwide|global(?:ly)?|unspecified|n/a|hybrid|on-?site|[()\-,/|·]")


def is_remote(job: dict) -> bool:
    return bool(_REMOTE_RE.search(f"{job.get('location', '')} {job.get('title', '')}".lower()))


def _names_no_place(location: str) -> bool:
    return not re.sub(r"[^a-z]+", "", _MODE_WORDS.sub(" ", (location or "").lower()))


def bucket_of(job: dict, profile: Profile) -> tuple[int, str]:
    location = str(job.get("location") or "")
    blob = " ".join(str(job.get(k) or "") for k in ("location", "title", "description")).lower()
    loc_codes = countries.countries_in(location, location) | countries.regions_in(location)
    # Where the job is comes from the location field first. The description is a
    # fallback only, since it names every country the company has ever sold to.
    codes = loc_codes or countries.countries_in(blob[:400])
    targets = set(profile.target_countries)
    cities = [norm(c) for c in profile.cities if norm(c)]

    if (targets & codes) or any(f" {c} " in f" {norm(location)} " for c in cities):
        return BUCKET_TARGET, "In your target countries"
    if (is_remote(job) and not _LOCKED_RE.search(blob) and _names_no_place(location)):
        return BUCKET_REMOTE, "Remote, worldwide"
    if profile.home_country and profile.home_country in codes:
        return BUCKET_HOME, f"In {countries.name_of(profile.home_country)}"
    if codes:
        return BUCKET_ELSEWHERE, "Other countries"
    return BUCKET_UNCLEAR, "Location unclear"


def prefilter(job: dict, profile: Profile) -> str | None:
    """Stage 1. Returns why a job is rejected, or None to keep it."""
    title = f" {norm(job.get('title'))} "
    for word in profile.exclude_title_words:
        w = norm(word)
        if w and f" {w} " in title:
            return f"title contains \"{word}\""

    if profile.max_years_required:
        years = min_years_required(job.get("description"))
        if years is not None and years > profile.max_years_required:
            return f"asks for {years}+ years"

    bucket = job.get("bucket")
    modes = set(profile.work_modes)
    if modes == {"remote"} and bucket in (BUCKET_TARGET, BUCKET_HOME, BUCKET_ELSEWHERE) and not is_remote(job):
        return "not remote"
    # With target countries set, a job clearly placed somewhere else is only worth
    # reading if it is remote. Onsite in a country the user didn't pick is out.
    if profile.target_countries and bucket == BUCKET_ELSEWHERE and not is_remote(job):
        return "outside your countries"
    if "remote" not in modes and bucket == BUCKET_REMOTE:
        return "remote, and you didn't ask for remote"
    return None


def _identity(job: dict) -> tuple:
    return norm(job.get("title")), norm(job.get("company")), norm(job.get("location"))


def dedupe(jobs: list[dict]) -> list[dict]:
    out, ids, identities = [], set(), set()
    for job in jobs:
        if not job.get("id") or not job.get("title"):
            continue
        ident = _identity(job)
        if job["id"] in ids or ident in identities:
            continue
        ids.add(job["id"])
        identities.add(ident)
        out.append(job)
    return out


def _priority(job: dict) -> tuple:
    return (0 if job.get("direct") else 1,
            job["age_days"] if job.get("age_days") is not None else 9999)


def allocate_budget(jobs: list[dict], total: int) -> list[dict]:
    """Give each bucket its share of the scoring budget, cap any one source inside
    a bucket, then hand unused share to the best buckets that still have jobs."""
    groups: dict[int, list[dict]] = {b: [] for b in BUCKET_SHARE}
    for job in sorted(jobs, key=_priority):
        groups[job.get("bucket", BUCKET_UNCLEAR)].append(job)
    for b, group in groups.items():
        kept, per_source = [], {}
        for job in group:
            src = job.get("source", "?")
            if per_source.get(src, 0) < MAX_PER_SOURCE:
                per_source[src] = per_source.get(src, 0) + 1
                kept.append(job)
        groups[b] = kept

    picked, leftover = [], 0
    for b, share in BUCKET_SHARE.items():
        quota = int(total * share)
        picked += groups[b][:quota]
        leftover += max(0, quota - len(groups[b]))
        groups[b] = groups[b][quota:]
    leftover += total - sum(int(total * s) for s in BUCKET_SHARE.values())
    for b in BUCKET_SHARE:
        if leftover <= 0:
            break
        take = groups[b][:leftover]
        picked += take
        leftover -= len(take)
    picked.sort(key=lambda j: (j.get("bucket", BUCKET_UNCLEAR),) + _priority(j))
    return picked[:total]


def tier_for(score: int, min_match_score: int = 50) -> str:
    """apply/strong stay at their fixed, recruiter-judgment bar; the maybe/low
    line is the user's own minimum match, so raising it hides weaker matches
    without pretending an 82 and a 45 are the same kind of "not quite" match."""
    if score < min_match_score:
        return "low"
    if score >= 80:
        return "apply"
    if score >= 65:
        return "strong"
    return "maybe"


def salary_below_minimum(verdict: dict, profile: Profile) -> bool:
    """Only compares like with like. No currency conversion: a wrong exchange rate
    silently hiding a good job is worse than showing one that pays too little."""
    minimum = profile.salary.minimum
    stated = verdict.get("salary_max") or verdict.get("salary_min")
    if not minimum or not stated:
        return False
    if (verdict.get("salary_currency") or "").upper() != profile.salary.currency.upper():
        return False
    period = verdict.get("salary_period")
    if period == profile.salary.period:
        return stated < minimum
    if period == "year" and profile.salary.period == "month":
        return stated / 12 < minimum
    if period == "month" and profile.salary.period == "year":
        return stated * 12 < minimum
    return False


# ---------------- run state ----------------

@dataclass
class RunState:
    running: bool = False
    run_id: int | None = None
    phase: str = "idle"          # idle | searching | filtering | scoring | done | failed | stopped
    message: str = ""
    sources_done: int = 0
    sources_total: int = 0
    found: int = 0
    to_score: int = 0
    scored: int = 0
    matches: int = 0
    log: list[str] = field(default_factory=list)
    stop_requested: bool = False

    def public(self) -> dict:
        d = self.__dict__.copy()
        d["log"] = self.log[-60:]
        return d


class Runner:
    """Runs one search at a time on a background thread."""

    def __init__(self):
        self._lock = threading.Lock()
        self.state = RunState()

    def log(self, line: str) -> None:
        self.state.log.append(f"{time.strftime('%H:%M:%S')}  {line}")
        del self.state.log[:-300]

    def start(self, profile: Profile, trigger: str = "manual",
              on_done: Callable[[int, list[dict]], None] | None = None) -> bool:
        with self._lock:
            if self.state.running:
                return False
            self.state = RunState(running=True, phase="searching", message="Starting")
        self.thread = threading.Thread(target=self._run, args=(profile, trigger, on_done), daemon=True)
        self.thread.start()
        return True

    def stop(self) -> None:
        self.state.stop_requested = True

    def _run(self, profile: Profile, trigger: str, on_done) -> None:
        s = self.state
        stats: dict = {}
        try:
            s.run_id = store.start_run(trigger)
            matches = run_search(profile, s, self.log, stats)
            s.phase = "stopped" if s.stop_requested else "done"
            store.finish_run(s.run_id, s.phase, stats)
            if on_done and not s.stop_requested:
                on_done(s.run_id, matches)
        except Exception as e:  # the thread must always leave a final state behind
            s.phase, s.message = "failed", str(e) or e.__class__.__name__
            self.log(f"Run failed: {s.message}")
            if s.run_id is not None:
                try:
                    store.finish_run(s.run_id, "failed", stats, s.message)
                except Exception:
                    pass
        finally:
            s.running = False


def run_search(profile: Profile, s: RunState, log: Callable[[str], None], stats: dict) -> list[dict]:
    providers = llm.build_providers()
    if not providers:
        raise llm.LLMError("Add your Groq API key before searching.")
    if not profile.titles:
        raise ValueError("Add at least one job title before searching.")

    ctx = Context(profile=profile, log=log, should_stop=lambda: s.stop_requested)
    active = [src for src in SOURCES if src.enabled(profile)]
    s.sources_total = len(active)
    raw: list[dict] = []
    per_source: dict[str, int] = {}
    for src in active:
        if s.stop_requested:
            return []
        s.message = f"Searching {src.label}"
        found = src.fetch(ctx)
        per_source[src.label] = len(found)
        log(f"{src.label}: {len(found)} matching titles")
        raw += found
        s.sources_done += 1
        s.found = len(raw)

    s.phase, s.message = "filtering", "Removing duplicates and jobs you've already seen"
    jobs = dedupe(raw)
    for job in jobs:
        job["bucket"], job["bucket_label"] = bucket_of(job, profile)
    seen = store.seen_ids()
    new = [j for j in jobs if j["id"] not in seen]
    fresh = [j for j in new if j.get("age_days") is None or j["age_days"] <= profile.max_age_days]

    kept, rejected = [], {}
    for job in fresh:
        why = prefilter(job, profile)
        if why:
            rejected[why] = rejected.get(why, 0) + 1
        else:
            kept.append(job)
    to_score = allocate_budget(kept, profile.max_jobs_to_score)
    s.to_score = len(to_score)
    stats.update(found=len(raw), unique=len(jobs), new=len(new), fresh=len(fresh),
                 passed_rules=len(kept), scored=0, matches=0, per_source=per_source,
                 rejected=dict(sorted(rejected.items(), key=lambda kv: -kv[1])[:10]))
    log(f"{len(raw)} found, {len(new)} new, {len(fresh)} recent, {len(kept)} passed the rules, "
        f"scoring {len(to_score)}")

    s.phase = "scoring"
    matches = []
    for i, job in enumerate(to_score, 1):
        if s.stop_requested:
            break
        s.message = f"Reading {job['title']} at {job['company']}"
        verdict = llm.evaluate_job(job, profile, providers, log)
        if verdict is None:
            if all(p.exhausted for p in providers):
                log("AI limit reached. The remaining jobs will be scored on the next run.")
                break
            continue
        job.update(verdict)
        job["tier"] = tier_for(job["score"], profile.min_match_score)
        job["salary_below_minimum"] = salary_below_minimum(verdict, profile)
        if job["salary_below_minimum"] and profile.salary.strict:
            job["tier"] = "low"
            job["reason"] = f"Pays below your minimum. {job['reason']}"
        store.save_job(s.run_id, job)
        s.scored = i
        stats["scored"] = s.scored
        if job["tier"] != "low":
            matches.append(job)
            s.matches = len(matches)
            stats["matches"] = s.matches
        time.sleep(llm.scoring_delay(providers))

    s.message = f"{len(matches)} jobs worth a look"
    return matches
