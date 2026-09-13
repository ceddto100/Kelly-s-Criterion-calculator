import { describe, it, expect } from 'vitest';
import {
  WALTERS_CFB,
  detectAutoFactors,
  normalCdf,
  projectWalters,
  pullTowardZero,
  sigmaForLine,
  updateRating,
  type WaltersInput,
} from '../src/utils/waltersCfb.js';

const base: WaltersInput = { ratingA: 0, ratingB: 0, venue: 'neutral', marketSpread: 0 };

describe('Walters CFB projection', () => {
  it('hands the PICKED side its own cover probability (old Kelly bug)', () => {
    // Team A +7 on a neutral field against a Team B rated 10 points better.
    const r = projectWalters({ ...base, ratingA: 0, ratingB: 10, marketSpread: 7 });
    expect(r.trueLine).toBe(10);
    expect(r.pick).toBe('B');
    expect(r.pickSpread).toBe(-7);
    expect(r.coverProbabilityA).toBeLessThan(50);
    expect(r.pickProbability).toBeCloseTo(100 - r.coverProbabilityA!, 10);
    expect(r.pickProbability).toBeGreaterThan(50);
    expect(r.confidence).toBe('BET'); // 3-point edge
  });

  it('is symmetric when the teams are swapped, rivalry included (old divisional bug)', () => {
    const game: WaltersInput = {
      ratingA: 12.4, ratingB: 4.1, venue: 'home', marketSpread: -6.5, rivalry: true,
      factorsA: { bye: true, qb: 'experienced' },
      factorsB: { travel: true, bounceback: true },
    };
    const swapped: WaltersInput = {
      ratingA: game.ratingB, ratingB: game.ratingA, venue: 'away', marketSpread: 6.5, rivalry: true,
      factorsA: game.factorsB, factorsB: game.factorsA,
    };
    const a = projectWalters(game);
    const b = projectWalters(swapped);
    expect(b.predictedMargin).toBeCloseTo(-a.predictedMargin, 10);
    expect(b.edge).toBeCloseTo(a.edge!, 10);
    expect(b.pickProbability).toBeCloseTo(a.pickProbability!, 10);
    expect(b.pick).toBe(a.pick === 'A' ? 'B' : 'A');
    expect(b.pickSpread).toBe(a.pickSpread);
  });

  it('pulls rivalry games toward a pick-em without flipping the favorite', () => {
    expect(pullTowardZero(0.6, 1)).toBe(0);
    expect(pullTowardZero(-5, 1)).toBe(-4);
    expect(pullTowardZero(5, 1)).toBe(4);
    const r = projectWalters({ ...base, ratingA: 5, rivalry: true });
    expect(r.predictedMargin).toBe(4);
    expect(r.breakdown.rivalryAdjustment).toBe(-1);
  });

  it('applies home field only off a neutral site', () => {
    expect(projectWalters({ ...base, venue: 'home' }).breakdown.homeField).toBe(3);
    expect(projectWalters({ ...base, venue: 'away' }).breakdown.homeField).toBe(-3);
    expect(projectWalters({ ...base, venue: 'neutral' }).breakdown.homeField).toBe(0);
  });

  it('grades the edge at the configured thresholds', () => {
    const grade = (edge: number) => projectWalters({ ...base, ratingA: edge, marketSpread: 0 }).confidence;
    expect(grade(1.2)).toBe('NO_BET');
    expect(grade(1.25)).toBe('LEAN');
    expect(grade(2.5)).toBe('BET');
    expect(grade(3.5)).toBe('STRONG');
    expect(projectWalters(base).pick).toBeNull();
    expect(projectWalters(base).confidence).toBe('NO_BET');
  });

  it('never grades a 28-point game above LEAN and widens its error range', () => {
    const r = projectWalters({ ...base, ratingA: 34, marketSpread: -30 });
    expect(r.edge).toBe(4);
    expect(r.confidence).toBe('LEAN');
    expect(r.cappedForBigSpread).toBe(true);
    expect(r.sigma).toBeCloseTo(sigmaForLine(34), 10);
    expect(sigmaForLine(14)).toBe(16);
    expect(sigmaForLine(-24)).toBeCloseTo(17.5, 10);
  });

  it('returns a true line but no pick without a market line', () => {
    const r = projectWalters({ ...base, ratingA: 7, marketSpread: null });
    expect(r.trueLine).toBe(-7);
    expect([r.edge, r.pick, r.pickProbability, r.coverProbabilityA]).toEqual([null, null, null, null]);
    expect(r.confidence).toBe('NO_BET');
  });

  it('values the starting QB by the backup behind him', () => {
    expect(projectWalters({ ...base, factorsA: { qb: 'experienced' } }).predictedMargin).toBe(-4);
    expect(projectWalters({ ...base, factorsA: { qb: 'inexperienced' } }).predictedMargin).toBe(-9);
    expect(projectWalters({ ...base, factorsB: { qb: 'inexperienced' } }).predictedMargin).toBe(9);
  });

  it('accepts a config override for calibration', () => {
    const cfg = { ...WALTERS_CFB, homeFieldAdvantage: 2.25 };
    expect(projectWalters({ ...base, venue: 'home' }, cfg).predictedMargin).toBe(2.25);
  });

  it('computes a sane normal CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1.96)).toBeCloseTo(0.025, 3);
  });
});

describe('automatic situational factors', () => {
  it('counts a bye only against an opponent that was not also rested', () => {
    expect(detectAutoFactors({ restDays: 14 }, { restDays: 7 }).bye).toBe(true);
    expect(detectAutoFactors({ restDays: 14 }, { restDays: 14 }).bye).toBe(false);
    expect(detectAutoFactors({ restDays: 14 }, {}).bye).toBe(false); // opponent's opener
  });

  it('flags a short week unless both teams are on one', () => {
    expect(detectAutoFactors({ restDays: 5 }, { restDays: 7 }).shortWeek).toBe(true);
    expect(detectAutoFactors({ restDays: 5 }, {}).shortWeek).toBe(true);
    expect(detectAutoFactors({ restDays: 5 }, { restDays: 5 }).shortWeek).toBe(false);
  });

  it('flags long trips and early body-clock kickoffs away from home', () => {
    expect(detectAutoFactors({ tzChange: 3 }, {}).travel).toBe(true);
    expect(detectAutoFactors({ tzChange: 1 }, {}).travel).toBe(false);
    expect(detectAutoFactors({ tzChange: 1, bodyClockHour: 9 }, {}).travel).toBe(true);
    expect(detectAutoFactors({ atHome: true, tzChange: 0, bodyClockHour: 9 }, {}).travel).toBe(false);
  });

  it('flags altitude only for visitors from low-lying stadiums', () => {
    expect(detectAutoFactors({ baseElevationFt: 600 }, {}, 7200).altitude).toBe(true);
    expect(detectAutoFactors({ baseElevationFt: 5300 }, {}, 7200).altitude).toBe(false);
    expect(detectAutoFactors({ atHome: true, baseElevationFt: 600 }, {}, 7200).altitude).toBe(false);
    expect(detectAutoFactors({ baseElevationFt: 600 }, {}, 3900).altitude).toBe(false);
  });

  it('flags a bounceback after a 21-point loss and suggests a lookahead', () => {
    expect(detectAutoFactors({ prevMargin: -21 }, {}).bounceback).toBe(true);
    expect(detectAutoFactors({ prevMargin: -20 }, {}).bounceback).toBe(false);
    expect(detectAutoFactors({ nextOpponentRank: 4 }, {}).lookahead).toBe(true);
    expect(detectAutoFactors({ nextOpponentRank: 11 }, {}).lookahead).toBe(false);
  });

  it('never switches a factor on from unknown inputs', () => {
    expect(Object.values(detectAutoFactors({}, {}, undefined)).some(Boolean)).toBe(false);
  });
});

describe('rating updater', () => {
  it('matches the classic decay formula when the surprise is under the cap', () => {
    const r = updateRating({ oldRating: 10, opponentRating: 2, actualMargin: 14, venue: 'home' });
    const classic = 0.85 * 10 + 0.15 * (14 + 2 - 3);
    expect(r.expectedMargin).toBe(11);
    expect(r.newRating).toBeCloseTo(classic, 10);
  });

  it('caps a blowout surprise so a mismatch cannot swing the rating', () => {
    const r = updateRating({ oldRating: 25, opponentRating: -30, actualMargin: 56, venue: 'home' });
    expect(r.surprise).toBe(-2); // expected to win by 58
    const blowout = updateRating({ oldRating: 0, opponentRating: 0, actualMargin: 63, venue: 'neutral' });
    expect(blowout.cappedSurprise).toBe(21);
    expect(blowout.newRating).toBeCloseTo(0.15 * 21, 10);
  });
});
