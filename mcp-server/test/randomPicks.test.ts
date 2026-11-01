import { describe, it, expect } from 'vitest';
import { selectRandomPicks, type PickCandidate } from '../src/tools/dailyCalc.js';

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
