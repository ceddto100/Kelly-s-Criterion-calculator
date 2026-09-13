import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCsv } from '../src/utils/csv.js';
import {
  calendarDaysBetween,
  closingLineValue,
  consensusLine,
  elevationFeetResolver,
  gradeSpread,
  homeSpreadFromLine,
  latestRanks,
  localHour,
  pickCurrentWeek,
  utcOffsetHours,
} from '../../scripts/lib/cfbd.mjs';
import { runCfbUpdate } from '../../scripts/lib/cfbUpdate.mjs';
import {
  buildSlateGames,
  lineLabel,
  loadCFBDataFrom,
  parseCFBData,
  prefillForTeams,
  prefillFromSlate,
  summarizePicks,
} from '../src/utils/cfbCsv.js';

describe('CFBD response shaping', () => {
  it('reads the home spread from the named favorite, falling back to the bare number', () => {
    expect(homeSpreadFromLine({ formattedSpread: 'Georgia -7.5', spread: 7.5 }, 'Georgia', 'Auburn')).toBe(-7.5);
    expect(homeSpreadFromLine({ formattedSpread: 'Georgia -7.5' }, 'Auburn', 'Georgia')).toBe(7.5);
    expect(homeSpreadFromLine({ formattedSpread: 'Auburn +3' }, 'Auburn', 'Georgia')).toBe(3);
    expect(homeSpreadFromLine({ formattedSpread: 'PK' }, 'Auburn', 'Georgia')).toBe(0);
    expect(homeSpreadFromLine({ formattedSpread: '', spread: -2.5 }, 'Auburn', 'Georgia')).toBe(-2.5);
    expect(homeSpreadFromLine({ formattedSpread: 'Somebody Else -4' }, 'Auburn', 'Georgia')).toBeUndefined();
  });

  it('takes the median line across books to the nearest half point', () => {
    const bg = {
      homeTeam: 'A', awayTeam: 'B',
      lines: [
        { formattedSpread: 'A -7', overUnder: 55.5 },
        { formattedSpread: 'A -6.5', overUnder: 56 },
        { formattedSpread: 'A -7.5', overUnder: null },
      ],
    };
    expect(consensusLine(bg)).toEqual({ spreadHome: -7, total: 56, books: 3 });
    expect(consensusLine(undefined)).toEqual({ spreadHome: undefined, total: undefined, books: 0 });
  });

  it('grades picks and closing-line value from each side', () => {
    expect(gradeSpread(24, 17, -7, 'home')).toBe('push');
    expect(gradeSpread(24, 16, -7, 'home')).toBe('win');
    expect(gradeSpread(24, 16, -7, 'away')).toBe('loss');
    expect(closingLineValue('home', -7, -8)).toBe(1);
    expect(closingLineValue('away', -7, -8)).toBe(-1);
    expect(closingLineValue('away', 3, 3)).toBe(0);
  });

  it('prefers the playoff committee over the AP poll and ignores FCS polls', () => {
    const r = latestRanks([
      { seasonType: 'regular', week: 10, polls: [{ poll: 'AP Top 25', ranks: [{ rank: 1, teamId: 1 }] }] },
      {
        seasonType: 'regular', week: 11,
        polls: [
          { poll: 'FCS Coaches Poll', ranks: [{ rank: 1, teamId: 99 }] },
          { poll: 'AP Top 25', ranks: [{ rank: 1, teamId: 1 }] },
          { poll: 'Playoff Committee Rankings', ranks: [{ rank: 1, teamId: 2 }, { rank: 2, teamId: 1 }] },
        ],
      },
    ]);
    expect(r.poll).toBe('Playoff Committee Rankings');
    expect(r.ranks.get(2)).toBe(1);
    expect(r.ranks.has(99)).toBe(false);
  });

  it('handles clocks, DST and elevation units', () => {
    expect(calendarDaysBetween('2026-10-31T16:00:00Z', '2026-11-07T17:00:00Z')).toBe(7);
    expect(calendarDaysBetween('2026-09-12T23:30:00Z', '2026-09-18T00:00:00Z')).toBe(5); // Sat night → Thu night ET
    expect(utcOffsetHours('America/Phoenix', new Date('2026-07-01T12:00:00Z'))).toBe(-7);
    expect(utcOffsetHours('America/Denver', new Date('2026-07-01T12:00:00Z'))).toBe(-6);
    expect(utcOffsetHours('Not/AZone', new Date())).toBeUndefined();
    expect(localHour('America/Los_Angeles', new Date('2026-09-19T16:00:00Z'))).toBe(9);
    expect(elevationFeetResolver([{ elevation: '60' }, { elevation: '2195' }]).unit).toBe('meters');
    expect(elevationFeetResolver([{ elevation: '200' }, { elevation: '7220' }]).toFeet('7220')).toBe(7220);
  });

  it('rolls the current week forward once the earliest open game is long past', () => {
    const now = new Date('2026-09-20T15:00:00Z');
    const games = [
      { season: 2026, seasonType: 'regular', week: 3, completed: true, startDate: '2026-09-19T16:00:00Z' },
      { season: 2026, seasonType: 'regular', week: 3, completed: false, startDate: '2026-09-10T16:00:00Z' },
      { season: 2026, seasonType: 'regular', week: 4, completed: false, startDate: '2026-09-26T16:00:00Z' },
    ];
    expect(pickCurrentWeek(games, now)).toMatchObject({ week: 4 });
  });
});

// ---------------------------------------------------------------------------
// End-to-end refresh on fixture responses (fictional teams, placeholder numbers)
// ---------------------------------------------------------------------------

const loc = (id: number, timezone: string, elevation: string) => ({ id, timezone, elevation });
const TEAMS = [
  { id: 1, school: 'Fixture State', abbreviation: 'FXST', conference: 'Test East', location: loc(101, 'America/New_York', '60') },
  { id: 2, school: 'Sample Tech', abbreviation: 'SMPT', conference: 'Test West', location: loc(102, 'America/Los_Angeles', '30') },
  { id: 3, school: 'Mock University', abbreviation: 'MOCK', conference: 'Test West', location: loc(103, 'America/Denver', '2195') },
  { id: 4, school: 'Example A&M', abbreviation: 'EXAM', conference: 'Test East', location: loc(104, 'America/Chicago', '150') },
];
const VENUES = [
  { id: 101, name: 'Fixture Field', ...loc(101, 'America/New_York', '60') },
  { id: 102, name: 'Sample Stadium', ...loc(102, 'America/Los_Angeles', '30') },
  { id: 103, name: 'Mock Mountain Stadium', ...loc(103, 'America/Denver', '2195') },
  { id: 104, name: 'Example Bowl', ...loc(104, 'America/Chicago', '150') },
];

function game(id: number, week: number, startDate: string, home: number, away: number, extra: Record<string, unknown> = {}) {
  const name = (t: number) => TEAMS.find((x) => x.id === t)?.school ?? 'Tiny College';
  return {
    id, season: 2026, week, seasonType: 'regular', startDate, startTimeTBD: false, completed: false,
    neutralSite: false, conferenceGame: false, venueId: home === 99 ? null : 100 + home, venue: '',
    homeId: home, homeTeam: name(home), homeConference: '', homeClassification: home === 99 ? 'fcs' : 'fbs',
    homePoints: null, awayId: away, awayTeam: name(away), awayConference: '',
    awayClassification: away === 99 ? 'fcs' : 'fbs', awayPoints: null, ...extra,
  };
}
const final = (home: number, away: number) => ({ completed: true, homePoints: home, awayPoints: away });

function fixtureApi(phase: { week3Final: boolean }) {
  const calls: string[] = [];
  const api = async (endpoint: string, params: Record<string, unknown> = {}) => {
    calls.push(`${endpoint}${params.week ? `#${params.week}` : ''}`);
    switch (endpoint) {
      case '/teams/fbs': return TEAMS;
      case '/venues': return VENUES;
      case '/games': return [
        game(1001, 1, '2026-09-05T16:00:00Z', 1, 99, final(45, 10)),
        game(1002, 1, '2026-09-05T23:30:00Z', 2, 4, final(21, 24)),
        game(2001, 2, '2026-09-12T20:00:00Z', 3, 2, final(42, 14)),
        game(2002, 2, '2026-09-12T17:00:00Z', 4, 99, final(38, 3)),
        game(3001, 3, '2026-09-19T16:00:00Z', 1, 2, phase.week3Final ? final(31, 17) : {}),
        game(3002, 3, '2026-09-19T20:00:00Z', 3, 4, phase.week3Final ? final(30, 21) : {}),
        game(4001, 4, '2026-09-26T16:00:00Z', 2, 3),
        game(4002, 4, '2026-09-26T20:00:00Z', 1, 4),
      ];
      case '/lines':
        if (params.week !== 3) return [];
        return phase.week3Final
          ? [
              { id: 3001, homeTeam: 'Fixture State', awayTeam: 'Sample Tech', lines: [{ formattedSpread: 'Fixture State -8' }] },
              { id: 3002, homeTeam: 'Mock University', awayTeam: 'Example A&M', lines: [{ formattedSpread: 'Mock University -9' }] },
            ]
          : [
              {
                id: 3001, homeTeam: 'Fixture State', awayTeam: 'Sample Tech',
                lines: [
                  { formattedSpread: 'Fixture State -7', spread: -7, overUnder: 55.5 },
                  { formattedSpread: 'Fixture State -6.5', spread: -6.5, overUnder: 56 },
                  { formattedSpread: 'Fixture State -7.5', overUnder: 55 },
                ],
              },
              {
                id: 3002, homeTeam: 'Mock University', awayTeam: 'Example A&M',
                // The bare number's sign is wrong on purpose: the named favorite must win.
                lines: [{ formattedSpread: 'Mock University -10', spread: 10 }, { formattedSpread: '', spread: -9.5 }],
              },
            ];
      case '/rankings': return [
        { season: 2026, seasonType: 'regular', week: 2, polls: [{ poll: 'AP Top 25', ranks: [{ rank: 20, teamId: 4 }] }] },
        {
          season: 2026, seasonType: 'regular', week: 3,
          polls: [
            { poll: 'AP Top 25', ranks: [{ rank: 4, teamId: 3 }, { rank: 12, teamId: 1 }] },
            { poll: 'FCS Coaches Poll', ranks: [{ rank: 1, teamId: 99 }] },
          ],
        },
      ];
      case '/ratings/sp': return [
        { team: 'Fixture State', rating: 14.2 }, { team: 'Sample Tech', rating: 3.0 },
        { team: 'Mock University', rating: 20.5 }, { team: 'nationalAverages', rating: 0 },
      ];
      case '/ratings/fpi': return [
        { team: 'Fixture State', fpi: 12.0 }, { team: 'Sample Tech', fpi: 9.8 },
        { team: 'Mock University', fpi: 21.1 }, { team: 'Example A&M', fpi: 1.4 },
      ];
      default: throw new Error(`unexpected endpoint ${endpoint}`);
    }
  };
  return { api, calls };
}

describe('college football refresh (fixtures)', () => {
  let outDir: string;
  let cacheDir: string;
  const csv = (file: string) => parseCsv(fs.readFileSync(path.join(outDir, file), 'utf8'));
  const meta = () => JSON.parse(fs.readFileSync(path.join(outDir, 'last_updated.json'), 'utf8'));
  const state = () => JSON.parse(fs.readFileSync(path.join(cacheDir, '2026', 'state.json'), 'utf8'));

  beforeEach(() => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cfb-'));
    outDir = path.join(root, 'out');
    cacheDir = path.join(root, 'cache');
  });
  afterEach(() => fs.rmSync(path.dirname(outDir), { recursive: true, force: true }));

  it('builds ratings, the weekly slate, then logs and grades picks', async () => {
    const quiet = () => {};

    // Wednesday: first run — everything fetched, both games still > 72h out.
    const wed = fixtureApi({ week3Final: false });
    await runCfbUpdate({ api: wed.api, outDir, cacheDir, now: new Date('2026-09-16T15:00:00Z'), log: quiet });
    expect(wed.calls).toEqual(['/teams/fbs', '/venues', '/games', '/lines#3', '/rankings', '/ratings/sp', '/ratings/fpi']);

    const ratings = csv('cfb_ratings.csv');
    expect(ratings.map((r) => [r.team, r.rating, r.rating_sources, r.ratings_gap_band])).toEqual([
      ['Mock University', '20.8', 'sp+ fpi', '0-3'],
      ['Fixture State', '13.1', 'sp+ fpi', '0-3'],
      ['Sample Tech', '6.4', 'sp+ fpi', '6+'],
      ['Example A&M', '1.4', 'fpi', ''],
    ]);

    const [g1, g2] = csv('cfb_slate.csv');
    expect(g1).toMatchObject({
      game_id: '3001', week: '3', home_team: 'Fixture State', home_rank: '12', home_rest_days: '14',
      away_rest_days: '7', away_prev_margin: '-28', away_tz_change: '3', away_body_clock_hour: '9',
      away_next_opponent: 'Mock University', away_next_opponent_rank: '4',
      spread_home: '-7', total: '55.5', line_books: '3',
    });
    expect(g2).toMatchObject({
      game_id: '3002', home_rank: '4', venue_elevation_ft: '7201', away_base_elevation_ft: '492', spread_home: '-9.5',
    });
    expect(meta()).toMatchObject({ week: 3, ratedTeams: 4, venueElevationUnit: 'meters', apiCalls: 7, picksPending: 0 });
    expect(csv('cfb_predictions.csv')).toEqual([]);

    // Thursday: inside 72 hours — picks logged, ratings and static data not refetched.
    const thu = fixtureApi({ week3Final: false });
    await runCfbUpdate({ api: thu.api, outDir, cacheDir, now: new Date('2026-09-17T03:00:00Z'), log: quiet });
    expect(thu.calls).toEqual(['/games', '/lines#3', '/rankings']);
    const pending = state().pending;
    expect(pending.map((p: { gameId: number; side: string; pickLineHome: number; confidence: string }) =>
      [p.gameId, p.side, p.pickLineHome, p.confidence])).toEqual([[3001, 'home', -7, 'STRONG'], [3002, 'home', -9.5, 'STRONG']]);
    // 13.1 − 6.4 + 3 home + 1 bye; the visitor's travel (−1.5) and bounceback (+1.5) cancel.
    expect(pending[0].probability).toBeCloseTo(59.14, 1);

    // Sunday after the games: picks graded against the final score and the closing line.
    const sun = fixtureApi({ week3Final: true });
    await runCfbUpdate({ api: sun.api, outDir, cacheDir, now: new Date('2026-09-20T15:00:00Z'), log: quiet });
    expect(sun.calls).toEqual(['/games', '/lines#4', '/rankings', '/ratings/sp', '/ratings/fpi', '/lines#3']);
    expect(csv('cfb_predictions.csv').map((r) => [r.game_id, r.sport, r.market, r.outcome, r.clv_points, r.pick_side])).toEqual([
      ['3001', 'CFB', 'spread', 'win', '1', 'home'],
      ['3002', 'CFB', 'spread', 'loss', '-0.5', 'home'],
    ]);
    expect(state().pending).toEqual([]);
    expect(meta()).toMatchObject({ week: 4, picksLogged: 2, picksPending: 0 });
    // The public log never carries the raw line a pick was logged at.
    expect(fs.readFileSync(path.join(outDir, 'cfb_predictions.csv'), 'utf8')).not.toMatch(/-9\.5|-7"/);
  });

  it('gives the app the same projection the pick log recorded', async () => {
    const quiet = () => {};
    await runCfbUpdate({ api: fixtureApi({ week3Final: false }).api, outDir, cacheDir, now: new Date('2026-09-16T15:00:00Z'), log: quiet });
    await runCfbUpdate({ api: fixtureApi({ week3Final: false }).api, outDir, cacheDir, now: new Date('2026-09-17T03:00:00Z'), log: quiet });
    const read = async (file: string) => {
      try { return fs.readFileSync(path.join(outDir, file), 'utf8'); } catch { return null; }
    };
    const data = await loadCFBDataFrom(read);
    expect(data.teams).toHaveLength(4);
    expect(data.meta?.week).toBe(3);

    const games = buildSlateGames(data, new Date('2026-09-17T03:00:00Z'));
    const g = games.find((x) => x.row.gameId === 3001)!;
    expect(g.isTop25).toBe(true);
    expect(g.projection?.pickProbability).toBeCloseTo(state().pending[0].probability, 1);
    expect(g.prefill.auto.A.bye).toBe(true);
    expect(g.prefill.auto.B).toMatchObject({ travel: true, bounceback: true, lookahead: true });
    expect(g.prefill.hints.B[0]).toContain('#4 Mock University');
    expect(g.prefill.hints.B).toContain('SP+ and FPI disagree by 6+ points — check QB and injury news');

    // The same game seen from the visitor's side flips the spread, venue and factors.
    const fromAway = prefillFromSlate(data, g.row, 'away');
    expect(fromAway).toMatchObject({ venue: 'away', marketSpread: 7 });
    expect(fromAway.teamA.name).toBe('Sample Tech');
    expect(fromAway.auto.A.travel).toBe(true);
    expect(prefillForTeams(data, 2, 1)?.marketSpread).toBe(7);

    // Teams that don't meet this week are a hypothetical: no line, no automatic factors.
    const hypothetical = prefillForTeams(data, 1, 3, 'neutral')!;
    expect(hypothetical).toMatchObject({ marketSpread: null, venue: 'neutral' });
    expect(Object.values(hypothetical.auto.A).some(Boolean)).toBe(false);
    expect(lineLabel(-7, 'FXST', 'SMPT')).toBe('FXST -7');
    expect(lineLabel(7, 'SMPT', 'FXST')).toBe('FXST -7');
    expect(lineLabel(0, 'A', 'B')).toBe('PK');

    await runCfbUpdate({ api: fixtureApi({ week3Final: true }).api, outDir, cacheDir, now: new Date('2026-09-20T15:00:00Z'), log: quiet });
    const record = summarizePicks((await loadCFBDataFrom(read)).picks);
    expect(record).toMatchObject({ picks: 2, wins: 1, losses: 1, pushes: 0, withClose: 2, beatClose: 1, averageClv: 0.25 });
  });

  it('treats header-only files and HTML fallback pages as no data', () => {
    const empty = parseCFBData({ ratings: '"team_id","team"\n', slate: '<!doctype html><html>', predictions: null, meta: '<html>' });
    expect(empty).toEqual({ teams: [], slate: [], picks: [], meta: null });
  });

  it('spends no API calls in the offseason', async () => {
    const { api, calls } = fixtureApi({ week3Final: false });
    const r = await runCfbUpdate({ api, outDir, cacheDir, now: new Date('2026-05-01T12:00:00Z'), log: () => {} });
    expect(r.status).toBe('offseason');
    expect(calls).toEqual([]);
    expect(fs.existsSync(outDir)).toBe(false);
  });
});
