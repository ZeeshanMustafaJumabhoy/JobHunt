import pytest
from shortlist import countries, pipeline
from shortlist.pipeline import BUCKET_ELSEWHERE, BUCKET_HOME, BUCKET_REMOTE, BUCKET_TARGET, BUCKET_UNCLEAR
from shortlist.profile import Profile, Salary


def gulf_seeker(**overrides):
    base = dict(home_country="PK", target_countries=["AE", "SA"], titles=["QA Engineer"],
                work_modes=["remote", "hybrid", "onsite"], max_years_required=6,
                exclude_title_words=["principal", "intern"])
    base.update(overrides)
    return Profile(**base)


def job(**kw):
    base = {"id": "x", "title": "QA Engineer", "company": "Acme", "location": "", "description": "",
            "source": "Test", "age_days": 1, "direct": False}
    base.update(kw)
    return base


@pytest.mark.parametrize("location,expected", [
    ("Dubai, United Arab Emirates", BUCKET_TARGET),
    ("Riyadh", BUCKET_TARGET),
    ("Remote", BUCKET_REMOTE),
    ("Worldwide", BUCKET_REMOTE),
    ("Remote (US)", BUCKET_ELSEWHERE),
    ("Full Remote / United States", BUCKET_ELSEWHERE),
    ("Karachi, Pakistan", BUCKET_HOME),
    ("Bucharest, Romania", BUCKET_ELSEWHERE),   # "Romania" contains "oman"
    ("Indianapolis, Indiana", BUCKET_UNCLEAR),  # "Indiana" contains "india"
    ("", BUCKET_UNCLEAR),
])
def test_bucket_of(location, expected):
    bucket, label = pipeline.bucket_of(job(location=location), gulf_seeker())
    assert bucket == expected, label


def test_remote_but_locked_in_description_is_not_worldwide():
    j = job(location="Remote", description="Candidates must be located in the United States.")
    assert pipeline.bucket_of(j, gulf_seeker())[0] != BUCKET_REMOTE


def test_city_of_interest_counts_as_target():
    p = gulf_seeker(target_countries=[], cities=["Lisbon"])
    assert pipeline.bucket_of(job(location="Lisbon"), p)[0] == BUCKET_TARGET


def _with_bucket(j, p):
    j["bucket"], j["bucket_label"] = pipeline.bucket_of(j, p)
    return j


def test_prefilter_rejects_excluded_title_words():
    p = gulf_seeker()
    assert "principal" in pipeline.prefilter(_with_bucket(job(title="Principal QA Engineer", location="Dubai"), p), p)
    # Word match only, so "internal" doesn't trip "intern".
    assert pipeline.prefilter(_with_bucket(job(title="QA Engineer, Internal Tools", location="Dubai"), p), p) is None


def test_prefilter_years_cap():
    p = gulf_seeker(max_years_required=5)
    too_many = _with_bucket(job(location="Dubai", description="You have 8+ years of testing experience"), p)
    in_range = _with_bucket(job(location="Dubai", description="3-7 years of experience"), p)
    company_age = _with_bucket(job(location="Dubai", description="In business for 45 years"), p)
    assert pipeline.prefilter(too_many, p) == "asks for 8+ years"
    assert pipeline.prefilter(in_range, p) is None
    assert pipeline.prefilter(company_age, p) is None


def test_prefilter_remote_only_user_drops_onsite():
    p = gulf_seeker(work_modes=["remote"])
    assert pipeline.prefilter(_with_bucket(job(location="Dubai"), p), p) == "not remote"
    assert pipeline.prefilter(_with_bucket(job(location="Remote"), p), p) is None


def test_prefilter_drops_onsite_outside_targets_but_keeps_remote_there():
    p = gulf_seeker()
    assert pipeline.prefilter(_with_bucket(job(location="Berlin, Germany"), p), p) == "outside your countries"
    assert pipeline.prefilter(_with_bucket(job(location="Berlin, Germany (remote)"), p), p) is None


def test_dedupe_keeps_first_copy_and_catches_same_job_different_id():
    a = job(id="career-1", company="Acme", location="Dubai", direct=True)
    b = job(id="linkedin-9", company="ACME", location="dubai")
    c = job(id="career-1")
    assert pipeline.dedupe([a, b, c]) == [a]


def test_allocate_budget_respects_shares_and_redistributes():
    p = gulf_seeker()
    pool = [_with_bucket(job(id=f"r{i}", location="Remote", source=f"S{i % 5}", title=f"QA {i}"), p) for i in range(100)]
    pool += [_with_bucket(job(id=f"t{i}", location="Dubai", source="T", title=f"QA T{i}"), p) for i in range(3)]
    picked = pipeline.allocate_budget(pool, 20)
    assert len(picked) == 20
    assert sum(1 for j in picked if j["bucket"] == BUCKET_TARGET) == 3
    # Targets come first in the final order.
    assert all(j["bucket"] == BUCKET_TARGET for j in picked[:3])


def test_allocate_budget_caps_one_source():
    p = gulf_seeker()
    pool = [_with_bucket(job(id=f"r{i}", location="Remote", source="Flood", title=f"QA {i}"), p) for i in range(100)]
    assert len(pipeline.allocate_budget(pool, 60)) == pipeline.MAX_PER_SOURCE


@pytest.mark.parametrize("score,tier", [(95, "apply"), (80, "apply"), (79, "strong"), (65, "strong"), (50, "maybe"), (49, "low")])
def test_tier_for(score, tier):
    assert pipeline.tier_for(score) == tier


def test_tier_for_respects_custom_minimum():
    # Raising the bar reclassifies a middling score as low without touching apply/strong.
    assert pipeline.tier_for(60, min_match_score=70) == "low"
    assert pipeline.tier_for(82, min_match_score=70) == "apply"
    # Lowering it below the old fixed floor surfaces scores that used to be hidden.
    assert pipeline.tier_for(45, min_match_score=40) == "maybe"


def test_salary_below_minimum_only_compares_like_with_like():
    p = Profile(salary=Salary(minimum=3000, currency="USD", period="month"))
    assert pipeline.salary_below_minimum({"salary_max": 2000, "salary_currency": "USD", "salary_period": "month"}, p)
    assert pipeline.salary_below_minimum({"salary_max": 30000, "salary_currency": "USD", "salary_period": "year"}, p)
    assert not pipeline.salary_below_minimum({"salary_max": 48000, "salary_currency": "USD", "salary_period": "year"}, p)
    assert not pipeline.salary_below_minimum({"salary_max": 2000, "salary_currency": "AED", "salary_period": "month"}, p)
    assert not pipeline.salary_below_minimum({"salary_max": None}, p)


def test_country_detection_handles_bare_codes_only_in_location():
    assert "US" in countries.countries_in("Remote - US", "Remote - US")
    assert "US" not in countries.countries_in("join us today", "")
    assert countries.countries_in("Lagos") == {"NG"}
