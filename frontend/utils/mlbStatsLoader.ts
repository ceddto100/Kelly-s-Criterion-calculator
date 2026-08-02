/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MLB CSV stats loader
 * ====================
 * The single place the app reads MLB data from. Everything comes from static
 * CSVs under `/stats/mlb/`, exactly like the NBA (`/stats/nba/`), NFL
 * (`/stats/nfl/`) and NHL (`/stats/nhl/`) tabs — no backend call, no live
 * scrape, no GitHub-Action-dependent API.
 *
 *   mlb_team_offense.csv  team, abbreviation, wrc_plus, woba, ops,
 *                         runs_per_game, recent_runs_per_game
 *   mlb_starters.csv      pitcher, team, abbreviation, throws, era, fip,
 *                         xfip, siera
 *   mlb_bullpen.csv       team, abbreviation, bullpen_fip, bullpen_era,
 *                         bullpen_whip, innings_last1d, innings_last3d,
 *                         closer_available
 *   mlb_parks.csv         team, abbreviation, venue, park_factor, roof_type
 *   mlb_slate.csv         one row per game today (see SlateRow below)
 *
 * Files are fetched once and cached for the session. A blank cell means "not
 * supplied" and is passed through as `undefined`, so the projection engine's
 * data-completeness logic can lower confidence honestly instead of the loader
 * inventing a default.
 */

import type { MLBProjectionInput, MLBTeamInput, WindDirection } from './mlbProjection';

const BASE = '/stats/mlb';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface MLBTeamRow {
  team: string;
  abbreviation: string;
  wrcPlus?: number;
  woba?: number;
  ops?: number;
  runsPerGame?: number;
  recentRunsPerGame?: number;
  /** Bullpen, joined from mlb_bullpen.csv. */
  bullpenFip?: number;
  bullpenEra?: number;
  bullpenWhip?: number;
  inningsLast1d?: number;
  inningsLast3d?: number;
  closerAvailable?: boolean;
  /** Home ballpark, joined from mlb_parks.csv. */
  venue?: string;
  parkFactor?: number;
  roofType?: string;
}

export interface MLBPitcherRow {
  pitcher: string;
  team: string;
  abbreviation: string;
  throws?: string;
  era?: number;
  fip?: number;
  xfip?: number;
  siera?: number;
}

export interface SlateRow {
  gameDate: string;
  gameTime: string;
  awayTeam: string;
  awayAbbr: string;
  homeTeam: string;
  homeAbbr: string;
  venue: string;
  awayStarter: string;
  awayStarterConfirmed?: boolean;
  homeStarter: string;
  homeStarterConfirmed?: boolean;
  bookTotal?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
  temperatureF?: number;
  windSpeedMph?: number;
  windDirection?: WindDirection;
  roofClosed?: boolean;
  awayLineupConfirmed?: boolean;
  homeLineupConfirmed?: boolean;
}

/** A slate game with both teams' stats already joined and ready to project. */
export interface MLBSlateGame {
  id: string;
  slate: SlateRow;
  homeRow: MLBTeamRow | null;
  awayRow: MLBTeamRow | null;
  homeStarterRow: MLBPitcherRow | null;
  awayStarterRow: MLBPitcherRow | null;
  input: MLBProjectionInput;
  /** Teams present in the slate but missing from the stat CSVs. */
  missingTeams: string[];
}

// ---------------------------------------------------------------------------
// CSV parsing
// ---------------------------------------------------------------------------

/**
 * Split one CSV line, honouring double quotes and escaped `""`. The generator
 * quotes every cell, and team names can contain periods and spaces, so a naive
 * `split(',')` is not safe here.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, '').trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}

/** Blank stays blank: an absent stat must never become a fabricated 0. */
function n(v: string | undefined): number | undefined {
  if (v === undefined || v.trim() === '') return undefined;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function b(v: string | undefined): boolean | undefined {
  if (v === undefined) return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'yes' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return undefined;
}

/** Collapse a name for matching ("St. Louis" vs "St Louis", accents in names). */
export function normalizeName(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents (José -> jose)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const nickname = (s: string) => normalizeName((s || '').trim().split(/\s+/).pop() || '');

// ---------------------------------------------------------------------------
// Loading + caching
// ---------------------------------------------------------------------------

export interface MLBStats {
  teams: MLBTeamRow[];
  pitchers: MLBPitcherRow[];
  slate: SlateRow[];
  updatedAt: string | null;
}

let cache: Promise<MLBStats> | null = null;

async function fetchCsv(file: string, required: boolean): Promise<Record<string, string>[]> {
  try {
    const res = await fetch(`${BASE}/${file}`);
    if (!res.ok) {
      if (required) throw new Error(`${file}: HTTP ${res.status}`);
      return [];
    }
    return parseCsv(await res.text());
  } catch (e) {
    if (required) throw e;
    return [];
  }
}

async function load(): Promise<MLBStats> {
  const [offenseRows, bullpenRows, parkRows, pitcherRows, slateRows, meta] = await Promise.all([
    fetchCsv('mlb_team_offense.csv', true),
    fetchCsv('mlb_bullpen.csv', false),
    fetchCsv('mlb_parks.csv', false),
    fetchCsv('mlb_starters.csv', false),
    fetchCsv('mlb_slate.csv', false),
    fetch(`${BASE}/last_updated.json`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const bullpenByAbbr = new Map(bullpenRows.map((r) => [normalizeName(r.abbreviation), r]));
  const parkByAbbr = new Map(parkRows.map((r) => [normalizeName(r.abbreviation), r]));

  const teams: MLBTeamRow[] = offenseRows.map((r) => {
    const key = normalizeName(r.abbreviation);
    const bp = bullpenByAbbr.get(key);
    const park = parkByAbbr.get(key);
    return {
      team: r.team,
      abbreviation: r.abbreviation,
      wrcPlus: n(r.wrc_plus),
      woba: n(r.woba),
      ops: n(r.ops),
      runsPerGame: n(r.runs_per_game),
      recentRunsPerGame: n(r.recent_runs_per_game),
      bullpenFip: n(bp?.bullpen_fip),
      bullpenEra: n(bp?.bullpen_era),
      bullpenWhip: n(bp?.bullpen_whip),
      inningsLast1d: n(bp?.innings_last1d),
      inningsLast3d: n(bp?.innings_last3d),
      closerAvailable: b(bp?.closer_available),
      venue: park?.venue,
      parkFactor: n(park?.park_factor),
      roofType: park?.roof_type,
    };
  });

  const pitchers: MLBPitcherRow[] = pitcherRows.map((r) => ({
    pitcher: r.pitcher,
    team: r.team,
    abbreviation: r.abbreviation,
    throws: r.throws || undefined,
    era: n(r.era),
    fip: n(r.fip),
    xfip: n(r.xfip),
    siera: n(r.siera),
  }));

  const slate: SlateRow[] = slateRows.map((r) => ({
    gameDate: r.game_date,
    gameTime: r.game_time,
    awayTeam: r.away_team,
    awayAbbr: r.away_abbr,
    homeTeam: r.home_team,
    homeAbbr: r.home_abbr,
    venue: r.venue,
    awayStarter: r.away_starter,
    awayStarterConfirmed: b(r.away_starter_confirmed),
    homeStarter: r.home_starter,
    homeStarterConfirmed: b(r.home_starter_confirmed),
    bookTotal: n(r.book_total),
    homeMoneyline: n(r.home_moneyline),
    awayMoneyline: n(r.away_moneyline),
    temperatureF: n(r.temperature_f),
    windSpeedMph: n(r.wind_speed_mph),
    windDirection: (r.wind_direction as WindDirection) || undefined,
    roofClosed: b(r.roof_closed),
    awayLineupConfirmed: b(r.away_lineup_confirmed),
    homeLineupConfirmed: b(r.home_lineup_confirmed),
  }));

  return { teams, pitchers, slate, updatedAt: meta?.updatedAt ?? null };
}

export function loadMLBStats(): Promise<MLBStats> {
  if (!cache) {
    cache = load().catch((e) => {
      cache = null; // let a later attempt retry rather than caching the failure
      throw e;
    });
  }
  return cache;
}

/** Warm the cache so the first card tap is instant. */
export function preloadMLBStats(): void {
  void loadMLBStats().catch(() => {});
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

/** Find a team by abbreviation, then full name, then nickname. */
export function findTeamRow(
  teams: MLBTeamRow[],
  nameOrAbbr: string,
  abbr?: string,
): MLBTeamRow | null {
  const key = normalizeName(nameOrAbbr);
  const abbrKey = abbr ? normalizeName(abbr) : '';
  return (
    (abbrKey && teams.find((t) => normalizeName(t.abbreviation) === abbrKey)) ||
    teams.find((t) => normalizeName(t.abbreviation) === key) ||
    teams.find((t) => normalizeName(t.team) === key) ||
    teams.find((t) => nickname(t.team) === key) ||
    teams.find((t) => nickname(t.team) === nickname(nameOrAbbr)) ||
    null
  );
}

/**
 * Find a starting pitcher by name. Prefers a same-team match so two pitchers
 * sharing a name (which does happen) resolve to the right one.
 */
export function findPitcherRow(
  pitchers: MLBPitcherRow[],
  name: string,
  teamAbbr?: string,
): MLBPitcherRow | null {
  if (!name) return null;
  const key = normalizeName(name);
  const matches = pitchers.filter((p) => normalizeName(p.pitcher) === key);
  if (matches.length === 0) return null;
  if (matches.length === 1 || !teamAbbr) return matches[0];
  const abbrKey = normalizeName(teamAbbr);
  return matches.find((p) => normalizeName(p.abbreviation) === abbrKey) || matches[0];
}

// ---------------------------------------------------------------------------
// CSV rows -> projection engine input
// ---------------------------------------------------------------------------

function toTeamInput(
  row: MLBTeamRow,
  starter: MLBPitcherRow | null,
  starterConfirmed: boolean | undefined,
  lineupConfirmed: boolean | undefined,
): MLBTeamInput {
  return {
    name: row.team,
    offense: {
      wrcPlus: row.wrcPlus,
      woba: row.woba,
      ops: row.ops,
      runsPerGame: row.runsPerGame,
      recentRunsPerGame: row.recentRunsPerGame,
    },
    starter: {
      era: starter?.era,
      fip: starter?.fip,
      xfip: starter?.xfip,
      siera: starter?.siera,
      confirmed: starterConfirmed,
    },
    bullpen: {
      fip: row.bullpenFip,
      era: row.bullpenEra,
      whip: row.bullpenWhip,
      inningsLast1d: row.inningsLast1d,
      inningsLast3d: row.inningsLast3d,
      closerAvailable: row.closerAvailable,
    },
    lineup: lineupConfirmed === undefined ? undefined : { confirmed: lineupConfirmed },
  };
}

/**
 * Build the engine input for one slate game by joining it to the team, bullpen,
 * park and starter CSVs. The park factor always comes from the HOME team's row,
 * which is what "the ballpark this game is played in" means.
 */
export function buildSlateGame(stats: MLBStats, slate: SlateRow, index: number): MLBSlateGame {
  const homeRow = findTeamRow(stats.teams, slate.homeTeam, slate.homeAbbr);
  const awayRow = findTeamRow(stats.teams, slate.awayTeam, slate.awayAbbr);
  const homeStarterRow = findPitcherRow(stats.pitchers, slate.homeStarter, slate.homeAbbr);
  const awayStarterRow = findPitcherRow(stats.pitchers, slate.awayStarter, slate.awayAbbr);

  const missingTeams: string[] = [];
  if (!homeRow) missingTeams.push(slate.homeTeam);
  if (!awayRow) missingTeams.push(slate.awayTeam);

  const blank = (name: string): MLBTeamRow => ({ team: name, abbreviation: '' });

  const roofClosed =
    slate.roofClosed ?? (homeRow?.roofType === 'Dome' || homeRow?.roofType === 'Closed');

  const input: MLBProjectionInput = {
    home: toTeamInput(
      homeRow ?? blank(slate.homeTeam),
      homeStarterRow,
      slate.homeStarterConfirmed,
      slate.homeLineupConfirmed,
    ),
    away: toTeamInput(
      awayRow ?? blank(slate.awayTeam),
      awayStarterRow,
      slate.awayStarterConfirmed,
      slate.awayLineupConfirmed,
    ),
    environment: {
      parkFactor: homeRow?.parkFactor,
      temperatureF: slate.temperatureF,
      windSpeedMph: slate.windSpeedMph,
      windDirection: slate.windDirection,
      roofClosed,
      // A retractable roof means the forecast may not apply once it closes.
      weatherReliable: homeRow?.roofType === 'Retractable' ? false : undefined,
    },
    line: {
      total: slate.bookTotal,
      homeMoneyline: slate.homeMoneyline,
      awayMoneyline: slate.awayMoneyline,
    },
  };

  return {
    id: `${slate.gameDate}-${slate.awayAbbr}-${slate.homeAbbr}-${index}`,
    slate,
    homeRow,
    awayRow,
    homeStarterRow,
    awayStarterRow,
    input,
    missingTeams,
  };
}

/** Today's full slate, each game joined to the stat CSVs and ready to project. */
export async function loadSlateGames(): Promise<MLBSlateGame[]> {
  const stats = await loadMLBStats();
  return stats.slate.map((row, i) => buildSlateGame(stats, row, i));
}

/**
 * Build a projection input for an arbitrary matchup (the estimator's team
 * pickers), using each team's season stats and the home team's ballpark.
 * Starters are optional — pass a pitcher name to pull that pitcher's line.
 */
export function buildMatchupInput(
  stats: MLBStats,
  homeName: string,
  awayName: string,
  opts: { homeStarter?: string; awayStarter?: string } = {},
): { input: MLBProjectionInput; homeRow: MLBTeamRow | null; awayRow: MLBTeamRow | null } {
  const homeRow = findTeamRow(stats.teams, homeName);
  const awayRow = findTeamRow(stats.teams, awayName);
  const slate: SlateRow = {
    gameDate: '',
    gameTime: '',
    awayTeam: awayRow?.team ?? awayName,
    awayAbbr: awayRow?.abbreviation ?? '',
    homeTeam: homeRow?.team ?? homeName,
    homeAbbr: homeRow?.abbreviation ?? '',
    venue: homeRow?.venue ?? '',
    awayStarter: opts.awayStarter ?? '',
    homeStarter: opts.homeStarter ?? '',
  };
  const game = buildSlateGame(stats, slate, 0);
  return { input: game.input, homeRow, awayRow };
}
