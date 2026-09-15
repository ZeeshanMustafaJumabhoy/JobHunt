"""SQLite storage for scored jobs and run history, in data/shortlist.db.

A job is stored once it has been scored. Its presence is also what marks it as
seen, so a later run doesn't pay to score it again. Jobs whose scoring failed
are never stored, which means the next run retries them.
"""

import json
import sqlite3
import threading
from contextlib import contextmanager
from datetime import UTC, datetime

from .paths import data_dir

_LOCK = threading.Lock()

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    trigger TEXT NOT NULL DEFAULT 'manual',
    status TEXT NOT NULL DEFAULT 'running',
    stats TEXT NOT NULL DEFAULT '{}',
    error TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    run_id INTEGER REFERENCES runs(id),
    found_at TEXT NOT NULL,
    source TEXT, title TEXT, company TEXT, location TEXT, url TEXT, description TEXT,
    age_days INTEGER, direct INTEGER NOT NULL DEFAULT 0,
    bucket INTEGER, bucket_label TEXT,
    score INTEGER NOT NULL DEFAULT 0, tier TEXT, reason TEXT,
    visa_sponsorship TEXT, remote_type TEXT, years_required INTEGER,
    salary TEXT NOT NULL DEFAULT '{}', salary_below_minimum INTEGER NOT NULL DEFAULT 0,
    matched_skills TEXT NOT NULL DEFAULT '[]', missing_skills TEXT NOT NULL DEFAULT '[]',
    scored_by TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    resume_tips TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS jobs_run ON jobs(run_id);
CREATE INDEX IF NOT EXISTS jobs_score ON jobs(score DESC);
CREATE TABLE IF NOT EXISTS ats_scan (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    scanned_at TEXT NOT NULL,
    score INTEGER NOT NULL,
    summary TEXT NOT NULL DEFAULT '',
    checks TEXT NOT NULL DEFAULT '[]',
    suggestions TEXT NOT NULL DEFAULT '[]'
);
"""

STATUSES = ("new", "saved", "applied", "hidden")


def _migrate(conn: sqlite3.Connection) -> None:
    """Add columns introduced after a user's database already existed.
    CREATE TABLE IF NOT EXISTS only helps for brand-new tables."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(jobs)")}
    if "resume_tips" not in cols:
        conn.execute("ALTER TABLE jobs ADD COLUMN resume_tips TEXT NOT NULL DEFAULT '[]'")


def now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")


@contextmanager
def connect():
    conn = sqlite3.connect(data_dir() / "shortlist.db", timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(SCHEMA)
        _migrate(conn)
        yield conn
        conn.commit()
    finally:
        conn.close()


def seen_ids() -> set[str]:
    with connect() as conn:
        return {row[0] for row in conn.execute("SELECT id FROM jobs")}


def start_run(trigger: str = "manual") -> int:
    with _LOCK, connect() as conn:
        cur = conn.execute("INSERT INTO runs (started_at, trigger) VALUES (?, ?)", (now_iso(), trigger))
        return cur.lastrowid


def finish_run(run_id: int, status: str, stats: dict, error: str | None = None) -> None:
    with _LOCK, connect() as conn:
        conn.execute("UPDATE runs SET finished_at=?, status=?, stats=?, error=? WHERE id=?",
                     (now_iso(), status, json.dumps(stats), error, run_id))


def save_job(run_id: int, job: dict) -> None:
    salary = {k: job.get(k) for k in ("salary_min", "salary_max", "salary_currency", "salary_period")}
    with _LOCK, connect() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO jobs (id, run_id, found_at, source, title, company, location,
               url, description, age_days, direct, bucket, bucket_label, score, tier, reason,
               visa_sponsorship, remote_type, years_required, salary, salary_below_minimum,
               matched_skills, missing_skills, scored_by, resume_tips)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (job["id"], run_id, now_iso(), job.get("source"), job.get("title"), job.get("company"),
             job.get("location"), job.get("url"), job.get("description"), job.get("age_days"),
             int(bool(job.get("direct"))), job.get("bucket"), job.get("bucket_label"),
             job.get("score", 0), job.get("tier"), job.get("reason"), job.get("visa_sponsorship"),
             job.get("remote_type"), job.get("years_required"), json.dumps(salary),
             int(bool(job.get("salary_below_minimum"))),
             json.dumps(job.get("matched_skills") or []), json.dumps(job.get("missing_skills") or []),
             job.get("scored_by"), json.dumps(job.get("resume_tips") or [])))


def _job_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["direct"] = bool(d["direct"])
    d["salary_below_minimum"] = bool(d["salary_below_minimum"])
    for key in ("salary", "matched_skills", "missing_skills", "resume_tips"):
        d[key] = json.loads(d[key] or ("{}" if key == "salary" else "[]"))
    return d


def list_jobs(min_score: int = 0, status: str | None = None, run_id: int | None = None,
              limit: int = 500) -> list[dict]:
    sql, args = "SELECT * FROM jobs WHERE score >= ?", [min_score]
    if status:
        sql += " AND status = ?"
        args.append(status)
    else:
        sql += " AND status != 'hidden'"
    if run_id is not None:
        sql += " AND run_id = ?"
        args.append(run_id)
    sql += " ORDER BY score DESC, found_at DESC LIMIT ?"
    args.append(max(1, min(limit, 2000)))
    with connect() as conn:
        return [_job_row(r) for r in conn.execute(sql, args)]


def set_status(job_id: str, status: str) -> bool:
    if status not in STATUSES:
        raise ValueError("Unknown status")
    with _LOCK, connect() as conn:
        return conn.execute("UPDATE jobs SET status=? WHERE id=?", (status, job_id)).rowcount > 0


def _run_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["stats"] = json.loads(d["stats"] or "{}")
    return d


def list_runs(limit: int = 20) -> list[dict]:
    with connect() as conn:
        return [_run_row(r) for r in conn.execute("SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,))]


def last_run(trigger: str | None = None) -> dict | None:
    sql, args = "SELECT * FROM runs", []
    if trigger:
        sql += " WHERE trigger = ?"
        args.append(trigger)
    with connect() as conn:
        row = conn.execute(sql + " ORDER BY id DESC LIMIT 1", args).fetchone()
    return _run_row(row) if row else None


def mark_interrupted_runs() -> None:
    """A run still marked running at startup died with the previous process."""
    with _LOCK, connect() as conn:
        conn.execute("UPDATE runs SET status='interrupted', finished_at=? WHERE status='running'", (now_iso(),))


def counts(min_score: int = 50) -> dict:
    with connect() as conn:
        rows = conn.execute("SELECT status, COUNT(*) FROM jobs WHERE score >= ? GROUP BY status", (min_score,)).fetchall()
    return {status: n for status, n in rows}


def forget_all() -> None:
    with _LOCK, connect() as conn:
        conn.execute("DELETE FROM jobs")
        conn.execute("DELETE FROM runs")


def save_ats_scan(result: dict) -> dict:
    scanned_at = now_iso()
    with _LOCK, connect() as conn:
        conn.execute(
            """INSERT INTO ats_scan (id, scanned_at, score, summary, checks, suggestions)
               VALUES (1, ?, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET
                 scanned_at=excluded.scanned_at, score=excluded.score, summary=excluded.summary,
                 checks=excluded.checks, suggestions=excluded.suggestions""",
            (scanned_at, result["score"], result["summary"],
             json.dumps(result["checks"]), json.dumps(result["suggestions"])))
    return get_ats_scan()


def get_ats_scan() -> dict | None:
    with connect() as conn:
        row = conn.execute("SELECT * FROM ats_scan WHERE id = 1").fetchone()
    if not row:
        return None
    d = dict(row)
    d["checks"] = json.loads(d["checks"] or "[]")
    d["suggestions"] = json.loads(d["suggestions"] or "[]")
    return d
