import { describe, it, expect } from 'vitest';
import { selectRandomPicks, selectAllPicks, gameTag, DEFAULT_ALL_PICKS_SPORTS, type PickCandidate } from '../src/tools/dailyCalc.js';

function cand(id: string, probability: number): PickCandidate {
  return {
    sport: 'NBA',
    sportLabel: 'basketball',
    homeTeam: `Home ${id}`,
    awayTeam: `Away ${id}`,
    market: 'moneyline',
    pick: `Home ${id} ML`,
    pickedSide: 'home',
    line: 0,
    probability,
  };
}

describe('selectRandomPicks', () => {
  it('returns exactly the requested count when enough games exist', () => {
    const c = Array.from({ length: 12 }, (_, i) => cand(String(i), 50 + i));
    expect(selectRandomPicks(c, 5)).toHaveLength(5);
  });

  it('draws positive-edge games before no-edge games', () => {
    const value = [cand('v1', 60), cand('v2', 58), cand('v3', 55)];
    const noEdge = [cand('n1', 51), cand('n2', 50.5), cand('n3', 52), cand('n4', 50)];
    const picks = selectRandomPicks([...noEdge, ...value], 5);
    expect(picks.slice(0, 3).every((p) => p.probability > 52.38)).toBe(true);
    expect(picks.slice(3).every((p) => p.probability <= 52.38)).toBe(true);
  });

  it('returns all games when fewer than requested, with no duplicates', () => {
    const c = [cand('a', 55), cand('b', 51)];
    const picks = selectRandomPicks(c, 5);
    expect(picks).toHaveLength(2);
    expect(new Set(picks.map((p) => p.homeTeam)).size).toBe(2);
  });
});

describe('selectAllPicks', () => {
  const date = '2026-11-03';
  const nhl: PickCandidate = { ...cand('h', 54), sport: 'NHL', sportLabel: 'hockey', market: 'total', pick: 'Over 6.5', pickedSide: 'over', line: 6.5 };
  const mlb: PickCandidate = { ...cand('m', 56), sport: 'MLB', sportLabel: 'baseball' };

  it('returns every positive-edge NBA/NFL/NHL game and excludes other sports', () => {
    const c = [cand('a', 55), cand('b', 60), nhl, mlb];
    const picks = selectAllPicks(c, DEFAULT_ALL_PICKS_SPORTS, date);
    expect(picks.map((p) => p.homeTeam)).toEqual(['Home b', 'Home a', 'Home h']);
  });

  it('never returns no-edge games', () => {
    const c = [cand('a', 51), cand('b', 52.38), cand('c', 53)];
    const picks = selectAllPicks(c, DEFAULT_ALL_PICKS_SPORTS, date);
    expect(picks.map((p) => p.homeTeam)).toEqual(['Home c']);
  });

  it('skips duplicates and games already logged today', () => {
    const a = cand('a', 55);
    const logged = new Set([gameTag(date, cand('b', 50))]);
    const picks = selectAllPicks([a, a, cand('b', 58)], DEFAULT_ALL_PICKS_SPORTS, date, logged);
    expect(picks).toHaveLength(1);
    expect(picks[0].homeTeam).toBe('Home a');
  });
});
