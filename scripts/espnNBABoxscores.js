// scripts/espnNBABoxscores.js
// =============================================================================
// Rebound and turnover margins from ESPN game box scores.
//
// Why this exists: ESPN's per-team /statistics endpoint only has a team's OWN
// totals, so the ESPN fallback wrote 0 for rebound_margin and turnover_margin.
// Each game summary has both teams' box score, so the margins come from those.
// stats.nba.com has the margins directly but times out from cloud IPs
// (GitHub Actions), and ESPN does not.
//
// Box scores are cached in backend/data/nba/boxscores_<season>.json (committed by
// the workflow), so each run only fetches the games finished since the last run.
// =============================================================================
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 20000;
const CACHE_DIR = path.join(__dirname, '..', 'backend', 'data', 'nba');

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

// YYYYMMDD for a Date, in US Eastern (the NBA's schedule day).
function easternYmd(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get('year')}${get('month')}${get('day')}`;
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

// { ABBR: { reb, tov } } for both teams, or null if the box score is incomplete.
function parseBoxscore(summary) {
  const teams = summary?.boxscore?.teams;
  if (!Array.isArray(teams) || teams.length !== 2) return null;
  const out = {};
  for (const t of teams) {
    const abbr = t.team?.abbreviation;
    const stats = t.statistics || [];
    const reb = boxStat(stats, ['totalRebounds', 'rebounds']);
    const tov = boxStat(stats, ['totalTurnovers', 'turnovers']);
    if (!abbr || reb === undefined || tov === undefined) return null;
    out[abbr] = { reb, tov };
  }
  return out;
}

function loadCache(file, season) {
  try {
    const cache = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (cache.season === season) return cache;
  } catch (_) { /* first run of the season */ }
  return { season, scannedDates: [], games: {} };
}

/**
 * @param {number} season ESPN season year, the year the season ends (2027 for 2026-27)
 * @returns {Promise<Map<string, {rebound_margin: number, turnover_margin: number, games: number}>>}
 *   ESPN abbreviation -> per-game margins (turnover_margin = opponent TOV - own TOV,
 *   the same sign as NBA.com)
 */
async function fetchNBAMargins(season) {
  const file = path.join(CACHE_DIR, `boxscores_${season}.json`);
  const cache = loadCache(file, season);
  const scanned = new Set(cache.scannedDates);
  const today = easternYmd(new Date());

  // Regular season starts in October of the year before `season`; scan from
  // Oct 1 and let season.type filter out the preseason.
  let fetched = 0;
  for (let d = new Date(Date.UTC(season - 1, 9, 1, 12)); easternYmd(d) <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const ymd = easternYmd(d);
    if (scanned.has(ymd)) continue;

    const board = await getJson(`${ESPN_SITE}/scoreboard?dates=${ymd}&limit=100`);
    if (!board) continue;

    let allDone = true;
    for (const ev of board.events || []) {
      if (ev.season?.type !== 2) continue;
      if (!ev.status?.type?.completed) { allDone = false; continue; }
      if (cache.games[ev.id]) continue;

      const summary = await getJson(`${ESPN_SITE}/summary?event=${ev.id}`);
      const box = parseBoxscore(summary);
      if (box) {
        cache.games[ev.id] = { date: ymd, teams: box };
        fetched++;
      } else {
        allDone = false;
      }
      await delay(150);
    }
    if (allDone && ymd < today) scanned.add(ymd);
    await delay(150);
  }

  cache.scannedDates = [...scanned].sort();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cache));

  const sums = new Map(); // abbr -> { reb, tov, games }
  for (const { teams } of Object.values(cache.games)) {
    const [a, b] = Object.keys(teams);
    for (const [me, opp] of [[a, b], [b, a]]) {
      const s = sums.get(me) || { reb: 0, tov: 0, games: 0 };
      s.reb += teams[me].reb - teams[opp].reb;
      s.tov += teams[opp].tov - teams[me].tov;
      s.games++;
      sums.set(me, s);
    }
  }

  const margins = new Map();
  for (const [abbr, s] of sums) {
    margins.set(abbr, {
      rebound_margin: Math.round((s.reb / s.games) * 10) / 10,
      turnover_margin: Math.round((s.tov / s.games) * 10) / 10,
      games: s.games,
    });
  }
  console.log(`  ESPN box scores: ${Object.keys(cache.games).length} games cached (${fetched} new), margins for ${margins.size} teams`);
  return margins;
}

module.exports = { fetchNBAMargins, parseBoxscore, easternYmd };
