// backend/utils/betGrading.js
// =============================================================================
// Live scores + automatic grading for logged bets.
//
// For each pending bet we look up the game on ESPN's scoreboard (same source
// as the Games tab), report its live status/score, and — once ESPN says the
// game is FINAL — grade the bet as win / loss / push from the final score.
//
// Conventions (match the Bets UI):
//   - teamA is the side the bet is about (spread/moneyline pick, or "home" for
//     totals); teamB is the opponent.
//   - Spread: estimation.pointSpread is teamA's line (-3.5 = teamA favored).
//   - Total:  estimation.pointSpread is the total line; totalSide is over/under.
// =============================================================================

const { fetchScoreboard } = require('../scrapers/dailyGames');

// Bet sport -> ESPN scoreboards to search (legacy generic values try both).
const SPORT_LEAGUES = {
  nfl: ['NFL'], football: ['NFL', 'CFB'], cfb: ['CFB'],
  nba: ['NBA'], basketball: ['NBA', 'CBB'], wnba: ['WNBA'], cbb: ['CBB'],
  mlb: ['MLB'], baseball: ['MLB'],
  nhl: ['NHL'], hockey: ['NHL'],
};
// Weekly sports: a bet can be logged several days before kickoff.
const WEEKLY = new Set(['NFL', 'CFB']);
const DAY_MS = 24 * 60 * 60 * 1000;
// A game that started more than this long before the bet was logged is a
// previous game (e.g. last night's game in an MLB series), not this bet's.
const LIVE_BET_GRACE_MS = 4 * 60 * 60 * 1000;
// Don't keep searching for bets that never matched a game.
const MAX_PENDING_AGE_MS = 30 * DAY_MS;

const TOTALS_SPORTS = new Set(['hockey', 'nhl']);
const resolveBetType = (bet) =>
  bet.estimation?.betType || (TOTALS_SPORTS.has(bet.matchup?.sport) ? 'total' : 'spread');

// ---- team matching ----------------------------------------------------------

const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const compact = (s) => norm(s).replace(/ /g, '');

/**
 * Does a team the user logged ("Edmonton Oilers", "Oilers", "EDM") refer to
 * this side of an ESPN game?
 */
function teamMatches(betTeam, name, abbr, short) {
  const candidates = [betTeam?.name, betTeam?.abbreviation].filter(Boolean);
  const full = norm(name);
  const fullTokens = full.split(' ');
  for (const raw of candidates) {
    const c = norm(raw);
    if (!c) continue;
    if (abbr && compact(raw) === compact(abbr)) return true;
    if (c === full || compact(raw) === compact(name)) return true;
    if (short && c === norm(short)) return true;
    // Every word the user typed is a word of the team name ("rangers" in
    // "new york rangers"); ignore 1–2 letter fragments.
    const tokens = c.split(' ');
    if (c.length >= 3 && tokens.every((t) => fullTokens.includes(t))) {
      // A bare city ("New York", "Los Angeles") is ambiguous — require the
      // nickname to be among the words.
      if (tokens.includes(fullTokens[fullTokens.length - 1])) return true;
    }
  }
  return false;
}

/**
 * Map a game onto the bet's teamA/teamB, or null if the teams don't match.
 * Returns { game, scoreA, scoreB, teamAIsHome }.
 */
function orientGame(bet, game) {
  const A = bet.matchup?.teamA;
  const B = bet.matchup?.teamB;
  const aHome = teamMatches(A, game.homeTeam, game.homeAbbr, game.homeShort);
  const aAway = teamMatches(A, game.awayTeam, game.awayAbbr, game.awayShort);
  const bHome = teamMatches(B, game.homeTeam, game.homeAbbr, game.homeShort);
  const bAway = teamMatches(B, game.awayTeam, game.awayAbbr, game.awayShort);
  if (aHome && bAway) return { game, scoreA: game.homeScore, scoreB: game.awayScore, teamAIsHome: true };
  if (aAway && bHome) return { game, scoreA: game.awayScore, scoreB: game.homeScore, teamAIsHome: false };
  return null;
}

/** Pick the bet's game: the first matching game that hadn't long started when it was logged. */
function findGameForBet(bet, games) {
  const created = new Date(bet.createdAt).getTime();
  const matches = games
    .map((g) => orientGame(bet, g))
    .filter(Boolean)
    .filter((m) => new Date(m.game.startTime).getTime() > created - LIVE_BET_GRACE_MS)
    .sort((x, y) => new Date(x.game.startTime) - new Date(y.game.startTime));
  return matches[0] || null;
}

// ---- grading ----------------------------------------------------------------

/**
 * Grade a bet from a score. Returns 'win' | 'loss' | 'push', or null when the
 * bet can't be graded (e.g. a total with no side recorded).
 */
function gradeBet(bet, scoreA, scoreB) {
  if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) return null;
  const type = resolveBetType(bet);
  const line = Number(bet.estimation?.pointSpread);
  if (type === 'total') {
    const side = bet.estimation?.totalSide;
    if (!side || !Number.isFinite(line)) return null;
    const total = scoreA + scoreB;
    if (total === line) return 'push';
    const over = total > line;
    return (side === 'over') === over ? 'win' : 'loss';
  }
  if (type === 'moneyline') {
    if (scoreA === scoreB) return 'push';
    return scoreA > scoreB ? 'win' : 'loss';
  }
  // spread
  if (!Number.isFinite(line)) return null;
  const covered = scoreA + line - scoreB;
  if (covered === 0) return 'push';
  return covered > 0 ? 'win' : 'loss';
}

// ---- scoreboard lookup ------------------------------------------------------

/** ESPN's calendar day (US/Eastern) for a timestamp, as YYYYMMDD. */
function espnDate(ms) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
  return parts.replace(/-/g, '');
}

/** The ESPN days a pending bet's game could fall on. */
function datesForBet(bet, league, now = Date.now()) {
  const created = new Date(bet.createdAt).getTime();
  const span = WEEKLY.has(league) ? 8 : 3;
  const dates = new Set();
  for (let i = 0; i < span; i++) {
    const t = created + i * DAY_MS;
    if (t > now + DAY_MS) break;
    dates.add(espnDate(t));
  }
  dates.add(espnDate(Math.min(now, created + (span - 1) * DAY_MS)));
  return [...dates];
}

/**
 * Look up live/final scores for pending bets and grade the ones whose game is
 * final. Does not save anything — returns
 *   { live: { [betId]: info }, toGrade: [{ bet, result, scoreA, scoreB, gameId }] }.
 */
async function checkPendingBets(bets, { fetch = fetchScoreboard, now = Date.now() } = {}) {
  const pending = bets.filter(
    (b) => b.outcome?.result === 'pending' && now - new Date(b.createdAt).getTime() < MAX_PENDING_AGE_MS
  );

  // Gather every (league, day) scoreboard needed, fetch each once.
  const wanted = new Map(); // key -> { league, date }
  const plan = pending.map((bet) => {
    const leagues = SPORT_LEAGUES[bet.matchup?.sport] || [];
    const keys = [];
    for (const league of leagues) {
      for (const date of datesForBet(bet, league, now)) {
        const key = `${league}:${date}`;
        wanted.set(key, { league, date });
        keys.push(key);
      }
    }
    return { bet, keys };
  });
  const boards = new Map();
  await Promise.all(
    [...wanted].map(async ([key, { league, date }]) => {
      boards.set(key, await fetch(league, date));
    })
  );

  const live = {};
  const toGrade = [];
  for (const { bet, keys } of plan) {
    const seen = new Set();
    const games = [];
    for (const key of keys) {
      for (const g of boards.get(key) || []) {
        const id = `${g.sport}:${g.gameId}`;
        if (!seen.has(id)) { seen.add(id); games.push(g); }
      }
    }
    const match = findGameForBet(bet, games);
    const id = String(bet._id);
    if (!match) {
      live[id] = { matched: false };
      continue;
    }
    const { game, scoreA, scoreB, teamAIsHome } = match;
    const started = game.status === 'in_progress' || game.status === 'final';
    const grade = started ? gradeBet(bet, scoreA, scoreB) : null;
    live[id] = {
      matched: true,
      gameId: game.gameId,
      status: game.status,
      statusDetail: game.statusDetail,
      startTime: game.startTime,
      scoreA: started ? scoreA : null,
      scoreB: started ? scoreB : null,
      teamAIsHome,
      currentGrade: grade, // how the bet stands right now
    };
    if (game.status === 'final' && grade) {
      toGrade.push({ bet, result: grade, scoreA, scoreB, gameId: game.gameId });
    }
  }
  return { live, toGrade };
}

module.exports = {
  teamMatches,
  orientGame,
  findGameForBet,
  gradeBet,
  espnDate,
  datesForBet,
  checkPendingBets,
};
