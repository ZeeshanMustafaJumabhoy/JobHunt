"""The email digest, sent through the user's own Gmail."""

import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
from urllib.parse import urlparse

from . import envfile

TIER_NAMES = {"apply": "Apply now", "strong": "Strong match", "maybe": "Worth a look"}
REMOTE_NAMES = {"remote_worldwide": "Remote, worldwide", "remote_regional": "Remote, one region only",
                "hybrid": "Hybrid", "onsite": "On-site"}


def _safe_url(url: str) -> str:
    # Postings come from third parties. Only link out to http(s).
    return url if urlparse(url or "").scheme in ("http", "https") else ""


def build_html(jobs: list[dict]) -> str:
    date = datetime.now().strftime("%d %B %Y")
    out = [f"<div style=\"font-family:Arial,sans-serif;color:#1B2430;max-width:640px\">"
           f"<h2 style=\"font-weight:600\">Your shortlist for {date}</h2>"]
    if not jobs:
        out.append("<p>No new jobs cleared the bar today. The search runs again tomorrow.</p>")
    for tier, name in TIER_NAMES.items():
        group = sorted((j for j in jobs if j.get("tier") == tier), key=lambda j: (j.get("bucket", 9), -j["score"]))
        if not group:
            continue
        out.append(f"<h3 style=\"margin-top:28px;font-weight:600\">{name} ({len(group)})</h3>")
        for j in group:
            facts = [j.get("bucket_label"), REMOTE_NAMES.get(j.get("remote_type"))]
            if j.get("visa_sponsorship") == "yes":
                facts.append("Offers visa sponsorship")
            elif j.get("visa_sponsorship") == "no":
                facts.append("No sponsorship")
            if j.get("salary_below_minimum"):
                facts.append("Pays below your minimum")
            url = _safe_url(j.get("url", ""))
            title = escape(j.get("title") or "Untitled")
            title_html = f"<a href=\"{escape(url, quote=True)}\" style=\"color:#2E47C2\">{title}</a>" if url else title
            skills = ", ".join(j.get("matched_skills") or [])
            out.append(
                "<div style=\"padding:12px 0;border-top:1px solid #DADDD6\">"
                f"<div style=\"font-size:16px\"><b>{title_html}</b></div>"
                f"<div>{escape(j.get('company') or '')}, {escape(j.get('location') or '')}. Score {j['score']}</div>"
                f"<div style=\"color:#5A6470\">{escape(', '.join(f for f in facts if f))}</div>"
                f"<div style=\"margin-top:4px\">{escape(j.get('reason') or '')}</div>"
                + (f"<div style=\"color:#5A6470\">You have: {escape(skills)}</div>" if skills else "")
                + "</div>")
    out.append("<p style=\"color:#5A6470;font-size:12px;margin-top:28px\">Sent by Shortlist, running on your own computer.</p></div>")
    return "".join(out)


def send_digest(jobs: list[dict]) -> None:
    address = envfile.get("GMAIL_ADDRESS")
    password = envfile.get("GMAIL_APP_PASSWORD").replace(" ", "")
    if not (address and password):
        raise RuntimeError("Email isn't set up.")
    recipient = envfile.get("RECIPIENT_EMAIL") or address
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Shortlist: {len(jobs)} new jobs for {datetime.now().strftime('%d %b')}"
    msg["From"] = address
    msg["To"] = recipient
    msg.attach(MIMEText(build_html(jobs), "html", "utf-8"))
    with smtplib.SMTP("smtp.gmail.com", 587, timeout=30) as server:
        server.starttls()
        server.login(address, password)
        server.sendmail(address, [recipient], msg.as_string())
