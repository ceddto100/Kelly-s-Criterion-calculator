import { describe, it, expect } from 'vitest';
import { parseHomeSpread } from '../tools/gamesOfDay.js';

describe('parseHomeSpread', () => {
  it('reads a home favorite from ESPN details', () => {
    expect(parseHomeSpread({ details: 'DET -2.5' }, 'DET', 'PHI')).toBe(-2.5);
  });

  it('flips an away favorite to the home perspective', () => {
    expect(parseHomeSpread({ details: 'CHA -2.5' }, 'BKN', 'CHA')).toBe(2.5);
  });

  it('treats EVEN / PK as a real pick-em line', () => {
    expect(parseHomeSpread({ details: 'EVEN' }, 'BOS', 'MIL')).toBe(0);
    expect(parseHomeSpread({ details: 'PK' }, 'BOS', 'MIL')).toBe(0);
  });

  it('falls back to the numeric spread with favorite flags', () => {
    expect(
      parseHomeSpread({ spread: 4.5, homeTeamOdds: { favorite: false }, awayTeamOdds: { favorite: true } }, 'WSH', 'ATL')
    ).toBe(4.5);
    expect(
      parseHomeSpread({ spread: 4.5, homeTeamOdds: { favorite: true }, awayTeamOdds: { favorite: false } }, 'WSH', 'ATL')
    ).toBe(-4.5);
  });

  it('returns undefined when no spread is posted (never defaults to 0)', () => {
    expect(parseHomeSpread(undefined, 'WSH', 'ATL')).toBeUndefined();
    expect(parseHomeSpread({}, 'WSH', 'ATL')).toBeUndefined();
    expect(parseHomeSpread({ overUnder: 221.5 }, 'WSH', 'ATL')).toBeUndefined();
    expect(parseHomeSpread({ spread: 3 }, 'WSH', 'ATL')).toBeUndefined();
  });
});
