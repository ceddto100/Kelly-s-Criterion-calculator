#!/usr/bin/env python3
"""
scripts/updateMLBAdvanced.py
============================
Fetches MLB advanced stats from FanGraphs (via pybaseball) and writes them where
the backend can read them at runtime:

    backend/data/mlb/team_offense.csv   -> team, abbreviation, wrc_plus, woba
    backend/data/mlb/pitchers.csv       -> name, team, fip, xfip, siera
    backend/data/mlb/last_updated.json  -> { updatedAt, season, teams, pitchers }

Why: the MLB projection engine (frontend/utils/mlbProjection.ts) weights wRC+
(45%) and wOBA (30%) for offense and SIERA (35%) / xFIP (25%) / FIP (25%) for
starters — but MLB StatsAPI only exposes OPS, runs/game and ERA. Without these,
the engine runs on its lowest-weight inputs and stays low-confidence. The backend
(backend/scrapers/mlbAdvanced.js) merges these files into /api/mlb/daily.

Best-effort by design: each source is fetched independently and a failure leaves
the previous file in place, so a flaky FanGraphs scrape never breaks the live MLB
slate — it just falls back to OPS/ERA, which is today's behavior.
"""
import os
import sys
import json
import datetime

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "data", "mlb")

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
    now = datetime.datetime.utcnow()
    # MLB regular season ~ late Mar to early Oct; before March, use prior year.
    return now.year if now.month >= 3 else now.year - 1


def clean(text):
    return str(text).replace(",", " ").strip()


def fmt(value, decimals):
    try:
        import pandas as pd  # local import so the module loads even if pandas is missing
        if value is None or (hasattr(pd, "isna") and pd.isna(value)):
            return ""
    except Exception:
        if value is None:
            return ""
    try:
        return f"{float(value):.{decimals}f}"
    except (TypeError, ValueError):
        return ""


def write_csv(path, header, rows):
    with open(path, "w", encoding="utf-8") as f:
        f.write(",".join(header) + "\n")
        for row in rows:
            f.write(",".join("" if v is None else str(v) for v in row) + "\n")


def fetch_team_offense(season):
    """Returns list of [full_name, fg_abbr, wrc_plus, woba]."""
    from pybaseball import team_batting
    df = team_batting(season)
    rows = []
    for _, r in df.iterrows():
        code = str(r.get("Team", "")).strip()
        full = FG_TEAM_TO_FULL.get(code)
        if not full:
            print(f"  [team] unmapped FanGraphs code '{code}', skipping")
            continue
        rows.append([full, code, fmt(r.get("wRC+"), 0), fmt(r.get("wOBA"), 3)])
    return rows


def fetch_pitchers(season):
    """Returns list of [name, fg_team, fip, xfip, siera] for every pitcher."""
    from pybaseball import pitching_stats
    # qual=0 -> no innings minimum, so probable starters early in the year are included.
    df = pitching_stats(season, qual=0)
    rows = []
    for _, r in df.iterrows():
        name = clean(r.get("Name", ""))
        if not name:
            continue
        rows.append([name, clean(r.get("Team", "")), fmt(r.get("FIP"), 2),
                     fmt(r.get("xFIP"), 2), fmt(r.get("SIERA"), 2)])
    return rows


def main():
    season = season_year()
    os.makedirs(OUT_DIR, exist_ok=True)
    print(f"=== Betgistics MLB Advanced Stats Update (FanGraphs / pybaseball) ===")
    print(f"Season: {season}  |  UTC: {datetime.datetime.utcnow().isoformat()}Z\n")

    team_rows, pitcher_rows = None, None

    try:
        team_rows = fetch_team_offense(season)
        write_csv(os.path.join(OUT_DIR, "team_offense.csv"),
                  ["team", "abbreviation", "wrc_plus", "woba"], team_rows)
        print(f"Wrote team_offense.csv ({len(team_rows)} teams)")
    except Exception as e:  # noqa: BLE001 - best effort, keep prior file on failure
        print(f"team offense fetch FAILED (keeping previous file): {e}")

    try:
        pitcher_rows = fetch_pitchers(season)
        write_csv(os.path.join(OUT_DIR, "pitchers.csv"),
                  ["name", "team", "fip", "xfip", "siera"], pitcher_rows)
        print(f"Wrote pitchers.csv ({len(pitcher_rows)} pitchers)")
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
    now = datetime.datetime.utcnow().isoformat() + "Z"
    if team_rows is not None or pitcher_rows is not None:
        manifest["updatedAt"] = now
        manifest["season"] = season
    if team_rows is not None:
        manifest["teams"] = len(team_rows)
    if pitcher_rows is not None:
        manifest["pitchers"] = len(pitcher_rows)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Wrote {manifest_path}")

    if team_rows is None and pitcher_rows is None:
        print("\nBoth FanGraphs fetches failed — no files updated.")
        sys.exit(1)
    print("\nDone.")


if __name__ == "__main__":
    main()
