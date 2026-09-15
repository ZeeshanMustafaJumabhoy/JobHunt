from shortlist import ats
from shortlist.profile import Profile


def test_parse_scan_clamps_and_filters_categories():
    result = ats.parse_scan({
        "score": "150",
        "summary": "Reads fine but light on numbers.",
        "checks": [
            {"category": "keywords", "status": "GOOD", "note": "Covers the core terms."},
            {"category": "Not a real category", "status": "bad", "note": "ignored"},
            {"category": "Keywords", "status": "bad", "note": "duplicate category is dropped"},
        ],
        "suggestions": ["Add a metric.", "Add a metric.", "Spell out ATS on first use."],
    })
    assert result["score"] == 100
    assert result["checks"] == [{"category": "Keywords", "status": "good", "note": "Covers the core terms."}]
    assert result["suggestions"] == ["Add a metric.", "Spell out ATS on first use."]


def test_parse_scan_survives_garbage():
    result = ats.parse_scan({"score": "n/a", "checks": "nope", "suggestions": None})
    assert result == {"score": 0, "summary": "", "checks": [], "suggestions": []}


def test_scan_prompt_targets_a_specific_job_when_given():
    profile = Profile(resume_text="Sara Khan, data analyst.", titles=["Data Analyst"])
    prompt = ats.scan_prompt(profile, job={"title": "BI Analyst", "company": "Acme", "description": "SQL and Tableau."})
    assert "BI Analyst" in prompt and "Acme" in prompt


def test_scan_prompt_falls_back_to_profile_titles():
    profile = Profile(resume_text="Sara Khan.", titles=["Data Analyst"], skills=["SQL"])
    prompt = ats.scan_prompt(profile)
    assert "Data Analyst" in prompt and "SQL" in prompt
