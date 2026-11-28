import { describe, it, expect } from 'vitest';
import { calculateNHLProjection, nhlMarketScale, nhlSlateLevelScale } from '../src/utils/nhl.js';
import { noPushProbability } from '../src/utils/decision.js';

const team = (xGF60: number, xGA60: number) => ({ xGF60, xGA60, GSAx60: 0, HDCF60: 0, PPpct: 0, PKpct: 0, timesShorthanded: 0 }) as any;
const slate = [
  [team(3.6, 2.8), team(3.0, 3.3)], [team(3.1, 3.1), team(3.2, 3.0)], [team(2.7, 3.4), team(3.4, 2.9)],
  [team(3.3, 3.2), team(2.9, 3.1)], [team(3.0, 2.7), team(3.5, 3.4)], [team(2.8, 3.0), team(3.1, 3.2)],
];
const overPct = (h: any, a: any, line: number, s = 1) => {
  const p = calculateNHLProjection(h, a, line, s);
  return noPushProbability(p.overProbability, p.underProbability);
};

describe('NHL market level', () => {
  it('recovers the scale the book priced', () => {
    const [h, a] = slate[0];
    expect(nhlMarketScale(h, a, 5.5, overPct(h, a, 5.5, 0.93))).toBeCloseTo(0.93, 3);
    expect(nhlMarketScale(h, a, 6.5, overPct(h, a, 6.5, 1.05))).toBeCloseTo(1.05, 3);
  });

  it('a book pricing fewer goals no longer turns every lean into an Over', () => {
    const books = slate.map(([h, a], i) => ({ h, a, line: 5.5 + (i % 2), fair: overPct(h, a, 5.5 + (i % 2), 0.94 * [1.04, 0.98, 1.0, 0.96, 1.02, 1.0][i]) }));
    const rawOvers = books.filter((b) => overPct(b.h, b.a, b.line) > b.fair).length;
    expect(rawOvers).toBe(books.length);
    const scale = nhlSlateLevelScale(books.map((b) => nhlMarketScale(b.h, b.a, b.line, b.fair)!));
    const overs = books.filter((b) => overPct(b.h, b.a, b.line, scale) > b.fair + 0.05).length;
    const unders = books.filter((b) => overPct(b.h, b.a, b.line, scale) < b.fair - 0.05).length;
    expect(overs).toBeGreaterThan(0);
    expect(unders).toBeGreaterThan(0);
  });

  it('shrinks small slates toward no adjustment', () => {
    expect(nhlSlateLevelScale([])).toBe(1);
    expect(nhlSlateLevelScale([0.9])).toBeCloseTo(0.975, 6);
    expect(nhlSlateLevelScale([0.9, 0.92, 0.94, 0.96])).toBeCloseTo(0.93, 6);
  });

  it('scale 1 leaves the projection unchanged', () => {
    const [h, a] = slate[1];
    expect(calculateNHLProjection(h, a, 6.5, 1)).toEqual(calculateNHLProjection(h, a, 6.5));
  });
});
