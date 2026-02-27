/**
 * Games of the Day Tool
 *
 * Fetches today's scheduled games from ESPN's free public scoreboard API.
 * Returns structured game data for NBA, NFL, and NHL.
 *
 * ESPN Scoreboard API (free, no auth required):
 *   NBA: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard
 *   NFL: https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard
 *   NHL: https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard
 *
 * By default ESPN returns today's games. Defaults to today's date.
 *
 * TOOL: get_todays_games
 * Returns a list of today's games for the requested sport(s).
 */

import { z } from 'zod';

// ============================================================================
// TYPES
// ============================================================================

export interface DailyGame {
  gameId: string;
  sport: 'NBA' | 'NFL' | 'NHL';
  homeTeam: string;
  homeAbbr: string;
  awayTeam: string;
  awayAbbr: string;
  startTime: string;       // ISO 8601
  status: 'scheduled' | 'in_progress' | 'final' | 'postponed';
  homeScore?: number;
  awayScore?: number;
}

export interface TodaysGamesResult {
  success: boolean;
  date: string;
  sport: string;
  games: DailyGame[];
  total: number;
  error?: string;
}

// ============================================================================
// ESPN SPORT CONFIG
// ============================================================================

const ESPN_ENDPOINTS: Record<'NBA' | 'NFL' | 'NHL', string> = {
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
};

const ESPN_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };

// ============================================================================
// FETCH
// ============================================================================

async function fetchScoreboard(sport: 'NBA' | 'NFL' | 'NHL'): Promise<unknown> {
  const url = ESPN_ENDPOINTS[sport];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { headers: ESPN_HEADERS, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[GamesOfDay] Failed to fetch ${sport} scoreboard: ${message}`);
    return null;
  }
}

// ============================================================================
// PARSE
// ============================================================================

function mapStatus(stateType: string, detail: string): DailyGame['status'] {
  const state = (stateType || '').toLowerCase();
  const det = (detail || '').toLowerCase();
  if (state === 'post' || det === 'final' || det === 'f/ot' || det === 'f/so') return 'final';
  if (state === 'in' || det.includes('half') || det.includes('qtr') || det.includes('period')) return 'in_progress';
  if (det.includes('postponed') || det.includes('cancelled')) return 'postponed';
  return 'scheduled';
}

function parseESPNScoreboard(data: unknown, sport: 'NBA' | 'NFL' | 'NHL'): DailyGame[] {
  const d = data as any;
  const events = d?.events || [];
  const games: DailyGame[] = [];

  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;

    const competitors = competition.competitors || [];
    const home = competitors.find((c: any) => c.homeAway === 'home');
    const away = competitors.find((c: any) => c.homeAway === 'away');
    if (!home || !away) continue;

    const statusType = competition.status?.type?.state || '';
    const statusDetail = competition.status?.type?.shortDetail || competition.status?.displayClock || '';

    const homeScore = home.score !== undefined ? parseFloat(home.score) : undefined;
    const awayScore = away.score !== undefined ? parseFloat(away.score) : undefined;

    games.push({
      gameId: event.id || competition.id,
      sport,
      homeTeam: home.team?.displayName || home.team?.name || 'Unknown',
      homeAbbr: home.team?.abbreviation || '',
      awayTeam: away.team?.displayName || away.team?.name || 'Unknown',
      awayAbbr: away.team?.abbreviation || '',
      startTime: event.date || competition.date || new Date().toISOString(),
      status: mapStatus(statusType, statusDetail),
      homeScore: isNaN(homeScore as number) ? undefined : homeScore,
      awayScore: isNaN(awayScore as number) ? undefined : awayScore,
    });
  }

  return games;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export async function getTodaysGames(sport: 'NBA' | 'NFL' | 'NHL' | 'ALL' = 'ALL'): Promise<DailyGame[]> {
  const sportsToFetch: Array<'NBA' | 'NFL' | 'NHL'> =
    sport === 'ALL' ? ['NBA', 'NFL', 'NHL'] : [sport];

  const results = await Promise.all(
    sportsToFetch.map(async (s) => {
      const data = await fetchScoreboard(s);
      if (!data) return [];
      return parseESPNScoreboard(data, s);
    })
  );

  return results.flat();
}

// ============================================================================
// MCP TOOL
// ============================================================================

export const getTodaysGamesToolDefinition = {
  name: 'get_todays_games',
  description: 'Fetch today\'s scheduled games from ESPN for NBA, NFL, and/or NHL. Returns game details including teams, start times, and current status. Use this before running daily calculations to see what games are available.',
};

export const getTodaysGamesInputSchema = z.object({
  sport: z
    .enum(['NBA', 'NFL', 'NHL', 'ALL'])
    .default('ALL')
    .describe('Which sport to fetch games for. Defaults to ALL sports.'),
  statusFilter: z
    .enum(['all', 'scheduled', 'in_progress', 'final'])
    .default('all')
    .describe('Filter games by status. Defaults to all statuses.'),
});

export async function handleGetTodaysGames(
  params: z.infer<typeof getTodaysGamesInputSchema>
): Promise<TodaysGamesResult> {
  const sport = (params.sport || 'ALL') as 'NBA' | 'NFL' | 'NHL' | 'ALL';
  const statusFilter = params.statusFilter || 'all';

  try {
    let games = await getTodaysGames(sport);

    if (statusFilter !== 'all') {
      games = games.filter((g) => g.status === statusFilter);
    }

    const today = new Date().toISOString().split('T')[0];

    return {
      success: true,
      date: today,
      sport,
      games,
      total: games.length,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      date: new Date().toISOString().split('T')[0],
      sport,
      games: [],
      total: 0,
      error,
    };
  }
}
