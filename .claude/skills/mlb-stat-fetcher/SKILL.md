---
name: mlb-stat-fetcher
description: Fetch today's real MLB team, pitcher, bullpen and slate stats from the approved sources and write them into the Betgistics CSVs at frontend/public/stats/mlb/. Use whenever the user asks to refresh, update, or pull MLB stats, fill in wRC+/xFIP/SIERA, rebuild today's slate, or says the MLB data is stale, missing, or empty.
---

# MLB Stat Fetcher

You are filling the data files that a betting model reads. A wrong number here
becomes a wrong bet. **Accuracy beats completeness beats speed, in that order.**

Your job: produce five CSVs in `frontend/public/stats/mlb/` containing real,
current MLB numbers, matching the exact schema below.

## The one rule that matters

**Never write a number you did not read from a source.**

Not an estimate. Not a carry-forward from last season. Not something that "looks
about right" for that team. Not a value inferred from a similar stat. If you
could not find it, **leave the cell empty**. An empty cell is a correct,
supported answer — the model detects it, lowers its confidence, and may decline
to bet. That is the system working. A plausible-looking invented number defeats
every safeguard downstream and is the single worst outcome of this task.

If you catch yourself about to fill a cell from memory, stop and leave it blank.

## Don't stop early

Work through every source and every column. Do not stop because:

- a page was slow, timed out, or returned an error — retry it, then try the
  fallback source for that stat
- one source is blocked — the others still work; keep going
- you have "most" of the data — partial output is only acceptable after you have
  actually attempted every source for every missing column

You are done when each column below is either **filled from a source** or
**confirmed unavailable after trying its listed fallbacks**. Report which
columns ended up empty and why.

## Sources

Prefer the top source for each stat. Fall back down the list if it fails.

**Machine-readable, no auth — these answer reliably:**

- MLB StatsAPI — `https://statsapi.mlb.com/api/v1/...`
  - schedule + probable starters + venue + lineups:
    `/schedule?sportId=1&date=YYYY-MM-DD&hydrate=probablePitcher,venue(location,fieldInfo),lineups`
  - team hitting: `/teams/stats?season={YEAR}&group=hitting&stats=season&sportIds=1`
  - recent form: `/teams/{id}/stats?stats=byDateRange&group=hitting&season={YEAR}&startDate=…&endDate=…`
  - every pitcher: `/stats?stats=season&group=pitching&season={YEAR}&sportId=1&playerPool=all&limit=2000`
  - boxscore (relief innings): `https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live`
- ESPN scoreboard (book total + moneylines) —
  `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard`
- Open-Meteo (weather) — `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&hourly=temperature_2m,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`

**Browser-only — these 403 scripted requests, so open them in a real browser:**

- FanGraphs team batting (**wRC+**, wOBA) —
  `https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&qual=0&type=8&team=0,ts&season={YEAR}&season1={YEAR}&month=0&ind=0`
- FanGraphs starters (**xFIP**, **SIERA**) —
  `https://www.fangraphs.com/leaders/major-league?pos=all&stats=sta&lg=all&qual=0&type=8&season={YEAR}&season1={YEAR}&month=0&ind=0`
- FanGraphs relievers by team (bullpen FIP/ERA/WHIP) —
  `https://www.fangraphs.com/leaders/major-league?pos=all&stats=rel&lg=all&qual=0&type=8&team=0,ts&season={YEAR}&season1={YEAR}&month=0&ind=0`
- Baseball Savant park factors (yearly refresh only) —
  `https://baseballsavant.mlb.com/leaderboard/statcast-park-factors`
- Baseball-Reference (OPS+ as a wRC+ substitute; probables) —
  `https://www.baseball-reference.com/leagues/majors/{YEAR}.shtml`,
  `https://www.baseball-reference.com/previews/index.shtml`
- Probable pitchers / confirmed lineups —
  `https://www.mlb.com/probable-pitchers`,
  `https://www.rotowire.com/baseball/projected-starters.php`,
  `https://www.fangraphs.com/roster-resource/probables-grid`

`node scripts/updateMLBStats.js` already produces everything from the
machine-readable tier, including computed wOBA and FIP. **Run it first**, then
your remaining job is the browser-only columns: `wrc_plus`, `xfip`, `siera`, and
anything the script left blank. Don't redo work the script already did.

## Freshness

- "Today" means the **US Eastern** date, not UTC. A US night game falls on the
  next UTC day; using UTC after 8pm ET silently produces tomorrow's empty slate.
- Season stats must be the **current season**, through the most recent completed
  games. If a page offers a season selector, confirm it reads the current year
  before you copy anything.
- Book totals and lineups change all day. Note the time you captured them.
- If a source's own timestamp shows it is more than a day stale, treat that stat
  as unavailable rather than copying an old value.

## Output

Write these five files to `frontend/public/stats/mlb/`. Quote every cell. Keep
the header row exactly as shown — the loader matches on column names. Use team
abbreviations **as MLB StatsAPI writes them**: `AZ` (not ARI), `SD`, `SF`, `TB`,
`CWS`, `KC`, `WSH`, `ATH`.

### `mlb_team_offense.csv` — 30 rows

```csv
"team","abbreviation","wrc_plus","woba","ops","runs_per_game","recent_runs_per_game"
"Atlanta Braves","ATL","108","0.322","0.732","4.91","5.24"
"Baltimore Orioles","BAL","96","0.311","0.715","4.32","3.98"
"Colorado Rockies","COL","","0.310","0.706","4.55","4.90"
```

`recent_runs_per_game` is runs/game over roughly the last three weeks — a
different number from `runs_per_game`, not a copy of it. The Rockies row shows
the correct handling of a stat you could not find: blank, not guessed.

### `mlb_starters.csv` — one row per pitcher

```csv
"pitcher","team","abbreviation","throws","era","fip","xfip","siera"
"Zack Wheeler","Philadelphia Phillies","PHI","R","2.94","3.01","3.15","3.22"
"Max Scherzer","Toronto Blue Jays","TOR","R","4.12","4.05","4.21","4.09"
```

### `mlb_bullpen.csv` — 30 rows

```csv
"team","abbreviation","bullpen_fip","bullpen_era","bullpen_whip","innings_last1d","innings_last3d","closer_available"
"Atlanta Braves","ATL","3.95","3.70","1.16","2.0","9.3","yes"
```

Bullpen figures are the **relief corps only** (pitchers with zero starts),
innings-weighted — not the team's overall pitching line. `closer_available` is
`yes`/`no`/blank; leave it blank unless you find an actual report.

### `mlb_parks.csv` — 30 rows, only refresh at the start of a season

```csv
"team","abbreviation","venue","park_factor","roof_type"
"Colorado Rockies","COL","Coors Field","112","Open"
"Arizona Diamondbacks","AZ","Chase Field","103","Retractable"
```

`park_factor` is the **runs** index, 100 = neutral. `roof_type` is
`Open` / `Dome` / `Retractable`.

### `mlb_slate.csv` — one row per game today

```csv
"game_date","game_time","away_team","away_abbr","home_team","home_abbr","venue","away_starter","away_starter_confirmed","home_starter","home_starter_confirmed","book_total","home_moneyline","away_moneyline","temperature_f","wind_speed_mph","wind_direction","roof_closed","away_lineup_confirmed","home_lineup_confirmed"
"2026-08-02","2026-08-02T17:35:00Z","Philadelphia Phillies","PHI","Baltimore Orioles","BAL","Oriole Park at Camden Yards","Zack Wheeler","yes","Kyle Bradish","yes","8.5","-135","115","89","11","crosswind","no","no","no"
"2026-08-02","2026-08-02T20:10:00Z","Kansas City Royals","KC","Colorado Rockies","COL","Coors Field","Cole Ragans","yes","","no","11.5","-120","100","91","9","out","no","no","no"
```

- `wind_direction` is `out` / `in` / `crosswind` / `none` **relative to the
  park's home-plate→centre-field line**, not a compass direction. Convert it.
  If the roof is closed, use `none`.
- Booleans are `yes` / `no`; blank means unknown.
- Moneylines are American odds. Blank if the book hasn't posted.
- The second row shows a TBD starter handled correctly: name blank, confirmed
  `no` — never invent a probable pitcher.

## Before you finish

1. Row counts: 30 / 30 / 30 for offense, bullpen, parks. Slate matches the
   number of games actually scheduled today.
2. Spot-check 3 values per file against the source page you took them from.
3. Sanity ranges — anything outside these means you misread a column:
   wRC+ 70–130 · wOBA .270–.360 · OPS .620–.820 · R/G 3.0–6.0 ·
   ERA/FIP/xFIP/SIERA 1.50–7.00 · WHIP 0.90–1.70 · park factor 88–118 ·
   book total 6.5–12.5
4. Confirm no cell contains a number you did not read from a source.
5. Update `last_updated.json` with the UTC timestamp, season, row counts, the
   sources you actually used, and a `notes` field listing any column you left
   empty and the reason.

Then report: which files you wrote, which columns are empty and why, and any
source that was unreachable.
