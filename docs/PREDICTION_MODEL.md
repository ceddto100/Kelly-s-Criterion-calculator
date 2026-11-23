# Prediction model — November 2026 recalibration

The prediction board, HTTP API, MCP tools and the daily auto picks share one implementation per sport. No statistical columns were added: every input below is one the updaters already write. What changed is how those stats are weighted and how a projection is turned into a probability against a posted line. Every constant below was checked against past games instead of assumed.

## What the backtest found (November 2026)

Data used, all pre-game:

- **Inputs:** every stats snapshot the updater committed to git (NBA 68, NFL 58, NHL 116 snapshots), plus walk-forward season-to-date stats rebuilt from box scores.
- **Results and closing lines:** NFL from nflverse `games.csv` (2010–2026). NBA and NHL final scores from the sportsdataverse `hoopR-nba-raw` and `fastRhockey-nhl-raw` repositories, and NBA closing lines from the DraftKings line ESPN stored with each game.
- **The live record:** all 41 daily auto-pick runs from Nov 3–22, 2026 (266 unique picks), graded against final scores.

| | Old math | Finding |
|---|---|---|
| NBA spreads | 0.5 × net-rating gap, sigma 12 | Live picks were 77% underdogs, and stated probabilities averaged 66% against a 56% hit rate. Over 1,203 games with closing lines, the old rule bet 89% of games, 88% of them underdogs, at 50.6% ATS while claiming 65%. |
| NFL spreads | 0.5 × points + 0.25 × yards/15, home 2.5 | Live record 4-16, plus 17 duplicate bets on games already logged (fixed Nov 5). From 2010 to 2026, 3,301 bets went 48.2% ATS (−264 units) and 74% were underdogs. |
| NHL totals | Negative binomial (var = 1.32 × mean) on 60-minute xG, priced at −110 | Live picks were Under on 81 of 82 games at 6.5 and Over on 20 of 21 at 5.5 (52-51 overall). The projected total averaged 6.16 against an actual 6.42. |
| CFB (Walters) | Rating margin vs line, sigma 16 | Picks went 91-100 while claiming 56.8%; STRONG picks went 23-35. |

The common cause is that the probabilities were computed as if the model knew more than the market. Against closing lines, these season stats showed **no measurable edge** in any sport. The fitted weight of the model's disagreement with the line was:

| Sport | Fitted weight | Games or picks |
|---|---|---|
| NFL | −0.02 ± 0.06 | 4,063 games |
| NBA | −0.06 ± 0.09 | 1,203 games |
| CFB | −0.58 ± 0.42 | 191 graded picks |

The live NBA picks beat the closing line by only +0.09 points on average. Through the shipped code, the new math moves every sport's line probabilities to calibration:

| Metric | Old | New |
|---|---|---|
| NBA cover Brier | 0.276 | 0.250 |
| NFL cover Brier | 0.268 | 0.250 |
| NHL over 6.5 Brier | 0.258 | 0.247 |
| CFB pick Brier | 0.265 | 0.252 |

A coin flip scores 0.250. The old spread probabilities did worse than a coin flip, which is what oversized Kelly stakes: a claimed 85% on an NBA +4.5 meant betting over a third of the bankroll at half Kelly.

## Spread sports (NBA, NFL): projection

`projected margin = home edge + k(n) × raw season gap`, with `k(n) = n / (n + priorGames)`

The raw gap is the full difference between the two teams' season-to-date ratings. Offense against an average defense **adds** to defense against an average offense; the old 0.5 averaged them, halving every real gap. `k(n)` is standard Bayesian shrinkage: after `n` games a team's average is regressed toward the league average by `priorGames` games of average play. It rises from near 0 in the first week to about 0.75 (NFL) or 0.9 (NBA) at season end. The CSVs have no games-played column, so `n` is estimated from the league calendar at the snapshot date (`estimateGamesPlayed`).

**NBA**
- The raw gap is the net-efficiency difference (offensive minus defensive rating, or points per 100 possessions) at the two teams' average pace.
- `priorGames` = 10. The binned fits rise from 0.17 in the first week to about 1.0 by mid-season, and the market's own implied weight follows the same curve.
- Home edge 2.0 (market 1.5–2.0). Sigma 14: the residual SD of NBA margins around closing lines was 14.1, not 12.
- FG%, three-point stats, rebounds and turnovers are already inside scoring efficiency and are not added again.

**NFL**
- The raw gap is 0.8 × net points per game plus 0.2 × net yards per game / 15. If yardage is missing, points carry the full weight.
- `priorGames` = 6, the same in every era tested: 2010–2026, since 2020, since 2023, and each season alone.
- Home edge 1.8: the fit since 2020 gave 1.80, and the market uses about 1.65. Sigma 13 (residual 12.6–13.0).
- Season turnover totals keep zero weight: there is no per-game denominator in the CSV and no reliable evidence of value.
- The model shows the same structure the market uses: points 0.84 and yards 0.40 per k-weighted unit in 2026.

## Pricing a bet: anchored to the market

A stats-only projection is calibrated to results, but it shrinks every team toward average, while the posted line also carries priors (rosters, last season, injuries). Comparing the raw projection with the line therefore makes nearly every favorite look overpriced. That is the structural source of the underdog skew, and the same compression produced the NHL under skew. The comparison is made on equal footing, and the line is treated as the market's estimate:

```
disagreement = (margin − home edge) − k(n) × c × (market margin − home edge)
P(cover)     = Φ(marketTrust × disagreement / sigma)
```

- `c` (`marketGapScale`) is the measured slope of season gaps on market gaps: NBA 0.91; NFL 1.15, the midpoint of its fits. With it, the disagreement is uncorrelated with how big a favorite the market makes a team: underdog share in the NBA backtest fell from 88% to 54% at a trust of 0.2.
- `marketTrust` = 0.1 for the NFL, NBA and NHL: the largest weight the closing-line fits above cannot rule out (upper 95% bound). CFB uses 0.2, its own bound.
- Picks therefore fire only on large disagreements, and Kelly stakes stay small. 0 turns betting off; raise it only if new data shows an edge.
- With `marketTrust` = 1 and k = c = 1 the formula is exactly the old `Φ((margin + spread) / sigma)`.

The daily picks also use **real prices**. ESPN's odds entry carries over/under and spread prices; both sides are parsed (`parseTotalOdds`, `parseSpreadOdds`), de-vigged for the fair probability, and each side is bet only above the break-even of its own price, with Kelly sized at that price. When ESPN has no price, a spread is assumed at −110/−110. For an NHL total, the fair probability is a league-average game at that line, marked up by standard vig.

## NHL

All-situation MoneyPuck xG already includes chance quality and special teams; HDCF and PP/PK are context only. Each side's regulation goals are the equal blend of its xGF/60 and the opponent's xGA/60, with a 0.15 home edge split across the two sides.

Totals settle on the final score, and **a game tied after regulation always gets exactly one more goal** (the OT winner or the shootout decider). In the 2025–27 finals no game ended tied, 70% of totals were odd, and the variance of the total was only 0.80 × its mean. The old negative binomial had none of that shape. It missed the extra goal, so it projected 0.26 goals low, and it inflated the variance, so it found Unders at 6.5 that were not there.

The final total is now built as follows:

- The regulation total is Poisson.
- The home/away split is binomial.
- The chance of an even regulation total ending tied is scaled by 1.25, for score effects. Independent Poisson ties only about 16% of games; with the scaling the model reached overtime in 21%.
- A tie adds one goal.

Against 462 games with a fresh pre-game snapshot, the new model matched the finals closely:

| | Model | Actual |
|---|---|---|
| Mean total | 6.41 | 6.42 |
| Odd totals | 70% | 69% |
| Over 6.5 | 48.8% | 49.1% |
| Over 5.5 | 58.6% | 60.0% |

The Brier score improved at both lines.

Season goalie GSAx is no longer subtracted. Every backtested weight above 0 made totals worse (Brier 0.4835 at 0, 0.4880 at 0.25, 0.4977 at 0.5): team GSAx mixes starters and backups and regresses heavily. It stays configurable for a future confirmed-starter feed.

Over, under and push are summed exactly. Bets use push-free probabilities, win / (win + loss), because a push refunds the stake. The old code folded the whole push mass into the Under on whole-number lines.

## MLB

Not recalibrated in November 2026: the season had ended, the slate CSVs store no final scores, and MLB is not in the daily auto picks. Before next season it should get the same results-based check, including anchoring its probabilities to the posted price.


The frontend previously maintained a separate copy of the entire MLB engine. It now imports the server's pure module, and both runtimes share the CSV slate/starter/bullpen/park joiner.

The offense anchor is wRC+ when present. wOBA, OPS and runs/game are ordered fallbacks, rather than diluting park-adjusted wRC+ with overlapping, unadjusted descriptions of the same offense. No new metrics are collected. Starting-pitcher ERA estimators retain their existing normalized blend (SIERA .35, xFIP .25, FIP .25, ERA .15 over available values). These are priors; research does not establish a universally best fixed blend. Starter/bullpen exposure follows expected innings (5.5/9 and 3.5/9). Existing fatigue, park, weather, lineup and limited recent-form adjustments remain. Their magnitudes require backtesting, and raw fallback offense or unadjusted pitching can still carry park/context bias.

Sources: [FanGraphs wRC+](https://library.fangraphs.com/offense/wrc/) explains its park/league adjustment and relation to wOBA. [FanGraphs FIP](https://library.fangraphs.com/pitching/fip/) explains its pitching components and limitations. These support feature selection, not invented claims that the retained blend is optimal.

The board only attaches slate starters/weather when the selected pair has a unique game on the requested date (today if omitted). An unscheduled pair is explicitly hypothetical. Doubleheaders require selecting the intended game's starters in the MLB estimator. Missing optional components retain neutral fallbacks and appear as limitations; missing offense never produces a fabricated team projection. MLB normal total probabilities and logistic moneyline probabilities are approximations, not a fitted joint scoring distribution. Integer MLB totals do not yet separately model push probability; use half-run comparisons when evaluating binary calibration.

## College football (Walters Protocol)

The Walters tab is college-football-only. Per-game averages mislead in college football because schedules are so uneven: 50 points a game against overmatched opponents is not the same offense as 50 against a conference schedule. The model therefore starts from opponent-adjusted power ratings. Each FBS team's rating is the mean of SP+ and FPI, which both express points versus an average FBS team on a neutral field. One pure module, `mcp-server/src/utils/waltersCfb.ts`, serves the Walters tab, the Today's Games CFB cards, the stat updater and the calibration script.

`margin(A) = ratingA − ratingB + home field + (situational A − situational B) + (QB A − QB B)`, then pulled up to 1 point toward zero for a rivalry game.

- Home field +3.0 (0 at neutral sites).
- Detected automatically from the weekly slate:
  - off a bye when the opponent is not: +1.0
  - short week (5 days or fewer): −1.0
  - 2+ time zones or a kickoff before 10:00 on the team's home clock: −1.5
  - visiting a 4,500+ ft stadium from under 3,000 ft: −1.0
  - bounceback after a 21+ point loss: +1.5
- A top-10 next opponent (lookahead, −1.0) is only suggested. Letdown spots and rivalries are manual.
- Starting QB out: −4 with an experienced backup, −9 with an inexperienced one. QB status is never automated because there is no NCAA-wide injury report; [conferences decide](https://sportshandle.com/college-football-injury-reporting-conference-decision/), and the [SEC](https://www.cbssports.com/college-football/news/sec-institutes-player-availability-injury-reports-for-all-teams-during-2024-college-football-season/) and [Big Ten](https://www.cbssports.com/college-football/news/big-ten-institutes-player-availability-injury-reports-for-all-teams-during-2023-college-football-season) publish their own.

Every value above is a structural starting point, not a fitted coefficient.

The final margin is treated as normal around the projection. Its spread is 16 points, widening 0.15 per point of line beyond 14, because lopsided games (starters rest, garbage time) are the least predictable. Any 28+ point line caps at LEAN. Cover probability is reported for the side the edge favors; pushes and key numbers are not modeled.

Since November 2026, that cover probability is anchored to the market line like the other sports (`marketTrust` 0.2, `pickProbability`; the ratings-only figure is kept as `modelPickProbability`).

- The graded 2026 log went 91-100 while claiming 56.8%, and fit a trust weight of −0.58 ± 0.42.
- Anchoring lowers the Brier score from 0.265 to 0.252 and the mean stated probability to 51.4%.
- The point-based tiers are unchanged. In that log, STRONG went 23-35, BET 13-17, LEAN 26-24 and NO_BET 29-24, so higher tiers have not outperformed yet. An edge of 7+ points is flagged, because it usually means the market has news the ratings lack. The optional rating updater moves a hand-kept rating by 15% of the *surprise* (actual minus expected margin), capped at ±21 points, so a blowout of an overmatched opponent cannot swing it.

**Data.** `scripts/updateCFBStats.mjs` calls the [CollegeFootballData.com](https://collegefootballdata.com) API with a free key (`CFBD_API_KEY`). Twice-daily runs use about 250 of the free tier's 1,000 monthly calls. CFBD's terms forbid republishing its data as a standalone dataset, so the public CSVs hold only derived values:

- the rating blend and a disagreement band
- consensus lines (the median across books, to the nearest half point)
- rest, travel and elevation context

Pending picks and season-static responses stay in a private Actions cache.

**Validation.** Once per game, 72 hours before kickoff, the updater logs the automatic-factor pick at the consensus line. After the game it grades that pick against the final score and the closing line. `cfb_predictions.csv` carries the `evaluatePredictions.mjs` columns (sport `CFB`, market `spread`) plus closing-line value. `scripts/calibrateCFBWalters.mjs` checks the constants against completed seasons using only pre-game numbers: closing lines, CFBD pre-game Elo, schedule context and the poll released before each game. It fits on earlier seasons and scores the last one. It suggests a value only when the estimate is at least two standard errors from zero, and it never edits the engine. CFBD keeps no weekly SP+/FPI snapshots, so Elo stands in for the rating there; the live pick log is the real test of the blend.

## Data contract and conversational boundaries

- Canonical source: `frontend/public/stats`, or `STATS_DIR` for the MCP deployment. The duplicate top-level `stats/` folder is not the board's source.
- `predictionCore.ts` performs shared CSV parsing, joins and projections. Optional blank values stay absent. Invalid values, malformed rows, missing required scores and ambiguous teams produce errors.
- `predict_game` takes identifiers and an optional existing line, never generated statistics. Results include model version, snapshot date, source files, actual inputs, drivers and limitations.
- `get_sports_catalog` supports comparison and team questions. ChatGPT supplies the language understanding and calls typed tools; no extra language model runs inside the projection engine.
- `ask_sports` offers a bounded direct-text interface: team-stat questions, methods and simple `away at home` requests. Ambiguity returns clarification. It does not pretend to understand arbitrary language; the host can use `predict_game` after resolving it.
- Predictions use no database, AI API key, live injury feed or external scraping. Refresh jobs remain an explicit ingestion step that writes CSVs; they are not invoked while answering a prediction.
- Public MCP defaults to four read-only prediction tools. Legacy AI/account/bet tools are opt-in via `ENABLE_LEGACY_TOOLS=true`; they are outside the CSV-only guarantee and should not be exposed for this product's prediction-only use case.

## How to validate and tune next

The November 2026 backtest is reproducible with `scripts/backtest/` (see its README). It rebuilds pre-game inputs from the committed snapshots and box scores, downloads results and closing lines from public sources, and runs **the production modules themselves** old-versus-new. Re-run it as results accumulate. Change `priorGames`, `marketGapScale` or `marketTrust` only when a re-fit moves them by more than their standard error.


Use saved **pre-game** snapshots and settled game outcomes, grouped by sport and market. Keep all records for a game together. Train on earlier dates, validate on later dates, and reserve a final untouched season/window. Never use today's cumulative CSV to reconstruct past pre-game knowledge.

Fit a small regularized margin/count model with only the existing metrics. Tune weights, residual variance and home effects inside chronological training folds; compare to the present structural baseline. Calibrate probabilities on held-out predictions, then measure final log loss, Brier score, reliability bins, margin/total MAE and performance by season. Do not select weights by win rate or return alone. Treat pushes as their own outcome or explicitly evaluate conditional non-push probabilities.

The included `scripts/evaluatePredictions.mjs` scores exported pre-game binary predictions and reports reliability bins by sport/market. It refuses forecasts recorded at or after tipoff and excludes pushes/voids explicitly. It is an evaluation utility, not automatic training or evidence of accuracy.

[scikit-learn calibration guidance](https://scikit-learn.org/stable/modules/calibration.html) distinguishes proper scoring rules from calibration alone and requires separate calibration data. [TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html) explains why ordinary shuffled folds can train on future observations. Adapt splits to game dates rather than blindly assuming equally spaced games.
