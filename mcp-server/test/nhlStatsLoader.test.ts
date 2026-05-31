/**
 * Tests that the NHL stats loader produces output the hockey projection engine
 * can consume directly — the integration point the daily pipeline relies on.
 */
import { describe, it, expect } from 'vitest';
import { getNHLTeamStats, getAllNHLTeams } from '../src/utils/statsLoader.js';
import { calculateNHLProjection } from '../src/tools/hockeyProbability.js';

describe('NHL stats loader → hockey engine integration', () => {
  it('loads a full slate of NHL teams', () => {
    const teams = getAllNHLTeams();
    // 30-32 NHL teams depending on the season's CSV snapshot.
    expect(teams.length).toBeGreaterThanOrEqual(30);
  });

  it('produces engine-ready stats with all 7 required fields', () => {
    const avs = getNHLTeamStats('Colorado Avalanche');
    expect(avs).not.toBeNull();
    for (const key of ['xGF60', 'xGA60', 'GSAx60', 'HDCF60', 'PP', 'PK', 'timesShorthandedPerGame'] as const) {
      expect(typeof avs![key]).toBe('number');
    }
  });

  it('feeds straight into calculateNHLProjection to yield a sane total', () => {
    const home = getNHLTeamStats('Avalanche');
    const away = getNHLTeamStats('Oilers');
    expect(home).not.toBeNull();
    expect(away).not.toBeNull();

    const projection = calculateNHLProjection(home!, away!, 6.0);
    // NHL game totals realistically land between ~4 and ~9 goals.
    expect(projection.projectedTotal).toBeGreaterThan(4);
    expect(projection.projectedTotal).toBeLessThan(9);
    // Probabilities are complementary and bounded.
    expect(projection.overProbability + projection.underProbability).toBeCloseTo(100, 1);
  });
});
