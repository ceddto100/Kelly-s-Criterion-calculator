/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Daily game → Probability Estimator transfer
 * ===========================================
 * Turns a clicked "Today's Games" card into a ready-to-use Probability
 * Estimator payload. For NBA / NFL / NHL it loads the same per-team CSVs the
 * Sports Matchup tab uses (cached so repeated clicks don't refetch), matches the
 * two teams by full name (most reliable across data sources) and maps their
 * stats straight onto the estimator's state shape. It also carries the betting
 * line: point spread for NBA/NFL, total goals for NHL. MLB is handled from the
 * already-complete projection input returned by /api/mlb/daily.
 *
 * Convention used everywhere here: Team A = HOME, Team B = AWAY. This mirrors the
 * NHL matchup transfer (home is team A) and lets the estimator's "Your Team is
 * Home" venue + home-field advantage line up with the real matchup automatically.
 */

import type { MLBProjectionInput } from './mlbProjection';

// ---- estimator state shapes (must match index.tsx initial*State) ------------

export interface FootballStatsShape {
  teamPointsFor: string; opponentPointsFor: string;
  teamPointsAgainst: string; opponentPointsAgainst: string;
  teamOffYards: string; opponentOffYards: string;
  teamDefYards: string; opponentDefYards: string;
  teamTurnoverDiff: string; opponentTurnoverDiff: string;
  teamAName: string; teamBName: string;
}

export interface BasketballStatsShape {
  teamPointsFor: string; opponentPointsFor: string;
  teamPointsAgainst: string; opponentPointsAgainst: string;
  teamFgPct: string; opponentFgPct: string;
  teamReboundMargin: string; opponentReboundMargin: string;
  teamTurnoverMargin: string; opponentTurnoverMargin: string;
  teamPace: string; opponentPace: string;
  team3PRate: string; opponent3PRate: string;
  team3PPct: string; opponent3PPct: string;
  teamAName: string; teamBName: string;
}

export interface HockeyStatsShape {
  homeXgf60: string; homeXga60: string; homeGsax60: string; homeHdcf60: string;
  homePP: string; homePK: string; homeTimesShorthanded: string;
  awayXgf60: string; awayXga60: string; awayGsax60: string; awayHdcf60: string;
  awayPP: string; awayPK: string; awayTimesShorthanded: string;
  teamAName: string; teamBName: string;
}

export type MLBFieldState = Record<string, string>;

/** Discriminated union the App applies to estimator state. */
export type DailyGameSelection =
  | { sport: 'NBA'; basketball: BasketballStatsShape; spread: string; isTeamAHome: boolean }
  | { sport: 'NFL'; football: FootballStatsShape; spread: string; isTeamAHome: boolean }
  | { sport: 'NHL'; hockey: HockeyStatsShape; totalGoalsLine: string }
  | { sport: 'MLB'; mlb: MLBFieldState };

/** Minimal shape of a generic (NBA/NFL/NHL) daily game card. */
export interface GenericGameLike {
  homeTeam: string;
  awayTeam: string;
  homeAbbr?: string;
  awayAbbr?: string;
  overUnder: number | null;
  spread: string | null;
}

/** Minimal shape of an MLB daily game card. */
export interface MLBGameLike {
  homeTeam: string;
  awayTeam: string;
  bookTotal: number | null;
  input: MLBProjectionInput;
}

// ---- loaded team-stat rows --------------------------------------------------

interface NBATeamRow {
  team: string; abbreviation: string;
  points_per_game: number; points_allowed: number; field_goal_pct: number;
  rebound_margin: number; turnover_margin: number; pace: number;
  three_pct: number; three_rate: number;
}
interface NFLTeamRow {
  team: string; abbreviation: string;
  ppg: number; allowed: number; off_yards: number; def_yards: number; turnover_diff: number;
}
interface NHLTeamRow {
  team: string; abbreviation: string;
  xgf60: number; xga60: number; gsax60: number; hdcf60: number;
  pp: number; pk: number; timesShorthanded: number;
}

// ---- small helpers ----------------------------------------------------------

function parseCsv(csv: string): Record<string, string | number>[] {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.replace(/"/g, '').trim());
    const obj: Record<string, string | number> = {};
    headers.forEach((h, i) => {
      const val = values[i];
      const n = parseFloat(val);
      obj[h] = isNaN(n) ? val : n;
    });
    return obj;
  });
}

/** Collapse a team name to a comparable key (handles "St. Louis" vs "St Louis"). */
function normalize(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Stringify a stat for an estimator input; '' when missing. */
function str(n: number | undefined | null, decimals?: number): string {
  if (n === undefined || n === null || Number.isNaN(n)) return '';
  return decimals === undefined ? String(n) : n.toFixed(decimals);
}

/**
 * Find a team row by full display name first (most reliable across ESPN/CSV),
 * then by abbreviation, then by the nickname (last word of the name).
 */
function findTeam<T extends { team: string; abbreviation: string }>(
  rows: T[],
  fullName: string,
  abbr?: string,
): T | null {
  const nName = normalize(fullName);
  const byName = rows.find((r) => normalize(r.team) === nName);
  if (byName) return byName;

  if (abbr) {
    const nAbbr = normalize(abbr);
    const byAbbr = rows.find((r) => normalize(r.abbreviation) === nAbbr);
    if (byAbbr) return byAbbr;
  }

  const lastWord = normalize(fullName.split(' ').pop() || '');
  if (lastWord) {
    const byNick = rows.find((r) => normalize(r.team.split(' ').pop() || '') === lastWord);
    if (byNick) return byNick;
  }
  return null;
}

// ---- cached CSV loaders -----------------------------------------------------

let nbaCache: Promise<NBATeamRow[]> | null = null;
let nflCache: Promise<NFLTeamRow[]> | null = null;
let nhlCache: Promise<NHLTeamRow[]> | null = null;

async function fetchText(path: string): Promise<string> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.text();
}

async function loadNbaTeams(): Promise<NBATeamRow[]> {
  if (nbaCache) return nbaCache;
  nbaCache = (async () => {
    const files = ['ppg', 'allowed', 'fieldgoal', 'rebound_margin', 'turnover_margin', 'pace', 'three_pct', 'three_rate'];
    const texts = await Promise.all(files.map((f) => fetchText(`/stats/nba/${f}.csv`)));
    const [ppg, allowed, fg, reb, tov, pace, threePct, threeRate] = texts.map(parseCsv);
    const allowedMap = new Map(allowed.map((d) => [d.abbreviation, d.allowed]));
    const fgMap = new Map(fg.map((d) => [d.abbreviation, d.fg_pct]));
    const rebMap = new Map(reb.map((d) => [d.abbreviation, d.rebound_margin]));
    const tovMap = new Map(tov.map((d) => [d.abbreviation, d.turnover_margin]));
    const paceMap = new Map(pace.map((d) => [d.abbreviation, d.pace]));
    const threePctMap = new Map(threePct.map((d) => [d.abbreviation, d.three_pct]));
    const threeRateMap = new Map(threeRate.map((d) => [d.abbreviation, d.three_rate]));
    return ppg.map((t) => ({
      team: t.team as string,
      abbreviation: t.abbreviation as string,
      points_per_game: t.ppg as number,
      points_allowed: (allowedMap.get(t.abbreviation) as number) ?? 0,
      field_goal_pct: (fgMap.get(t.abbreviation) as number) ?? 0,
      rebound_margin: (rebMap.get(t.abbreviation) as number) ?? 0,
      turnover_margin: (tovMap.get(t.abbreviation) as number) ?? 0,
      pace: (paceMap.get(t.abbreviation) as number) ?? 0,
      three_pct: (threePctMap.get(t.abbreviation) as number) ?? 0,
      three_rate: (threeRateMap.get(t.abbreviation) as number) ?? 0,
    }));
  })();
  return nbaCache;
}

async function loadNflTeams(): Promise<NFLTeamRow[]> {
  if (nflCache) return nflCache;
  nflCache = (async () => {
    const [ppg, allowed, off, def, to] = (
      await Promise.all([
        fetchText('/stats/nfl/nfl_ppg.csv'),
        fetchText('/stats/nfl/nfl_allowed.csv'),
        fetchText('/stats/nfl/nfl_off_yards.csv'),
        fetchText('/stats/nfl/nfl_def_yards.csv'),
        fetchText('/stats/nfl/nfl_turnover_diff.csv'),
      ])
    ).map(parseCsv);
    const allowedMap = new Map(allowed.map((d) => [d.abbreviation, d.allowed]));
    const offMap = new Map(off.map((d) => [d.abbreviation, d.off_yards]));
    const defMap = new Map(def.map((d) => [d.abbreviation, d.def_yards]));
    const toMap = new Map(to.map((d) => [d.abbreviation, d.turnover_diff]));
    return ppg.map((t) => ({
      team: t.team as string,
      abbreviation: t.abbreviation as string,
      ppg: t.ppg as number,
      allowed: (allowedMap.get(t.abbreviation) as number) ?? 0,
      off_yards: (offMap.get(t.abbreviation) as number) ?? 0,
      def_yards: (defMap.get(t.abbreviation) as number) ?? 0,
      turnover_diff: (toMap.get(t.abbreviation) as number) ?? 0,
    }));
  })();
  return nflCache;
}

async function loadNhlTeams(): Promise<NHLTeamRow[]> {
  if (nhlCache) return nhlCache;
  nhlCache = (async () => {
    const [xgf, xga, gsax, hdcf, pp, pk, ts] = (
      await Promise.all([
        fetchText('/stats/nhl/nhl_xgf60.csv'),
        fetchText('/stats/nhl/nhl_xga60.csv'),
        fetchText('/stats/nhl/nhl_gsax60.csv'),
        fetchText('/stats/nhl/nhl_hdcf60.csv'),
        fetchText('/stats/nhl/nhl_pp.csv'),
        fetchText('/stats/nhl/nhl_pk.csv'),
        fetchText('/stats/nhl/nhl_times_shorthanded.csv'),
      ])
    ).map(parseCsv);
    const xgaMap = new Map(xga.map((d) => [d.abbreviation, d.xga60]));
    const gsaxMap = new Map(gsax.map((d) => [d.abbreviation, d.gsax60]));
    const hdcfMap = new Map(hdcf.map((d) => [d.abbreviation, d.hdcf60]));
    const ppMap = new Map(pp.map((d) => [d.abbreviation, d.pp]));
    const pkMap = new Map(pk.map((d) => [d.abbreviation, d.pk]));
    const tsMap = new Map(ts.map((d) => [d.abbreviation, d.times_shorthanded]));
    return xgf.map((t) => ({
      team: t.team as string,
      abbreviation: t.abbreviation as string,
      xgf60: t.xgf60 as number,
      xga60: (xgaMap.get(t.abbreviation) as number) ?? 0,
      gsax60: (gsaxMap.get(t.abbreviation) as number) ?? 0,
      hdcf60: (hdcfMap.get(t.abbreviation) as number) ?? 0,
      pp: (ppMap.get(t.abbreviation) as number) ?? 0,
      pk: (pkMap.get(t.abbreviation) as number) ?? 0,
      timesShorthanded: (tsMap.get(t.abbreviation) as number) ?? 0,
    }));
  })();
  return nhlCache;
}

/** Warm the CSV cache for a sport so the first card click is instant. */
export function preloadSportStats(sport: 'NBA' | 'NFL' | 'NHL'): void {
  if (sport === 'NBA') void loadNbaTeams().catch(() => {});
  else if (sport === 'NFL') void loadNflTeams().catch(() => {});
  else if (sport === 'NHL') void loadNhlTeams().catch(() => {});
}

// ---- spread parsing ---------------------------------------------------------

/**
 * Convert an ESPN spread detail ("SEA -3.5", "LAR -3", "EVEN") into the spread
 * from the HOME team's perspective (negative = home favored), which is exactly
 * what the estimator's point-spread field expects for Team A (= home).
 */
export function homeSpreadFromDetail(
  detail: string | null,
  homeAbbr?: string,
  awayAbbr?: string,
): string {
  if (!detail) return '';
  const d = detail.trim();
  if (/^(even|pk|pick)/i.test(d)) return '0';
  const m = d.match(/([A-Za-z]{2,4})\s*(-?\+?\d+(?:\.\d+)?)/);
  if (!m) return '';
  const favAbbr = normalize(m[1]);
  const num = parseFloat(m[2].replace('+', ''));
  if (Number.isNaN(num)) return '';
  if (homeAbbr && normalize(homeAbbr) === favAbbr) return str(num); // home favored → negative line
  if (awayAbbr && normalize(awayAbbr) === favAbbr) return str(-num); // away favored → home is the dog
  // Fall back to treating the listed line as the home line.
  return str(num);
}

// ---- mappers: team rows → estimator state -----------------------------------

function nbaToBasketball(home: NBATeamRow, away: NBATeamRow): BasketballStatsShape {
  return {
    teamPointsFor: str(home.points_per_game, 1), opponentPointsFor: str(away.points_per_game, 1),
    teamPointsAgainst: str(home.points_allowed, 1), opponentPointsAgainst: str(away.points_allowed, 1),
    teamFgPct: str(home.field_goal_pct, 1), opponentFgPct: str(away.field_goal_pct, 1),
    teamReboundMargin: str(home.rebound_margin, 1), opponentReboundMargin: str(away.rebound_margin, 1),
    teamTurnoverMargin: str(home.turnover_margin, 1), opponentTurnoverMargin: str(away.turnover_margin, 1),
    teamPace: str(home.pace, 1), opponentPace: str(away.pace, 1),
    team3PRate: str(home.three_rate, 1), opponent3PRate: str(away.three_rate, 1),
    team3PPct: str(home.three_pct, 1), opponent3PPct: str(away.three_pct, 1),
    teamAName: home.abbreviation, teamBName: away.abbreviation,
  };
}

function nflToFootball(home: NFLTeamRow, away: NFLTeamRow): FootballStatsShape {
  return {
    teamPointsFor: str(home.ppg, 1), opponentPointsFor: str(away.ppg, 1),
    teamPointsAgainst: str(home.allowed, 1), opponentPointsAgainst: str(away.allowed, 1),
    teamOffYards: str(home.off_yards, 1), opponentOffYards: str(away.off_yards, 1),
    teamDefYards: str(home.def_yards, 1), opponentDefYards: str(away.def_yards, 1),
    teamTurnoverDiff: str(home.turnover_diff), opponentTurnoverDiff: str(away.turnover_diff),
    teamAName: home.abbreviation, teamBName: away.abbreviation,
  };
}

function nhlToHockey(home: NHLTeamRow, away: NHLTeamRow): HockeyStatsShape {
  return {
    homeXgf60: str(home.xgf60, 2), homeXga60: str(home.xga60, 2), homeGsax60: str(home.gsax60, 2), homeHdcf60: str(home.hdcf60, 1),
    homePP: str(home.pp, 1), homePK: str(home.pk, 1), homeTimesShorthanded: str(home.timesShorthanded, 1),
    awayXgf60: str(away.xgf60, 2), awayXga60: str(away.xga60, 2), awayGsax60: str(away.gsax60, 2), awayHdcf60: str(away.hdcf60, 1),
    awayPP: str(away.pp, 1), awayPK: str(away.pk, 1), awayTimesShorthanded: str(away.timesShorthanded, 1),
    teamAName: home.abbreviation, teamBName: away.abbreviation,
  };
}

// ---- public builders --------------------------------------------------------

export class TeamsNotFoundError extends Error {
  constructor(public missing: string[]) {
    super(`Couldn't find stats for ${missing.join(' and ')}`);
    this.name = 'TeamsNotFoundError';
  }
}

/**
 * Build the estimator payload for an NBA/NFL/NHL daily game. Loads (cached) the
 * sport's team stats and maps the two teams. Throws TeamsNotFoundError if a team
 * can't be matched so the caller can surface a helpful message.
 */
export async function buildGenericSelection(
  sport: 'NBA' | 'NFL' | 'NHL',
  game: GenericGameLike,
): Promise<DailyGameSelection> {
  if (sport === 'NBA') {
    const rows = await loadNbaTeams();
    const home = findTeam(rows, game.homeTeam, game.homeAbbr);
    const away = findTeam(rows, game.awayTeam, game.awayAbbr);
    assertFound(home, away, game);
    return {
      sport: 'NBA',
      basketball: nbaToBasketball(home!, away!),
      spread: homeSpreadFromDetail(game.spread, game.homeAbbr, game.awayAbbr),
      isTeamAHome: true,
    };
  }
  if (sport === 'NFL') {
    const rows = await loadNflTeams();
    const home = findTeam(rows, game.homeTeam, game.homeAbbr);
    const away = findTeam(rows, game.awayTeam, game.awayAbbr);
    assertFound(home, away, game);
    return {
      sport: 'NFL',
      football: nflToFootball(home!, away!),
      spread: homeSpreadFromDetail(game.spread, game.homeAbbr, game.awayAbbr),
      isTeamAHome: true,
    };
  }
  // NHL
  const rows = await loadNhlTeams();
  const home = findTeam(rows, game.homeTeam, game.homeAbbr);
  const away = findTeam(rows, game.awayTeam, game.awayAbbr);
  assertFound(home, away, game);
  return {
    sport: 'NHL',
    hockey: nhlToHockey(home!, away!),
    totalGoalsLine: game.overUnder !== null ? str(game.overUnder) : '',
  };
}

function assertFound(home: unknown, away: unknown, game: GenericGameLike): void {
  const missing: string[] = [];
  if (!home) missing.push(game.homeTeam);
  if (!away) missing.push(game.awayTeam);
  if (missing.length) throw new TeamsNotFoundError(missing);
}

/**
 * Flatten an MLB daily game's projection input into the MLBEstimator's flat
 * field state. Carries every metric the live feed provides — book total,
 * offense (wRC+/wOBA/OPS/R-G), starter (SIERA/xFIP/FIP/ERA + confirmed),
 * bullpen (quality + recent usage), ballpark, weather and lineup — so the
 * estimator reproduces the card's projection and the user can refine it.
 */
export function mlbInputToFields(game: MLBGameLike): MLBFieldState {
  const input = game.input;
  const total = input.line?.total ?? game.bookTotal ?? undefined;
  const fields: MLBFieldState = { windDirection: 'out' };

  const set = (key: string, value: string) => {
    if (value !== '') fields[key] = value;
  };
  const yesNo = (v: boolean | undefined): string => (v === undefined ? '' : v ? 'yes' : 'no');

  const home = input.home;
  const away = input.away;

  set('homeName', home?.name || game.homeTeam || '');
  set('awayName', away?.name || game.awayTeam || '');
  set('bookTotal', str(total));

  set('homeWrc', str(home?.offense?.wrcPlus));
  set('awayWrc', str(away?.offense?.wrcPlus));
  set('homeWoba', str(home?.offense?.woba, 3));
  set('awayWoba', str(away?.offense?.woba, 3));
  set('homeOps', str(home?.offense?.ops, 3));
  set('awayOps', str(away?.offense?.ops, 3));
  set('homeRecentRpg', str(home?.offense?.recentRunsPerGame ?? home?.offense?.runsPerGame, 2));
  set('awayRecentRpg', str(away?.offense?.recentRunsPerGame ?? away?.offense?.runsPerGame, 2));

  set('homeEra', str(home?.starter?.era, 2));
  set('awayEra', str(away?.starter?.era, 2));
  set('homeSierra', str(home?.starter?.siera, 2));
  set('awaySierra', str(away?.starter?.siera, 2));
  set('homeFip', str(home?.starter?.fip, 2));
  set('awayFip', str(away?.starter?.fip, 2));
  set('homeXfip', str(home?.starter?.xfip, 2));
  set('awayXfip', str(away?.starter?.xfip, 2));
  set('homeStarterConfirmed', yesNo(home?.starter?.confirmed));
  set('awayStarterConfirmed', yesNo(away?.starter?.confirmed));

  set('homeBpFip', str(home?.bullpen?.fip, 2));
  set('awayBpFip', str(away?.bullpen?.fip, 2));
  set('homeBpEra', str(home?.bullpen?.era, 2));
  set('awayBpEra', str(away?.bullpen?.era, 2));
  set('homeBpWhip', str(home?.bullpen?.whip, 2));
  set('awayBpWhip', str(away?.bullpen?.whip, 2));
  set('homeBpIp1', str(home?.bullpen?.inningsLast1d, 1));
  set('awayBpIp1', str(away?.bullpen?.inningsLast1d, 1));
  set('homeBpIp3', str(home?.bullpen?.inningsLast3d, 1));
  set('awayBpIp3', str(away?.bullpen?.inningsLast3d, 1));
  set('homeCloser', yesNo(home?.bullpen?.closerAvailable));
  set('awayCloser', yesNo(away?.bullpen?.closerAvailable));

  set('homeLineupConfirmed', yesNo(home?.lineup?.confirmed));
  set('awayLineupConfirmed', yesNo(away?.lineup?.confirmed));
  set('homeStarsOut', str(home?.lineup?.starsOut));
  set('awayStarsOut', str(away?.lineup?.starsOut));

  const env = input.environment;
  set('parkFactor', str(env?.parkFactor));
  set('temperatureF', str(env?.temperatureF, 0));
  set('windSpeedMph', str(env?.windSpeedMph, 0));
  if (env?.windDirection) fields.windDirection = env.windDirection;
  set('roofClosed', yesNo(env?.roofClosed));

  return fields;
}
