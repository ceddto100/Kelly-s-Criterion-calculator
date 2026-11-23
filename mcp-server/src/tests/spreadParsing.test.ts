import { describe, it, expect } from 'vitest';
import { parseHomeSpread } from '../tools/gamesOfDay.js';
import { parseTotalOdds, parseSpreadOdds, parseAmericanOdds } from '../tools/gamesOfDay.js';

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

describe('parseTotalOdds / parseSpreadOdds (real prices, not an assumed -110)', () => {
  it('reads numeric ESPN prices', () => {
    expect(parseTotalOdds({ overUnder: 6.5, overOdds: -115, underOdds: -105 })).toEqual({ overOdds: -115, underOdds: -105 });
    expect(parseSpreadOdds({ homeTeamOdds: { spreadOdds: -108 }, awayTeamOdds: { spreadOdds: -112 } }))
      .toEqual({ homeSpreadOdds: -108, awaySpreadOdds: -112 });
  });
  it('reads the nested string form, preferring the latest price', () => {
    const odds = { total: { over: { open: { odds: '-110' }, close: { odds: '+120' } }, under: { open: { odds: '-110' }, close: { odds: '-145' } } } };
    expect(parseTotalOdds(odds)).toEqual({ overOdds: 120, underOdds: -145 });
    expect(parseSpreadOdds({ pointSpread: { home: { close: { odds: 'EVEN' } }, away: { close: { odds: '-120' } } } }))
      .toEqual({ homeSpreadOdds: 100, awaySpreadOdds: -120 });
  });
  it('returns nothing unless both sides carry a plausible price', () => {
    expect(parseTotalOdds({ overOdds: -115 })).toEqual({});
    expect(parseTotalOdds({ overOdds: 'N/A', underOdds: -105 })).toEqual({});
    expect(parseTotalOdds({ overOdds: 5, underOdds: -105 })).toEqual({});
    expect(parseTotalOdds({ overOdds: 300, underOdds: 300 })).toEqual({}); // arbitrage: not a real book
    expect(parseTotalOdds(undefined)).toEqual({});
    expect(parseAmericanOdds('+135')).toBe(135);
    expect(parseAmericanOdds('ev')).toBe(100);
  });
});
