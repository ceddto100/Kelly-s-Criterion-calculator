#!/usr/bin/env python3
"""
scripts/updateMLBAdvanced.py
============================
Fetches MLB advanced stats from FanGraphs and writes them where the backend
can read them at runtime:

    backend/data/mlb/team_offense.csv   -> team, abbreviation, wrc_plus, woba
    backend/data/mlb/pitchers.csv       -> name, team, fip, xfip, siera
    backend/data/mlb/bullpen.csv        -> team, abbreviation, fip, era, whip
    backend/data/mlb/last_updated.json  -> { updatedAt, season, teams, pitchers, bullpens }

Why: the MLB projection engine (frontend/utils/mlbProjection.ts) weights wRC+
(45%) and wOBA (30%) for offense and SIERA (35%) / xFIP (25%) / FIP (25%) for
starters — but MLB StatsAPI only exposes OPS, runs/game and ERA. Without these,
the engine runs on its lowest-weight inputs and stays low-confidence. The backend
(backend/scrapers/mlbAdvanced.js) merges these files into /api/mlb/daily.

Data source: FanGraphs' modern JSON leaders API
(https://www.fangraphs.com/api/leaders/major-league/data), the same endpoint the
live site's leaderboards call. This replaces the old pybaseball scrape of
`leaders-legacy.aspx`, which FanGraphs retired — that page now returns HTTP 403
from cloud/CI IPs no matter what User-Agent is sent, which is why every CI run
failed. We first hit the JSON API with cloudscraper so Cloudflare challenge
cookies can be negotiated when FanGraphs serves an anti-bot page. If that still
fails, we fall back to Playwright/Chromium so JavaScript-based checks can run in
a real browser context before the API request is retried. If the runner IP is
blocked outright, set FANGRAPHS_PROXY/FG_PROXY to route both clients through an
allowed network; otherwise the updater exits successfully and keeps prior data.

Best-effort by design: each source is fetched independently and a failure leaves
the previous file in place, so a flaky FanGraphs response never breaks the live
MLB slate — it just falls back to OPS/ERA, which is the pre-existing behavior.
"""
import os
import re
import json
import time
import datetime
from urllib.parse import urlencode

import cloudscraper
from playwright.sync_api import sync_playwright

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "data", "mlb")

FG_API_URL = "https://www.fangraphs.com/api/leaders/major-league/data"

# A normal browser request profile. The JSON API is far more permissive than the
# retired HTML page, but we still send a realistic UA + Referer so we look like
# the site's own XHR rather than a bare script.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.fangraphs.com/leaders/major-league",
    "Origin": "https://www.fangraphs.com",
    "DNT": "1",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Connection": "keep-alive",
}

# FanGraphs currently protects the leaderboard/API endpoints with bot checks that
# commonly reject cloud-hosted runners (including GitHub Actions) with 403s.  A
# browser session cookie from a FanGraphs account lets the scheduled updater make
# the same JSON request as the logged-in web app.  Keep this optional so local
# development and already-allowed networks continue to work without secrets.
_COOKIE = os.environ.get("FANGRAPHS_COOKIE") or os.environ.get("FG_COOKIE")
if _COOKIE:
    _HEADERS["Cookie"] = _COOKIE

_PROXY = os.environ.get("FANGRAPHS_PROXY") or os.environ.get("FG_PROXY")

_SCRAPER = cloudscraper.create_scraper(
    browser={
        "browser": "chrome",
        "platform": "windows",
        "desktop": True,
    }
)
_SCRAPER.headers.update(_HEADERS)
if _PROXY:
    _SCRAPER.proxies.update({"http": _PROXY, "https": _PROXY})
_SESSION_WARMED = False


def warm_fangraphs_session():
    """Prime the cloudscraper session with any cookies FanGraphs sets."""
    global _SESSION_WARMED
    if _SESSION_WARMED:
        return
    _SESSION_WARMED = True
    try:
        _SCRAPER.get(
            "https://www.fangraphs.com/leaders/major-league",
            headers={
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;"
                    "q=0.9,*/*;q=0.8"
                ),
            },
            timeout=30,
        )
    except Exception as e:  # noqa: BLE001
        # API requests can still work without the initial page warmup.
        print(f"  [session] FanGraphs warmup skipped: {e}")

# FanGraphs team code -> StatsAPI-style full team name (used for matching in the
# backend against MLB StatsAPI's team names). Alternates included for safety.
FG_TEAM_TO_FULL = {
    "ARI": "Arizona Diamondbacks", "ATL": "Atlanta Braves", "BAL": "Baltimore Orioles",
    "BOS": "Boston Red Sox", "CHC": "Chicago Cubs", "CHW": "Chicago White Sox",
    "CWS": "Chicago White Sox", "CIN": "Cincinnati Reds", "CLE": "Cleveland Guardians",
    "COL": "Colorado Rockies", "DET": "Detroit Tigers", "HOU": "Houston Astros",
    "KCR": "Kansas City Royals", "KC": "Kansas City Royals", "LAA": "Los Angeles Angels",
    "LAD": "Los Angeles Dodgers", "MIA": "Miami Marlins", "MIL": "Milwaukee Brewers",
    "MIN": "Minnesota Twins", "NYM": "New York Mets", "NYY": "New York Yankees",
    "ATH": "Athletics", "OAK": "Athletics", "PHI": "Philadelphia Phillies",
    "PIT": "Pittsburgh Pirates", "SDP": "San Diego Padres", "SD": "San Diego Padres",
    "SEA": "Seattle Mariners", "SFG": "San Francisco Giants", "SF": "San Francisco Giants",
    "STL": "St. Louis Cardinals", "TBR": "Tampa Bay Rays", "TB": "Tampa Bay Rays",
    "TEX": "Texas Rangers", "TOR": "Toronto Blue Jays", "WSN": "Washington Nationals",
    "WSH": "Washington Nationals",
}


def season_year():
    now = datetime.datetime.now(datetime.timezone.utc)
    # MLB regular season ~ late Mar to early Oct; before March, use prior year.
    return now.year if now.month >= 3 else now.year - 1


def now_iso():
    return datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()


def clean(text):
    return str(text).replace(",", " ").strip()


_TAG_RE = re.compile(r"<[^>]+>")


def strip_html(text):
    """FanGraphs occasionally returns a player/team name as an <a> anchor."""
    return _TAG_RE.sub("", str(text)).strip()


def pick(row, *keys, default=None):
    """First non-empty value among the candidate keys (API field names vary)."""
    for k in keys:
        if k in row:
            v = row[k]
            if v is not None and v != "":
                return v
    return default


def fmt(value, decimals):
    if value is None or value == "":
        return ""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return ""
    if f != f:  # NaN
        return ""
    return f"{f:.{decimals}f}"


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8") as f:
        f.write(",".join(header) + "\n")
        for row in rows:
            f.write(",".join("" if v is None else str(v) for v in row) + "\n")


def parse_payload(payload):
    """Return the leaders rows from a FanGraphs JSON payload."""
    if isinstance(payload, dict):
        # The leaders API wraps rows in "data"; tolerate alternates.
        for key in ("data", "leaders", "rows"):
            if isinstance(payload.get(key), list):
                return payload[key]
        return []
    if isinstance(payload, list):
        return payload
    return []


def fetch_json_with_playwright(url):
    """Use Chromium to clear JS checks, then request the API in that context."""
    browser_headers = {k: v for k, v in _HEADERS.items() if k.lower() != "cookie"}
    with sync_playwright() as pw:
        launch_options = {"headless": True}
        if _PROXY:
            launch_options["proxy"] = {"server": _PROXY}
        browser = pw.chromium.launch(**launch_options)
        context = browser.new_context(
            user_agent=_HEADERS["User-Agent"],
            extra_http_headers=browser_headers,
            locale="en-US",
            viewport={"width": 1366, "height": 768},
        )
        try:
            if _COOKIE:
                context.add_cookies([
                    {
                        "name": part.split("=", 1)[0].strip(),
                        "value": part.split("=", 1)[1].strip(),
                        "domain": ".fangraphs.com",
                        "path": "/",
                    }
                    for part in _COOKIE.split(";")
                    if "=" in part
                ])
            page = context.new_page()
            page.goto(
                "https://www.fangraphs.com/leaders/major-league",
                wait_until="domcontentloaded",
                timeout=60000,
            )
            response = context.request.get(
                url,
                headers={"Accept": "application/json, text/plain, */*"},
                timeout=60000,
            )
            if not response.ok:
                raise RuntimeError(f"Playwright HTTP {response.status}")
            return parse_payload(json.loads(response.text()))
        finally:
            context.close()
            browser.close()


def fetch_json(params):
    """GET the FanGraphs leaders API and return the list of leader rows."""
    warm_fangraphs_session()
    url = FG_API_URL + "?" + urlencode(params)
    last_error = None
    for attempt in range(3):
        try:
            resp = _SCRAPER.get(url, timeout=60)
            resp.raise_for_status()
            return parse_payload(resp.json())
        except Exception as e:  # noqa: BLE001 - best effort retries
            last_error = str(e)
            print(f"  [cloudscraper] attempt {attempt + 1} failed: {last_error}")
        time.sleep(2 * (attempt + 1))

    print("  [playwright] falling back to Chromium browser fetch")
    try:
        return fetch_json_with_playwright(url)
    except Exception as e:  # noqa: BLE001 - preserve best-effort caller behavior
        raise RuntimeError(
            f"FanGraphs API request failed (cloudscraper: {last_error}; "
            f"playwright: {e}) for {url}"
        ) from e


def fetch_team_offense(season):
    """Returns list of [full_name, fg_abbr, wrc_plus, woba]."""
    data = fetch_json({
        "age": "", "pos": "all", "stats": "bat", "lg": "all", "qual": "0",
        "type": "8", "season": season, "season1": season, "startdate": "",
        "enddate": "", "month": "0", "hand": "", "team": "0,ts",
        "pageitems": "2000000000", "pagenum": "1", "ind": "0", "rost": "0",
        "players": "0", "postseason": "", "sortdir": "default", "sortstat": "WAR",
    })
    rows = []
    for r in data:
        abbr = str(pick(r, "TeamNameAbb", "TeamAbb", "Team", default="")).strip()
        full = FG_TEAM_TO_FULL.get(abbr) or strip_html(pick(r, "TeamName", "Team", default=""))
        if not full:
            print(f"  [team] unmapped FanGraphs row (abbr='{abbr}'), skipping")
            continue
        rows.append([clean(full), abbr,
                     fmt(pick(r, "wRC+", "wRCplus"), 0), fmt(pick(r, "wOBA"), 3)])
    if not rows:
        raise RuntimeError("team offense returned 0 rows")
    return rows


def fetch_pitchers(season):
    """
    Returns (pitcher_rows, bullpen_rows) from one FanGraphs pull:
      pitcher_rows: [name, fg_team, fip, xfip, siera] for every pitcher
      bullpen_rows: [full_name, fg_abbr, fip, era, whip] per team, an
                    innings-weighted aggregate over relievers (GS == 0).
    Traded pitchers show Team "- - -" on FanGraphs and are skipped in the
    bullpen aggregate (their relief innings can't be attributed to one team).
    """
    data = fetch_json({
        "age": "", "pos": "all", "stats": "pit", "lg": "all", "qual": "0",
        "type": "8", "season": season, "season1": season, "startdate": "",
        "enddate": "", "month": "0", "hand": "", "team": "0",
        "pageitems": "2000000000", "pagenum": "1", "ind": "0", "rost": "0",
        "players": "0", "postseason": "", "sortdir": "default", "sortstat": "WAR",
    })
    rows = []
    bp = {}  # fg code -> {stat: [weighted_sum, ip_outs_sum]}
    for r in data:
        name = clean(strip_html(pick(r, "PlayerName", "Name", default="")))
        team = str(pick(r, "TeamNameAbb", "TeamAbb", "Team", default="")).strip()
        if name:
            rows.append([name, team, fmt(pick(r, "FIP"), 2),
                         fmt(pick(r, "xFIP"), 2), fmt(pick(r, "SIERA"), 2)])

        if team not in FG_TEAM_TO_FULL:
            continue
        try:
            gs = float(pick(r, "GS", default=0) or 0)
            ip = float(pick(r, "IP", default=0) or 0)
        except (TypeError, ValueError):
            continue
        if gs > 0 or ip <= 0:
            continue
        # FanGraphs IP uses baseball notation (60.1 = 60 1/3); weight by outs.
        outs = int(ip) * 3 + round((ip % 1) * 10)
        agg = bp.setdefault(team, {"fip": [0.0, 0], "era": [0.0, 0], "whip": [0.0, 0]})
        for stat, col in (("fip", "FIP"), ("era", "ERA"), ("whip", "WHIP")):
            try:
                v = float(pick(r, col))
            except (TypeError, ValueError):
                continue
            agg[stat][0] += v * outs
            agg[stat][1] += outs

    if not rows:
        raise RuntimeError("pitching returned 0 rows")

    bullpen_rows = []
    for code, agg in sorted(bp.items()):
        def w(stat):
            total, outs = agg[stat]
            return total / outs if outs > 0 else None
        bullpen_rows.append([FG_TEAM_TO_FULL[code], code,
                             fmt(w("fip"), 2), fmt(w("era"), 2), fmt(w("whip"), 2)])
    return rows, bullpen_rows


def main():
    season = season_year()
    os.makedirs(OUT_DIR, exist_ok=True)
    print("=== Betgistics MLB Advanced Stats Update (FanGraphs JSON API) ===")
    print(f"Season: {season}  |  UTC: {now_iso()}\n")

    team_rows, pitcher_rows, bullpen_rows = None, None, None

    try:
        team_rows = fetch_team_offense(season)
        write_csv(os.path.join(OUT_DIR, "team_offense.csv"),
                  ["team", "abbreviation", "wrc_plus", "woba"], team_rows)
        print(f"Wrote team_offense.csv ({len(team_rows)} teams)")
    except Exception as e:  # noqa: BLE001 - best effort, keep prior file on failure
        print(f"team offense fetch FAILED (keeping previous file): {e}")

    try:
        pitcher_rows, bullpen_rows = fetch_pitchers(season)
        write_csv(os.path.join(OUT_DIR, "pitchers.csv"),
                  ["name", "team", "fip", "xfip", "siera"], pitcher_rows)
        print(f"Wrote pitchers.csv ({len(pitcher_rows)} pitchers)")
        write_csv(os.path.join(OUT_DIR, "bullpen.csv"),
                  ["team", "abbreviation", "fip", "era", "whip"], bullpen_rows)
        print(f"Wrote bullpen.csv ({len(bullpen_rows)} teams)")
    except Exception as e:  # noqa: BLE001
        print(f"pitcher fetch FAILED (keeping previous file): {e}")

    # Manifest (only stamp counts/time for sources that succeeded this run)
    manifest_path = os.path.join(OUT_DIR, "last_updated.json")
    manifest = {}
    try:
        with open(manifest_path, encoding="utf-8") as f:
            manifest = json.load(f)
    except Exception:
        pass
    now = now_iso()
    if team_rows is not None or pitcher_rows is not None:
        manifest["updatedAt"] = now
        manifest["season"] = season
    if team_rows is not None:
        manifest["teams"] = len(team_rows)
    if pitcher_rows is not None:
        manifest["pitchers"] = len(pitcher_rows)
    if bullpen_rows is not None:
        manifest["bullpens"] = len(bullpen_rows)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Wrote {manifest_path}")

    if team_rows is None and pitcher_rows is None:
        print("\nBoth FanGraphs fetches failed — no files updated.")
        print("Set FANGRAPHS_PROXY/FG_PROXY if FanGraphs is blocking the runner IP.")
        print("Done with stale/no FanGraphs refresh; downstream MLB fallback remains active.")
        return
    print("\nDone.")


if __name__ == "__main__":
    main()
