"""The user's search profile: who they are and what they're looking for.

This replaces every hardcoded constant the original single-user script had
(keywords, resume summary, target countries, years cap, and so on). It is saved
as data/profile.json, and the setup wizard fills it in one question at a time.
"""

import json
import os
import tempfile
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .paths import data_dir

WorkMode = Literal["remote", "hybrid", "onsite"]
SalaryPeriod = Literal["month", "year"]


class Salary(BaseModel):
    minimum: int | None = Field(default=None, ge=0)
    currency: str = "USD"
    period: SalaryPeriod = "month"
    # When true, jobs that state a lower salary are dropped. When false they are
    # kept and flagged, since most postings don't state a salary at all.
    strict: bool = False


class CareerPage(BaseModel):
    provider: Literal["greenhouse", "lever", "ashby", "workable", "smartrecruiters", "recruitee"]
    slug: str = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9._-]+$")
    company: str = Field(min_length=1, max_length=120)


class Sources(BaseModel):
    remote_boards: bool = True
    career_pages: bool = True
    adzuna: bool = True
    jooble: bool = True
    jsearch: bool = True
    # Off by default: it reads LinkedIn's public pages, which their terms don't
    # permit, so it has to be the user's own informed choice.
    linkedin: bool = False


class Profile(BaseModel):
    # From the resume
    name: str = ""
    headline: str = ""
    summary: str = ""
    resume_text: str = ""
    skills: list[str] = Field(default_factory=list)
    years_experience: float | None = Field(default=None, ge=0, le=60)
    seniority: str = ""

    # What they want
    suggested_titles: list[str] = Field(default_factory=list)
    titles: list[str] = Field(default_factory=list)
    title_keywords: list[str] = Field(default_factory=list)
    work_modes: list[WorkMode] = Field(default_factory=lambda: ["remote", "hybrid", "onsite"])
    home_country: str = ""                                   # ISO 3166-1 alpha-2
    target_countries: list[str] = Field(default_factory=list)  # ISO codes
    cities: list[str] = Field(default_factory=list)
    needs_visa: bool = True
    willing_to_relocate: bool = True
    max_years_required: int | None = Field(default=None, ge=1, le=40)
    salary: Salary = Field(default_factory=Salary)
    exclude_title_words: list[str] = Field(default_factory=list)
    dealbreakers: str = ""
    max_age_days: int = Field(default=21, ge=1, le=90)

    # Where to look
    sources: Sources = Field(default_factory=Sources)
    career_pages: list[CareerPage] = Field(default_factory=list)
    max_jobs_to_score: int = Field(default=60, ge=5, le=300)

    # Email digest
    digest_enabled: bool = False
    digest_time: str = Field(default="09:00", pattern=r"^([01]\d|2[0-3]):[0-5]\d$")

    # Wizard progress, so a closed tab resumes on the right step.
    setup_step: str = ""
    setup_complete: bool = False

    @field_validator("home_country")
    @classmethod
    def _upper_code(cls, v: str) -> str:
        return v.strip().upper()[:2]

    @field_validator("target_countries")
    @classmethod
    def _upper_codes(cls, v: list[str]) -> list[str]:
        return _unique([c.strip().upper()[:2] for c in v if c.strip()])

    @field_validator("skills", "suggested_titles", "titles", "title_keywords", "cities", "exclude_title_words")
    @classmethod
    def _clean_list(cls, v: list[str]) -> list[str]:
        return _unique([s.strip()[:120] for s in v if s and s.strip()])[:100]


def _unique(items: list[str]) -> list[str]:
    seen, out = set(), []
    for item in items:
        key = item.lower()
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out


# Seniority words that are never worth an AI call for someone at a given level.
# "Senior" and "lead" are deliberately left out: plenty of employers put those
# titles on 3-year roles, so the model reads the posting and decides.
_TOO_SENIOR = ["principal", "staff", "director", "head of", "vp", "vice president",
               "chief", "architect"]
_TOO_JUNIOR = ["intern", "internship", "trainee", "apprentice", "fresher", "graduate"]


def default_exclusions(years: float | None) -> list[str]:
    if years is None:
        return []
    out = []
    if years < 6:
        out += _TOO_SENIOR
    if years >= 1:
        out += _TOO_JUNIOR
    return out


def default_max_years(years: float | None) -> int | None:
    """Postings asking for a lot more experience than the user has are a long
    shot, but a few years of stretch is normal: "5+ years" routinely hires at 3."""
    if years is None:
        return None
    return int(years) + 4


def profile_path():
    return data_dir() / "profile.json"


def load() -> Profile:
    path = profile_path()
    if not path.exists():
        return Profile()
    try:
        return Profile.model_validate_json(path.read_text(encoding="utf-8"))
    except ValueError:
        # A hand-edited profile that no longer validates shouldn't brick the app.
        # Keep a copy so nothing is lost, and start fresh.
        path.replace(path.with_suffix(".invalid.json"))
        return Profile()


def save(profile: Profile) -> Profile:
    path = profile_path()
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix="profile.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(profile.model_dump(), f, indent=2, ensure_ascii=False)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise
    return profile


def update(changes: dict) -> Profile:
    merged = load().model_dump()
    for key, value in changes.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged[key], **value}
        else:
            merged[key] = value
    return save(Profile.model_validate(merged))
