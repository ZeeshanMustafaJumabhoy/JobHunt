"""Where Shortlist keeps things on disk.

Both locations can be overridden with environment variables, which is what the
test suite does so it never touches a real .env or a real profile.
"""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def env_path() -> Path:
    return Path(os.environ.get("SHORTLIST_ENV_FILE") or PROJECT_ROOT / ".env")


def data_dir() -> Path:
    path = Path(os.environ.get("SHORTLIST_DATA_DIR") or PROJECT_ROOT / "data")
    path.mkdir(parents=True, exist_ok=True)
    return path


def frontend_dist() -> Path:
    return PROJECT_ROOT / "frontend" / "dist"
