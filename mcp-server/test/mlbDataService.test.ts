/**
 * Tests for the MLB StatsAPI data-service parsers (pure, fixture-driven).
 * The network wrappers can only be verified at runtime against the live API,
 * so here we lock down the JSON-shape parsing and the engine-input assembly.
 */
import { describe, it, expect } from 'vitest';
import {
  toNum,
  parseScheduleResponse,
  parsePitcherStats,
  parseTeamOffense,
  buildMLBProjectionInput,
  type MLBScheduleGame,
} from '../src/utils/mlbDataService.js';
import { projectMLBGame } from '../src/utils/mlb.js';

describe('toNum', () => {
  it('coerces strings, passes numbers, rejects junk', () => {
    expect(toNum('3.41')).toBeCloseTo(3.41, 5);
    expect(toNum(2.7)).toBe(2.7);
    expect(toNum('')).toBeUndefined();
    expect(toNum(null)).toBeUndefined();
    expect(toNum(undefined)).toBeUndefined();
    expect(toNum('—')).toBeUndefined();
  });
});

describe('parseScheduleResponse', () => {
  const fixture = {
    dates: [
      {
        games: [
          {
            gamePk: 745001,
            gameDate: '2026-06-01T17:10:00Z',
            status: { detailedState: 'Scheduled', abstractGameState: 'Preview' },
            venue: { name: 'Coors Field' },
            teams: {
              home: {
                team: { id: 115, name: 'Colorado Rockies' },
                probablePitcher: { id: 666, fullName: 'Kyle Freeland' },
              },
              away: {
                team: { id: 119, name: 'Los Angeles Dodgers' },
                probablePitcher: { id: 477, fullName: 'Tyler Glasnow' },
              },
            },
          },
          {
            // game with no probable pitchers yet
            gamePk: 745002,
            gameDate: '2026-06-01T23:05:00Z',
            status: { detailedState: 'Scheduled', abstractGameState: 'Preview' },
            teams: {
              home: { team: { id: 147, name: 'New York Yankees' } },
              away: { team: { id: 111, name: 'Boston Red Sox' } },
            },
          },
        ],
      },
    ],
  };

  it('extracts games, teams, venue, and probable pitchers', () => {
    const games = parseScheduleResponse(fixture);
    expect(games).toHaveLength(2);

    const g1 = games[0];
    expect(g1.gamePk).toBe(745001);
    expect(g1.abstractState).toBe('Preview');
    expect(g1.venueName).toBe('Coors Field');
    expect(g1.home.name).toBe('Colorado Rockies');
    expect(g1.home.probablePitcherId).toBe(666);
    expect(g1.away.probablePitcherName).toBe('Tyler Glasnow');
  });

  it('handles games with no named starter', () => {
    const games = parseScheduleResponse(fixture);
    expect(games[1].home.probablePitcherId).toBeUndefined();
  });

  it('returns [] for an empty/garbage response', () => {
    expect(parseScheduleResponse({})).toEqual([]);
    expect(parseScheduleResponse(null)).toEqual([]);
  });
});

describe('parsePitcherStats', () => {
  it('pulls ERA and WHIP from the pitching split', () => {
    const json = {
      people: [
        {
          stats: [
            {
              group: { displayName: 'pitching' },
              splits: [{ stat: { era: '3.18', whip: '1.05' } }],
            },
          ],
        },
      ],
    };
    expect(parsePitcherStats(json)).toEqual({ era: 3.18, whip: 1.05 });
  });

  it('returns empty stats when the split is missing', () => {
    expect(parsePitcherStats({ people: [{}] })).toEqual({ era: undefined, whip: undefined });
  });
});

describe('parseTeamOffense', () => {
  it('computes runs/game from runs and gamesPlayed', () => {
    const json = {
      teams: [
        {
          stats: [
            {
              group: { displayName: 'hitting' },
              splits: [{ stat: { ops: '0.742', runs: '300', gamesPlayed: '60' } }],
            },
          ],
        },
      ],
    };
    const off = parseTeamOffense(json);
    expect(off.ops).toBeCloseTo(0.742, 5);
    expect(off.runsPerGame).toBeCloseTo(5.0, 5);
  });

  it('leaves runsPerGame undefined when games are missing', () => {
    const json = {
      teams: [{ stats: [{ group: { displayName: 'hitting' }, splits: [{ stat: { ops: '0.700' } }] }] }],
    };
    const off = parseTeamOffense(json);
    expect(off.ops).toBeCloseTo(0.7, 5);
    expect(off.runsPerGame).toBeUndefined();
  });
});

describe('buildMLBProjectionInput → engine', () => {
  const game: MLBScheduleGame = {
    gamePk: 1,
    gameDate: '2026-06-01T17:10:00Z',
    detailedState: 'Scheduled',
    abstractState: 'Preview',
    home: { teamId: 115, name: 'Rockies', probablePitcherId: 666, probablePitcherName: 'A' },
    away: { teamId: 119, name: 'Dodgers' }, // no named starter
  };

  it('marks starter confirmed only when a probable pitcher exists', () => {
    const input = buildMLBProjectionInput(
      game,
      { home: { ops: 0.72, runsPerGame: 4.5 }, away: { ops: 0.78, runsPerGame: 5.1 } },
      { home: { era: 4.2 }, away: null }
    );
    expect(input.home.starter.confirmed).toBe(true);
    expect(input.away.starter.confirmed).toBe(false);
    expect(input.home.offense.ops).toBe(0.72);
    // premium inputs left unset
    expect(input.home.starter.fip).toBeUndefined();
    expect(input.home.bullpen.fip).toBeUndefined();
  });

  it('produces a runnable projection that is low-confidence / no-bet on thin data', () => {
    const input = buildMLBProjectionInput(
      game,
      { home: { ops: 0.72, runsPerGame: 4.5 }, away: { ops: 0.78, runsPerGame: 5.1 } },
      { home: { era: 4.2 }, away: { era: 3.6 } }
    );
    const result = projectMLBGame(input);
    expect(result.totals.projectedTotal).toBeGreaterThan(4);
    expect(result.totals.projectedTotal).toBeLessThan(16);
    // No book line supplied → must be no-bet.
    expect(result.totals.lean).toBe('no-bet');
    // Thin data (no FIP/wRC+/bullpen/park) → completeness well below full.
    expect(result.dataCompleteness).toBeLessThan(0.8);
  });
});
