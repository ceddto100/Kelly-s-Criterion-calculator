/**
 * Core mathematical calculations for sports betting
 * Includes Kelly Criterion, probability estimation, and odds conversions
 */

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
  const z = (predictedMargin + spread) / sigma;
  const probability = normCdf(z) * 100;
  return Math.max(0.1, Math.min(99.9, probability));
}

// ============================================================================
// SPORT-SPECIFIC CONSTANTS (WALTERS PROTOCOL)
// ============================================================================

export const NFL_CONSTANTS = {
  sigma: 13.5,           // Standard deviation
  homeFieldAdvantage: 2.5,
  decayRate: 0.9,        // 90% historical, 10% recent
  qbValue: 7.0           // Points value of starting QB
};

export const NBA_CONSTANTS = {
  sigma: 11.5,           // Standard deviation
  homeCourtAdvantage: 3.0,
  decayRate: 0.85,       // 85% historical, 15% recent (faster truth convergence)
  backToBackPenalty: 2.0,
  superstarValue: 4.5    // Points value of superstar player
};

export const CFB_CONSTANTS = {
  sigma: 16.0,           // Higher variance in college
  homeFieldAdvantage: 3.0,
  decayRate: 0.85
};

export const CBB_CONSTANTS = {
  sigma: 10.5,
  homeCourtAdvantage: 3.5,
  decayRate: 0.85
};

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
}

export interface BasketballStats {
  teamPPG: number;
  teamAllowed: number;
  opponentPPG: number;
  opponentAllowed: number;
  teamFGPct?: number;       // Field goal percentage
  opponentFGPct?: number;
  teamReboundMargin?: number;
  opponentReboundMargin?: number;
  teamTurnoverMargin?: number;
  opponentTurnoverMargin?: number;
}

/**
 * Calculate predicted margin for football games
 * Uses weighted components: points (40%), yards (25%), turnovers (20%)
 */
export function predictedMarginFootball(stats: FootballStats): number {
  const teamNetPoints = stats.teamPPG - stats.teamAllowed;
  const opponentNetPoints = stats.opponentPPG - stats.opponentAllowed;
  const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.4;

  let yardsComponent = 0;
  if (stats.teamOffYards && stats.teamDefYards && stats.opponentOffYards && stats.opponentDefYards) {
    const teamNetYards = stats.teamOffYards - stats.teamDefYards;
    const opponentNetYards = stats.opponentOffYards - stats.opponentDefYards;
    yardsComponent = ((teamNetYards - opponentNetYards) / 25) * 0.25;
  }

  let turnoverComponent = 0;
  if (stats.teamTurnoverDiff !== undefined && stats.opponentTurnoverDiff !== undefined) {
    turnoverComponent = (stats.teamTurnoverDiff - stats.opponentTurnoverDiff) * 4 * 0.5 * 0.2;
  }

  return pointsComponent + yardsComponent + turnoverComponent;
}

/**
 * Calculate predicted margin for basketball games
 * Uses weighted components: points (35%), FG% (30%), rebounds (20%), turnovers (15%)
 */
export function predictedMarginBasketball(stats: BasketballStats): number {
  const teamNetPoints = stats.teamPPG - stats.teamAllowed;
  const opponentNetPoints = stats.opponentPPG - stats.opponentAllowed;
  const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.35;

  let fgComponent = 0;
  if (stats.teamFGPct !== undefined && stats.opponentFGPct !== undefined) {
    fgComponent = (stats.teamFGPct - stats.opponentFGPct) * 1.0 * 0.3;
  }

  let reboundComponent = 0;
  if (stats.teamReboundMargin !== undefined && stats.opponentReboundMargin !== undefined) {
    reboundComponent = (stats.teamReboundMargin - stats.opponentReboundMargin) * 0.5 * 0.2;
  }

  let turnoverComponent = 0;
  if (stats.teamTurnoverMargin !== undefined && stats.opponentTurnoverMargin !== undefined) {
    // Note: Inverted - higher turnover margin for opponent benefits team
    turnoverComponent = (stats.opponentTurnoverMargin - stats.teamTurnoverMargin) * 1.0 * 0.15;
  }

  return pointsComponent + fgComponent + reboundComponent + turnoverComponent;
}

/**
 * Full probability estimation for football
 */
export function estimateFootballProbability(
  stats: FootballStats,
  spread: number,
  venue: 'home' | 'away' | 'neutral' = 'neutral',
  isNFL: boolean = true
): ProbabilityResult {
  const constants = isNFL ? NFL_CONSTANTS : CFB_CONSTANTS;
  let predictedMargin = predictedMarginFootball(stats);

  // Apply home field advantage
  if (venue === 'home') {
    predictedMargin += constants.homeFieldAdvantage;
  } else if (venue === 'away') {
    predictedMargin -= constants.homeFieldAdvantage;
  }

  const probability = coverProbability(predictedMargin, spread, constants.sigma);

  return {
    probability: Math.round(probability * 100) / 100,
    predictedMargin: Math.round(predictedMargin * 100) / 100,
    sigma: constants.sigma,
    sport: isNFL ? 'NFL' : 'CFB',
    venue
  };
}

/**
 * Full probability estimation for basketball
 */
export function estimateBasketballProbability(
  stats: BasketballStats,
  spread: number,
  venue: 'home' | 'away' | 'neutral' = 'neutral',
  isNBA: boolean = true
): ProbabilityResult {
  const constants = isNBA ? NBA_CONSTANTS : CBB_CONSTANTS;
  let predictedMargin = predictedMarginBasketball(stats);

  // Apply home court advantage
  if (venue === 'home') {
    predictedMargin += constants.homeCourtAdvantage;
  } else if (venue === 'away') {
    predictedMargin -= constants.homeCourtAdvantage;
  }

  const probability = coverProbability(predictedMargin, spread, constants.sigma);

  return {
    probability: Math.round(probability * 100) / 100,
    predictedMargin: Math.round(predictedMargin * 100) / 100,
    sigma: constants.sigma,
    sport: isNBA ? 'NBA' : 'CBB',
    venue
  };
}

export interface ProbabilityResult {
  probability: number;
  predictedMargin: number;
  sigma: number;
  sport: string;
  venue: 'home' | 'away' | 'neutral';
}
