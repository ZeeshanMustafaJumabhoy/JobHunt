import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from shortlist import envfile  # noqa: E402


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    """Every test gets its own .env and data folder, and no real keys."""
    monkeypatch.setenv("SHORTLIST_ENV_FILE", str(tmp_path / ".env"))
    monkeypatch.setenv("SHORTLIST_DATA_DIR", str(tmp_path / "data"))
    for key in list(envfile.KNOWN_KEYS) + ["GROQ_MODEL", "OPENROUTER_MODELS"]:
        monkeypatch.delenv(key, raising=False)
    # The app sleeps between calls to respect rate limits. Not in tests. Only the
    # app's modules are patched, since pytest and anyio rely on the real sleep.
    from shortlist import llm, pipeline, sources
    for module in (llm, pipeline, sources):
        monkeypatch.setattr(module, "time", _NoSleep())
    yield tmp_path
    # write_env mutates os.environ directly; monkeypatch doesn't see those.
    for key in envfile.KNOWN_KEYS:
        os.environ.pop(key, None)


class _NoSleep:
    def __getattr__(self, name):
        import time
        return getattr(time, name)

    @staticmethod
    def sleep(*_):
        return None


class FakeResponse:
    def __init__(self, status=200, json_data=None, text="", headers=None):
        self.status_code = status
        self._json = json_data
        self.text = text if text else ("" if json_data is None else str(json_data))
        self.headers = headers or {}

    def json(self):
        if self._json is None:
            raise ValueError("no json")
        return self._json

    def raise_for_status(self):
        import requests
        if self.status_code >= 400:
            raise requests.HTTPError(response=self)


@pytest.fixture
def fake_response():
    return FakeResponse
