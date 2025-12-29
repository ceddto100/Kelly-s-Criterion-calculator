import { describe, expect, it, beforeEach } from 'vitest';
import {
  areStatsAvailable,
  clearStatsCache,
  getTeamStats,
  type NBATeamStats
} from '../utils/statsLoader.js';

describe('statsLoader', () => {
  beforeEach(() => {
    clearStatsCache();
  });

  it('detects NBA and NFL stats in the public stats directory', () => {
    const availability = areStatsAvailable();

    expect(availability.path).toBeTruthy();
    expect(availability.nba).toBe(true);
    expect(availability.nfl).toBe(true);
  });

  it('fetches NBA team stats using flexible aliases', () => {
    const pistons = getTeamStats('Pistons', 'NBA') as NBATeamStats | null;
    const clippers = getTeamStats('LA Clippers', 'NBA') as NBATeamStats | null;

    expect(pistons).not.toBeNull();
    expect(pistons?.abbreviation).toBe('DET');
    expect(pistons?.ppg).toBeCloseTo(119.2, 1);

    expect(clippers).not.toBeNull();
    expect(clippers?.abbreviation).toBe('LAC');
    expect(clippers?.ppg).toBeCloseTo(111.2, 1);
  });
});
