/**
 * MLB Data Service — live inputs for the MLB projection engine.
 * =============================================================
 * Pulls from MLB StatsAPI (https://statsapi.mlb.com, free, no auth):
 *   - today's schedule + probable starters (with a real "confirmed" signal)
 *   - starter season ERA/WHIP
 *   - team season OPS + runs/game (offense)
 *
 * WHAT THIS DOES NOT PROVIDE (and why MLB auto-confidence is intentionally low):
 *   StatsAPI is the official box-score feed. It does NOT expose the FanGraphs-
 *   derived metrics the engine prefers — FIP / xFIP / SIERA / wRC+ / wOBA — nor
 *   bullpen-only splits, park factors, or weather. We populate the real signals
 *   (probable pitcher + ERA, team OPS/RPG) and leave the premium ones unset.
 *   The engine already handles missing inputs by reducing data-completeness and
 *   confidence, so MLB projections will frequently come back no-bet. That is the
 *   correct, honest outcome: we should not bet MLB confidently on box-score data
 *   alone. Wiring in a FanGraphs (or similar) source later is the documented
 *   upgrade path that raises confidence — not more code here.
 *
 * Network note: the parsing/mapping functions are pure and unit-tested against
 * fixtures. The fetch wrappers depend on the StatsAPI JSON shape and can only be
 * verified against the live API at runtime (the build sandbox blocks egress).
 */

import type { MLBProjectionInput, MLBTeamInput } from './mlb.js';

export const MLB_STATSAPI_BASE = 'https://statsapi.mlb.com/api/v1';

// ---------------------------------------------------------------------------
// Parsed shapes
// ---------------------------------------------------------------------------

export interface MLBScheduleTeam {
  teamId: number;
  name: string;
  probablePitcherId?: number;
  probablePitcherName?: string;
}

export interface MLBScheduleGame {
  gamePk: number;
  gameDate: string;
  detailedState: string;
  abstractState: string; // 'Preview' | 'Live' | 'Final'
  venueName?: string;
  home: MLBScheduleTeam;
  away: MLBScheduleTeam;
}

export interface PitcherSeasonStats {
  era?: number;
  whip?: number;
}

export interface TeamSeasonOffense {
  ops?: number;
  runsPerGame?: number;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** StatsAPI returns many numeric stats as strings (e.g. "3.41"). Coerce safely. */
export function toNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[MLBData] Fetch failed for ${url}: ${message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pure parsers (unit-tested against fixtures)
// ---------------------------------------------------------------------------

/** Parse the /schedule response (hydrated with probablePitcher) into games. */
export function parseScheduleResponse(json: unknown): MLBScheduleGame[] {
  const data = json as any;
  const games: MLBScheduleGame[] = [];
  const dates = data?.dates ?? [];

  for (const date of dates) {
    for (const g of date?.games ?? []) {
      const homeT = g?.teams?.home;
      const awayT = g?.teams?.away;
      if (!homeT?.team || !awayT?.team) continue;

      const team = (side: any): MLBScheduleTeam => ({
        teamId: side.team.id,
        name: side.team.name || 'Unknown',
        probablePitcherId: side.probablePitcher?.id,
        probablePitcherName: side.probablePitcher?.fullName,
      });

      games.push({
        gamePk: g.gamePk,
        gameDate: g.gameDate || '',
        detailedState: g?.status?.detailedState || '',
        abstractState: g?.status?.abstractGameState || '',
        venueName: g?.venue?.name,
        home: team(homeT),
        away: team(awayT),
      });
    }
  }
  return games;
}

/** Parse a /people?hydrate=stats(group=pitching) response into ERA/WHIP. */
export function parsePitcherStats(json: unknown): PitcherSeasonStats {
  const data = json as any;
  const person = data?.people?.[0];
  const pitchingGroup = (person?.stats ?? []).find(
    (s: any) => s?.group?.displayName === 'pitching'
  );
  const stat = pitchingGroup?.splits?.[0]?.stat ?? {};
  return { era: toNum(stat.era), whip: toNum(stat.whip) };
}

/** Parse a /teams/{id}?hydrate=stats(group=hitting) response into offense. */
export function parseTeamOffense(json: unknown): TeamSeasonOffense {
  const data = json as any;
  const teamObj = data?.teams?.[0];
  const hittingGroup = (teamObj?.stats ?? []).find(
    (s: any) => s?.group?.displayName === 'hitting'
  );
  const stat = hittingGroup?.splits?.[0]?.stat ?? {};
  const runs = toNum(stat.runs);
  const games = toNum(stat.gamesPlayed);
  const runsPerGame = runs !== undefined && games && games > 0 ? runs / games : undefined;
  return { ops: toNum(stat.ops), runsPerGame };
}

/**
 * Assemble the engine input from the real signals we have. Premium inputs
 * (FIP/xFIP/SIERA/wRC+/wOBA, bullpen, park, weather) are intentionally left
 * unset so the engine reflects the true data quality. `confirmed` is true only
 * when StatsAPI actually named a probable starter.
 */
export function buildMLBProjectionInput(
  game: MLBScheduleGame,
  offense: { home: TeamSeasonOffense; away: TeamSeasonOffense },
  starters: { home: PitcherSeasonStats | null; away: PitcherSeasonStats | null }
): MLBProjectionInput {
  const team = (
    g: MLBScheduleTeam,
    off: TeamSeasonOffense,
    sp: PitcherSeasonStats | null
  ): MLBTeamInput => ({
    name: g.name,
    offense: { ops: off.ops, runsPerGame: off.runsPerGame },
    starter: { era: sp?.era, confirmed: g.probablePitcherId !== undefined },
    bullpen: {}, // not available from StatsAPI box-score feed
  });

  return {
    home: team(game.home, offense.home, starters.home),
    away: team(game.away, offense.away, starters.away),
    // No park/weather from this source — engine treats as neutral, lowers confidence.
    line: {},
  };
}

// ---------------------------------------------------------------------------
// Network wrappers (runtime-verified, not sandbox-verified)
// ---------------------------------------------------------------------------

/** Fetch today's (or a given date's) MLB schedule with probable starters. */
export async function fetchMLBSchedule(date?: string): Promise<MLBScheduleGame[]> {
  const dateParam = date ? `&date=${date}` : '';
  const url = `${MLB_STATSAPI_BASE}/schedule?sportId=1&hydrate=probablePitcher,venue${dateParam}`;
  const json = await fetchJson(url);
  if (!json) return [];
  return parseScheduleResponse(json);
}

export async function fetchPitcherStats(
  pitcherId: number,
  season: number
): Promise<PitcherSeasonStats | null> {
  const url = `${MLB_STATSAPI_BASE}/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`;
  const json = await fetchJson(url);
  if (!json) return null;
  return parsePitcherStats(json);
}

export async function fetchTeamOffense(
  teamId: number,
  season: number
): Promise<TeamSeasonOffense> {
  const url = `${MLB_STATSAPI_BASE}/teams/${teamId}?hydrate=stats(group=[hitting],type=[season],season=${season})`;
  const json = await fetchJson(url);
  if (!json) return {};
  return parseTeamOffense(json);
}

/**
 * Fetch everything needed to project one game and assemble the engine input.
 * Caches per-team offense within a slate via the provided map to avoid
 * refetching teams that appear more than once.
 */
export async function fetchMLBGameInputs(
  game: MLBScheduleGame,
  season: number,
  offenseCache: Map<number, TeamSeasonOffense>
): Promise<MLBProjectionInput> {
  const getOffense = async (teamId: number): Promise<TeamSeasonOffense> => {
    const cached = offenseCache.get(teamId);
    if (cached) return cached;
    const off = await fetchTeamOffense(teamId, season);
    offenseCache.set(teamId, off);
    return off;
  };

  const [homeOff, awayOff] = await Promise.all([
    getOffense(game.home.teamId),
    getOffense(game.away.teamId),
  ]);

  const [homeSp, awaySp] = await Promise.all([
    game.home.probablePitcherId
      ? fetchPitcherStats(game.home.probablePitcherId, season)
      : Promise.resolve(null),
    game.away.probablePitcherId
      ? fetchPitcherStats(game.away.probablePitcherId, season)
      : Promise.resolve(null),
  ]);

  return buildMLBProjectionInput(
    game,
    { home: homeOff, away: awayOff },
    { home: homeSp, away: awaySp }
  );
}
