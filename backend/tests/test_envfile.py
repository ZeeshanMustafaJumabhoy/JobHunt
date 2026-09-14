import os

import pytest
from shortlist import envfile


def test_write_then_read_round_trips(isolated):
    envfile.write_env({"GROQ_API_KEY": "gsk_abc123", "GMAIL_APP_PASSWORD": 'has space "quote"'})
    values = envfile.read_env()
    assert values["GROQ_API_KEY"] == "gsk_abc123"
    assert values["GMAIL_APP_PASSWORD"] == 'has space "quote"'
    assert os.environ["GROQ_API_KEY"] == "gsk_abc123"


def test_write_preserves_comments_and_unknown_keys(isolated):
    path = isolated / ".env"
    path.write_text("# my notes\nOTHER_THING=keep\nGROQ_API_KEY=old\n", encoding="utf-8")
    envfile.write_env({"GROQ_API_KEY": "gsk_new"})
    text = path.read_text(encoding="utf-8")
    assert "# my notes" in text
    assert "OTHER_THING=keep" in text
    assert "GROQ_API_KEY=gsk_new" in text
    assert "old" not in text


def test_none_removes_key(isolated):
    envfile.write_env({"JOOBLE_API_KEY": "x1"})
    envfile.write_env({"JOOBLE_API_KEY": None})
    assert "JOOBLE_API_KEY" not in envfile.read_env()
    assert "JOOBLE_API_KEY" not in os.environ


@pytest.mark.parametrize("value", ["abc\nEVIL=1", "abc\rEVIL=1"])
def test_rejects_line_breaks(value):
    with pytest.raises(ValueError):
        envfile.write_env({"GROQ_API_KEY": value})


def test_rejects_bad_key_names():
    with pytest.raises(ValueError):
        envfile.write_env({"lower case": "x"})


def test_file_values_override_stale_environment(isolated, monkeypatch):
    (isolated / ".env").write_text("GROQ_API_KEY=from_file\n", encoding="utf-8")
    monkeypatch.setenv("GROQ_API_KEY", "stale_shell_value")
    envfile.load_into_environ()
    assert os.environ["GROQ_API_KEY"] == "from_file"


def test_status_never_contains_full_values():
    envfile.write_env({"GROQ_API_KEY": "gsk_supersecretvalue1234", "GMAIL_ADDRESS": "someone@gmail.com"})
    status = envfile.status()
    assert status["GROQ_API_KEY"]["set"] is True
    assert "supersecret" not in str(status)
    assert status["GMAIL_ADDRESS"]["hint"] == "so…@gmail.com"
    assert status["JOOBLE_API_KEY"] == {"label": "Jooble", "set": False, "hint": ""}
