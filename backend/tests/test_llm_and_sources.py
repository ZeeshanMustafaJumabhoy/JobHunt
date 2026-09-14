import io
import zipfile

import pytest
from shortlist import llm, resume, sources
from shortlist.profile import Profile
from shortlist.text import clean_desc, days_old, min_years_required

# ---------------- llm ----------------

def test_loads_tolerates_fences_and_prose():
    assert llm._loads('```json\n{"score": 7}\n```') == {"score": 7}
    assert llm._loads('Here you go: {"score": 7} hope that helps') == {"score": 7}
    assert llm._loads("not json at all") is None
    assert llm._loads("[1, 2]") is None


def test_parse_verdict_clamps_and_normalises():
    p = Profile(skills=["Python", "Playwright"])
    v = llm.parse_verdict({
        "score": "140", "reason": "Good fit.", "visa_sponsorship": "YES",
        "remote_type": "remote worldwide", "years_required": "3",
        "salary_min": 5000, "salary_currency": "aed", "salary_period": "Month",
        "matched_skills": ["python", "Cobol"], "missing_skills": ["Kotlin", "playwright"],
    }, p)
    assert v["score"] == 100
    assert v["visa_sponsorship"] == "yes"
    assert v["remote_type"] == "remote_worldwide"
    assert v["years_required"] == 3
    assert v["salary_currency"] == "AED" and v["salary_period"] == "month"
    # Matched skills must be ones the candidate actually has, spelled their way.
    assert v["matched_skills"] == ["Python"]
    assert v["missing_skills"] == ["Kotlin"]


def test_parse_verdict_survives_garbage():
    v = llm.parse_verdict({"score": "high", "visa_sponsorship": 3, "matched_skills": "nope"}, Profile())
    assert v["score"] == 0 and v["visa_sponsorship"] == "unclear" and v["matched_skills"] == []


def _provider():
    return llm.Provider(name="Groq", url="https://example.test", key="k", models=["m"], mode="json_object", delay=0)


def test_ask_json_falls_through_to_second_provider(monkeypatch, fake_response):
    calls = []

    def fake_post(url, **kw):
        calls.append(url)
        if url == "https://first.test":
            return fake_response(401, {"error": "bad key"})
        return fake_response(200, {"choices": [{"message": {"content": '{"ok": true}'}}]})

    monkeypatch.setattr(llm.requests, "post", fake_post)
    first, second = _provider(), _provider()
    first.url, second.url, second.name = "https://first.test", "https://second.test", "OpenRouter"
    data, name = llm.ask_json("hi", [first, second])
    assert data == {"ok": True} and name == "OpenRouter"
    assert first.exhausted is True


def test_ask_json_daily_limit_raises_friendly_error(monkeypatch, fake_response):
    monkeypatch.setattr(llm.requests, "post",
                        lambda url, **kw: fake_response(429, {"e": 1}, text="Rate limit reached: tokens per day"))
    with pytest.raises(llm.LLMError, match="free limit"):
        llm.ask_json("hi", [_provider()])


def test_ask_json_without_providers():
    with pytest.raises(llm.LLMError, match="Groq"):
        llm.ask_json("hi", [])


def test_analyze_resume_cleans_output(monkeypatch):
    monkeypatch.setattr(llm, "ask_json", lambda *a, **k: ({
        "name": "Sara Khan", "years_experience": "4.25", "seniority": "Mid",
        "skills": ["SQL", "sql", "Tableau", ""], "home_country": "pk",
        "suggested_titles": ["Data Analyst"], "title_keywords": ["Data Analyst", "BI Analyst"],
    }, "Groq"))
    facts = llm.analyze_resume("resume text")
    assert facts["years_experience"] == 4.2 or facts["years_experience"] == 4.3
    assert facts["seniority"] == "mid"
    assert facts["skills"] == ["SQL", "Tableau"]
    assert facts["home_country"] == "PK"
    assert facts["title_keywords"] == ["data analyst", "bi analyst"]


# ---------------- sources ----------------

def test_title_matcher():
    m = sources.TitleMatcher(["QA Automation Engineer"], ["sdet", "test automation"])
    assert m("Senior SDET")
    assert m("Engineer, QA Automation")      # all words, any order
    assert m("Test Automation Lead")
    assert not m("Automation Engineer")      # missing "qa"
    assert not m("Sales Manager")
    assert not m("")


@pytest.mark.parametrize("url,provider,slug", [
    ("https://boards.greenhouse.io/tamara", "greenhouse", "tamara"),
    ("job-boards.greenhouse.io/careem/jobs/123", "greenhouse", "careem"),
    ("https://jobs.lever.co/fresha/abc", "lever", "fresha"),
    ("https://jobs.ashbyhq.com/rain", "ashby", "rain"),
    ("https://apply.workable.com/foodics/", "workable", "foodics"),
    ("https://jobs.smartrecruiters.com/Yassir", "smartrecruiters", "yassir"),
    ("https://unifonic.recruitee.com/", "recruitee", "unifonic"),
])
def test_parse_career_url(url, provider, slug):
    page = sources.parse_career_url(url)
    assert page.provider == provider and page.slug == slug


@pytest.mark.parametrize("url", ["https://example.com/careers", "", "https://www.recruitee.com/"])
def test_parse_career_url_rejects_unsupported(url):
    assert sources.parse_career_url(url) is None


def test_fetcher_failure_is_soft(monkeypatch):
    import requests

    def boom(*a, **k):
        raise requests.ConnectionError("offline")

    monkeypatch.setattr(sources.requests, "get", boom)
    logs = []
    ctx = sources.Context(profile=Profile(titles=["QA Engineer"]), log=logs.append)
    assert sources.fetch_remoteok(ctx) == []
    assert logs and "RemoteOK" in logs[0]


def test_remoteok_maps_fields(monkeypatch, fake_response):
    monkeypatch.setattr(sources.requests, "get", lambda *a, **k: fake_response(200, [
        {"legal": "notice"},
        {"id": 5, "position": "QA Engineer", "company": "Acme", "location": "", "url": "https://x.test/5",
         "description": "<p>Write &amp; run tests</p>", "date": "2026-09-01T00:00:00+00:00"},
        {"id": 6, "position": "Sales Lead", "company": "Acme"},
    ]))
    jobs = sources.fetch_remoteok(sources.Context(profile=Profile(titles=["QA Engineer"])))
    assert len(jobs) == 1
    assert jobs[0]["id"] == "remoteok-5" and jobs[0]["location"] == "Remote"
    assert jobs[0]["description"] == "Write & run tests"


def test_keyed_sources_skip_without_keys():
    ctx = sources.Context(profile=Profile(titles=["QA Engineer"], target_countries=["GB"]))
    assert sources.fetch_adzuna(ctx) == [] and sources.fetch_jooble(ctx) == [] and sources.fetch_jsearch(ctx) == []


# ---------------- text and resume ----------------

def test_clean_desc_and_years():
    assert clean_desc("<b>Hi</b>&nbsp;there", 50) == "Hi there"
    assert min_years_required("Requires 2+ yrs and a 30 year old company") == 2
    assert min_years_required("no numbers") is None


def test_days_old_formats():
    assert days_old(None) is None
    assert days_old("garbage") is None
    assert days_old("2000-01-01") > 9000
    assert days_old("2000-01-01T10:00:00Z") > 9000
    assert days_old(946684800000) > 9000   # epoch milliseconds


def _docx_bytes(text):
    xml = ('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
           f'<w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", xml)
    return buf.getvalue()


def test_resume_docx():
    body = "Experienced analyst. " * 20
    assert resume.extract_text("cv.docx", _docx_bytes(body)).startswith("Experienced analyst.")


@pytest.mark.parametrize("name,data,message", [
    ("cv.exe", b"x" * 500, "PDF, DOCX or TXT"),
    ("cv.txt", b"too short", "Very little text"),
    ("cv.docx", b"not a zip", "couldn't be read"),
    ("cv.pdf", b"x" * (resume.MAX_BYTES + 1), "over 5 MB"),
], ids=["wrong-type", "too-short", "bad-docx", "too-big"])
def test_resume_errors(name, data, message):
    with pytest.raises(resume.ResumeError, match=message):
        resume.extract_text(name, data)
