"""Live checks for each key before it is saved.

Each checker makes the cheapest request that proves the key works and returns
(ok, message). Messages are shown to the user, so they say what to do next.
"""

import smtplib

import requests

TIMEOUT = 20


def _network_error(e: Exception) -> tuple[bool, str]:
    return False, f"Couldn't reach the service ({e.__class__.__name__}). Check your internet connection."


def check_groq(key: str) -> tuple[bool, str]:
    if not key.startswith("gsk_"):
        return False, "Groq keys start with gsk_. Copy the whole key from console.groq.com/keys."
    try:
        r = requests.get("https://api.groq.com/openai/v1/models", timeout=TIMEOUT,
                         headers={"Authorization": f"Bearer {key}"})
    except requests.RequestException as e:
        return _network_error(e)
    if r.status_code == 200:
        return True, "Groq key works."
    if r.status_code in (401, 403):
        return False, "Groq rejected this key. Create a new one at console.groq.com/keys."
    return False, f"Groq answered with HTTP {r.status_code}. Try again in a minute."


def check_openrouter(key: str) -> tuple[bool, str]:
    try:
        r = requests.get("https://openrouter.ai/api/v1/key", timeout=TIMEOUT,
                         headers={"Authorization": f"Bearer {key}"})
    except requests.RequestException as e:
        return _network_error(e)
    if r.status_code == 200:
        return True, "OpenRouter key works."
    if r.status_code in (401, 403):
        return False, "OpenRouter rejected this key. Create one at openrouter.ai/keys."
    return False, f"OpenRouter answered with HTTP {r.status_code}. Try again in a minute."


def check_adzuna(app_id: str, app_key: str) -> tuple[bool, str]:
    try:
        r = requests.get("https://api.adzuna.com/v1/api/jobs/gb/search/1", timeout=TIMEOUT,
                         params={"app_id": app_id, "app_key": app_key, "results_per_page": 1, "what": "engineer"})
    except requests.RequestException as e:
        return _network_error(e)
    if r.status_code == 200:
        return True, "Adzuna keys work."
    if r.status_code in (400, 401, 403):
        return False, "Adzuna rejected this ID and key pair. Both are on developer.adzuna.com under Dashboard."
    return False, f"Adzuna answered with HTTP {r.status_code}. Try again in a minute."


def check_jooble(key: str) -> tuple[bool, str]:
    if "/" in key or len(key) > 100:
        return False, "That doesn't look like a Jooble key."
    try:
        r = requests.post(f"https://jooble.org/api/{key}", json={"keywords": "engineer"}, timeout=TIMEOUT)
    except requests.RequestException as e:
        return _network_error(e)
    if r.status_code == 200:
        return True, "Jooble key works."
    if r.status_code in (401, 403, 404):
        return False, "Jooble rejected this key. The key arrives by email after signing up at jooble.org/api/about."
    return False, f"Jooble answered with HTTP {r.status_code}. Try again in a minute."


def check_rapidapi(key: str) -> tuple[bool, str]:
    host = "jsearch.p.rapidapi.com"
    try:
        r = requests.get(f"https://{host}/search", timeout=30,
                         headers={"X-RapidAPI-Key": key, "X-RapidAPI-Host": host},
                         params={"query": "engineer", "page": "1", "num_pages": "1"})
    except requests.RequestException as e:
        return _network_error(e)
    if r.status_code == 200:
        return True, "RapidAPI key works with JSearch."
    if r.status_code == 403:
        return False, "The key is valid but not subscribed to JSearch. Open JSearch on RapidAPI and pick the free Basic plan."
    if r.status_code == 401:
        return False, "RapidAPI rejected this key. Copy it from the X-RapidAPI-Key field on the JSearch page."
    if r.status_code == 429:
        return True, "Key works, but this month's free JSearch requests are used up."
    return False, f"JSearch answered with HTTP {r.status_code}. Try again in a minute."


def check_gmail(address: str, app_password: str) -> tuple[bool, str]:
    password = app_password.replace(" ", "")
    if len(password) != 16:
        return False, "A Gmail app password is 16 letters. Your normal Gmail password won't work here."
    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=TIMEOUT) as server:
            server.starttls()
            server.login(address, password)
        return True, "Gmail accepted the app password."
    except smtplib.SMTPAuthenticationError:
        return False, "Gmail rejected the address or app password. Make sure 2-Step Verification is on, then create a new app password."
    except (OSError, smtplib.SMTPException) as e:
        return _network_error(e)
