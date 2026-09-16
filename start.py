"""Start Shortlist with one command (use "python" instead of "python3" on
Windows, where that's usually the only one that exists):

    python3 start.py            install what's missing, build the UI, open the browser
    python3 start.py --dev      also run the Vite dev server with hot reload (for contributors)
    python3 start.py --no-open  don't open a browser tab

Needs Python 3.11+ and Node.js 20+ somewhere on this machine, and Node.js on
this terminal's PATH. If the Python running this script itself is older
(common on macOS, which ships Python 3.9 with Xcode's command line tools),
it looks for a newer one already installed and uses that instead — nothing
is installed globally either way. Everything goes inside this folder:
Python packages into .venv/, JavaScript packages into frontend/node_modules/.
"""

# This file must parse on whatever old Python happens to be running it (that's
# the whole problem find_newer_python() below solves), so modern syntax like
# `str | None` needs this to not fail before we even get a chance to look.
from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"
FRONTEND = ROOT / "frontend"
BACKEND = ROOT / "backend"
PORT = int(os.environ.get("SHORTLIST_PORT", "8421"))
IS_WINDOWS = os.name == "nt"


def say(msg: str) -> None:
    print(f"  {msg}", flush=True)


def fail(msg: str) -> None:
    print(f"\n  {msg}\n", file=sys.stderr, flush=True)
    sys.exit(1)


def venv_python() -> Path:
    return VENV / ("Scripts/python.exe" if IS_WINDOWS else "bin/python")


def run(cmd: list, cwd: Path = ROOT) -> None:
    result = subprocess.run(cmd, cwd=cwd, shell=IS_WINDOWS and cmd[0] in ("npm", "npx"))
    if result.returncode != 0:
        fail(f"This command failed: {' '.join(str(c) for c in cmd)}")


def fingerprint(*paths: Path) -> str:
    h = hashlib.sha256()
    for p in paths:
        if p.exists():
            h.update(p.read_bytes())
    return h.hexdigest()


def _python_version(executable: str) -> tuple:
    try:
        out = subprocess.run(
            [executable, "-c", "import sys; print(sys.version_info.major, sys.version_info.minor)"],
            capture_output=True, text=True, timeout=5,
        )
        major, minor = out.stdout.split()
        return int(major), int(minor)
    except Exception:
        return (0, 0)


def find_newer_python() -> str | None:
    """The newest Python 3.11+ this machine has, even if the one running this
    script is too old. macOS in particular ships an old Python with Xcode's
    command line tools, so a fine one is often just sitting on PATH unused
    (Homebrew's python3.13, python.org's installer, pyenv, ...) under a
    version-suffixed name that "python3" doesn't point to."""
    candidates = {p for p in (shutil.which("python3"), shutil.which("python")) if p}
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        try:
            names = os.listdir(directory)
        except OSError:
            continue
        for name in names:
            base = name[:-4] if IS_WINDOWS and name.lower().endswith(".exe") else name
            if base.count(".") == 1:
                prefix, suffix = base.split(".")
                if prefix in ("python3", "python") and suffix.isdigit():
                    candidates.add(os.path.join(directory, name))
    best_version, best_path = (0, 0), None
    for path in candidates:
        version = _python_version(path)
        if version >= (3, 11) and version > best_version:
            best_version, best_path = version, path
    return best_path


def ensure_python() -> None:
    python = sys.executable
    if sys.version_info < (3, 11):  # noqa: UP036 - this process may be on an old Python
        found = find_newer_python()
        if not found:
            fail(
                f"Shortlist needs Python 3.11 or newer. This is {sys.version.split()[0]}.\n"
                "  Install a newer one, then run this again:\n"
                "    macOS:    brew install python@3.13\n"
                "    Windows:  https://python.org/downloads (check \"Add to PATH\" during install)\n"
                "    Linux:    use your package manager, e.g. sudo apt install python3.11"
            )
        say(f"This terminal's Python is {sys.version.split()[0]}; using {found} instead.")
        python = found
    if not venv_python().exists():
        say("Creating a Python environment in .venv")
        run([python, "-m", "venv", str(VENV)])
    marker = VENV / ".requirements-hash"
    wanted = fingerprint(BACKEND / "requirements.txt")
    if not marker.exists() or marker.read_text() != wanted:
        say("Installing Python packages")
        run([venv_python(), "-m", "pip", "install", "--quiet", "--disable-pip-version-check",
             "-r", BACKEND / "requirements.txt"])
        marker.write_text(wanted)


def ensure_frontend(build: bool) -> None:
    if not shutil.which("npm"):
        fail("Node.js is needed to build the interface. Install the LTS version from nodejs.org, then run this again.")
    marker = FRONTEND / "node_modules" / ".lock-hash"
    wanted = fingerprint(FRONTEND / "package-lock.json")
    if not marker.exists() or marker.read_text() != wanted:
        say("Installing interface packages (first run takes a minute)")
        run(["npm", "ci", "--no-audit", "--no-fund", "--loglevel=error"], cwd=FRONTEND)
        marker.write_text(wanted)
    if not build:
        return
    dist = FRONTEND / "dist" / "index.html"
    sources = [p for p in (FRONTEND / "src").rglob("*") if p.is_file()] + [FRONTEND / "index.html"]
    newest = max(p.stat().st_mtime for p in sources)
    if not dist.exists() or dist.stat().st_mtime < newest:
        say("Building the interface")
        run(["npm", "run", "build", "--silent"], cwd=FRONTEND)


def ensure_env_file() -> None:
    env = ROOT / ".env"
    if not env.exists():
        env.write_text("# Shortlist saves your keys here during setup. Never commit this file.\n", encoding="utf-8")


def open_browser_when_ready(url: str) -> None:
    def wait():
        for _ in range(60):
            try:
                urllib.request.urlopen(url, timeout=1)
                break
            except OSError:
                time.sleep(0.5)
        webbrowser.open(url)

    threading.Thread(target=wait, daemon=True).start()


def main() -> None:
    parser = argparse.ArgumentParser(description="Start Shortlist")
    parser.add_argument("--dev", action="store_true", help="run the Vite dev server with hot reload")
    parser.add_argument("--no-open", action="store_true", help="don't open a browser tab")
    args = parser.parse_args()

    print("\n  Shortlist\n", flush=True)
    ensure_python()
    ensure_frontend(build=not args.dev)
    ensure_env_file()

    url = "http://localhost:5173" if args.dev else f"http://localhost:{PORT}"
    vite = None
    if args.dev:
        vite = subprocess.Popen(["npm", "run", "dev", "--silent"], cwd=FRONTEND, shell=IS_WINDOWS)
    if not args.no_open:
        open_browser_when_ready(url)

    say(f"Open {url}")
    say("Keep this window open while you use Shortlist. Press Ctrl+C to stop.\n")
    server = [venv_python(), "-m", "uvicorn", "shortlist.api:app",
              "--host", "127.0.0.1", "--port", str(PORT), "--log-level", "warning"]
    if args.dev:
        server.append("--reload")
    try:
        subprocess.run(server, cwd=BACKEND)
    except KeyboardInterrupt:
        pass
    finally:
        if vite:
            vite.terminate()
        say("Stopped.")


if __name__ == "__main__":
    main()
