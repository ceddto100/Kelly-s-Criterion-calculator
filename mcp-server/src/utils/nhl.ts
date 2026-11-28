import { normCdf } from './calculations.js';
import { CALIBRATION } from '../config/calibration.generated.js';

export interface NHLTeamStats {
  xGF60: number; xGA60: number; GSAx60: number; HDCF60: number;
  PP: number; PK: number; timesShorthandedPerGame: number;
}

/**
 * Constants checked against 1,684 NHL finals (2025-27); 462 of them had a
 * fresh pre-game snapshot. See docs/PREDICTION_MODEL.md.
 */
export const NHL_CONFIG = {
  /** Home teams outscored visitors by 0.16 goals a game; split across both sides. */
  homeIceAdvantage: 0.15,
  /**
   * Weight on the opponent's season GSAx/60. Every backtested weight above 0
   * made totals worse (Brier 0.4835 at 0, 0.4880 at 0.25, 0.4977 at 0.5): team
   * GSAx mixes starters and backups and regresses heavily. Kept at 0, and kept
   * configurable for a confirmed-starter feed.
   */
  goalieWeight: 0,
  /**
   * Regular-season totals settle on the final score, and a game tied after
   * regulation always gets exactly one more goal (OT winner or the shootout
   * decider). This is why 70% of NHL totals are odd and why 60-minute xG alone
   * projected 0.26 goals too few.
   */
  tieAddsOneGoal: true,
  /**
   * Independent Poisson scoring ties only ~16% of regulations; NHL games reach
   * overtime about 21% of the time because trailing teams push and leaders
   * sit back. Scaling the tie chance by 1.25 reproduced the 2025-27 finals:
   * 69-70% odd totals (actual 69%), mean 6.41 (6.42), over 6.5 48.8% (49.1%).
   */
  tieInflation: 1.25,
  /**
   * Priced games needed before a slate's market level is applied in full
   * (fewer are shrunk toward no adjustment). See nhlSlateLevelScale.
   */
  minSlateForLevel: 4,
  /** Goal cap for the exact sum (P(more than 40 in regulation) is negligible). */
  maxGoals: 40,
  /** League regulation goals per team, used only when no matchup data exists. */
  leagueGoalsPerTeam: 3.1,
  /**
   * How far a posted price may move toward the model, learned from history
   * against real ESPN closing prices (see sportsConfig and
   * scripts/backtest/calibrate.ts).
   */
  marketTrust: CALIBRATION.NHL.marketTrust,
} as const;

function poissonPmf(lambda: number, max: number): number[] {
  const out = new Array<number>(max + 1);
  out[0] = Math.exp(-lambda);
  for (let k = 1; k <= max; k++) out[k] = out[k - 1] * lambda / k;
  return out;
}

/**
 * Distribution of the FINAL total (index = goals). Regulation goals are
 * Poisson for each side, so the regulation total t is Poisson(λh + λa) and
 * the split is binomial; an even total is tied with that binomial chance
 * scaled by `tieInflation` (score effects). A tie always adds one goal.
 */
export function nhlFinalTotalDistribution(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals: number = NHL_CONFIG.maxGoals,
  tieInflation: number = NHL_CONFIG.tieInflation
) {
  if (!(lambdaHome > 0) || !(lambdaAway > 0) || !Number.isFinite(lambdaHome + lambdaAway)) throw new Error('Invalid NHL scoring rate');
  const lambda = lambdaHome + lambdaAway, share = lambdaHome / lambda;
  const reg = poissonPmf(lambda, maxGoals);
  const total = new Array<number>(maxGoals + 2).fill(0);
  let tie = 0, mass = 0;
  // Binomial P(t/2 – t/2 split | t goals), built up for even t without large factorials.
  let evenSplit = 1; // t = 0
  for (let t = 0; t <= maxGoals; t++) {
    if (t > 0 && t % 2 === 0) {
      const h = t / 2; // C(t,h)/C(t-2,h-1) = t(t-1)/h^2
      evenSplit *= (t * (t - 1)) / (h * h) * share * (1 - share);
    }
    const pTie = t % 2 === 0 ? Math.min(1, tieInflation * evenSplit) : 0;
    const p = reg[t];
    tie += p * pTie;
    total[t] += p * (1 - (NHL_CONFIG.tieAddsOneGoal ? pTie : 0));
    if (NHL_CONFIG.tieAddsOneGoal) total[t + 1] += p * pTie;
    mass += p;
  }
  return { total: total.map(p => p / mass), tieProbability: tie / mass };
}

/** Over/under/push (%) for a goals line from a final-total distribution. */
export function totalLineProbabilities(dist: number[], line: number) {
  let over = 0, under = 0, push = 0;
  dist.forEach((p, k) => {
    if (k > line) over += p;
    else if (k < line) under += p;
    else push += p;
  });
  return { over: over * 100, under: under * 100, push: push * 100 };
}

/**
 * Regulation goal rates. All-situation xG already includes chance quality and
 * special teams, so HDCF/PP/PK are context only. Equal offense/defense blend.
 */
export function nhlRegulationRates(home: NHLTeamStats, away: NHLTeamStats) {
  const lambdaHome = Math.max(0.05, (home.xGF60 + away.xGA60) / 2 - NHL_CONFIG.goalieWeight * away.GSAx60 + NHL_CONFIG.homeIceAdvantage / 2);
  const lambdaAway = Math.max(0.05, (away.xGF60 + home.xGA60) / 2 - NHL_CONFIG.goalieWeight * home.GSAx60 - NHL_CONFIG.homeIceAdvantage / 2);
  return { lambdaHome, lambdaAway };
}

/**
 * Project an NHL game's final score distribution and price a goals line.
 * over + under + push = 100; whole-number lines carry push mass.
 */
export function calculateNHLProjection(home: NHLTeamStats, away: NHLTeamStats, line: number, levelScale: number = 1) {
  if (!Number.isFinite(line) || line < 0 || line > 100) throw new Error('Invalid goals line');
  for (const team of [home, away]) {
    for (const [key, value] of Object.entries(team)) {
      if (typeof value !== 'number') continue; // optional caller team name
      if (!Number.isFinite(value) || (key !== 'GSAx60' && value < 0)) throw new Error('Invalid NHL statistic: ' + key);
    }
    if (!(team.xGF60 > 0 && team.xGA60 > 0) || !Number.isFinite(team.GSAx60)) throw new Error('Missing NHL scoring data');
  }
  if (!(levelScale > 0) || !Number.isFinite(levelScale)) throw new Error('Invalid NHL level scale');
  const rates = nhlRegulationRates(home, away);
  const lambdaHome = rates.lambdaHome * levelScale;
  const lambdaAway = rates.lambdaAway * levelScale;
  const { total, tieProbability } = nhlFinalTotalDistribution(lambdaHome, lambdaAway);
  const projectedTotal = total.reduce((s, p, k) => s + p * k, 0);
  const variance = total.reduce((s, p, k) => s + p * k * k, 0) - projectedTotal ** 2;
  // The tie-breaking goal goes to the side more likely to score next.
  const homeShare = lambdaHome / (lambdaHome + lambdaAway);
  const homeScore = lambdaHome + tieProbability * homeShare;
  const awayScore = lambdaAway + tieProbability * (1 - homeShare);
  const { over, under, push } = totalLineProbabilities(total, line);
  const round = (v: number) => Math.round(v * 10000) / 10000;
  return {
    homeScore: round(homeScore), awayScore: round(awayScore), projectedTotal: round(projectedTotal),
    regulationHomeGoals: round(lambdaHome), regulationAwayGoals: round(lambdaAway),
    overtimeProbability: round(tieProbability * 100),
    paceAdjustment: 0, specialTeamsAdjustment: 0,
    standardDeviation: Math.sqrt(variance), zScore: (projectedTotal - line) / Math.sqrt(variance),
    overProbability: round(over), underProbability: round(under), pushProbability: round(push),
  };
}
export type NHLProjectionResult = ReturnType<typeof calculateNHLProjection>;

/**
 * The scoring level the market is pricing for this matchup, relative to the
 * model: the factor s such that the model's rates × s give the book's fair
 * (push-free) over probability at its line. s < 1 means the book expects fewer
 * goals than the model does. Null when the price can't be matched.
 */
export function nhlMarketScale(home: NHLTeamStats, away: NHLTeamStats, line: number, fairOverPct: number): number | null {
  if (!Number.isFinite(line) || !(fairOverPct > 0 && fairOverPct < 100)) return null;
  const { lambdaHome, lambdaAway } = nhlRegulationRates(home, away);
  const overAt = (s: number) => {
    const { over, under } = totalLineProbabilities(nhlFinalTotalDistribution(lambdaHome * s, lambdaAway * s).total, line);
    return over + under > 0 ? (100 * over) / (over + under) : 50;
  };
  let lo = 0.4, hi = 2.0;
  if (overAt(lo) > fairOverPct || overAt(hi) < fairOverPct) return null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (overAt(mid) < fairOverPct) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * The slate's market level relative to the model: the median of each priced
 * game's market scale. Applied to every game, it removes the model's overall
 * scoring-level disagreement with the books (which made nearly every lean an
 * Over or nearly every lean an Under) and keeps only the matchup-relative
 * signal. Slates with fewer than NHL_CONFIG.minSlateForLevel priced games are
 * shrunk toward 1 so one or two prices can't swing it.
 */
export function nhlSlateLevelScale(scales: number[]): number {
  const s = scales.filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  if (!s.length) return 1;
  const m = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  const weight = Math.min(1, s.length / NHL_CONFIG.minSlateForLevel);
  return 1 + (m - 1) * weight;
}

/** League-average final-total probabilities for a line (no matchup information). */
export function nhlLeagueBaseline(line: number, goalsPerTeam: number = NHL_CONFIG.leagueGoalsPerTeam) {
  const { total } = nhlFinalTotalDistribution(goalsPerTeam + NHL_CONFIG.homeIceAdvantage / 2, goalsPerTeam - NHL_CONFIG.homeIceAdvantage / 2);
  return totalLineProbabilities(total, line);
}

export const normalCDF = normCdf;
