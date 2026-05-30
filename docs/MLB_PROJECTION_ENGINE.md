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

### NFL/CFB (`predictedMarginFootball` + `estimateFootballProbability`)
- Weights points 40% / yards 25% / turnovers 20% — directionally sound.
- **Gap:** no confidence score, no edge-vs-line, no no-bet — every game returns a
  cover %. Recommend adding the same confidence/edge/no-bet layer MLB now has.
- **Unused constants:** `decayRate`, `qbValue` are defined but never applied.
  Either wire QB-out adjustments in or remove to avoid implying they're used.

### NBA/CBB (`predictedMarginBasketball`)
- 7 weighted components + pace multiplier — the strongest existing model.
- **Risk:** PPG (15%) + points-allowed (15%) + FG% (25%) are correlated
  (efficiency shows up in all three) and may over-weight offense. Worth a
  correlation review and possibly folding PPG/allowed into net rating.
- Same missing confidence/no-bet layer as football.

### NHL (`calculateNHLProjection`)
- Most mature: graduated pace & special-teams scaling, overdispersion-adjusted
  variance, OT boost, home-ice. Good.
- **Gap:** still reports a raw over/under % with no edge-vs-line or no-bet rule.

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

## 3. Backtesting schema (design now, measure later)

Every projection should be storable so formulas can be scored against reality.
Recommended record (one row per projection):

```
game_date, sport, home_team, away_team,
market,                 // total | moneyline | spread | runline
book_line, book_odds,
projected_value,        // projected total / win prob / margin
edge, lean, confidence,
stats_snapshot,         // JSON of the exact inputs used at projection time
final_home_score, final_away_score,
result,                 // over/under hit, ML hit, spread hit (filled post-game)
closing_line            // for CLV analysis
```

Storing the **stats snapshot at projection time** is what makes backtesting
honest — it lets us replay and recalibrate weights (in `mlbConfig.ts`) against
outcomes without leaking future data.
