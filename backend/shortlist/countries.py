"""Countries the app can target, with the words postings use to name them.

Job boards write locations every way imaginable ("Dubai - UAE", "KSA", "Remote,
Deutschland"), so each country carries its common aliases and larger cities.
Matching is on word boundaries: plain substring matching once filed Romania
under Oman.
"""

import re
from functools import lru_cache

# code: (name, [aliases and cities])
COUNTRIES: dict[str, tuple[str, list[str]]] = {
    "AE": ("United Arab Emirates", ["uae", "u.a.e", "emirates", "emirati", "dubai", "abu dhabi", "sharjah", "ajman", "ras al khaimah"]),
    "SA": ("Saudi Arabia", ["saudi", "ksa", "riyadh", "jeddah", "dammam", "khobar", "neom", "mecca", "medina"]),
    "QA": ("Qatar", ["doha"]),
    "KW": ("Kuwait", ["kuwait city"]),
    "BH": ("Bahrain", ["manama"]),
    "OM": ("Oman", ["muscat"]),
    "JO": ("Jordan", ["amman"]),
    "EG": ("Egypt", ["cairo", "alexandria", "giza"]),
    "TR": ("Turkey", ["turkiye", "türkiye", "istanbul", "ankara", "izmir"]),
    "IL": ("Israel", ["tel aviv", "jerusalem", "haifa"]),
    "PK": ("Pakistan", ["karachi", "lahore", "islamabad", "rawalpindi", "faisalabad", "peshawar", "multan"]),
    "IN": ("India", ["bangalore", "bengaluru", "mumbai", "delhi", "new delhi", "gurgaon", "gurugram", "noida", "hyderabad", "pune", "chennai", "kolkata", "ahmedabad"]),
    "BD": ("Bangladesh", ["dhaka", "chittagong"]),
    "LK": ("Sri Lanka", ["colombo"]),
    "NP": ("Nepal", ["kathmandu"]),
    "SG": ("Singapore", []),
    "MY": ("Malaysia", ["kuala lumpur", "penang", "cyberjaya"]),
    "ID": ("Indonesia", ["jakarta", "bali", "surabaya"]),
    "PH": ("Philippines", ["manila", "makati", "cebu", "taguig"]),
    "VN": ("Vietnam", ["ho chi minh", "hanoi", "da nang"]),
    "TH": ("Thailand", ["bangkok", "chiang mai"]),
    "JP": ("Japan", ["tokyo", "osaka", "kyoto", "fukuoka"]),
    "KR": ("South Korea", ["korea", "seoul"]),
    "CN": ("China", ["beijing", "shanghai", "shenzhen", "guangzhou", "hangzhou"]),
    "HK": ("Hong Kong", []),
    "TW": ("Taiwan", ["taipei"]),
    "AU": ("Australia", ["sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra"]),
    "NZ": ("New Zealand", ["auckland", "wellington", "christchurch"]),
    "US": ("United States", ["usa", "u.s.", "u.s.a", "us-based", "new york", "san francisco", "seattle", "austin", "boston", "chicago", "denver", "atlanta", "los angeles", "california", "texas", "florida", "washington dc", "miami", "dallas", "houston", "san diego", "san jose", "portland", "raleigh"]),
    "CA": ("Canada", ["toronto", "vancouver", "montreal", "ottawa", "calgary", "edmonton", "waterloo"]),
    "MX": ("Mexico", ["mexico city", "guadalajara", "monterrey"]),
    "BR": ("Brazil", ["brasil", "sao paulo", "são paulo", "rio de janeiro", "belo horizonte", "curitiba", "florianopolis"]),
    "AR": ("Argentina", ["buenos aires", "cordoba"]),
    "CO": ("Colombia", ["bogota", "bogotá", "medellin", "medellín"]),
    "CL": ("Chile", ["santiago"]),
    "GB": ("United Kingdom", ["uk", "u.k.", "england", "scotland", "wales", "britain", "london", "manchester", "edinburgh", "glasgow", "birmingham", "bristol", "leeds", "cambridge", "oxford", "belfast"]),
    "IE": ("Ireland", ["dublin", "cork", "galway"]),
    "DE": ("Germany", ["deutschland", "berlin", "munich", "münchen", "hamburg", "frankfurt", "cologne", "köln", "stuttgart", "dusseldorf", "düsseldorf", "leipzig"]),
    "NL": ("Netherlands", ["holland", "amsterdam", "rotterdam", "utrecht", "the hague", "eindhoven"]),
    "BE": ("Belgium", ["brussels", "antwerp", "ghent"]),
    "LU": ("Luxembourg", []),
    "FR": ("France", ["paris", "lyon", "marseille", "toulouse", "nantes", "lille"]),
    "ES": ("Spain", ["españa", "madrid", "barcelona", "valencia", "seville", "malaga", "málaga"]),
    "PT": ("Portugal", ["lisbon", "lisboa", "porto", "braga"]),
    "IT": ("Italy", ["italia", "milan", "milano", "rome", "roma", "turin", "torino", "bologna"]),
    "CH": ("Switzerland", ["zurich", "zürich", "geneva", "basel", "lausanne", "bern"]),
    "AT": ("Austria", ["vienna", "wien", "graz", "linz"]),
    "PL": ("Poland", ["warsaw", "warszawa", "krakow", "kraków", "wroclaw", "wrocław", "gdansk", "gdańsk", "poznan", "poznań"]),
    "CZ": ("Czech Republic", ["czechia", "prague", "praha", "brno"]),
    "RO": ("Romania", ["bucharest", "cluj", "iasi", "timisoara"]),
    "HU": ("Hungary", ["budapest"]),
    "BG": ("Bulgaria", ["sofia", "plovdiv"]),
    "GR": ("Greece", ["athens", "thessaloniki"]),
    "HR": ("Croatia", ["zagreb"]),
    "RS": ("Serbia", ["belgrade", "novi sad"]),
    "SE": ("Sweden", ["stockholm", "gothenburg", "malmo", "malmö"]),
    "NO": ("Norway", ["oslo", "bergen"]),
    "DK": ("Denmark", ["copenhagen", "aarhus"]),
    "FI": ("Finland", ["helsinki", "espoo", "tampere"]),
    "EE": ("Estonia", ["tallinn", "tartu"]),
    "LV": ("Latvia", ["riga"]),
    "LT": ("Lithuania", ["vilnius", "kaunas"]),
    "UA": ("Ukraine", ["kyiv", "kiev", "lviv", "kharkiv"]),
    "CY": ("Cyprus", ["limassol", "nicosia"]),
    "MT": ("Malta", ["valletta"]),
    "ZA": ("South Africa", ["cape town", "johannesburg", "pretoria", "durban"]),
    "NG": ("Nigeria", ["lagos", "abuja"]),
    "KE": ("Kenya", ["nairobi"]),
    "MA": ("Morocco", ["casablanca", "rabat"]),
}

# Quick-pick groups for the country question, so nobody has to tick six boxes
# one at a time to say "the Gulf".
GROUPS: dict[str, list[str]] = {
    "Gulf (GCC)": ["AE", "SA", "QA", "KW", "BH", "OM"],
    "Western Europe": ["GB", "IE", "DE", "NL", "BE", "FR", "CH", "AT", "LU"],
    "Nordics": ["SE", "NO", "DK", "FI"],
    "Central and Eastern Europe": ["PL", "CZ", "RO", "HU", "BG", "HR", "RS", "EE", "LV", "LT"],
    "North America": ["US", "CA"],
    "South Asia": ["PK", "IN", "BD", "LK"],
    "Southeast Asia": ["SG", "MY", "ID", "PH", "VN", "TH"],
    "Australia and New Zealand": ["AU", "NZ"],
}

# Region words that aren't a country but do tell us roughly where a job is.
REGION_WORDS: dict[str, list[str]] = {
    "middle east": ["AE", "SA", "QA", "KW", "BH", "OM", "JO", "EG"],
    "mena": ["AE", "SA", "QA", "KW", "BH", "OM", "JO", "EG", "MA"],
    "gcc": GROUPS["Gulf (GCC)"],
    "gulf": GROUPS["Gulf (GCC)"],
    "europe": GROUPS["Western Europe"] + GROUPS["Nordics"] + GROUPS["Central and Eastern Europe"] + ["ES", "PT", "IT"],
    "emea": GROUPS["Western Europe"] + ["AE", "SA"],
    "apac": GROUPS["Southeast Asia"] + ["AU", "NZ", "JP", "IN"],
    "latam": ["BR", "AR", "CO", "CL", "MX"],
    "north america": ["US", "CA"],
}

# Short aliases that are also ordinary English words, or strings that are
# substrings of unrelated place names. These only count when the location field
# is short and contains nothing else, so "US" matches but "join us" doesn't.
_AMBIGUOUS = {"us", "uk", "in", "id", "ca", "de", "no"}

# Adzuna only runs country-scoped searches in these markets.
ADZUNA_MARKETS = {"AT", "AU", "BE", "BR", "CA", "CH", "DE", "ES", "FR", "GB", "IN",
                  "IT", "MX", "NL", "NZ", "PL", "SG", "US", "ZA"}


def name_of(code: str) -> str:
    return COUNTRIES.get(code.upper(), (code, []))[0]


@lru_cache(maxsize=1)
def _patterns() -> list[tuple[str, re.Pattern]]:
    out = []
    for code, (name, aliases) in COUNTRIES.items():
        words = [name.lower()] + [a for a in aliases if a not in _AMBIGUOUS]
        # Longest first, so "new york" is tried before "york".
        words.sort(key=len, reverse=True)
        # Bounded on both sides: "oman" must not match Romania, nor "india" Indiana.
        out.append((code, re.compile(r"(?<![a-z])(?:" + "|".join(re.escape(w) for w in words) + r")(?![a-z])")))
    return out


_REGION_RE = re.compile(r"(?<![a-z])(" + "|".join(re.escape(w) for w in REGION_WORDS) + r")(?![a-z])")
_BARE_CODE_RE = re.compile(r"(?:^|[,(/\-\s])(us|usa|uk|ca|de|in)(?:$|[),/\-\s])")
_BARE_CODE_MAP = {"us": "US", "usa": "US", "uk": "GB", "ca": "CA", "de": "DE", "in": "IN"}


def countries_in(text: str, location: str = "") -> set[str]:
    """Every country a piece of text names, as ISO codes."""
    blob = (text or "").lower()
    found = {code for code, pattern in _patterns() if pattern.search(blob)}
    # Two-letter codes are only trusted inside the location field, where "US" or
    # "Remote - UK" means the country and not the pronoun.
    loc = (location or "").lower()
    for m in _BARE_CODE_RE.finditer(loc):
        found.add(_BARE_CODE_MAP[m.group(1)])
    return found


def regions_in(text: str) -> set[str]:
    blob = (text or "").lower()
    out: set[str] = set()
    for m in _REGION_RE.finditer(blob):
        out.update(REGION_WORDS[m.group(1)])
    return out


def as_options() -> list[dict]:
    return [{"code": code, "name": name} for code, (name, _) in
            sorted(COUNTRIES.items(), key=lambda kv: kv[1][0])]
