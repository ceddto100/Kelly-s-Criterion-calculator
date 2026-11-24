/**
 * Tracked leans: grading the model's side on every lined game, and fitting
 * market trust from the graded record. Pure functions — no database needed.
 */
import { describe, it, expect } from 'vitest';
import { gradeTrack, trackObs } from '../src/tools/projectionLog.js';
import { fitTrust, spreadObs, totalObs } from '../src/utils/trustFit.js';
import type { ProjectionTrack } from '../src/models/Projection.js';

describe('gradeTrack', () => {
  it('grades a home lean against the home spread', () => {
    // home -3.5: wins by 4 covers, by 3 does not
    expect(gradeTrack({ market: 'spread', line: -3.5, side: 'home' }, 104, 100)).toBe('win');
    expect(gradeTrack({ market: 'spread', line: -3.5, side: 'home' }, 103, 100)).toBe('loss');
  });
  it('grades an away lean and pushes on the number', () => {
    expect(gradeTrack({ market: 'spread', line: -3.5, side: 'away' }, 103, 100)).toBe('win');
    expect(gradeTrack({ market: 'spread', line: -3, side: 'away' }, 103, 100)).toBe('push');
  });
  it('grades totals, counting overtime goals', () => {
    expect(gradeTrack({ market: 'total', line: 5.5, side: 'over' }, 3, 3)).toBe('win');
    expect(gradeTrack({ market: 'total', line: 5.5, side: 'under' }, 3, 3)).toBe('loss');
    expect(gradeTrack({ market: 'total', line: 6, side: 'under' }, 3, 3)).toBe('push');
  });
});

describe('trackObs', () => {
  const spread: ProjectionTrack = {
    market: 'spread', line: -3.5, side: 'home', modelProbability: 58, marketProbability: 50,
    disagreement: 2.5, sigma: 14, fairHome: 50, marketTrust: 0,
  };
  it('skips pushes', () => {
    expect(trackObs({ ...spread, line: -4 }, 104, 100)).toBeNull();
  });
  it('rewards trust when the model lean covers', () => {
    const o = trackObs(spread, 110, 100)!;
    expect(o(0.5)).toBeGreaterThan(o(0));
  });
  it('penalizes trust when the model lean misses', () => {
    const o = trackObs(spread, 100, 110)!;
    expect(o(0.5)).toBeLessThan(o(0));
  });
  it('needs the stored model and fair over for totals', () => {
    const total: ProjectionTrack = { market: 'total', line: 6.5, side: 'over', modelProbability: 55, marketProbability: 48, marketTrust: 0.18 };
    expect(trackObs(total, 4, 4)).toBeNull();
    expect(trackObs({ ...total, modelOver: 55, fairOver: 48 }, 4, 4)).not.toBeNull();
  });
});

describe('fitTrust', () => {
  // Deterministic pseudo-random draws so the test is stable.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  it('finds no trust when results follow the market', () => {
    const obs = Array.from({ length: 3000 }, () => {
      const modelOver = 0.35 + 0.3 * rand();
      return totalObs(modelOver, 0.5, rand() < 0.5);
    });
    const f = fitTrust(obs);
    expect(Math.abs(f.weight)).toBeLessThan(2.5 * f.se);
    expect(f.games).toBe(3000);
  });

  it('finds full trust when results follow the model', () => {
    const obs = Array.from({ length: 3000 }, () => {
      const modelOver = 0.3 + 0.4 * rand();
      return totalObs(modelOver, 0.5, rand() < modelOver);
    });
    const f = fitTrust(obs);
    expect(Math.abs(f.weight - 1)).toBeLessThan(2.5 * f.se);
  });

  it('reports infinite uncertainty with no games', () => {
    expect(fitTrust([]).se).toBe(Infinity);
  });

  it('matches the backtest spread likelihood at a 50/50 fair line', () => {
    const o = spreadObs(0.4, true);
    expect(o(0)).toBeCloseTo(Math.log(0.5), 6);
  });
});
