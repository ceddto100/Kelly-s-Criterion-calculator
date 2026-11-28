import { describe, it, expect } from 'vitest';
import { gapCandidate, selectGapPicks } from '../src/tools/dailyCalc.js';
import type { ProjectionTrack } from '../src/models/Projection.js';

const game = (id: string, sport = 'NBA') => ({
  sport, gameId: id, homeTeam: 'Detroit Pistons', homeAbbr: 'DET', awayTeam: 'Milwaukee Bucks', awayAbbr: 'MIL',
}) as Parameters<typeof gapCandidate>[0];

const spread = (side: 'home' | 'away', model: number, market: number, odds = -117): ProjectionTrack => ({
  market: 'spread', line: -9.5, side, odds, modelProbability: model, marketProbability: market, marketTrust: 0.8,
});

describe('gapCandidate', () => {
  it('backs the home side at its own line and price, on the model probability', () => {
    const c = gapCandidate(game('1'), spread('home', 69.2, 51.5));
    expect(c.pick).toBe('Detroit Pistons -9.5');
    expect(c.line).toBe(-9.5);
    expect(c.gap).toBe(17.7);
    expect(c.probability).toBe(69.2);
    expect(c.americanOdds).toBe(-117);
    expect(c.breakEvenPct).toBeCloseTo(53.9, 1);
    expect(c.gameIdTag).toBe('gid-espn-nba-1');
  });

  it('flips the line for the away side', () => {
    const c = gapCandidate(game('2'), spread('away', 60, 50));
    expect(c.pick).toBe('Milwaukee Bucks +9.5');
    expect(c.line).toBe(9.5);
    expect(c.pickedSide).toBe('away');
  });

  it('labels totals and falls back to -110 without a price', () => {
    const t: ProjectionTrack = { market: 'total', line: 6.5, side: 'under', modelProbability: 58, marketProbability: 50, marketTrust: 0.9 };
    const c = gapCandidate(game('3', 'NHL'), t);
    expect(c.pick).toBe('Under 6.5');
    expect(c.market).toBe('total');
    expect(c.sportLabel).toBe('hockey');
    expect(c.americanOdds).toBe(-110);
  });
});

describe('selectGapPicks', () => {
  it('takes every green gap (+3 or more), biggest first', () => {
    const a = gapCandidate(game('a'), spread('home', 58.2, 50.4)); // +7.8
    const b = gapCandidate(game('b'), spread('home', 69.2, 51.5)); // +17.7
    const c = gapCandidate(game('c'), spread('home', 53, 50.1));   // +2.9, not green
    const d = gapCandidate(game('d'), spread('home', 53, 50));     // +3.0, green
    expect(selectGapPicks([a, b, c, d]).map((p) => p.gameIdTag)).toEqual(['gid-espn-nba-b', 'gid-espn-nba-a', 'gid-espn-nba-d']);
  });

  it('skips games already gap-picked and duplicates', () => {
    const a = gapCandidate(game('a'), spread('home', 58, 50));
    const b = gapCandidate(game('b'), spread('home', 70, 50));
    expect(selectGapPicks([a, b, a], new Set(['gap-gid-espn-nba-b'])).map((p) => p.gameIdTag)).toEqual(['gid-espn-nba-a']);
    expect(selectGapPicks([])).toEqual([]);
  });
});
