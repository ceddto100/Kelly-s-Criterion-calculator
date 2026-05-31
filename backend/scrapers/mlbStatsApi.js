// backend/scrapers/mlbStatsApi.js
// =============================================================================
// MLB daily data for the live "Today's Games" view.
//
// Two free, no-auth sources (browsers can't call these directly due to CORS, so
// the backend proxies them — same role it plays for the NBA ESPN endpoints):
//   - MLB StatsAPI (statsapi.mlb.com): schedule + probable starters (with a real
//     "confirmed" signal), starter season ERA/WHIP, team season OPS + runs/game.
//   - ESPN MLB scoreboard: the consensus over/under total per game.
//
// The output of buildDailyMLBInputs() is an array of objects shaped exactly like
// the frontend's MLBProjectionInput (see frontend/utils/mlbProjection.ts), so the
// browser can feed each straight into projectMLBGame() with no reshaping.
//
// Intentionally partial: StatsAPI carries no FIP/xFIP/SIERA/wRC+/bullpen/park/
// weather, so those fields are left unset and the engine's data-completeness
// logic keeps MLB confidence modest. Games with no ESPN total stay no-bet.
// =============================================================================

const axios = require('axios');

const STATSAPI_BASE = 'https://statsapi.mlb.com/api/v1';
const ESPN_MLB_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 12000;

// --- small helpers -----------------------------------------------------------

function toNum(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

// Normalize a team name for cross-source matching (StatsAPI <-> ESPN).
function normalizeTeamName(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function getJson(url) {
  const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
  return res.data;
}

// --- parsers (pure; mirror mcp-server/src/utils/mlbDataService.ts) ------------

function parseScheduleResponse(data) {
  const games = [];
  for (const date of data?.dates ?? []) {
    for (const g of date?.games ?? []) {
      const homeT = g?.teams?.home;
      const awayT = g?.teams?.away;
      if (!homeT?.team || !awayT?.team) continue;
      const team = (side) => ({
        teamId: side.team.id,
        name: side.team.name || 'Unknown',
        probablePitcherId: side.probablePitcher?.id,
        probablePitcherName: side.probablePitcher?.fullName,
      });
      games.push({
        gamePk: g.gamePk,
        gameDate: g.gameDate || '',
        abstractState: g?.status?.abstractGameState || '',
        venueName: g?.venue?.name,
        home: team(homeT),
        away: team(awayT),
      });
    }
  }
  return games;
}

function parsePitcherStats(data) {
  const person = data?.people?.[0];
  const pitchingGroup = (person?.stats ?? []).find(
    (s) => s?.group?.displayName === 'pitching'
  );
  const stat = pitchingGroup?.splits?.[0]?.stat ?? {};
  return { era: toNum(stat.era), whip: toNum(stat.whip) };
}

function parseTeamOffense(data) {
  const teamObj = data?.teams?.[0];
  const hittingGroup = (teamObj?.stats ?? []).find(
    (s) => s?.group?.displayName === 'hitting'
  );
  const stat = hittingGroup?.splits?.[0]?.stat ?? {};
  const runs = toNum(stat.runs);
  const games = toNum(stat.gamesPlayed);
  const runsPerGame = runs !== undefined && games && games > 0 ? runs / games : undefined;
  return { ops: toNum(stat.ops), runsPerGame };
}

function parseESPNMLBTotals(data) {
  const byTeam = new Map();
  for (const event of data?.events ?? []) {
    const competition = event?.competitions?.[0];
    if (!competition) continue;
    const total = toNum(competition.odds?.[0]?.overUnder);
    if (total === undefined) continue;
    for (const c of competition.competitors ?? []) {
      const name = c?.team?.displayName || c?.team?.name;
      if (name) byTeam.set(normalizeTeamName(name), total);
    }
  }
  return byTeam;
}

function lookupBookTotal(game, totals) {
  return (
    totals.get(normalizeTeamName(game.home.name)) ??
    totals.get(normalizeTeamName(game.away.name))
  );
}

// --- assemble an MLBProjectionInput (matches the frontend type) --------------

function buildProjectionInput(game, offense, starters, bookTotal) {
  const team = (g, off, sp) => ({
    name: g.name,
    offense: { ops: off.ops, runsPerGame: off.runsPerGame },
    starter: { era: sp ? sp.era : undefined, confirmed: g.probablePitcherId !== undefined },
    bullpen: {},
  });
  return {
    home: team(game.home, offense.home, starters.home),
    away: team(game.away, offense.away, starters.away),
    line: bookTotal !== undefined ? { total: bookTotal } : {},
  };
}

// --- fetchers ----------------------------------------------------------------

async function fetchSchedule() {
  const data = await getJson(
    `${STATSAPI_BASE}/schedule?sportId=1&hydrate=probablePitcher,venue`
  );
  return parseScheduleResponse(data);
}

async function fetchPitcherStats(pitcherId, season) {
  try {
    const data = await getJson(
      `${STATSAPI_BASE}/people/${pitcherId}?hydrate=stats(group=[pitching],type=[season],season=${season})`
    );
    return parsePitcherStats(data);
  } catch (e) {
    return null;
  }
}

async function fetchTeamOffense(teamId, season) {
  try {
    const data = await getJson(
      `${STATSAPI_BASE}/teams/${teamId}?hydrate=stats(group=[hitting],type=[season],season=${season})`
    );
    return parseTeamOffense(data);
  } catch (e) {
    return {};
  }
}

async function fetchTotals() {
  try {
    const data = await getJson(ESPN_MLB_SCOREBOARD);
    return parseESPNMLBTotals(data);
  } catch (e) {
    return new Map();
  }
}

/**
 * Build the full slate of today's upcoming MLB games as ready-to-project inputs.
 * Returns: { date, season, count, games: [{ gamePk, matchup, venue, startTime,
 *            probableStarters, bookTotal, input }] }
 */
async function buildDailyMLBInputs() {
  const season = new Date().getUTCFullYear();
  const [schedule, totals] = await Promise.all([fetchSchedule(), fetchTotals()]);
  const upcoming = schedule.filter((g) => g.abstractState === 'Preview');

  const offenseCache = new Map();
  const getOffense = async (teamId) => {
    if (offenseCache.has(teamId)) return offenseCache.get(teamId);
    const off = await fetchTeamOffense(teamId, season);
    offenseCache.set(teamId, off);
    return off;
  };

  const games = [];
  for (const game of upcoming) {
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
    const bookTotal = lookupBookTotal(game, totals);
    const input = buildProjectionInput(
      game,
      { home: homeOff, away: awayOff },
      { home: homeSp, away: awaySp },
      bookTotal
    );
    games.push({
      gamePk: game.gamePk,
      matchup: `${game.away.name} @ ${game.home.name}`,
      homeTeam: game.home.name,
      awayTeam: game.away.name,
      venue: game.venueName,
      startTime: game.gameDate,
      probableStarters: {
        home: game.home.probablePitcherName || null,
        away: game.away.probablePitcherName || null,
      },
      bookTotal: bookTotal !== undefined ? bookTotal : null,
      input,
    });
  }

  return {
    date: new Date().toISOString().split('T')[0],
    season,
    count: games.length,
    games,
  };
}

module.exports = {
  buildDailyMLBInputs,
  // exported for tests
  parseScheduleResponse,
  parsePitcherStats,
  parseTeamOffense,
  parseESPNMLBTotals,
  lookupBookTotal,
  buildProjectionInput,
  normalizeTeamName,
  toNum,
};
