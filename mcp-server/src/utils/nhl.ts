import { normCdf } from './calculations.js';

export interface NHLTeamStats {
  xGF60: number; xGA60: number; GSAx60: number; HDCF60: number;
  PP: number; PK: number; timesShorthandedPerGame: number;
}
export const NHL_CONFIG = {
  homeIceAdvantage: 0.15,
  goalieWeight: 0.5,
  varianceMultiplier: 1.15 ** 2,
} as const;

/** All-situation xG already includes chance quality and special teams.
 * Equal offense/defense matchup blend; goalie effect regressed without exposure.
 * Negative binomial total preserves integer outcomes and nonzero push mass.
 * Constants are structural defaults, pending temporal calibration.
 */
export function calculateNHLProjection(home: NHLTeamStats, away: NHLTeamStats, line: number) {
  if (!Number.isFinite(line) || line < 0 || line > 100) throw new Error('Invalid goals line');
  for (const team of [home, away]) {
    for (const [key, value] of Object.entries(team)) {
      if (typeof value !== 'number') continue; // optional caller team name
      if (!Number.isFinite(value) || (key !== 'GSAx60' && value < 0)) throw new Error('Invalid NHL statistic: ' + key);
    }
    if (!(team.xGF60 > 0 && team.xGA60 > 0) || !Number.isFinite(team.GSAx60)) throw new Error('Missing NHL scoring data');
  }
  const homeScore = Math.max(0.05, (home.xGF60 + away.xGA60) / 2 - NHL_CONFIG.goalieWeight * away.GSAx60 + NHL_CONFIG.homeIceAdvantage / 2);
  const awayScore = Math.max(0.05, (away.xGF60 + home.xGA60) / 2 - NHL_CONFIG.goalieWeight * home.GSAx60 - NHL_CONFIG.homeIceAdvantage / 2);
  const projectedTotal = homeScore + awayScore;
  const variance = projectedTotal * NHL_CONFIG.varianceMultiplier;
  const r = projectedTotal ** 2 / (variance - projectedTotal);
  const p = r / (r + projectedTotal);
  let mass = p ** r, under = 0, push = 0, cdf = 0;
  for (let k = 0; k <= Math.floor(line); k++) {
    if (k < line) under += mass;
    else push = mass;
    cdf += mass;
    mass *= (k + r) / (k + 1) * (1 - p);
  }
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return {
    homeScore: round(homeScore), awayScore: round(awayScore), projectedTotal: round(projectedTotal),
    paceAdjustment: 0, specialTeamsAdjustment: 0,
    standardDeviation: Math.sqrt(variance), zScore: (projectedTotal - line) / Math.sqrt(variance),
    overProbability: round(Math.max(0, 1 - cdf) * 100), underProbability: round(under * 100), pushProbability: round(push * 100),
  };
}
export type NHLProjectionResult = ReturnType<typeof calculateNHLProjection>;
export const normalCDF = normCdf;
