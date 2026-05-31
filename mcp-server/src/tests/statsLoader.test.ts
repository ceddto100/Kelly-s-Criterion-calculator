import { describe, expect, it, beforeEach } from 'vitest';
import {
  areStatsAvailable,
  clearStatsCache,
  getTeamStats,
  getNHLTeamStats,
  type NBATeamStats,
  type NHLTeamStats
} from '../utils/statsLoader.js';

describe('statsLoader', () => {
  beforeEach(() => {
    clearStatsCache();
  });

  it('detects NBA, NFL and NHL stats in the public stats directory', () => {
    const availability = areStatsAvailable();

    expect(availability.path).toBeTruthy();
    expect(availability.nba).toBe(true);
    expect(availability.nfl).toBe(true);
    expect(availability.nhl).toBe(true);
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

  it('fetches NHL team stats using flexible aliases', () => {
    const avs = getNHLTeamStats('Avalanche') as NHLTeamStats | null;
    const oilers = getTeamStats('Edmonton Oilers', 'NHL') as NHLTeamStats | null;

    expect(avs).not.toBeNull();
    expect(avs?.abbreviation).toBe('COL');
    // xGF/60 is an expected-goals rate; assert a sane NHL range, not an exact
    // value that drifts as the stats CSVs refresh on a cron schedule.
    expect(avs?.xGF60).toBeGreaterThan(1.5);
    expect(avs?.xGF60).toBeLessThan(5);

    expect(oilers).not.toBeNull();
    expect(oilers?.abbreviation).toBe('EDM');
    // PP% should be a sensible 0-100 percentage.
    expect(oilers?.PP).toBeGreaterThan(0);
    expect(oilers?.PP).toBeLessThan(100);
  });

  it('maps ESPN-style NHL abbreviations to CSV teams', () => {
    // ESPN uses TB/NJ/SJ/LA; the CSVs use TBL/NJD/SJS/LAK.
    expect((getNHLTeamStats('TB') as NHLTeamStats | null)?.abbreviation).toBe('TBL');
    expect((getNHLTeamStats('NJ') as NHLTeamStats | null)?.abbreviation).toBe('NJD');
    expect((getNHLTeamStats('LA') as NHLTeamStats | null)?.abbreviation).toBe('LAK');
  });
});
