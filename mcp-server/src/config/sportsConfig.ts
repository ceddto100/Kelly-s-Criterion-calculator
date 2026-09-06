/** Structural defaults, not empirically fitted weights. See docs/PREDICTION_MODEL.md.
 * No new statistical inputs. Zero supplemental weights prevent double counting.
 */
const footballScaling = {yardsPerPoint:15,pointsPerTurnover:4,turnoverRegression:0.5,turnoverClamp:10};
export const FOOTBALL_CONFIG = {
  NFL:{sigma:13.5,homeFieldAdvantage:2.5,decayRate:0.9,qbValue:7,weights:{points:0.5,yards:0.25,turnovers:0},scaling:footballScaling},
  CFB:{sigma:16,homeFieldAdvantage:3,decayRate:0.85,qbValue:9,weights:{points:0.5,yards:0.25,turnovers:0},scaling:footballScaling},
} as const;
// These legacy scaling keys stay exported for API compatibility.
const basketballScaling={fgPctPointsMultiplier:2,threePctMultiplier:1,threeRateMultiplier:15,reboundPointValue:0.5,turnoverPointValue:1};
const basketballWeights={ppgFor:0.5,pointsAllowed:0.5,fgPct:0,rebounds:0,turnovers:0,threePct:0,threeRate:0};
export const BASKETBALL_CONFIG = {
  NBA:{sigma:12,homeCourtAdvantage:2.5,decayRate:0.85,leagueAvgPace:100,weights:basketballWeights,scaling:basketballScaling},
  CBB:{sigma:10.5,homeCourtAdvantage:3.5,decayRate:0.85,leagueAvgPace:68,weights:basketballWeights,scaling:basketballScaling},
} as const;
export type FootballLeague=keyof typeof FOOTBALL_CONFIG;
export type BasketballLeague=keyof typeof BASKETBALL_CONFIG;
