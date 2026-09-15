import pytest
from fastapi.testclient import TestClient
from shortlist import api, ats, envfile, keys, llm, pipeline, store
from shortlist import profile as profile_mod

H = {"X-Shortlist": "1"}


@pytest.fixture
def client():
    with TestClient(api.app, base_url="http://127.0.0.1:8421") as c:
        yield c


@pytest.fixture
def groq_ok(monkeypatch):
    monkeypatch.setattr(keys, "check_groq", lambda key: (True, "Groq key works."))


# ---------------- local-only protection ----------------

def test_rejects_foreign_host():
    with TestClient(api.app, base_url="http://evil.example") as c:
        assert c.get("/api/state", headers=H).status_code == 403


def test_rejects_missing_header(client):
    assert client.get("/api/state").status_code == 403


def test_rejects_cross_site_origin(client):
    r = client.get("/api/state", headers={**H, "Origin": "https://evil.example"})
    assert r.status_code == 403


def test_allows_local_dev_origin(client):
    assert client.get("/api/state", headers={**H, "Origin": "http://localhost:5173"}).status_code == 200


# ---------------- setup flow ----------------

def test_initial_state(client):
    s = client.get("/api/state", headers=H).json()
    assert s["ai_ready"] is False
    assert s["profile"]["setup_complete"] is False
    assert s["keys"]["GROQ_API_KEY"]["set"] is False


def test_bad_groq_key_is_not_saved(client, monkeypatch):
    monkeypatch.setattr(keys, "check_groq", lambda key: (False, "Groq rejected this key."))
    r = client.post("/api/keys/groq", json={"key": "gsk_bad"}, headers=H)
    assert r.status_code == 422 and r.json()["message"] == "Groq rejected this key."
    assert "GROQ_API_KEY" not in envfile.read_env()


def test_good_groq_key_is_saved_and_masked(client, groq_ok):
    r = client.post("/api/keys/groq", json={"key": "  gsk_goodkey123456  "}, headers=H)
    assert r.status_code == 200
    assert envfile.read_env()["GROQ_API_KEY"] == "gsk_goodkey123456"
    assert "goodkey" not in r.text
    assert client.get("/api/state", headers=H).json()["ai_ready"] is True


def test_unknown_key_name(client):
    assert client.post("/api/keys/stripe", json={"key": "x"}, headers=H).status_code == 422


def test_resume_needs_groq_first(client):
    r = client.post("/api/resume", files={"file": ("cv.txt", b"x" * 300, "text/plain")}, headers=H)
    assert r.status_code == 400 and "Groq" in r.json()["detail"]


def test_resume_upload_fills_profile(client, groq_ok, monkeypatch):
    client.post("/api/keys/groq", json={"key": "gsk_goodkey123456"}, headers=H)
    monkeypatch.setattr(llm, "analyze_resume", lambda text: {
        "name": "Sara Khan", "headline": "Data analyst", "summary": "Four years in analytics.",
        "years_experience": 4.0, "seniority": "mid", "skills": ["SQL", "Tableau"], "home_country": "PK",
        "suggested_titles": ["Data Analyst", "BI Analyst"], "title_keywords": ["data analyst"],
    })
    r = client.post("/api/resume", files={"file": ("cv.txt", b"Sara Khan, analyst. " * 30, "text/plain")}, headers=H)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["has_resume"] is True and "resume_text" not in p
    assert p["suggested_titles"] == ["Data Analyst", "BI Analyst"]
    assert p["max_years_required"] == 8
    assert "principal" in p["exclude_title_words"]


def test_resume_scan_requires_resume(client, groq_ok):
    client.post("/api/keys/groq", json={"key": "gsk_goodkey123456"}, headers=H)
    r = client.post("/api/resume/scan", headers=H)
    assert r.status_code == 400 and "resume" in r.json()["detail"].lower()


def test_resume_scan_runs_and_then_cools_down(client, groq_ok, monkeypatch):
    client.post("/api/keys/groq", json={"key": "gsk_goodkey123456"}, headers=H)
    profile_mod.update({"resume_text": "Sara Khan, data analyst with 4 years of experience."})
    monkeypatch.setattr(ats, "scan_resume", lambda profile, providers, job=None: {
        "score": 72, "summary": "Solid, a few gaps.",
        "checks": [{"category": "Keywords", "status": "good", "note": "Covers the core terms."}],
        "suggestions": ["Add a metric to your top bullet."],
    })

    first = client.post("/api/resume/scan", headers=H)
    assert first.status_code == 200, first.text
    assert first.json()["scan"]["score"] == 72

    again = client.post("/api/resume/scan", headers=H)
    assert again.status_code == 429
    assert "rescan" in again.json()["detail"].lower()

    fetched = client.get("/api/resume/scan", headers=H)
    assert fetched.json()["scan"]["summary"] == "Solid, a few gaps."


def test_titles_fall_back_when_ai_fails(client, monkeypatch):
    def fail(titles):
        raise llm.LLMError("limit")
    monkeypatch.setattr(llm, "expand_titles", fail)
    r = client.post("/api/titles", json={"titles": ["Data Analyst", " "]}, headers=H)
    assert r.status_code == 200 and r.json()["titles"] == ["Data Analyst"]
    assert client.post("/api/titles", json={"titles": []}, headers=H).status_code == 400


def test_patch_profile_validates(client):
    ok = client.patch("/api/profile", json={"work_modes": ["remote"], "target_countries": ["ae", "sa"],
                                             "salary": {"minimum": 3000}}, headers=H)
    assert ok.status_code == 200
    body = ok.json()
    assert body["target_countries"] == ["AE", "SA"] and body["salary"]["currency"] == "USD"
    assert client.patch("/api/profile", json={"work_modes": ["moon"]}, headers=H).status_code == 400
    assert client.patch("/api/profile", json={"resume_text": "x"}, headers=H).status_code == 400
    assert client.patch("/api/profile", json={"digest_time": "25:00"}, headers=H).status_code == 400


def test_add_career_page(client, monkeypatch):
    monkeypatch.setattr(api.sources, "check_career_page", lambda page: 12)
    r = client.post("/api/career-pages", json={"url": "https://jobs.lever.co/fresha"}, headers=H)
    assert r.status_code == 200 and r.json()["openings"] == 12
    assert r.json()["profile"]["career_pages"][0]["slug"] == "fresha"
    bad = client.post("/api/career-pages", json={"url": "https://example.com/jobs"}, headers=H)
    assert bad.status_code == 400


# ---------------- runs ----------------

def test_run_requires_setup(client):
    r = client.post("/api/run", headers=H)
    assert r.status_code == 400


def test_full_run_with_fake_sources_and_ai(client, groq_ok, monkeypatch):
    client.post("/api/keys/groq", json={"key": "gsk_goodkey123456"}, headers=H)
    profile_mod.update({"titles": ["QA Engineer"], "home_country": "PK", "target_countries": ["AE"],
                        "skills": ["Playwright"]})

    def fake_fetch(ctx):
        return [
            {"id": "a", "source": "Fake", "title": "QA Engineer", "company": "Acme", "location": "Dubai",
             "url": "https://acme.test/a", "description": "Playwright", "age_days": 2, "direct": True},
            {"id": "b", "source": "Fake", "title": "Principal QA Engineer", "company": "Big", "location": "Dubai",
             "url": "", "description": "", "age_days": 1, "direct": False},
            {"id": "c", "source": "Fake", "title": "QA Engineer", "company": "Old", "location": "Dubai",
             "url": "", "description": "", "age_days": 90, "direct": False},
        ]

    monkeypatch.setattr(pipeline, "SOURCES", [pipeline.SOURCES[0].__class__("fake", "Fake", fake_fetch, lambda p: True)])
    profile_mod.update({"exclude_title_words": ["principal"]})
    monkeypatch.setattr(llm, "evaluate_job", lambda job, p, providers, log=print: {
        "score": 88, "reason": "Strong match.", "visa_sponsorship": "yes", "remote_type": "onsite",
        "years_required": 2, "salary_min": None, "salary_max": None, "salary_currency": "",
        "salary_period": "", "matched_skills": ["Playwright"], "missing_skills": [], "scored_by": "Groq"})

    assert client.post("/api/run", headers=H).status_code == 200
    api.runner.thread.join(timeout=10)

    state = client.get("/api/run", headers=H).json()
    assert state["phase"] == "done", state
    jobs = client.get("/api/jobs", headers=H).json()["jobs"]
    assert [j["id"] for j in jobs] == ["a"]
    assert jobs[0]["tier"] == "apply" and jobs[0]["matched_skills"] == ["Playwright"]

    assert client.patch("/api/jobs/a", json={"status": "applied"}, headers=H).status_code == 200
    assert client.get("/api/jobs?status=applied", headers=H).json()["jobs"][0]["id"] == "a"
    assert client.patch("/api/jobs/nope", json={"status": "applied"}, headers=H).status_code == 404
    assert store.last_run()["stats"]["rejected"] == {'title contains "principal"': 1}


def test_spa_path_traversal_blocked(client):
    r = client.get("/..%2F..%2F.env")
    assert "GROQ" not in r.text
