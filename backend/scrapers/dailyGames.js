// backend/scrapers/dailyGames.js
// =============================================================================
// Today's games + betting lines for NBA / NFL / NHL / MLB from ESPN's free
// scoreboard API. The backend proxies these because browsers can't call ESPN
// directly (CORS) — same role it already plays for the NBA team endpoints.
//
// This returns the slate (teams, start time, status, score, consensus
// over/under). MLB additionally has a full projection path via mlbStatsApi.js;
// the other sports surface games + lines here and are projected client-side
// where the app has the team stats loaded.
// =============================================================================

const axios = require('axios');

const ESPN_ENDPOINTS = {
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
};
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 12000;

function mapStatus(stateType, detail) {
  const state = (stateType || '').toLowerCase();
  const det = (detail || '').toLowerCase();
  if (state === 'post' || det === 'final' || det.startsWith('f/')) return 'final';
  if (state === 'in' || det.includes('half') || det.includes('qtr') ||
      det.includes('period') || det.includes('inning')) return 'in_progress';
  if (det.includes('postponed') || det.includes('cancelled')) return 'postponed';
  return 'scheduled';
}

function parseScoreboard(data, sport) {
  const games = [];
  for (const event of data?.events ?? []) {
    const competition = event?.competitions?.[0];
    if (!competition) continue;
    const competitors = competition.competitors || [];
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    if (!home || !away) continue;

    const statusType = competition.status?.type?.state || '';
    const statusDetail =
      competition.status?.type?.shortDetail || competition.status?.displayClock || '';
    const rawOU = competition.odds?.[0]?.overUnder;
    const overUnder = rawOU !== undefined && rawOU !== null ? parseFloat(rawOU) : null;
    const spread = competition.odds?.[0]?.details || null;

    games.push({
      gameId: event.id || competition.id,
      sport,
      homeTeam: home.team?.displayName || home.team?.name || 'Unknown',
      homeAbbr: home.team?.abbreviation || '',
      awayTeam: away.team?.displayName || away.team?.name || 'Unknown',
      awayAbbr: away.team?.abbreviation || '',
      startTime: event.date || competition.date || new Date().toISOString(),
      status: mapStatus(statusType, statusDetail),
      statusDetail,
      homeScore: home.score !== undefined ? parseInt(home.score, 10) : null,
      awayScore: away.score !== undefined ? parseInt(away.score, 10) : null,
      overUnder: overUnder !== null && !Number.isNaN(overUnder) ? overUnder : null,
      spread,
    });
  }
  return games;
}

async function fetchScoreboard(sport) {
  try {
    const res = await axios.get(ESPN_ENDPOINTS[sport], { headers: HEADERS, timeout: TIMEOUT });
    return parseScoreboard(res.data, sport);
  } catch (e) {
    console.error(`[dailyGames] ${sport} fetch failed: ${e.message}`);
    return [];
  }
}

/**
 * Fetch today's games for one sport or ALL. Returns
 * { date, sport, count, games: [...] }.
 */
async function fetchDailyGames(sport = 'ALL') {
  const sports = sport === 'ALL' ? ['NBA', 'NFL', 'NHL', 'MLB'] : [sport];
  const results = await Promise.all(sports.map(fetchScoreboard));
  const games = results.flat();
  return {
    date: new Date().toISOString().split('T')[0],
    sport,
    count: games.length,
    games,
  };
}

module.exports = { fetchDailyGames, parseScoreboard, mapStatus };
