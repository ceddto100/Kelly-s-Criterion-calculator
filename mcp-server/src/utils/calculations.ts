/**
 * Core mathematical calculations for sports betting
 * Includes Kelly Criterion, probability estimation, and odds conversions
 */

import {
  FOOTBALL_CONFIG,
  BASKETBALL_CONFIG,
  SEASON_CALENDAR,
  type FootballLeague,
  type BasketballLeague,
} from '../config/sportsConfig.js';

// ============================================================================
// SAMPLE-SIZE SHRINKAGE (games played)
// ============================================================================

export type SpreadLeague = FootballLeague | BasketballLeague;

/** Optional context for the spread models. */
export interface SpreadModelContext {
  /** Games behind the season-to-date stats. Estimated from `asOf` when omitted. */
  gamesPlayed?: number;
  /** When the stats were taken (snapshot time). Defaults to now. */
  asOf?: Date | string | number;
}

const DAY_MS = 86400000;

/** UTC noon of the n-th given weekday (0 = Sunday) in a month. */
function nthWeekday(year: number, month: number, weekday: number, n: number): number {
  const first = Date.UTC(year, month, 1, 12);
  const offset = (weekday - new Date(first).getUTCDay() + 7) % 7;
  return first + (offset + 7 * (n - 1)) * DAY_MS;
}

function toTime(asOf: Date | string | number | undefined): number {
  const t = asOf === undefined ? Date.now() : new Date(asOf).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

/**
 * Approximate games played behind a season-to-date stat line on a date. The
 * CSVs have no games-played column, so this follows the league calendar:
 * NBA opens on the third Tuesday of October (82 games in ~174 days); NFL kicks
 * off the Thursday after Labor Day, one game a week with one bye in weeks
 * 5-14. Between seasons the CSVs still hold the last full season.
 */
export function estimateGamesPlayed(league: SpreadLeague, asOf?: Date | string | number): number {
  const t = toTime(asOf);
  const d = new Date(t);
  const seasonYear = d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  if (league === 'NBA') {
    const { games, seasonDays } = SEASON_CALENDAR.NBA;
    // Whole days, so every call on the same day sees the same sample size.
    const days = Math.floor((t - nthWeekday(seasonYear, 9, 2, 3)) / DAY_MS);
    if (days < 0) return games;
    return Math.min(games, Math.max(0, (days * games) / seasonDays));
  }
  if (league === 'NFL') {
    const { games } = SEASON_CALENDAR.NFL;
    const kickoff = nthWeekday(seasonYear, 8, 1, 1) + 3 * DAY_MS; // Thursday after Labor Day
    const days = (t - kickoff) / DAY_MS;
    if (days < 0) return games;
    const weeks = Math.min(18, Math.max(0, Math.floor((days + 3) / 7)));
    const byes = Math.min(1, Math.max(0, (weeks - 4) / 10));
    return Math.min(games, Math.max(0, weeks - byes));
  }
  return Number.POSITIVE_INFINITY; // college leagues: no sample-size shrink configured
}

/** k(n) = n / (n + priorGames): weight the season-to-date gap earns after n games. */
export function evidenceWeight(priorGames: number, gamesPlayed: number): number {
  if (!(priorGames > 0)) return 1;
  if (!Number.isFinite(gamesPlayed)) return 1;
  const n = Math.max(0, gamesPlayed);
  return n / (n + priorGames);
}

function gamesFor(league: SpreadLeague, context?: SpreadModelContext): number {
  const n = context?.gamesPlayed;
  if (n !== undefined) {
    // +Infinity is allowed: "full season weight" (no shrink).
    if (Number.isNaN(n) || n < 0) throw new Error('Invalid games played');
    return n;
  }
  return estimateGamesPlayed(league, context?.asOf);
}

/**
 * Recent-form blend used by the spread models. When a recent rate is supplied,
 * blend it with the season rate per the league decay rate
 * (effective = decay*season + (1-decay)*recent). Falls back to season-only when
 * no recent value is given, so default behavior is unchanged.
 */
function blendRecent(season: number, recent: number | undefined, decay: number): number {
  if (recent === undefined || !isFinite(recent)) return season;
  return decay * season + (1 - decay) * recent;
}

// ============================================================================
// ODDS CONVERSIONS
// ============================================================================

/**
 * Convert American odds to decimal odds
 * @param americanOdds - American format odds (e.g., -110, +150)
 * @returns Decimal odds (e.g., 1.91, 2.50)
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

/**
 * Convert decimal odds to American odds
 * @param decimalOdds - Decimal format odds (e.g., 1.91, 2.50)
 * @returns American odds (e.g., -110, +150)
 */
export function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100);
  } else {
    return Math.round(-100 / (decimalOdds - 1));
  }
}

/**
 * Convert fractional odds to decimal odds
 * @param numerator - Fractional odds numerator (e.g., 5 in 5/2)
 * @param denominator - Fractional odds denominator (e.g., 2 in 5/2)
 * @returns Decimal odds
 */
export function fractionalToDecimal(numerator: number, denominator: number): number {
  return (numerator / denominator) + 1;
}

/**
 * Convert decimal odds to fractional odds
 * @param decimalOdds - Decimal format odds
 * @returns Object with numerator and denominator
 */
export function decimalToFractional(decimalOdds: number): { numerator: number; denominator: number } {
  const decimal = decimalOdds - 1;
  // Find GCD for simplification
  const precision = 1000;
  const numerator = Math.round(decimal * precision);
  const denominator = precision;
  const gcd = findGCD(numerator, denominator);
  return {
    numerator: numerator / gcd,
    denominator: denominator / gcd
  };
}

function findGCD(a: number, b: number): number {
  return b === 0 ? a : findGCD(b, a % b);
}

/**
 * Calculate implied probability from American odds
 * @param americanOdds - American format odds
 * @returns Implied probability as percentage (0-100)
 */
export function impliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return (100 / (americanOdds + 100)) * 100;
  } else {
    return (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100;
  }
}

/**
 * Calculate vig/juice from two-way odds
 * @param odds1 - American odds for option 1
 * @param odds2 - American odds for option 2
 * @returns Vig as percentage
 */
export function calculateVig(odds1: number, odds2: number): number {
  const prob1 = impliedProbability(odds1);
  const prob2 = impliedProbability(odds2);
  return prob1 + prob2 - 100;
}

// ============================================================================
// KELLY CRITERION
// ============================================================================

/**
 * Calculate Kelly Criterion fraction
 * @param probability - Win probability (0-1)
 * @param decimalOdds - Decimal odds
 * @returns Kelly fraction (optimal bet size as fraction of bankroll)
 */
export function kellyFraction(probability: number, decimalOdds: number): number {
  const b = decimalOdds - 1; // Net odds (what you win per unit bet)
  const p = probability;
  const q = 1 - probability;

  // Kelly formula: f* = (bp - q) / b
  const kelly = ((b * p) - q) / b;

  return Math.max(0, kelly); // Never bet negative
}

/**
 * Calculate recommended stake using Kelly Criterion
 * @param bankroll - Total bankroll in USD
 * @param probability - Win probability (0-100)
 * @param americanOdds - American format odds
 * @param fraction - Kelly fraction multiplier (1 = full Kelly, 0.5 = half Kelly)
 * @returns Stake calculation result
 */
export function calculateKellyStake(
  bankroll: number,
  probability: number,
  americanOdds: number,
  fraction: number = 1
): KellyResult {
  const decimalOdds = americanToDecimal(americanOdds);
  const probDecimal = probability / 100;
  const kelly = kellyFraction(probDecimal, decimalOdds);

  const impliedProb = impliedProbability(americanOdds);
  const edge = probability - impliedProb;
  const hasValue = edge > 0 && kelly > 0;

  const adjustedKelly = kelly * fraction;
  const recommendedStake = hasValue ? bankroll * adjustedKelly : 0;
  const stakePercentage = adjustedKelly * 100;

  const potentialWin = recommendedStake * (decimalOdds - 1);
  const potentialPayout = recommendedStake * decimalOdds;

  return {
    recommendedStake: Math.round(recommendedStake * 100) / 100,
    stakePercentage: Math.round(stakePercentage * 100) / 100,
    kellyFraction: Math.round(kelly * 10000) / 10000,
    adjustedKellyFraction: Math.round(adjustedKelly * 10000) / 10000,
    hasValue,
    edge: Math.round(edge * 100) / 100,
    impliedProbability: Math.round(impliedProb * 100) / 100,
    decimalOdds: Math.round(decimalOdds * 1000) / 1000,
    potentialWin: Math.round(potentialWin * 100) / 100,
    potentialPayout: Math.round(potentialPayout * 100) / 100
  };
}

export interface KellyResult {
  recommendedStake: number;
  stakePercentage: number;
  kellyFraction: number;
  adjustedKellyFraction: number;
  hasValue: boolean;
  edge: number;
  impliedProbability: number;
  decimalOdds: number;
  potentialWin: number;
  potentialPayout: number;
}

// ============================================================================
// STATISTICAL PROBABILITY (WALTERS PROTOCOL)
// ============================================================================

/**
 * Normal CDF using Abramowitz-Stegun approximation
 * @param x - Z-score
 * @returns Cumulative probability
 */
export function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y = 1.0 - (a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5) * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Calculate cover probability from predicted margin and spread
 * @param predictedMargin - Predicted point margin (positive = favorite expected to win by this much)
 * @param spread - Point spread (negative = favorite gives points)
 * @param sigma - Standard deviation for the sport
 * @returns Cover probability as percentage (0-100)
 */
export function coverProbability(predictedMargin: number, spread: number, sigma: number): number {
  // Z = (predictedMargin + spread) / sigma
  // For favorite at -7: if predicted margin is 10, Z = (10 + (-7)) / sigma = 3/sigma
  if (![predictedMargin, spread, sigma].every(Number.isFinite) || sigma <= 0) throw new Error('Invalid probability inputs');
  const z = (predictedMargin + spread) / sigma;
  const probability = normCdf(z) * 100;
  return Math.max(0.1, Math.min(99.9, probability));
}

// ============================================================================
// SPORT-SPECIFIC CONSTANTS (WALTERS PROTOCOL)
// ----------------------------------------------------------------------------
// Sourced from config/sportsConfig.ts (single source of truth for tuning &
// backtesting). These compatibility exports preserve the existing API surface.
// ============================================================================

export const NFL_CONSTANTS = {
  sigma: FOOTBALL_CONFIG.NFL.sigma,
  homeFieldAdvantage: FOOTBALL_CONFIG.NFL.homeFieldAdvantage,
  decayRate: FOOTBALL_CONFIG.NFL.decayRate,
  qbValue: FOOTBALL_CONFIG.NFL.qbValue,
  priorGames: FOOTBALL_CONFIG.NFL.priorGames,
  marketTrust: FOOTBALL_CONFIG.NFL.marketTrust,
  marketGapScale: FOOTBALL_CONFIG.NFL.marketGapScale,
};

export const NBA_CONSTANTS = {
  sigma: BASKETBALL_CONFIG.NBA.sigma,
  homeCourtAdvantage: BASKETBALL_CONFIG.NBA.homeCourtAdvantage,
  decayRate: BASKETBALL_CONFIG.NBA.decayRate,
  backToBackPenalty: 2.0,
  superstarValue: 4.5,
  leagueAvgPace: BASKETBALL_CONFIG.NBA.leagueAvgPace,
  fgPctPointsMultiplier: BASKETBALL_CONFIG.NBA.scaling.fgPctPointsMultiplier,
  priorGames: BASKETBALL_CONFIG.NBA.priorGames,
  marketTrust: BASKETBALL_CONFIG.NBA.marketTrust,
  marketGapScale: BASKETBALL_CONFIG.NBA.marketGapScale,
};

export const CFB_CONSTANTS = {
  sigma: FOOTBALL_CONFIG.CFB.sigma,
  homeFieldAdvantage: FOOTBALL_CONFIG.CFB.homeFieldAdvantage,
  decayRate: FOOTBALL_CONFIG.CFB.decayRate,
  priorGames: FOOTBALL_CONFIG.CFB.priorGames,
  marketTrust: FOOTBALL_CONFIG.CFB.marketTrust,
  marketGapScale: FOOTBALL_CONFIG.CFB.marketGapScale,
};

export const CBB_CONSTANTS = {
  sigma: BASKETBALL_CONFIG.CBB.sigma,
  homeCourtAdvantage: BASKETBALL_CONFIG.CBB.homeCourtAdvantage,
  decayRate: BASKETBALL_CONFIG.CBB.decayRate,
  priorGames: BASKETBALL_CONFIG.CBB.priorGames,
  marketTrust: BASKETBALL_CONFIG.CBB.marketTrust,
  marketGapScale: BASKETBALL_CONFIG.CBB.marketGapScale,
};

// ============================================================================
// MARKET-ANCHORED COVER PROBABILITY
// ============================================================================

export interface MarketCoverInput {
  /** Model margin for the team, including its home edge. */
  predictedMargin: number;
  /** That team's home edge in points (+ home, − away, 0 neutral). */
  homeEdge: number;
  /** The posted spread from the team's side (negative = favored). */
  spread: number;
  /** k(n): weight the season gap earned (1 = no shrink). */
  evidenceWeight: number;
  /** How far the line may move toward the model (0 = trust the market). */
  marketTrust: number;
  sigma: number;
  /** Slope of the raw season gap on the market's implied gap (1 = equal scale). */
  marketGapScale?: number;
}

/**
 * Cover probability against a posted line, anchored to that line.
 *
 * A stats-only model is calibrated against results but knows less than the
 * market: it shrinks every team toward average while the line also carries
 * priors (rosters, last season). Comparing the raw margin to the line therefore
 * makes every favorite look overpriced — the source of the underdog skew.
 * The fair comparison shrinks the market's implied team gap by the same k(n):
 *
 *   disagreement = (margin − homeEdge) − k(n) × c × (marketMargin − homeEdge)
 *   anchored     = marketMargin + marketTrust × disagreement
 *   P(cover)     = Φ((anchored + spread) / σ) = Φ(marketTrust × disagreement / σ)
 *
 * where c (marketGapScale) is the measured slope of season gaps on market gaps,
 * which keeps the disagreement uncorrelated with the size of the favorite.
 * With k = c = 1 and marketTrust = 1 this is exactly Φ((margin+spread)/σ).
 */
export function marketAnchoredCover(input: MarketCoverInput): { probability: number; disagreement: number; anchoredMargin: number } {
  const { predictedMargin, homeEdge, spread, evidenceWeight: k, marketTrust, sigma } = input;
  const c = input.marketGapScale ?? 1;
  if (![predictedMargin, homeEdge, spread, k, marketTrust, sigma, c].every(Number.isFinite) || sigma <= 0 || marketTrust < 0 || c <= 0) {
    throw new Error('Invalid probability inputs');
  }
  const marketMargin = -spread;
  const disagreement = (predictedMargin - homeEdge) - k * c * (marketMargin - homeEdge);
  const anchoredMargin = marketMargin + marketTrust * disagreement;
  return { probability: coverProbability(anchoredMargin, spread, sigma), disagreement, anchoredMargin };
}

/** Options for the full probability estimators. */
export interface ProbabilityOptions extends SpreadModelContext {
  /**
   * True (default) when `spread` is a posted sportsbook line: the probability
   * is anchored to it. False for a straight-up / hypothetical margin question.
   */
  marketLine?: boolean;
}

// ============================================================================
// PREDICTED MARGIN CALCULATIONS
// ============================================================================

export interface FootballStats {
  teamPPG: number;          // Points per game scored
  teamAllowed: number;      // Points per game allowed
  opponentPPG: number;      // Opponent PPG
  opponentAllowed: number;  // Opponent points allowed
  teamOffYards?: number;    // Offensive yards per game
  teamDefYards?: number;    // Defensive yards allowed per game
  opponentOffYards?: number;
  opponentDefYards?: number;
  teamTurnoverDiff?: number;  // Turnover differential
  opponentTurnoverDiff?: number;
  // Recent-form rates (last few games). When provided, blended with season
  // rates via the league decay rate. Optional — omit for season-only behavior.
  teamRecentPPG?: number;
  teamRecentAllowed?: number;
  opponentRecentPPG?: number;
  opponentRecentAllowed?: number;
  // Net starting-QB advantage for the team in points (positive = team's QB edge,
  // negative = opponent's). Clamped to ±qbValue. Use to reflect a backup/injured
  // starter. Optional — omit for no QB adjustment.
  qbEdge?: number;
}

export interface BasketballStats {
  teamPPG: number;
  teamAllowed: number;
  opponentPPG: number;
  opponentAllowed: number;
  teamOffRtg?: number;
  teamDefRtg?: number;
  opponentOffRtg?: number;
  opponentDefRtg?: number;
  teamFGPct?: number;       // Field goal percentage
  opponentFGPct?: number;
  teamReboundMargin?: number;
  opponentReboundMargin?: number;
  teamTurnoverMargin?: number;
  opponentTurnoverMargin?: number;
  teamPace?: number;        // Possessions per game (league avg ~100)
  opponentPace?: number;
  team3PRate?: number;      // 3-point attempt rate (3PA / FGA, e.g., 0.40 for 40%)
  opponent3PRate?: number;
  team3PPct?: number;       // 3-point percentage (e.g., 36.5 for 36.5%)
  opponent3PPct?: number;
  // Recent-form rates. When provided, blended with season rates via the league
  // decay rate. Optional — omit for season-only behavior.
  teamRecentPPG?: number;
  teamRecentAllowed?: number;
  opponentRecentPPG?: number;
  opponentRecentAllowed?: number;
}

/**
 * Calculate predicted margin for football games (neutral site, before home edge).
 * Raw gap = weighted points / yards (/ turnovers) differential from FOOTBALL_CONFIG,
 * with an optional recent-form blend (decay rate); it is shrunk by k(n) for the
 * games behind the stats, then an optional starting-QB edge is added.
 */
export function predictedMarginFootball(
  stats: FootballStats,
  league: FootballLeague = 'NFL',
  context?: SpreadModelContext
): number {
  for (const key of ['teamPPG', 'teamAllowed', 'opponentPPG', 'opponentAllowed'] as const) {
    if (!Number.isFinite(stats[key]) || stats[key] < 0) throw new Error('Invalid scoring statistic: ' + key);
  }
  for (const [key, value] of Object.entries(stats)) {
    if (value !== undefined && !Number.isFinite(value)) throw new Error('Invalid statistic: ' + key);
  }
  const cfg = FOOTBALL_CONFIG[league];
  const { weights, scaling, decayRate, qbValue } = cfg;

  const teamPPG = blendRecent(stats.teamPPG, stats.teamRecentPPG, decayRate);
  const teamAllowed = blendRecent(stats.teamAllowed, stats.teamRecentAllowed, decayRate);
  const oppPPG = blendRecent(stats.opponentPPG, stats.opponentRecentPPG, decayRate);
  const oppAllowed = blendRecent(stats.opponentAllowed, stats.opponentRecentAllowed, decayRate);

  const teamNetPoints = teamPPG - teamAllowed;
  const opponentNetPoints = oppPPG - oppAllowed;
  const haveYards = [stats.teamOffYards, stats.teamDefYards, stats.opponentOffYards, stats.opponentDefYards]
    .every(v => v !== undefined && Number.isFinite(v));
  // Without yardage, scoring carries yardage's share too (NFL) so the gap keeps
  // its scale; the legacy college weights are left as they were.
  const pointsWeight = haveYards || league !== 'NFL' ? weights.points : weights.points + weights.yards;
  const pointsComponent = (teamNetPoints - opponentNetPoints) * pointsWeight;

  let yardsComponent = 0;
  if (haveYards) {
    const teamNetYards = stats.teamOffYards! - stats.teamDefYards!;
    const opponentNetYards = stats.opponentOffYards! - stats.opponentDefYards!;
    yardsComponent = ((teamNetYards - opponentNetYards) / scaling.yardsPerPoint) * weights.yards;
  }

  let turnoverComponent = 0;
  if (stats.teamTurnoverDiff !== undefined && stats.opponentTurnoverDiff !== undefined) {
    const clampTO = (v: number) => Math.max(-scaling.turnoverClamp, Math.min(scaling.turnoverClamp, v));
    const teamTO = clampTO(stats.teamTurnoverDiff);
    const oppTO = clampTO(stats.opponentTurnoverDiff);
    turnoverComponent =
      (teamTO - oppTO) * scaling.pointsPerTurnover * scaling.turnoverRegression * weights.turnovers;
  }

  // Starting-QB edge: optional, clamped to ±qbValue so it can never dominate.
  let qbComponent = 0;
  if (stats.qbEdge !== undefined && isFinite(stats.qbEdge)) {
    qbComponent = Math.max(-qbValue, Math.min(qbValue, stats.qbEdge));
  }

  const k = evidenceWeight(cfg.priorGames, gamesFor(league, context));
  return k * (pointsComponent + yardsComponent + turnoverComponent) + qbComponent;
}

/**
 * Compare offense and defense at common pace (neutral site, before home edge).
 * The raw gap is the full net-efficiency difference at the shared pace; it is
 * shrunk by k(n) for sample size. See docs/PREDICTION_MODEL.md.
 */
export function predictedMarginBasketball(
  stats: BasketballStats,
  league: BasketballLeague = 'NBA',
  context?: SpreadModelContext
): number {
  for (const key of ['teamPPG', 'teamAllowed', 'opponentPPG', 'opponentAllowed'] as const) {
    if (!Number.isFinite(stats[key]) || stats[key] < 0) throw new Error('Invalid scoring statistic: ' + key);
  }
  for (const [key, value] of Object.entries(stats)) {
    if (value !== undefined && !Number.isFinite(value)) throw new Error('Invalid statistic: ' + key);
  }
  const cfg = BASKETBALL_CONFIG[league];
  const { weights, decayRate, leagueAvgPace } = cfg;

  const teamPPG = blendRecent(stats.teamPPG, stats.teamRecentPPG, decayRate);
  const teamAllowed = blendRecent(stats.teamAllowed, stats.teamRecentAllowed, decayRate);
  const oppPPG = blendRecent(stats.opponentPPG, stats.opponentRecentPPG, decayRate);
  const oppAllowed = blendRecent(stats.opponentAllowed, stats.opponentRecentAllowed, decayRate);

  // Compare efficiencies at a common tempo. Do not add shooting/rebound/TO
  // bonuses: those events already contribute to points per possession.
  // NBA weight 1 = the full gap (offense vs average defense adds, it is not
  // averaged); k(n) supplies the regression to the mean. CBB keeps 0.5.
  const validPace = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v > 0;
  const havePace = validPace(stats.teamPace) && validPace(stats.opponentPace);
  const paceA = havePace ? stats.teamPace! : leagueAvgPace;
  const paceB = havePace ? stats.opponentPace! : leagueAvgPace;
  const pace = (paceA + paceB) / 2;
  const ratings = [stats.teamOffRtg, stats.teamDefRtg, stats.opponentOffRtg, stats.opponentDefRtg];
  const haveRatings = havePace && ratings.every(v => v !== undefined && Number.isFinite(v) && v > 0);
  const netA = haveRatings ? stats.teamOffRtg! - stats.teamDefRtg! : (teamPPG - teamAllowed) * 100 / paceA;
  const netB = haveRatings ? stats.opponentOffRtg! - stats.opponentDefRtg! : (oppPPG - oppAllowed) * 100 / paceB;
  const k = evidenceWeight(cfg.priorGames, gamesFor(league, context));
  return k * (netA - netB) * weights.ppgFor * pace / 100;
}

function finishEstimate(
  league: SpreadLeague,
  neutralMargin: number,
  homeEdgePoints: number,
  spread: number,
  venue: 'home' | 'away' | 'neutral',
  constants: { sigma: number; priorGames: number; marketTrust: number; marketGapScale: number },
  gamesPlayed: number,
  options: ProbabilityOptions | undefined
): ProbabilityResult {
  const homeEdge = venue === 'home' ? homeEdgePoints : venue === 'away' ? -homeEdgePoints : 0;
  const predictedMargin = neutralMargin + homeEdge;
  const k = evidenceWeight(constants.priorGames, gamesPlayed);
  const modelProbability = coverProbability(predictedMargin, spread, constants.sigma);
  const anchored = options?.marketLine === false
    ? null
    : marketAnchoredCover({ predictedMargin, homeEdge, spread, evidenceWeight: k, marketTrust: constants.marketTrust, sigma: constants.sigma, marketGapScale: constants.marketGapScale });
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    probability: r2(anchored ? anchored.probability : modelProbability),
    modelProbability: r2(modelProbability),
    predictedMargin: r2(predictedMargin),
    sigma: constants.sigma,
    sport: league,
    venue,
    gamesPlayed: Number.isFinite(gamesPlayed) ? Math.round(gamesPlayed * 10) / 10 : null,
    evidenceWeight: Math.round(k * 1000) / 1000,
    marketTrust: anchored ? constants.marketTrust : null,
    disagreement: anchored ? r2(anchored.disagreement) : null,
  };
}

/**
 * Full probability estimation for football. `probability` is the cover
 * probability anchored to `spread` as a posted line (see marketAnchoredCover);
 * `modelProbability` is the model-only figure. Pass `{marketLine:false}` for a
 * straight-up or hypothetical question.
 */
export function estimateFootballProbability(
  stats: FootballStats,
  spread: number,
  venue: 'home' | 'away' | 'neutral' = 'neutral',
  isNFL: boolean = true,
  options?: ProbabilityOptions
): ProbabilityResult {
  const league: FootballLeague = isNFL ? 'NFL' : 'CFB';
  const constants = isNFL ? NFL_CONSTANTS : CFB_CONSTANTS;
  const gamesPlayed = gamesFor(league, options);
  const neutral = predictedMarginFootball(stats, league, { gamesPlayed });
  return finishEstimate(league, neutral, constants.homeFieldAdvantage, spread, venue, constants, gamesPlayed, options);
}

/**
 * Full probability estimation for basketball (same contract as football).
 */
export function estimateBasketballProbability(
  stats: BasketballStats,
  spread: number,
  venue: 'home' | 'away' | 'neutral' = 'neutral',
  isNBA: boolean = true,
  options?: ProbabilityOptions
): ProbabilityResult {
  const league: BasketballLeague = isNBA ? 'NBA' : 'CBB';
  const constants = isNBA ? NBA_CONSTANTS : CBB_CONSTANTS;
  const gamesPlayed = gamesFor(league, options);
  const neutral = predictedMarginBasketball(stats, league, { gamesPlayed });
  return finishEstimate(league, neutral, constants.homeCourtAdvantage, spread, venue, constants, gamesPlayed, options);
}

export interface ProbabilityResult {
  /** Cover probability (%): market-anchored for a posted line, else model-only. */
  probability: number;
  /** Model-only cover probability (%), before anchoring to the line. */
  modelProbability: number;
  predictedMargin: number;
  sigma: number;
  sport: string;
  venue: 'home' | 'away' | 'neutral';
  /** Games behind the stats (null when the league uses no shrink). */
  gamesPlayed: number | null;
  /** k(n) applied to the season gap. */
  evidenceWeight: number;
  /** Trust weight used to move the line toward the model (null = not anchored). */
  marketTrust: number | null;
  /** Model-vs-market disagreement in points (null = not anchored). */
  disagreement: number | null;
}
