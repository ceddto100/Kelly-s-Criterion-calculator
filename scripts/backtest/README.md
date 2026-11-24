# Model backtest

Rebuilds what the models knew before each game, then grades the **production code** against what happened. This is the evidence behind the constants in `mcp-server/src/config/sportsConfig.ts`, `mcp-server/src/utils/nhl.ts` and `mcp-server/src/utils/waltersCfb.ts`; see `docs/PREDICTION_MODEL.md`.

## Run it

```bash
pip install pandas pyarrow numpy          # once
python3 scripts/backtest/build_datasets.py  # from the repo root; caches downloads in scripts/backtest/.cache
cd mcp-server && npx tsx ../scripts/backtest/validate.ts ../scripts/backtest/.cache/backtest.json    # old vs new report
cd mcp-server && npx tsx ../scripts/backtest/calibrate.ts ../scripts/backtest/.cache/backtest.json   # re-learn marketTrust (add --write to save)
```

To include the graded bet log, export graded `betlogs` documents to JSON and run `python3 scripts/backtest/betlog_evidence.py EXPORT.json`. It writes per-sport summary numbers only, never individual bets, to `betlog_evidence.json`, which `calibrate.ts` folds in.

The `Recalibrate models from history` workflow runs `calibrate.ts --write` every Monday and commits `mcp-server/src/config/calibration.generated.ts` when the learned trust changes.

The first build downloads about 1.5 GB of NBA game files (it keeps only the line and box totals, about 1 MB on disk) and takes several minutes. Later runs fetch only new games.

## Data sources

| What | Where |
|---|---|
| Pre-game NHL stats | every snapshot of `frontend/public/stats/nhl` in git history |
| Pre-game NBA/NFL stats | rebuilt walk-forward from final scores (NBA pace from box-score possessions) and `backend/data/nfl/boxscores_*.json` (NFL yardage) |
| NFL scores and closing lines | [nflverse `games.csv`](https://github.com/nflverse/nfldata) |
| NBA scores, closing lines, box totals | [sportsdataverse hoopR-nba-raw](https://github.com/sportsdataverse/hoopR-nba-raw) (the DraftKings line ESPN stored with each game) |
| NHL final scores (OT/SO included) | [sportsdataverse fastRhockey-nhl-raw](https://github.com/sportsdataverse/fastRhockey-nhl-raw) |
| NHL closing totals and over/under prices | ESPN game summaries (`pickcenter`), cached in `.cache/nhl_odds.jsonl` |
| CFB graded picks | `frontend/public/stats/cfb/cfb_predictions.csv` |

These are validation inputs only. The models still read nothing but the CSVs the updaters write.

## Reading the output

- **bets / W-L / units:** what the daily-picks rule would have bet at -110 (probability above 52.38%), and how it did against the closing line.
- **underdog/under share:** a model with no structural bias should land near 50%.
- **Brier / log-loss:** calibration of the line probabilities on every game. A coin flip scores 0.2500 / 0.6931; anything worse than that is overconfident.

Re-fit a constant only when new data moves it by more than its standard error. The fitting notes are in `docs/PREDICTION_MODEL.md`.
