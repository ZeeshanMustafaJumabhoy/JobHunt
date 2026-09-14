"""Small text helpers shared by every job source."""

import html
import re
from datetime import UTC, datetime

_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")


def clean_desc(raw: str | None, limit: int = 1200) -> str:
    """Strip HTML from a description and cut it to a length the model can score
    without blowing the token budget."""
    if not raw:
        return ""
    text = html.unescape(_TAG_RE.sub(" ", html.unescape(str(raw))))
    return _SPACE_RE.sub(" ", text).strip()[:limit]


def tidy(value) -> str:
    return _SPACE_RE.sub(" ", html.unescape(str(value or ""))).strip()


def _now() -> datetime:
    return datetime.now(UTC)


def days_old(raw) -> int | None:
    """Days since a posting went up, or None when the date is unknown. Accepts ISO
    strings (with or without a zone) and epochs in seconds or milliseconds."""
    if raw in (None, ""):
        return None
    if isinstance(raw, (int, float)) or str(raw).strip().isdigit():
        try:
            ts = float(raw)
            if ts > 1e11:
                ts /= 1000
            return max(0, (_now() - datetime.fromtimestamp(ts, UTC)).days)
        except (ValueError, OverflowError, OSError):
            return None
    s = str(raw).strip().replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        try:
            dt = datetime.strptime(s[:10], "%Y-%m-%d")
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return max(0, (_now() - dt).days)


_YEARS_RE = re.compile(
    r"(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to|–)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)\b", re.I)
PLAUSIBLE_YEARS = (1, 20)


def min_years_required(text: str | None) -> int | None:
    """The smallest "N years" figure a posting asks for, or None.

    Smallest, because "3-7 years" is reachable at 3. Figures outside a plausible
    range are ignored: "in business for 30+ years" is not an experience demand."""
    found = []
    for m in _YEARS_RE.finditer(text or ""):
        n = int(m.group(1))
        if PLAUSIBLE_YEARS[0] <= n <= PLAUSIBLE_YEARS[1]:
            found.append(n)
    return min(found) if found else None


def norm(value) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
