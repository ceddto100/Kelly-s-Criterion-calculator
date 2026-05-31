# Betgistics — MLB Projection Engine & Sport Audit

This document covers (1) the new MLB projection engine, (2) an audit of the
existing sports' math with prioritized fixes, and (3) a backtesting schema so
every projection can eventually be measured against real results.

Betgistics is a **stat-based projection platform**, not an AI guessing app. The
math engine owns the projection; AI is only for explaining results. Nothing here
promises guaranteed wins — outputs are *model projections*, *possible edges*, and
*leans*, always paired with *risk factors* and *bankroll discipline*.

---

## 1. MLB Projection Engine

MLB is built from the ground up rather than copied from NBA/NFL/NHL, because
baseball scoring is driven by starting pitching, bullpen quality/fatigue,
ballpark, weather, and lineup/handedness — factors the other models don't have.

**Source of truth:** `mcp-server/src/utils/mlb.ts` (+ `config/mlbConfig.ts`)
**Frontend mirror:** `frontend/utils/mlbProjection.ts` (kept in sync; mirrors the
existing `nhlProjection.ts` pattern)
**MCP tool:** `estimate_mlb_projection` (`mcp-server/src/tools/mlbProjection.ts`)
**UI:** MLB tab → `frontend/forms/MLBEstimator.tsx` → `components/ProjectionResultCard.tsx`
**Tests:** `mcp-server/test/mlb.test.ts` (28 unit tests)

### Model

Runs are modeled **multiplicatively** around a league baseline. Each driver
produces a multiplier centered on 1.0 (>1 = more runs, <1 = fewer). Neutral
inputs reproduce the league average, which makes every result auditable:

```
projectedRuns(batting vs opposing pitching) =
    LEAGUE_AVG_RUNS (4.3)
  × offenseMultiplier        // wRC+/wOBA/OPS/RPG blend
  × pitchingMultiplier       // SP (FIP/xFIP/SIERA) + bullpen, innings-weighted
  × parkMultiplier           // run park factor / 100
  × weatherMultiplier        // temp + wind direction/speed (capped)
  × lineupMultiplier         // stars out, platoon edge
  × recentFormMultiplier     // capped + regressed to avoid small samples

projectedTotal = projectedHomeRuns + projectedAwayRuns
```

Modular functions (all pure, all tested): `normalizeStat`,
`calculateOffenseScore`, `calculatePitchingMultiplier`,
`calculateParkMultiplier`, `calculateWeatherMultiplier`,
`calculateLineupMultiplier`, `calculateRecentFormMultiplier`,
`calculateProjectedTeamRuns`, `calculateTotalEdge`, `determineTotalLean`,
`runMarginToWinProb`, `calculateConfidenceScore`, `identifyStatDrivers`,
`identifyRiskFactors`, `projectMLBGame`.

### Key stat decisions

- **Offense:** wRC+ is the core anchor (park/league adjusted). wOBA/OPS/RPG are
  optional fills. Raw RPG is intentionally low-weighted (noisy, context-heavy).
  Excluded as core to avoid duplication: ISO, K%, BB%, OBP, SLG — they're already
  captured by wRC+/wOBA and would double-count.
- **Starting pitching:** SIERA/xFIP/FIP preferred; ERA kept at a small 15% weight
  as a sanity anchor only. We never rely on ERA alone.
- **Bullpen:** FIP/ERA/WHIP blend, plus a **fatigue penalty** from 1-day/3-day
  relief usage and a share-shift when the closer is unavailable. MLB overs/unders
  are often decided late, so the bullpen is weighted by the innings it actually
  throws (~39% of the game, more when fatigued).
- **Environment:** park run factor + weather (warm air & wind-out raise runs;
  cold & wind-in lower them; closed roof neutralizes). Effects are small and
  capped to avoid runaway projections.
- **Lineup:** stars resting downgrades offense; platoon edge is a small bump.
  An **unconfirmed** lineup does *not* move the mean — it lowers confidence.

### Markets

- **Totals (over/under):** primary. Edge = projected total − book total (runs).
- **Moneyline:** projected run margin → win probability (logistic), de-vigged vs
  the book to produce a fair-probability edge.
- Run line and team totals are intentionally left as future extensions; the
  per-team run breakdown already provides the inputs they need.

### Confidence & no-bet (discipline)

Confidence is **not** just edge size. It blends:

- **edge strength** (how far projection is from the line),
- **agreement** between independent categories (offense/pitching/park/weather),
- **data quality** (input coverage + starter/lineup confirmation + weather
  reliability), which also acts as a hard **ceiling** — thin data can never be
  highly confident.

No-bet is returned (and treated as a smart result, not a failure) when:

- the projected edge is below threshold (totals: 0.5 runs; ML: 4% prob),
- data completeness is below 50%,
- starters/lineups are unconfirmed enough to undercut the projection,
- the line moved sharply and our edge isn't large enough to fight it.

### Tuning

Every constant lives in `config/mlbConfig.ts` (backend) / `MLB_CONFIG`
(frontend). No magic numbers in the math. Adjust there and re-run tests.

---

## 2. Audit of existing sports (prioritized fixes)

Current math: `mcp-server/src/utils/calculations.ts` (mirrored in `index.tsx`).

All sport weights/constants are now centralized in `config/sportsConfig.ts`
(football/basketball) so the formulas can be tuned and backtested without
editing math — the spec's "weights in a config file" requirement. `calculations.ts`
reads from there; the old `*_CONSTANTS` exports remain as thin compatibility
wrappers.

### NFL/CFB (`predictedMarginFootball` + `estimateFootballProbability`)
- Weights points 40% / yards 25% / turnovers 20% — directionally sound, now in config.
- **FIXED — unused constants wired in:** `decayRate` now drives an optional
  recent-form blend (effective = decay·season + (1−decay)·recent), applied only
  when recent rates are supplied so default behavior is unchanged. `qbValue` now
  caps an optional `qbEdge` input (reflect a backup/injured starter), clamped to
  ±qbValue so it can never dominate the projection.
- **DONE — confidence/edge/no-bet:** added via the shared decision layer.

### NBA/CBB (`predictedMarginBasketball`)
- 7 weighted components + pace multiplier — the strongest existing model, now in config.
- **FIXED — CBB pace bug:** the model reused the NBA's ~100-possession baseline
  for college, which wrongly compressed CBB margins by ~32%. CBB now uses ~68.
- **Correlation note:** PPG-for, points-allowed and FG% are positively correlated
  (efficiency shows up in all three). They're kept separate (volume vs efficiency
  carry distinct signal) but the weights are now in one place to retune against
  backtest data. Recent-form blend added (decay 0.85) like football.
- **DONE — confidence/edge/no-bet:** added via the shared decision layer.

### NHL (`calculateNHLProjection`)
- Most mature: graduated pace & special-teams scaling, overdispersion-adjusted
  variance, OT boost, home-ice. Good.
- **DONE — confidence/edge/no-bet:** added via the shared decision layer.

### Cross-cutting recommendation — DONE
The MLB decision discipline is now extracted into a shared module so NFL/NBA/NHL
emit the same disciplined output (edge vs line, lean/no-bet, confidence, risks).

**Source:** `mcp-server/src/utils/decision.ts` (+ `config/decisionConfig.ts`)
**Tests:** `mcp-server/test/decision.test.ts` (14 unit tests)

Every spread/total tool (`estimate_football_probability`,
`estimate_basketball_probability`, `estimate_hockey_probability`) now returns,
**in addition to** its existing fields (kept for backward compatibility):

```
decision: {
  fairImpliedPct,    // vig-free implied probability of the chosen side
  edgePct,           // model probability − fair implied (percentage points)
  recommendation,    // 'bet' | 'pass' | 'no-bet'
  confidence,        // 0-100, blends edge + decisiveness + data quality
  confidenceLabel,   // low | medium | high
  summary            // plain-language, non-hype explanation
}
dataCompleteness,    // 0-1, drives the confidence ceiling
riskFactors[],       // structural uncertainties (injuries/rest/lines not modeled)
disclaimer           // never promises a guaranteed result
```

How it works (sport-agnostic):
- The model's probability for a side (cover% for spreads, over/under% for totals)
  is compared against the **vig-free implied probability** of that side, computed
  by de-vigging the two-way price (defaults to the standard −110/−110 line when
  odds aren't supplied; callers may pass `spreadOdds`/`betOdds` + the opposite
  side to use the real market price).
- **No-bet** fires when data completeness is below 50% or the edge is under the
  threshold (default 3%). **Pass** fires when the model actively disfavors the
  side. Otherwise **bet** (a *possible edge*, never a guarantee).
- **Confidence** blends edge size, how decisively the model leaves a coin flip,
  and data quality — with data quality as a hard ceiling so a big edge on thin
  inputs can't read as high confidence (same philosophy as MLB).

All thresholds live in `config/decisionConfig.ts` for tuning/backtesting.

---

## 3. Backtesting storage — IMPLEMENTED

Every projection is now storable so formulas can be scored against reality.

**Model:** `mcp-server/src/models/Projection.ts` (Mongoose)
**Tools:** `mcp-server/src/tools/projectionLog.ts`
**Tests:** `mcp-server/test/projectionGrading.test.ts` (16 grading tests)

Stored record (one row per projection, unique per game+market+model):

```
gameDate, sport, league, homeTeam, awayTeam,
market,                 // total | spread | moneyline
bookLine, bookOdds,
projectedValue,         // projected total / margin / win prob
edge, lean, confidence,
modelVersion,           // which engine/config produced it
statsSnapshot,          // JSON of the EXACT inputs used at projection time
result,                 // pending | win | loss | push (filled post-game)
finalHomeScore, finalAwayScore,
closingLine,            // for CLV analysis
settledAt
```

Three MCP tools:
- **`record_projection`** — store a projection + its stat snapshot (idempotent
  per game+market+model, so re-running a slate updates rather than duplicates).
- **`settle_projection`** — after the game, grade the stored projection against
  the final score. Grading is a pure, unit-tested function (`gradeProjection`)
  covering totals (over/under vs line), moneyline (home/away), and spread (home
  perspective). `no-bet`/`pass` settle as push (no action).
- **`get_backtest_summary`** — aggregate hit rate, average edge, average
  confidence, and **hit rate bucketed by confidence band** — the key
  calibration check: do higher-confidence projections actually win more often?
  Filterable by sport/league/market/modelVersion.

Storing the **stats snapshot + modelVersion at projection time** is what makes
backtesting honest: we can replay the stored inputs, recompute under new weights
(in `sportsConfig.ts` / `mlbConfig.ts`), and score against outcomes without
leaking future data — then compare model versions head-to-head.

### Auto-population via the daily pipeline
`run_daily_calculations` (`tools/dailyCalc.ts`) calls `record_projection` for
**every analyzed game** (not just value bets), tagged `modelVersion: 'daily-v1'`,
with the full stat snapshot. It runs on the existing 9:00 AM UTC cron, so the
backtest log fills itself daily. Toggle with the `recordProjections` option
(default true). After games finish, call `settle_projection` with the final
score to grade each one, then `get_backtest_summary` to track calibration.

Sport coverage in the daily pipeline:
- **NBA / NFL** — moneyline market. The decision layer turns each home win
  probability into a `home`/`no-bet` lean; value bets are also Kelly-sized and
  logged as wagers.
- **NHL** — totals (over/under) market, via a new NHL stats loader
  (`getNHLTeamStats`) that reads the seven `nhl_*.csv` files and feeds them
  straight into the hockey engine. The over/under line comes from ESPN's odds
  feed (`overUnder`); when present the model leans over/under/no-bet, when absent
  it still records the projected total as a no-bet. NHL is analysis +
  backtesting only — it is not auto-logged as a wager (the bet-logging flow is
  spread/moneyline-shaped). Team-name lookup handles ESPN's abbreviations
  (TB/NJ/SJ/LA) mapping to the CSV forms (TBL/NJD/SJS/LAK).
- **MLB** — totals market, via **MLB StatsAPI** (`utils/mlbDataService.ts`,
  free/no-auth). Pulls today's schedule + **real probable starters** (with a
  genuine confirmed flag), starter season ERA/WHIP, and team season OPS + runs/
  game. Deliberately partial: StatsAPI does **not** expose the FanGraphs metrics
  the engine prefers (FIP/xFIP/SIERA/wRC+/wOBA), bullpen splits, park factors, or
  weather, so those inputs are left unset. The engine's data-completeness logic
  then (correctly) lowers confidence — MLB projections come back low-confidence
  and, with no book line from StatsAPI, **no-bet** by design. We record them
  anyway so the backtest log can later reveal whether even this thin signal
  carries any edge. MLB is analysis + backtesting only, never auto-logged as a
  wager. The documented upgrade path that raises MLB confidence is a FanGraphs
  (or similar) data source + a totals line feed — that is the real prerequisite,
  not more engine code. Parsers are pure and unit-tested against fixtures; the
  live fetch wrappers are runtime-verified (the build sandbox blocks egress).
  For richer manual projections, `estimate_mlb_projection` still accepts the full
  input set (bullpen, park, weather, lineup).
