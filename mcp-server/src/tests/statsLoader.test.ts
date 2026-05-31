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

    // Assert the alias lookup resolves to the right team (the behavior under
    // test). PPG values are NOT hardcoded: the stats CSVs refresh on a cron
    // schedule, so we assert a sane NBA scoring range instead of a brittle exact
    // season average that drifts with every stats update.
    expect(pistons).not.toBeNull();
    expect(pistons?.abbreviation).toBe('DET');
    expect(pistons?.ppg).toBeGreaterThan(90);
    expect(pistons?.ppg).toBeLessThan(140);

    expect(clippers).not.toBeNull();
    expect(clippers?.abbreviation).toBe('LAC');
    expect(clippers?.ppg).toBeGreaterThan(90);
    expect(clippers?.ppg).toBeLessThan(140);
  });
});
