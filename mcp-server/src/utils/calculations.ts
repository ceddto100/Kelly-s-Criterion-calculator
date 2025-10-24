/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utility functions for Kelly Criterion and probability calculations
 */

export interface FootballStats {
  teamPointsFor: number;
  teamPointsAgainst: number;
  opponentPointsFor: number;
  opponentPointsAgainst: number;
  teamOffYards: number;
  teamDefYards: number;
  opponentOffYards: number;
  opponentDefYards: number;
  teamTurnoverDiff: number;
  opponentTurnoverDiff: number;
}

export interface BasketballStats {
  teamPointsFor: number;
  teamPointsAgainst: number;
  opponentPointsFor: number;
  opponentPointsAgainst: number;
  teamFgPct: number;
  opponentFgPct: number;
  teamReboundMargin: number;
  opponentReboundMargin: number;
  teamTurnoverMargin: number;
  opponentTurnoverMargin: number;
}

/**
 * Standard normal cumulative distribution function using Abramowitz-Stegun approximation
 */
export function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1 + sign * y);
}

/**
 * Converts American odds to decimal odds
 */
export function americanToDecimal(odds: number): number {
  if (odds > 0) {
    return (odds / 100) + 1;
  } else {
    return (100 / Math.abs(odds)) + 1;
  }
}

/**
 * Calculates Kelly Criterion fraction
 * @param probability - Win probability (0-1)
 * @param decimalOdds - Decimal odds
 * @returns Kelly fraction (optimal betting percentage)
 */
export function kellyFraction(probability: number, decimalOdds: number): number {
  const b = decimalOdds - 1;
  const p = probability;
  const q = 1 - p;
  const k = ((b * p) - q) / b;
  return k;
}

/**
 * Predicts margin for NFL/college football game
 */
export function predictedMarginFootball(stats: FootballStats): number {
  const teamNetPoints = stats.teamPointsFor - stats.teamPointsAgainst;
  const opponentNetPoints = stats.opponentPointsFor - stats.opponentPointsAgainst;

  const teamNetYards = stats.teamOffYards - stats.teamDefYards;
  const opponentNetYards = stats.opponentOffYards - stats.opponentDefYards;

  const teamTO = stats.teamTurnoverDiff;
  const oppTO = stats.opponentTurnoverDiff;

  const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.5;
  const yardsComponent = ((teamNetYards - opponentNetYards) / 100) * 0.3;
  const turnoverComponent = (teamTO - oppTO) * 4 * 0.2;

  return pointsComponent + yardsComponent + turnoverComponent;
}

/**
 * Predicts margin for NBA/college basketball game
 */
export function predictedMarginBasketball(stats: BasketballStats): number {
  const teamNetPoints = stats.teamPointsFor - stats.teamPointsAgainst;
  const opponentNetPoints = stats.opponentPointsFor - stats.opponentPointsAgainst;

  const fgT = stats.teamFgPct;
  const fgO = stats.opponentFgPct;

  const rebT = stats.teamReboundMargin;
  const rebO = stats.opponentReboundMargin;

  const tovT = stats.teamTurnoverMargin;
  const tovO = stats.opponentTurnoverMargin;

  const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.4;
  const fgComponent = (fgT - fgO) * 2 * 0.3;
  const reboundComponent = (rebT - rebO) * 0.2;
  const turnoverComponent = (tovT - tovO) * 0.1;

  return pointsComponent + fgComponent + reboundComponent + turnoverComponent;
}

/**
 * Calculates cover probability using normal distribution
 * @param predictedMargin - Predicted point margin
 * @param spread - Point spread (negative if team is favored)
 * @param sigma - Standard deviation (13.5 for football, 12.0 for basketball)
 */
export function coverProbability(predictedMargin: number, spread: number, sigma: number): number {
  const Z = (predictedMargin + spread) / sigma;
  const p = normCdf(Z);
  return Math.max(0.1, Math.min(99.9, p * 100));
}

/**
 * Formats a number as USD currency
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}
