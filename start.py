"""Start Shortlist with one command:

    python start.py            install what's missing, build the UI, open the browser
    python start.py --dev      also run the Vite dev server with hot reload (for contributors)
    python start.py --no-open  don't open a browser tab

Needs Python 3.11+ and Node.js 20+. Everything is installed inside this folder:
Python packages into .venv/, JavaScript packages into frontend/node_modules/.
"""

import argparse
import hashlib
import os
import shutil
import subprocess
import sys
import threading
import time
import urllib.request
import venv
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


def ensure_python() -> None:
    if sys.version_info < (3, 11):  # noqa: UP036 - start.py runs on whatever Python the user has
        fail(f"Shortlist needs Python 3.11 or newer. This is {sys.version.split()[0]}.")
    if not venv_python().exists():
        say("Creating a Python environment in .venv")
        venv.create(VENV, with_pip=True)
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
