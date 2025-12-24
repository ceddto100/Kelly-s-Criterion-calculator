/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests for calculation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  americanToDecimal,
  kellyFraction,
  normCdf,
  coverProbability,
  predictedMarginFootball,
  predictedMarginBasketball,
  formatCurrency,
  type FootballStats,
  type BasketballStats,
} from '../../utils/calculations.js';

describe('americanToDecimal', () => {
  it('should convert positive American odds to decimal odds', () => {
    expect(americanToDecimal(100)).toBe(2.0);
    expect(americanToDecimal(150)).toBe(2.5);
    expect(americanToDecimal(200)).toBe(3.0);
    expect(americanToDecimal(300)).toBe(4.0);
  });

  it('should convert negative American odds to decimal odds', () => {
    expect(americanToDecimal(-100)).toBe(2.0);
    expect(americanToDecimal(-110)).toBeCloseTo(1.909, 3);
    expect(americanToDecimal(-200)).toBe(1.5);
    expect(americanToDecimal(-300)).toBeCloseTo(1.333, 3);
  });

  it('should handle edge cases', () => {
    expect(americanToDecimal(-1000)).toBeCloseTo(1.1, 1);
    expect(americanToDecimal(1000)).toBe(11.0);
  });
});

describe('kellyFraction', () => {
  it('should calculate positive Kelly fraction for value bets', () => {
    // 60% probability at decimal odds 2.0 (even money)
    const k = kellyFraction(0.6, 2.0);
    expect(k).toBeCloseTo(0.2, 2); // Should recommend 20% bet
  });

  it('should return zero or negative for no-value bets', () => {
    // 50% probability at decimal odds 1.91 (-110 American)
    const k = kellyFraction(0.5, 1.91);
    expect(k).toBeLessThanOrEqual(0);
  });

  it('should handle high probability scenarios', () => {
    // 80% probability at decimal odds 1.5 (-200)
    const k = kellyFraction(0.8, 1.5);
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(1);
  });

  it('should return negative for bad bets', () => {
    // 40% probability at decimal odds 2.0
    const k = kellyFraction(0.4, 2.0);
    expect(k).toBeLessThan(0);
  });
});

describe('normCdf', () => {
  it('should return 0.5 for zero input', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 2);
  });

  it('should return values close to 1 for large positive input', () => {
    expect(normCdf(3)).toBeGreaterThan(0.99);
    expect(normCdf(5)).toBeGreaterThan(0.999);
  });

  it('should return values close to 0 for large negative input', () => {
    expect(normCdf(-3)).toBeLessThan(0.01);
    expect(normCdf(-5)).toBeLessThan(0.001);
  });

  it('should be symmetric around 0', () => {
    const pos = normCdf(1);
    const neg = normCdf(-1);
    expect(pos + neg).toBeCloseTo(1, 2);
  });
});

describe('coverProbability', () => {
  it('should return 50% when predicted margin equals negative spread', () => {
    const prob = coverProbability(0, 0, 13.5);
    expect(prob).toBeCloseTo(50, 1);
  });

  it('should return >50% when team is predicted to beat the spread', () => {
    // Predicted to win by 7, spread is -3.5
    const prob = coverProbability(7, -3.5, 13.5);
    expect(prob).toBeGreaterThan(50);
  });

  it('should return <50% when team is predicted not to cover', () => {
    // Predicted to win by 2, but spread is -7
    const prob = coverProbability(2, -7, 13.5);
    expect(prob).toBeLessThan(50);
  });

  it('should cap probability between 0.1 and 99.9', () => {
    const veryHigh = coverProbability(100, -50, 13.5);
    expect(veryHigh).toBeLessThanOrEqual(99.9);

    const veryLow = coverProbability(-100, 50, 13.5);
    expect(veryLow).toBeGreaterThanOrEqual(0.1);
  });
});

describe('predictedMarginFootball', () => {
  it('should predict positive margin for stronger team', () => {
    const stats: FootballStats = {
      teamPointsFor: 28,
      teamPointsAgainst: 20,
      opponentPointsFor: 21,
      opponentPointsAgainst: 24,
      teamOffYards: 380,
      teamDefYards: 310,
      opponentOffYards: 330,
      opponentDefYards: 360,
      teamTurnoverDiff: 1.5,
      opponentTurnoverDiff: -0.5,
    };
    const margin = predictedMarginFootball(stats);
    expect(margin).toBeGreaterThan(0);
  });

  it('should predict negative margin for weaker team', () => {
    const stats: FootballStats = {
      teamPointsFor: 18,
      teamPointsAgainst: 28,
      opponentPointsFor: 27,
      opponentPointsAgainst: 19,
      teamOffYards: 300,
      teamDefYards: 400,
      opponentOffYards: 390,
      opponentDefYards: 320,
      teamTurnoverDiff: -1.2,
      opponentTurnoverDiff: 1.8,
    };
    const margin = predictedMarginFootball(stats);
    expect(margin).toBeLessThan(0);
  });

  it('should handle evenly matched teams', () => {
    const stats: FootballStats = {
      teamPointsFor: 24,
      teamPointsAgainst: 24,
      opponentPointsFor: 24,
      opponentPointsAgainst: 24,
      teamOffYards: 350,
      teamDefYards: 350,
      opponentOffYards: 350,
      opponentDefYards: 350,
      teamTurnoverDiff: 0,
      opponentTurnoverDiff: 0,
    };
    const margin = predictedMarginFootball(stats);
    expect(Math.abs(margin)).toBeLessThan(1);
  });
});

describe('predictedMarginBasketball', () => {
  it('should predict positive margin for stronger team', () => {
    const stats: BasketballStats = {
      teamPointsFor: 115,
      teamPointsAgainst: 108,
      opponentPointsFor: 110,
      opponentPointsAgainst: 112,
      teamFgPct: 0.475,
      opponentFgPct: 0.445,
      teamReboundMargin: 3.5,
      opponentReboundMargin: -1.2,
      teamTurnoverMargin: 1.8,
      opponentTurnoverMargin: -0.5,
    };
    const margin = predictedMarginBasketball(stats);
    expect(margin).toBeGreaterThan(0);
  });

  it('should predict negative margin for weaker team', () => {
    const stats: BasketballStats = {
      teamPointsFor: 105,
      teamPointsAgainst: 112,
      opponentPointsFor: 114,
      opponentPointsAgainst: 107,
      teamFgPct: 0.435,
      opponentFgPct: 0.485,
      teamReboundMargin: -2.5,
      opponentReboundMargin: 2.8,
      teamTurnoverMargin: -1.5,
      opponentTurnoverMargin: 1.2,
    };
    const margin = predictedMarginBasketball(stats);
    expect(margin).toBeLessThan(0);
  });

  it('should handle evenly matched teams', () => {
    const stats: BasketballStats = {
      teamPointsFor: 112,
      teamPointsAgainst: 112,
      opponentPointsFor: 112,
      opponentPointsAgainst: 112,
      teamFgPct: 0.465,
      opponentFgPct: 0.465,
      teamReboundMargin: 0,
      opponentReboundMargin: 0,
      teamTurnoverMargin: 0,
      opponentTurnoverMargin: 0,
    };
    const margin = predictedMarginBasketball(stats);
    expect(Math.abs(margin)).toBeLessThan(1);
  });
});

describe('formatCurrency', () => {
  it('should format positive numbers as USD currency', () => {
    expect(formatCurrency(100)).toBe('$100.00');
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
    expect(formatCurrency(0.99)).toBe('$0.99');
  });

  it('should format negative numbers as USD currency', () => {
    expect(formatCurrency(-50)).toBe('-$50.00');
    expect(formatCurrency(-1234.56)).toBe('-$1,234.56');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should handle large numbers', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000.00');
  });
});
