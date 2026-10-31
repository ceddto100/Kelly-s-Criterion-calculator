// scripts/espnNFLBoxscores.js
// =============================================================================
// Points allowed, yards allowed and turnover differential from ESPN game box
// scores.
//
// Why this exists: ESPN's per-team /statistics endpoint only has a team's OWN
// totals, so the NFL updater wrote 0 for allowed, def_yards and turnover_diff,
// and the standings feed stopped carrying points-against for the NFL. Each game
// summary has both teams' box score, so the opponent numbers come from those.
//
// Box scores are cached in backend/data/nfl/boxscores_<season>.json (committed by
// the workflow), so each run only fetches the games finished since the last run.
// =============================================================================
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 20000;
const REGULAR_SEASON_WEEKS = 18;
const CACHE_DIR = path.join(__dirname, '..', 'backend', 'data', 'nfl');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
      return res.data;
    } catch (err) {
      console.error(`  Attempt ${i + 1} failed for ${url}: ${err.message}`);
      if (i < retries - 1) await delay(2000 * (i + 1));
    }
  }
  return null;
}

function boxStat(stats, names) {
  for (const n of names) {
    const s = stats.find((st) => st.name === n);
    if (!s) continue;
    const v = parseFloat(s.displayValue ?? s.value);
    if (!Number.isNaN(v)) return v;
  }
  return undefined;
}

// { ABBR: { pts, yds, tov } } for both teams, or null if anything is missing.
// Points come from the scoreboard event; yards and turnovers from the summary.
function parseGame(event, summary) {
  const competitors = event?.competitions?.[0]?.competitors;
  const teams = summary?.boxscore?.teams;
  if (!Array.isArray(competitors) || competitors.length !== 2) return null;
  if (!Array.isArray(teams) || teams.length !== 2) return null;

  const out = {};
  for (const c of competitors) {
    const abbr = c.team?.abbreviation;
    const pts = parseFloat(c.score?.value ?? c.score);
    const box = teams.find((t) => t.team?.abbreviation === abbr);
    const stats = box?.statistics || [];
    const yds = boxStat(stats, ['totalYards']);
    const tov = boxStat(stats, ['turnovers']);
    if (!abbr || Number.isNaN(pts) || yds === undefined || tov === undefined) return null;
    out[abbr] = { pts, yds, tov };
  }
  return out;
}

function loadCache(file, season) {
  try {
    const cache = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cache.season === season) return cache;
  } catch (_) { /* first run of the season */ }
  return { season, scannedWeeks: [], games: {} };
}

/**
 * @param {number} season ESPN NFL season year, the year the season starts (2026 for 2026-27)
 * @returns {Promise<Map<string, {allowed: number, def_yards: number, turnover_diff: number, games: number}>>}
 *   ESPN abbreviation -> points and yards allowed per game, and the season-total
 *   turnover differential (takeaways - giveaways, as ESPN shows it)
 */
async function fetchNFLOpponentStats(season) {
  const file = path.join(CACHE_DIR, `boxscores_${season}.json`);
  const cache = loadCache(file, season);
  const scanned = new Set(cache.scannedWeeks);

  let fetched = 0;
  for (let week = 1; week <= REGULAR_SEASON_WEEKS; week++) {
    if (scanned.has(week)) continue;

    const board = await getJson(`${ESPN_SITE}/scoreboard?dates=${season}&seasontype=2&week=${week}&limit=100`);
    if (!board) continue;

    const events = (board.events || []).filter((ev) => ev.season?.type === 2);
    let allDone = events.length > 0;
    for (const ev of events) {
      if (!ev.status?.type?.completed) { allDone = false; continue; }
      if (cache.games[ev.id]) continue;

      const summary = await getJson(`${ESPN_SITE}/summary?event=${ev.id}`);
      const game = parseGame(ev, summary);
      if (game) {
        cache.games[ev.id] = { week, teams: game };
        fetched++;
      } else {
        allDone = false;
      }
      await delay(150);
    }
    if (allDone) scanned.add(week);
    await delay(150);
  }

  cache.scannedWeeks = [...scanned].sort((a, b) => a - b);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cache));

  const sums = new Map(); // abbr -> { ptsAllowed, ydsAllowed, toDiff, games }
  for (const { teams } of Object.values(cache.games)) {
    const [a, b] = Object.keys(teams);
    for (const [me, opp] of [[a, b], [b, a]]) {
      const s = sums.get(me) || { ptsAllowed: 0, ydsAllowed: 0, toDiff: 0, games: 0 };
      s.ptsAllowed += teams[opp].pts;
      s.ydsAllowed += teams[opp].yds;
      s.toDiff += teams[opp].tov - teams[me].tov;
      s.games++;
      sums.set(me, s);
    }
  }

  const result = new Map();
  for (const [abbr, s] of sums) {
    result.set(abbr, {
      allowed: Math.round((s.ptsAllowed / s.games) * 10) / 10,
      def_yards: Math.round((s.ydsAllowed / s.games) * 10) / 10,
      turnover_diff: s.toDiff,
      games: s.games,
    });
  }
  console.log(`  ESPN box scores: ${Object.keys(cache.games).length} games cached (${fetched} new), opponent stats for ${result.size} teams`);
  return result;
}

module.exports = { fetchNFLOpponentStats, parseGame };
