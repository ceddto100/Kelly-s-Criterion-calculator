# Betgistics — MLB CSV Pipeline, Stat Necessity Audit & Source URLs

Companion to [MLB_PROJECTION_ENGINE.md](MLB_PROJECTION_ENGINE.md). That document
describes the *math*. This one describes the *data*: where every number comes
from, which CSV column feeds which term in the equation, and which stats are
load-bearing versus decorative.

---

## 1. The data flow (after the CSV migration)

MLB now works exactly like the NBA, NFL and NHL tabs — static CSVs under
`frontend/public/stats/<sport>/`, fetched by the browser, no backend call:

```
scripts/updateMLBStats.js  (or the mlb-stat-fetcher agent)
        │
        ▼
frontend/public/stats/mlb/*.csv
        │
        ▼
frontend/utils/mlbStatsLoader.ts        parse + join + cache
        │
        ├──────────────► DailyGamesView.tsx      "Today's Games" cards
        │                  (loadSlateGames)       one card per slate row
        │                         │
        │                         │ tap
        │                         ▼
        │                 dailyGameTransfer.mlbInputToFields()
        │                         │
        └──────────────► MLBEstimator.tsx ◄───────┘
                           (team + starter pickers autofill from the same CSVs)
                                  │
                                  ▼
                     frontend/utils/mlbProjection.ts   projectMLBGame()
                                  │
                                  ▼
                        ProjectionResultCard.tsx
```

The key property: **the Today's Games card and the estimator produce identical
numbers**, because they read the same CSVs through the same loader and run the
same engine. Tapping a card just pre-fills the form.

### What changed

| Before | After |
| --- | --- |
| `GET /api/mlb/daily` → backend → MLB StatsAPI + FanGraphs + ESPN + Open-Meteo, live, per request | Browser reads `/stats/mlb/*.csv` |
| `scripts/updateMLBAdvanced.py` scraped FanGraphs (403s from every CI IP — **failed on every scheduled run**) | `scripts/updateMLBStats.js` uses StatsAPI + ESPN + Open-Meteo, all of which answer from CI |
| wOBA/FIP scraped from FanGraphs | wOBA/FIP **computed** from StatsAPI counting stats (public formulas) |
| MLB estimator had no team picker — every stat typed by hand | Team + starter dropdowns autofill all 11 stats from CSV |

`scripts/updateMLBAdvanced.py` and the backend `/api/mlb/daily` route are no
longer on the app's path. They are left in place (unreferenced) rather than
deleted, so nothing that may still call the API breaks; delete when you're
satisfied nothing else uses them.

---

## 2. The CSV contract

Five files plus a manifest, all in `frontend/public/stats/mlb/`. Every cell is
double-quoted. **A blank cell means "not available" and is passed through as
`undefined`** — the engine lowers its data-completeness score rather than
substituting a default. Never write `0` for a stat you don't have.

### `mlb_team_offense.csv` — one row per team (30)

```csv
"team","abbreviation","wrc_plus","woba","ops","runs_per_game","recent_runs_per_game"
"Atlanta Braves","ATL","","0.322","0.732","4.91","5.24"
"Colorado Rockies","COL","","0.310","0.706","4.55","4.90"
```

### `mlb_starters.csv` — one row per pitcher (~770)

```csv
"pitcher","team","abbreviation","throws","era","fip","xfip","siera"
"Zack Wheeler","Philadelphia Phillies","PHI","R","2.94","3.01","",""
"Max Scherzer","Toronto Blue Jays","TOR","R","4.12","4.05","",""
```

### `mlb_bullpen.csv` — one row per team (30)

```csv
"team","abbreviation","bullpen_fip","bullpen_era","bullpen_whip","innings_last1d","innings_last3d","closer_available"
"Atlanta Braves","ATL","3.95","3.70","1.16","2.0","9.3",""
```

### `mlb_parks.csv` — one row per team (30), refreshed yearly

```csv
"team","abbreviation","venue","park_factor","roof_type"
"Colorado Rockies","COL","Coors Field","112","Open"
"Arizona Diamondbacks","AZ","Chase Field","103","Retractable"
```

### `mlb_slate.csv` — one row per game today

```csv
"game_date","game_time","away_team","away_abbr","home_team","home_abbr","venue","away_starter","away_starter_confirmed","home_starter","home_starter_confirmed","book_total","home_moneyline","away_moneyline","temperature_f","wind_speed_mph","wind_direction","roof_closed","away_lineup_confirmed","home_lineup_confirmed"
"2026-08-02","2026-08-02T17:35:00Z","Philadelphia Phillies","PHI","Baltimore Orioles","BAL","Oriole Park at Camden Yards","Zack Wheeler","yes","Kyle Bradish","yes","8.5","-135","115","89","11","crosswind","no","no","no"
```

Conventions: booleans are `yes`/`no` (blank = unknown), `wind_direction` is one
of `out` / `in` / `crosswind` / `none` **relative to the ballpark's
home-plate→centre-field bearing** (not compass direction), moneylines are
American odds, and `abbreviation` must match what MLB StatsAPI uses — notably
`AZ` (not ARI), plus `SD`, `SF`, `TB`, `CWS`, `KC`, `WSH`, `ATH`.

---

## 3. Stat necessity audit

Every column, traced to the term it feeds. "Weight" is the share it carries
inside its blend when all inputs are present.

### Offense → `calculateOffenseScore` → `offenseMultiplier`

| Column | Weight | Necessary? | Notes |
| --- | --- | --- | --- |
| `wrc_plus` | 0.45 | **Core.** Highest-value cell in the whole dataset. | Park- and league-adjusted, so it composes correctly with `park_factor` with no double-counting. Sets offense coverage to 1.0 on its own. |
| `woba` | 0.30 | **Core.** Best fallback if wRC+ is missing. | Sensitivity 2.2 — verified correct: a +3.8% wOBA implies +8.5% runs (elasticity ≈ 2.24 via wRAA). |
| `ops` | 0.15 | Useful, not required. | Sensitivity 1.4 — verified against the "10 pts OPS ≈ 0.08 R/G" rule (elasticity ≈ 1.34). **Not park-adjusted**, so a team's OPS is contaminated by its own park; combining it with `park_factor` mildly double-counts. This is why its weight is low and wRC+ is preferred. |
| `runs_per_game` | 0.10 | Low value. Keep — it's free from StatsAPI. | Outcome, not skill. Deliberately low-weighted. |
| `recent_runs_per_game` | separate | Keep. | Feeds `recentFormMultiplier`, capped at ±5% and regressed 80% toward season. **Not** part of the offense blend — these are two different terms and must not be conflated. |

### Pitching → `calculatePitchingMultiplier` → `pitchingMultiplier`

Starter share ≈ 61% of the game (5.5 of 9 innings), bullpen ≈ 39%.

| Column | Weight | Necessary? |
| --- | --- | --- |
| `siera` | 0.35 of starter | **Core.** Most predictive of future run prevention. |
| `xfip` | 0.25 of starter | **Core.** Normalises HR/FB luck. |
| `fip` | 0.25 of starter | **Core.** Defence-independent. |
| `era` | 0.15 of starter | Sanity anchor only — never relied on alone. |
| `bullpen_fip` | 0.45 of bullpen | **Core.** |
| `bullpen_era` | 0.30 of bullpen | **Core.** |
| `bullpen_whip` | 0.25 of bullpen | Keep. Converted to the ERA scale via `(WHIP − 1.30) × 3.5 + lgERA`. |
| `innings_last1d` / `innings_last3d` | fatigue | Keep. Drives up to an 8% bullpen penalty. |
| `closer_available` | share shift | Keep. Moves 4% more of the game onto the bullpen when `no`. |
| `throws` | — | **Not consumed by the engine today.** Present so the platoon-edge input can eventually be derived automatically instead of typed. Safe to leave blank. |

FIP, xFIP and SIERA are all scaled to league ERA by construction, so blending
them against a single `avgEra` baseline is correct.

### Environment

| Column | Feeds | Necessary? |
| --- | --- | --- |
| `park_factor` | `parkMultiplier` | **Core.** Coors at 112 moves a total by ~1.0 run. |
| `temperature_f` | `weatherMultiplier` | Keep. ~1% runs per 10°F. |
| `wind_speed_mph` + `wind_direction` | `weatherMultiplier` | Keep. Combined weather effect capped at ±8%. |
| `roof_closed` | neutralises weather | **Core** for the 6 roofed parks. |
| `roof_type` | derives `roof_closed`, `weatherReliable` | Keep. `Retractable` flags the forecast as unreliable. |

### Line + status

| Column | Feeds | Necessary? |
| --- | --- | --- |
| `book_total` | totals edge | **Required to bet.** Without it the card shows a projection but no lean. |
| `home_moneyline` / `away_moneyline` | de-vig → ML edge | **Required for the moneyline market.** |
| `*_starter_confirmed` | data completeness ×0.85 | Keep. |
| `*_lineup_confirmed` | data completeness ×0.92 | Keep. |

### Columns intentionally **not** collected

ISO, K%, BB%, OBP, SLG, BABIP, team ERA, team WHIP. All are already captured by
wRC+/wOBA/OPS (offense) or FIP/SIERA (pitching), and adding them would
double-count correlated signal without adding information.

---

## 4. NHL — the complete stat list

Seven CSVs in `frontend/public/stats/nhl/`, all shaped
`"team","abbreviation",<stat>`. Consumed by `frontend/utils/nhlProjection.ts`
(`calculateNHLProjection`) and `frontend/forms/NHLMatchup.tsx`.

| # | File | Column | Stat | Role in the equation |
| --- | --- | --- | --- | --- |
| 1 | `nhl_xgf60.csv` | `xgf60` | Expected Goals For / 60 | `homeScore = (home.xGF60 + away.xGA60)/2 − away.GSAx60 + 0.15` |
| 2 | `nhl_xga60.csv` | `xga60` | Expected Goals Against / 60 | same base-score term, opponent side |
| 3 | `nhl_gsax60.csv` | `gsax60` | Goals Saved Above Expected / 60 | subtracted from the opponent's score — the goaltending term |
| 4 | `nhl_hdcf60.csv` | `hdcf60` | High-Danger Chances For / 60 | pace: combined HDCF 20→30 scales a 0→+0.40 goal bump |
| 5 | `nhl_pp.csv` | `pp` | Power-Play % | special teams: `(home.PP + (100 − away.PK)) × away.timesShorthanded` |
| 6 | `nhl_pk.csv` | `pk` | Penalty-Kill % | same term, defensive side |
| 7 | `nhl_times_shorthanded.csv` | `times_shorthanded` | Times shorthanded / game | multiplier on the special-teams mismatch |

Plus these model constants (not CSV inputs): home-ice advantage **+0.15 goals**,
special-teams bonus capped at **+0.50 goals** per team, overdispersion factor
**1.15** on the standard deviation, and an overtime boost of **+0.23 goals**
(~23% of games reach OT).

All seven are load-bearing — none is decorative, and none duplicates another.

---

## 5. Source URLs

Verified reachable. HTTP status is what a plain scripted GET actually returned.

### Tier 1 — machine-readable, no auth, never blocked (`200`)

| Source | URL | Provides |
| --- | --- | --- |
| MLB StatsAPI — schedule | `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=YYYY-MM-DD&hydrate=probablePitcher,venue(location,fieldInfo),lineups` | Slate, probable starters, venue, roof type, coordinates, posted lineups |
| MLB StatsAPI — team hitting | `https://statsapi.mlb.com/api/v1/teams/stats?season=2026&group=hitting&stats=season&sportIds=1` | OPS, runs, games, and the raw components to compute wOBA |
| MLB StatsAPI — recent form | `https://statsapi.mlb.com/api/v1/teams/{teamId}/stats?stats=byDateRange&group=hitting&season=2026&startDate=…&endDate=…` | Trailing runs/game |
| MLB StatsAPI — all pitchers | `https://statsapi.mlb.com/api/v1/stats?stats=season&group=pitching&season=2026&sportId=1&playerPool=all&limit=2000` | Every pitcher's ERA + FIP components + `gamesStarted` (for the SP/RP split) |
| MLB StatsAPI — boxscore | `https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live` | Relief innings for the fatigue input |
| MLB StatsAPI — teams | `https://statsapi.mlb.com/api/v1/teams?sportId=1&hydrate=venue(location,fieldInfo)` | Abbreviations, venues, roof types |
| ESPN scoreboard | `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard` | Consensus over/under + moneylines |
| Open-Meteo | `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&hourly=temperature_2m,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph` | First-pitch temperature, wind speed, wind bearing |

### Tier 2 — browser-only (block scripted requests)

| Source | URL | Provides |
| --- | --- | --- |
| FanGraphs team batting | `https://www.fangraphs.com/leaders/major-league?pos=all&stats=bat&lg=all&qual=0&type=8&team=0,ts&season=2026&season1=2026&month=0&ind=0` | **wRC+**, wOBA |
| FanGraphs starters | `https://www.fangraphs.com/leaders/major-league?pos=all&stats=sta&lg=all&qual=0&type=8&season=2026&season1=2026&month=0&ind=0` | **xFIP, SIERA**, FIP per starter |
| FanGraphs relievers (team) | `https://www.fangraphs.com/leaders/major-league?pos=all&stats=rel&lg=all&qual=0&type=8&team=0,ts&season=2026&season1=2026&month=0&ind=0` | Bullpen FIP/ERA/WHIP as a unit |
| FanGraphs probables grid | `https://www.fangraphs.com/roster-resource/probables-grid` | Probable starters, several days out |
| Baseball Savant park factors | `https://baseballsavant.mlb.com/leaderboard/statcast-park-factors` | **Run park factors** (refresh yearly) |
| Baseball Savant expected stats | `https://baseballsavant.mlb.com/leaderboard/expected_statistics?type=batter-team&year=2026` | Team xwOBA (cross-check on wOBA) |
| Baseball-Reference team batting | `https://www.baseball-reference.com/leagues/majors/2026.shtml` | OPS+ (a usable wRC+ substitute), team totals |
| Baseball-Reference previews | `https://www.baseball-reference.com/previews/index.shtml` | Probable pitchers by date |
| MLB.com probable pitchers | `https://www.mlb.com/probable-pitchers` | Official probables |
| Rotowire probables | `https://www.rotowire.com/baseball/projected-starters.php` | Probables + confirmed lineups |

FanGraphs returns **HTTP 403 to any scripted request**, including from a
residential IP. It is readable in a real browser session, which is precisely why
`wrc_plus`, `xfip` and `siera` are the columns delegated to the browser-driven
agent rather than to `scripts/updateMLBStats.js`.

### NHL sources (for parity)

| Stat | Source |
| --- | --- |
| xGF/60, xGA/60, GSAx/60, HDCF/60 | MoneyPuck — `https://moneypuck.com/moneypuck/playerData/seasonSummary/2026/regular/teams.csv` |
| PP%, PK%, times shorthanded | NHL API — `https://api-web.nhle.com/v1/standings/now` and `https://api.nhle.com/stats/rest/en/team/summary?cayenneExp=seasonId=20252026` |
| Fallback for all seven | Natural Stat Trick — `https://www.naturalstattrick.com/teamtable.php` |

---

## 6. Refresh cadence

| Data | Cadence | Producer |
| --- | --- | --- |
| `mlb_slate.csv` | Several times a day; at minimum ~2h before first pitch (lineups post then) | `updateMLBStats.js` / agent |
| `mlb_team_offense.csv`, `mlb_bullpen.csv`, `mlb_starters.csv` | Daily | `updateMLBStats.js` / agent |
| `wrc_plus`, `xfip`, `siera` columns | Daily | agent only (FanGraphs is browser-only) |
| `mlb_parks.csv` | Once a season | Manual, from Baseball Savant |

```bash
node scripts/updateMLBStats.js
```
