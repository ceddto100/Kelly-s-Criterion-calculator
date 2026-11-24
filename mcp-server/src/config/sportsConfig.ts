/**
 * Spread-model constants. Every number below was checked against historical
 * games; see docs/PREDICTION_MODEL.md ("November 2026 backtest") for the data.
 *
 * Structure (NFL/NBA):
 *   projected margin = home edge + k(n) × raw season gap
 *   k(n) = n / (n + priorGames)   — Bayesian shrinkage: with n games played a
 *   team's season-to-date average is regressed toward league average by
 *   `priorGames` games of average play. Fitted values: NFL 6 (4,063 games,
 *   2010-2026), NBA 10 (1,203 games, 2025-27).
 *
 * The old fixed 0.5 multiplier ignored sample size: it over-reacted in the
 * first weeks and halved real gaps for the rest of the season, which is why
 * the model kept backing underdogs.
 *
 * `marketTrust` is how far a posted line may be moved toward the model's
 * opinion when pricing a bet. It is LEARNED FROM HISTORY: scripts/backtest/
 * calibrate.ts grades the model against every completed game at the closing
 * line, fits how much of its disagreement turned into results, shrinks that
 * toward 0 by the evidence and writes calibration.generated.ts (weekly
 * workflow). A sport earns picks only while its history shows an edge.
 *
 * `marketGapScale` (c): the model's disagreement is measured against c × the
 * market's implied team gap. The fitted slope of season gaps on market gaps
 * was NBA 0.91 (1,203 games) and NFL 1.28 (4,063); with c = 1 NBA bets stayed
 * ~67% underdogs. NFL bets leaned to favorites at c = 1 and to underdogs at
 * 1.28, so it uses the midpoint 1.15.
 *
 * CFB/CBB keep their previous behaviour (priorGames 0 → no sample-size
 * shrink, same weights) because they were not part of this backtest.
 */
import { CALIBRATION } from './calibration.generated.js';

const footballScaling = {yardsPerPoint:15,pointsPerTurnover:4,turnoverRegression:0.5,turnoverClamp:10};
export const FOOTBALL_CONFIG = {
  NFL:{sigma:13,homeFieldAdvantage:1.8,decayRate:0.9,qbValue:7,priorGames:6,marketTrust:CALIBRATION.NFL.marketTrust,marketGapScale:1.15,
    weights:{points:0.8,yards:0.2,turnovers:0},scaling:footballScaling},
  CFB:{sigma:16,homeFieldAdvantage:3,decayRate:0.85,qbValue:9,priorGames:0,marketTrust:1,marketGapScale:1,
    weights:{points:0.5,yards:0.25,turnovers:0},scaling:footballScaling},
} as const;
// These legacy scaling keys stay exported for API compatibility.
const basketballScaling={fgPctPointsMultiplier:2,threePctMultiplier:1,threeRateMultiplier:15,reboundPointValue:0.5,turnoverPointValue:1};
export const BASKETBALL_CONFIG = {
  // NBA: full net-efficiency gap (weight 1) shrunk by games played. Residual SD
  // of actual margins around NBA closing lines was 14.1 (2025-27), not 12.
  NBA:{sigma:14,homeCourtAdvantage:2,decayRate:0.85,leagueAvgPace:100,priorGames:10,marketTrust:CALIBRATION.NBA.marketTrust,marketGapScale:0.91,
    weights:{ppgFor:1,pointsAllowed:1,fgPct:0,rebounds:0,turnovers:0,threePct:0,threeRate:0},scaling:basketballScaling},
  CBB:{sigma:10.5,homeCourtAdvantage:3.5,decayRate:0.85,leagueAvgPace:68,priorGames:0,marketTrust:1,marketGapScale:1,
    weights:{ppgFor:0.5,pointsAllowed:0.5,fgPct:0,rebounds:0,turnovers:0,threePct:0,threeRate:0},scaling:basketballScaling},
} as const;
export type FootballLeague=keyof typeof FOOTBALL_CONFIG;
export type BasketballLeague=keyof typeof BASKETBALL_CONFIG;

/**
 * Season calendars used to estimate how many games stand behind a season-
 * to-date stat when the CSVs carry no games-played column. Estimates are
 * within about one game, which moves k(n) by a few hundredths at most.
 */
export const SEASON_CALENDAR = {
  /** Regular season opens on the third Tuesday of October; 82 games in ~174 days. */
  NBA: { games: 82, seasonDays: 174 },
  /** Kickoff is the Thursday after Labor Day; one game a week, one bye in weeks 5-14. */
  NFL: { games: 17 },
} as const;
