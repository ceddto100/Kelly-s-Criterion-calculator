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
  // Only used to grade logged bets (not shown in the Games tab).
  CFB: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80&limit=300',
  CBB: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50&limit=400',
  WNBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard',
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

function toNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Turn ESPN's spread text ("BOS -5.5", "EVEN", "PK") into the HOME team's
 * spread (negative = home favored). Returns null when it can't be read.
 */
function parseHomeSpread(details, homeAbbr, awayAbbr, odds) {
  const text = (details || '').trim();
  if (!text) return null;
  if (/^(even|pk|pick|pick'?em)$/i.test(text)) return 0;
  const m = text.match(/^(.+?)\s*([+-]?\d+(?:\.\d+)?)$/);
  if (m) {
    const abbr = m[1].trim().toUpperCase();
    const num = parseFloat(m[2]);
    if (homeAbbr && abbr === homeAbbr.toUpperCase()) return num;
    if (awayAbbr && abbr === awayAbbr.toUpperCase()) return -num;
    // Abbreviation didn't match — fall back to ESPN's favorite flags.
    if (odds?.homeTeamOdds?.favorite) return -Math.abs(num);
    if (odds?.awayTeamOdds?.favorite) return Math.abs(num);
  }
  return null;
}

/** Pull { spread, overUnder, homeSpread } out of one ESPN odds/pickcenter entry. */
function extractLine(odds, homeAbbr, awayAbbr) {
  if (!odds) return { spread: null, overUnder: null, homeSpread: null, isMoneyline: false };
  const spread = odds.details || null;
  let homeSpread = parseHomeSpread(spread, homeAbbr, awayAbbr, odds);
  // NHL/MLB "details" is often a moneyline ("SJ -125"), not a point spread.
  const isMoneyline = homeSpread !== null && Math.abs(homeSpread) >= 100;
  if (isMoneyline) homeSpread = null;
  return { spread, overUnder: toNum(odds.overUnder), homeSpread, isMoneyline };
}

function hasLine(g) {
  return g.spread !== null || g.overUnder !== null;
}

/**
 * Grade a live or final game against its pre-game line. For live games this is
 * "as of now"; the frontend labels it that way.
 */
function gradeGame(g) {
  if (g.homeScore === null || g.awayScore === null) return { atsResult: null, totalResult: null };
  if (g.status !== 'final' && g.status !== 'in_progress') return { atsResult: null, totalResult: null };
  let atsResult = null;
  if (g.homeSpread !== null && g.homeSpread !== undefined) {
    const m = g.homeScore + g.homeSpread - g.awayScore;
    atsResult = m > 0 ? 'home' : m < 0 ? 'away' : 'push';
  }
  let totalResult = null;
  if (g.overUnder !== null && g.overUnder !== undefined) {
    const t = g.homeScore + g.awayScore;
    totalResult = t > g.overUnder ? 'over' : t < g.overUnder ? 'under' : 'push';
  }
  return { atsResult, totalResult };
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
    const line = extractLine(competition.odds?.[0], home.team?.abbreviation, away.team?.abbreviation);

    games.push({
      gameId: event.id || competition.id,
      sport,
      homeTeam: home.team?.displayName || home.team?.name || 'Unknown',
      homeAbbr: home.team?.abbreviation || '',
      homeShort: home.team?.shortDisplayName || home.team?.name || '',
      awayTeam: away.team?.displayName || away.team?.name || 'Unknown',
      awayAbbr: away.team?.abbreviation || '',
      awayShort: away.team?.shortDisplayName || away.team?.name || '',
      startTime: event.date || competition.date || new Date().toISOString(),
      status: mapStatus(statusType, statusDetail),
      statusDetail,
      homeScore: home.score !== undefined ? parseInt(home.score, 10) : null,
      awayScore: away.score !== undefined ? parseInt(away.score, 10) : null,
      overUnder: line.overUnder,
      spread: line.spread,
      homeSpread: line.homeSpread,
      isMoneyline: line.isMoneyline,
    });
  }
  return games;
}

// Short in-memory cache so the Bets tab polling live scores doesn't hammer ESPN.
const cache = new Map(); // key -> { at, games }
const CACHE_MS = 30 * 1000;

/**
 * Fetch one sport's scoreboard. `date` is an optional ESPN calendar day
 * (YYYYMMDD, US/Eastern); omitted = ESPN's "today".
 */
async function fetchScoreboard(sport, date) {
  const key = `${sport}:${date || 'today'}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.games;
  try {
    const url = ESPN_ENDPOINTS[sport];
    if (!url) return [];
    const full = date ? `${url}${url.includes('?') ? '&' : '?'}dates=${date}` : url;
    const res = await axios.get(full, { headers: HEADERS, timeout: TIMEOUT });
    const games = parseScoreboard(res.data, sport);
    rememberLines(games);
    cache.set(key, { at: Date.now(), games });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return games;
  } catch (e) {
    console.error(`[dailyGames] ${sport} ${date || ''} fetch failed: ${e.message}`);
    return [];
  }
}

// ---- pre-game line recovery -------------------------------------------------
// ESPN drops the `odds` block from the scoreboard once a game starts, so live
// and finished games would show no line. We remember every line we see while a
// game is still scheduled, and for anything we missed we pull the pre-game line
// from the game's summary (`pickcenter`), which keeps it after kickoff.

const lineMemory = new Map(); // gameId -> { spread, overUnder, homeSpread }
const summaryCache = new Map(); // gameId -> { at, line|null }
const SUMMARY_MISS_MS = 5 * 60 * 1000;

function rememberLines(games) {
  for (const g of games) {
    if (hasLine(g) && g.status === 'scheduled') {
      lineMemory.set(g.gameId, {
        spread: g.spread, overUnder: g.overUnder, homeSpread: g.homeSpread, isMoneyline: g.isMoneyline,
      });
    }
  }
  while (lineMemory.size > 2000) lineMemory.delete(lineMemory.keys().next().value);
}

function summaryUrl(sport, gameId) {
  const base = ESPN_ENDPOINTS[sport];
  if (!base) return null;
  return `${base.split('?')[0].replace(/\/scoreboard$/, '/summary')}?event=${gameId}`;
}

async function fetchPregameLine(game) {
  const hit = summaryCache.get(game.gameId);
  if (hit && (hit.line || Date.now() - hit.at < SUMMARY_MISS_MS)) return hit.line;
  const url = summaryUrl(game.sport, game.gameId);
  if (!url) return null;
  let line = null;
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
    const entries = [...(res.data?.pickcenter || []), ...(res.data?.odds || [])];
    for (const o of entries) {
      const l = extractLine(o, game.homeAbbr, game.awayAbbr);
      if (hasLine(l)) { line = l; break; }
    }
  } catch (e) {
    console.error(`[dailyGames] ${game.sport} summary ${game.gameId} failed: ${e.message}`);
  }
  summaryCache.set(game.gameId, { at: Date.now(), line });
  if (summaryCache.size > 2000) summaryCache.delete(summaryCache.keys().next().value);
  return line;
}

/** Fill in missing pre-game lines and grade live/final games against them. */
async function withPregameLines(games) {
  return Promise.all(games.map(async (game) => {
    let g = { ...game, lineSource: hasLine(game) ? 'live' : null };
    if (!hasLine(g) && g.status !== 'scheduled') {
      const line = lineMemory.get(g.gameId) || (await fetchPregameLine(g));
      if (line) g = { ...g, ...line, lineSource: 'pregame' };
    } else if (hasLine(g) && g.status !== 'scheduled') {
      // Scoreboard still has odds mid-game — those can be live lines, so prefer
      // the remembered pre-game line when we have it.
      const line = lineMemory.get(g.gameId);
      if (line) g = { ...g, ...line, lineSource: 'pregame' };
    }
    return { ...g, ...gradeGame(g) };
  }));
}

/**
 * Fetch today's games for one sport or ALL. Returns
 * { date, sport, count, games: [...] }.
 */
async function fetchDailyGames(sport = 'ALL') {
  const sports = sport === 'ALL' ? ['NBA', 'NFL', 'NHL', 'MLB'] : [sport];
  const results = await Promise.all(sports.map((s) => fetchScoreboard(s)));
  const games = await withPregameLines(results.flat());
  return {
    date: new Date().toISOString().split('T')[0],
    sport,
    count: games.length,
    games,
  };
}

module.exports = {
  fetchDailyGames,
  fetchScoreboard,
  parseScoreboard,
  mapStatus,
  parseHomeSpread,
  gradeGame,
  withPregameLines,
  ESPN_ENDPOINTS,
};
