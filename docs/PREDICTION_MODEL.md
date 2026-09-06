# Prediction model audit — September 2026

The prediction board, HTTP API and default MCP tools use one CSV joiner and one implementation per sport. No statistical columns were added. These changes fix mathematical and data-flow defects; they do **not** establish improved historical accuracy. This repository contains current aggregate snapshots, not a time-indexed training set of pre-game statistics and final outcomes. No coefficients are described as trained or optimal.

## NBA

Offensive and defensive ratings measure points per 100 possessions; pace supplies the conversion back to game points. The model compares net efficiency at the average of the two teams' paces. If complete ratings and positive pace are unavailable, it derives each team's efficiency from its existing points scored/allowed and pace. With no paired pace, it uses the raw scoring matchup blend.

`margin = 0.5 × (netEfficiencyHome − netEfficiencyAway) × expectedPace / 100 + homeAdvantage`

The half weight is an equal offense-versus-defense matchup blend, not a claim of fitted regression strength. FG%, three-point percentage/volume, rebounds and turnovers remain supported and visible, but receive no additional additive bonus because their contributions are already represented in scoring efficiency. Net rating is also not added on top of offensive minus defensive rating. This avoids counting the same performance several times. The retained NBA residual scale is 12 points, home advantage 2.5; both still require calibration. College fallback retains its own variance and pace defaults and is available only through legacy/manual tools, not the professional CSV board.

Source: [NBA glossary](https://www.nba.com/stats/help/glossary?hidenav=true). Ratings express scoring per possession; pace normalizes comparisons.

## NFL

`margin = 0.5 × netScoringGap + 0.25 × netYardageGap / 15 + homeAdvantage`

This retains scoring as the primary signal and yardage as a weaker, correlated supplement. The yardage conversion and weight are inherited structural priors, not research-proven universal constants. Season turnover differential is a total without an exposure denominator in the supported CSV schema. The prior code effectively assumed a season length, then added a positive turnover reward to points that already contained turnover effects. Its supplemental weight is now zero. The column is retained for context. With game-count history one could regress a per-game effect, but silently adding that input would violate the requested scope.

The richer contextual NFL models described by [nflfastR](https://nflfastr.com/articles/nflfastR.html) require play-level inputs this app does not have. Their EPA or win-probability formulas cannot responsibly be copied onto season PPG/yardage columns. Home advantage 2.5 and residual scale 13.5 remain uncalibrated defaults. The normal margin model is an approximation and does not capture NFL key-number spikes or explicitly model ties/pushes.

## NHL

An actual sign error was fixed: the old `1 − CDF((mean − line)/sd)` decreased over probability when expected scoring increased.

The updater selects MoneyPuck **all-situation** xG. HDCF and PP/PK are therefore descriptive context, not independent reasons to add more goals. A missing all-situation feed now fails rather than silently switching to 5-on-5 rates. Each team's mean is the equal blend of its xGF/60 and its opponent's xGA/60, minus half the opposing GSAx/60. The goalie half weight is a conservative, unfitted shrinkage assumption because no goalie exposure column is supported. The retained 0.15 home edge is split across teams so it shifts margin without inflating the game total. No blanket overtime-goal increment is added to all-situation rates. Team means are bounded above zero and sum to the reported total.

Totals use a negative-binomial approximation: variance = mean × 1.15², preserving the previous standard-deviation inflation rather than mistaking it for a variance multiplier. The shape is `mean² / (variance − mean)`. Integer outcome probabilities are summed exactly within that distribution; `over + under + push = 100%`. This is a working count model, not an exact game-state simulator. Endgame empty-net behavior, actual starting-goalie uncertainty, shootouts and dependence between teams are limitations.

[MoneyPuck methodology](https://www.moneypuck.com/about.htm) supports separating chance creation and goaltending and avoiding excessive reaction to recent games. Its published importance percentages belong to its own trained model and feature set; they were **not** transplanted into this smaller model.

## MLB

The frontend previously maintained a separate copy of the entire MLB engine. It now imports the server's pure module, and both runtimes share the CSV slate/starter/bullpen/park joiner.

The offense anchor is wRC+ when present. wOBA, OPS and runs/game are ordered fallbacks, rather than diluting park-adjusted wRC+ with overlapping, unadjusted descriptions of the same offense. No new metrics are collected. Starting-pitcher ERA estimators retain their existing normalized blend (SIERA .35, xFIP .25, FIP .25, ERA .15 over available values). These are priors; research does not establish a universally best fixed blend. Starter/bullpen exposure follows expected innings (5.5/9 and 3.5/9). Existing fatigue, park, weather, lineup and limited recent-form adjustments remain. Their magnitudes require backtesting, and raw fallback offense or unadjusted pitching can still carry park/context bias.

Sources: [FanGraphs wRC+](https://library.fangraphs.com/offense/wrc/) explains its park/league adjustment and relation to wOBA. [FanGraphs FIP](https://library.fangraphs.com/pitching/fip/) explains its pitching components and limitations. These support feature selection, not invented claims that the retained blend is optimal.

The board only attaches slate starters/weather when the selected pair has a unique game on the requested date (today if omitted). An unscheduled pair is explicitly hypothetical. Doubleheaders require selecting the intended game's starters in the MLB estimator. Missing optional components retain neutral fallbacks and appear as limitations; missing offense never produces a fabricated team projection. MLB normal total probabilities and logistic moneyline probabilities are approximations, not a fitted joint scoring distribution. Integer MLB totals do not yet separately model push probability; use half-run comparisons when evaluating binary calibration.

## Data contract and conversational boundaries

- Canonical source: `frontend/public/stats`, or `STATS_DIR` for the MCP deployment. The duplicate top-level `stats/` folder is not the board's source.
- `predictionCore.ts` performs shared CSV parsing, joins and projections. Optional blank values stay absent. Invalid values, malformed rows, missing required scores and ambiguous teams produce errors.
- `predict_game` takes identifiers and an optional existing line, never generated statistics. Results include model version, snapshot date, source files, actual inputs, drivers and limitations.
- `get_sports_catalog` supports comparison and team questions. ChatGPT supplies the language understanding and calls typed tools; no extra language model runs inside the projection engine.
- `ask_sports` offers a bounded direct-text interface: team-stat questions, methods and simple `away at home` requests. Ambiguity returns clarification. It does not pretend to understand arbitrary language; the host can use `predict_game` after resolving it.
- Predictions use no database, AI API key, live injury feed or external scraping. Refresh jobs remain an explicit ingestion step that writes CSVs; they are not invoked while answering a prediction.
- Public MCP defaults to four read-only prediction tools. Legacy AI/account/bet tools are opt-in via `ENABLE_LEGACY_TOOLS=true`; they are outside the CSV-only guarantee and should not be exposed for this product's prediction-only use case.

## How to validate and tune next

Use saved **pre-game** snapshots and settled game outcomes, grouped by sport and market. Keep all records for a game together. Train on earlier dates, validate on later dates, and reserve a final untouched season/window. Never use today's cumulative CSV to reconstruct past pre-game knowledge.

Fit a small regularized margin/count model with only the existing metrics. Tune weights, residual variance and home effects inside chronological training folds; compare to the present structural baseline. Calibrate probabilities on held-out predictions, then measure final log loss, Brier score, reliability bins, margin/total MAE and performance by season. Do not select weights by win rate or return alone. Treat pushes as their own outcome or explicitly evaluate conditional non-push probabilities.

The included `scripts/evaluatePredictions.mjs` scores exported pre-game binary predictions and reports reliability bins by sport/market. It refuses forecasts recorded at or after tipoff and excludes pushes/voids explicitly. It is an evaluation utility, not automatic training or evidence of accuracy.

[scikit-learn calibration guidance](https://scikit-learn.org/stable/modules/calibration.html) distinguishes proper scoring rules from calibration alone and requires separate calibration data. [TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html) explains why ordinary shuffled folds can train on future observations. Adapt splits to game dates rather than blindly assuming equally spaced games.
