"""Read and write the project's .env file.

The setup wizard saves each key as soon as it has been tested, so a user who
closes the app halfway through picks up where they left off. Writes preserve
comments, ordering and any keys this app doesn't know about, and go through a
temp file so a crash mid-write can't leave a half-written .env behind.
"""

import os
import re
import tempfile
from pathlib import Path

from .paths import env_path

# Every key the app reads, with what it is for. The frontend never receives the
# values, only whether each one is set and a masked hint.
KNOWN_KEYS = {
    "GROQ_API_KEY": "Groq (AI, required)",
    "OPENROUTER_API_KEY": "OpenRouter (backup AI)",
    "ADZUNA_APP_ID": "Adzuna app ID",
    "ADZUNA_APP_KEY": "Adzuna app key",
    "JOOBLE_API_KEY": "Jooble",
    "RAPIDAPI_KEY": "RapidAPI (JSearch)",
    "GMAIL_ADDRESS": "Gmail address",
    "GMAIL_APP_PASSWORD": "Gmail app password",
    "RECIPIENT_EMAIL": "Send the digest to",
}

_KEY_RE = re.compile(r"^[A-Z][A-Z0-9_]*$")
_LINE_RE = re.compile(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$")


def _unquote(raw: str) -> str:
    raw = raw.strip()
    if len(raw) >= 2 and raw[0] == raw[-1] == '"':
        return re.sub(r"\\(.)", r"\1", raw[1:-1])
    if len(raw) >= 2 and raw[0] == raw[-1] == "'":
        return raw[1:-1]
    return raw


def read_env(path: Path | None = None) -> dict[str, str]:
    path = path or env_path()
    if not path.exists():
        return {}
    values = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.lstrip().startswith("#"):
            continue
        m = _LINE_RE.match(line)
        if m:
            values[m.group(1)] = _unquote(m.group(2))
    return values


def _validate(key: str, value: str) -> None:
    if not _KEY_RE.match(key):
        raise ValueError(f"Invalid key name: {key!r}")
    # A newline in a value would let one field write arbitrary extra lines.
    if "\n" in value or "\r" in value:
        raise ValueError(f"{key} can't contain a line break")


def _format(value: str) -> str:
    if value == "" or re.search(r"[\s#\"']", value):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    return value


def write_env(updates: dict[str, str | None], path: Path | None = None) -> None:
    """Set keys to new values. A value of None removes the key."""
    path = path or env_path()
    for key, value in updates.items():
        _validate(key, value or "")

    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    remaining = dict(updates)
    out = []
    for line in lines:
        m = _LINE_RE.match(line)
        if m and not line.lstrip().startswith("#") and m.group(1) in remaining:
            value = remaining.pop(m.group(1))
            if value is not None:
                out.append(f"{m.group(1)}={_format(value)}")
            continue
        out.append(line)
    for key, value in remaining.items():
        if value is not None:
            out.append(f"{key}={_format(value)}")

    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".env.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write("\n".join(out) + "\n")
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.unlink(tmp)
        raise

    for key, value in updates.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value


def load_into_environ(path: Path | None = None) -> None:
    """Values in .env win over the process environment. The wizard is the source
    of truth, and a stale shell variable silently overriding a key the user just
    saved is exactly the kind of bug nobody can diagnose."""
    for key, value in read_env(path).items():
        os.environ[key] = value


def get(key: str) -> str:
    return os.environ.get(key, "").strip()


def mask(value: str) -> str:
    if not value:
        return ""
    if "@" in value:
        name, _, domain = value.partition("@")
        return f"{name[:2]}…@{domain}"
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:4]}…{value[-4:]}"


def status() -> dict[str, dict]:
    return {key: {"label": label, "set": bool(get(key)), "hint": mask(get(key))}
            for key, label in KNOWN_KEYS.items()}
