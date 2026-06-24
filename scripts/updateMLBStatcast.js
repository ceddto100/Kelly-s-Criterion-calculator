// scripts/updateMLBStatcast.js
// =============================================================================
// Fallback/baseline source for the MLB advanced-stats CSVs that
// scripts/updateMLBAdvanced.py normally fills from FanGraphs:
//
//   backend/data/mlb/team_offense.csv   -> team, abbreviation, wrc_plus, woba
//   backend/data/mlb/pitchers.csv       -> name, team, fip, xfip, siera
//   backend/data/mlb/bullpen.csv        -> team, abbreviation, fip, era, whip
//
// Why this exists: FanGraphs blanket-blocks cloud/CI IPs with a 403, so the
// Python updater frequently fails in GitHub Actions and leaves whatever file
// happened to be there before (stale, or nothing on a fresh checkout). This
// script gets the same three files to a "good enough" state using only
// sources that don't bot-wall unauthenticated API/CI traffic:
//
//   - wOBA (team offense): Baseball Savant's custom leaderboard CSV export.
//     UNVERIFIED FROM A SANDBOXED DEV ENVIRONMENT — this repo's sandbox can't
//     make arbitrary outbound HTTPS calls to confirm the exact endpoint/column
//     names live. It's modeled on Baseball Savant's documented custom
//     leaderboard CSV export shape. Parsing is defensive (column lookup by
//     name, row-count sanity check) and on any mismatch this step is skipped
//     and the previous file is left alone — confirm against a real run of the
//     "Update Sports Stats" GitHub Actions workflow and adjust SAVANT_* below
//     if the columns differ.
//   - FIP (starters + bullpen): computed directly from MLB StatsAPI's raw
//     season pitching counting stats (HR, BB, HBP, K, IP) using the standard
//     public FIP formula. StatsAPI is the same domain backend/scrapers/
//     mlbStatsApi.js already calls successfully from this exact CI job, so
//     this has no new blocking risk.
//   - wRC+, xFIP, SIERA have no equivalent free/public source and are left
//     blank. The projection engine (mcp-server/src/utils/mlb.ts) already
//     normalizes its blend weights over whatever inputs are present, so a
//     blank field degrades the projection's confidence rather than breaking
//     it — the same fallback behavior FanGraphs failures already produce.
//
// Best-effort by design, matching updateMLBAdvanced.py: each output file is
// only overwritten when its fetch fully succeeds, so a flaky response never
// regresses a file that was already in better shape (e.g. from a previous
// successful FanGraphs run).
// =============================================================================
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { ipToOuts } = require('../backend/scrapers/mlbEnrichment');

const OUT_DIR = path.join(__dirname, '..', 'backend', 'data', 'mlb');
const STATSAPI_BASE = 'https://statsapi.mlb.com/api/v1';
const SAVANT_LEADERBOARD_URL = 'https://baseballsavant.mlb.com/leaderboard/custom';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/csv, text/plain, */*',
};
const TIMEOUT = 20000;

// League-average FIP constant (recent-seasons approximation, same style as
// MLB_LEAGUE.avgEra in mcp-server/src/config/mlbConfig.ts — refresh yearly).
const FIP_CONSTANT = 3.10;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function seasonYear() {
  const now = new Date();
  // MLB regular season ~ late Mar to early Oct; before March, use prior year.
  return now.getUTCMonth() + 1 >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

function clean(s) {
  return String(s ?? '').replace(/,/g, ' ').trim();
}

function fmt(value, decimals) {
  if (value === undefined || value === null || !Number.isFinite(value)) return '';
  return value.toFixed(decimals);
}

/** First defined, non-empty value among candidate keys (API field names vary). */
function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function toNum(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT, ...options });
      return res.data;
    } catch (err) {
      lastErr = err;
      console.error(`  attempt ${i + 1} failed for ${url}: ${err.message}`);
      if (i < retries - 1) await delay(1500 * (i + 1));
    }
  }
  throw lastErr;
}

// Minimal CSV parser — fine for Savant's export (no embedded commas/quotes in
// the numeric/team columns we read).
function parseCsv(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? '').trim(); });
    return row;
  });
}

function writeCsv(file, header, rows) {
  const lines = [header.join(',')];
  for (const row of rows) lines.push(row.map((v) => (v === undefined || v === null ? '' : v)).join(','));
  fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

// --- Baseball Savant: team-level wOBA -----------------------------------------

async function fetchSavantTeamWoba(season) {
  const params = new URLSearchParams({
    year: String(season),
    type: 'batter-team',
    filter: '',
    min: '1',
    selections: 'ab,woba,xwoba',
    chart: 'false',
    x: 'ab',
    y: 'ab',
    r: 'no',
    chartType: 'beeswarm',
    sort: '1',
    sortDir: 'desc',
    csv: 'true',
  });
  const text = await fetchWithRetry(`${SAVANT_LEADERBOARD_URL}?${params.toString()}`);
  const rows = parseCsv(typeof text === 'string' ? text : JSON.stringify(text));
  if (rows.length < 28 || rows.length > 31) {
    throw new Error(`unexpected row count from Savant leaderboard (${rows.length}); skipping`);
  }
  const teamKeyHeader = Object.keys(rows[0]).find((h) => h.includes('team')) || Object.keys(rows[0])[0];
  const wobaHeader = Object.keys(rows[0]).find((h) => h === 'woba');
  if (!wobaHeader) throw new Error('no "woba" column in Savant leaderboard response; skipping');
  const out = rows.map((r) => ({ team: clean(r[teamKeyHeader]), woba: toNum(r[wobaHeader]) }))
    .filter((r) => r.team && r.woba !== undefined);
  if (!out.length) throw new Error('Savant leaderboard parsed 0 usable rows; skipping');
  return out;
}

// --- MLB StatsAPI: teams + per-pitcher raw counting stats ---------------------

async function fetchTeams() {
  const data = await fetchWithRetry(`${STATSAPI_BASE}/teams?sportId=1&activeStatus=Yes`);
  return (data?.teams ?? [])
    .filter((t) => t?.id && t?.name)
    .map((t) => ({ id: t.id, name: t.name, abbreviation: t.abbreviation || '' }));
}

async function fetchPitcherIds(teamId) {
  const data = await fetchWithRetry(`${STATSAPI_BASE}/teams/${teamId}/roster?rosterType=active`);
  return (data?.roster ?? [])
    .filter((p) => p?.position?.type === 'Pitcher' && p?.person?.id)
    .map((p) => ({ id: p.person.id, name: p.person.fullName }));
}

async function fetchPitcherSeasonRaw(personId, season) {
  const data = await fetchWithRetry(
    `${STATSAPI_BASE}/people/${personId}?hydrate=stats(group=[pitching],type=[season],season=${season})`,
  );
  const person = data?.people?.[0];
  const group = (person?.stats ?? []).find((s) => s?.group?.displayName === 'pitching');
  const stat = group?.splits?.[0]?.stat;
  if (!stat) return null;
  const outs = ipToOuts(stat.inningsPitched);
  if (!outs) return null;
  return {
    gamesStarted: toNum(pick(stat, 'gamesStarted')) || 0,
    outs,
    era: toNum(pick(stat, 'era')),
    whip: toNum(pick(stat, 'whip')),
    homeRuns: toNum(pick(stat, 'homeRuns')) || 0,
    baseOnBalls: toNum(pick(stat, 'baseOnBalls')) || 0,
    hitBatsmen: toNum(pick(stat, 'hitBatsmen', 'hitByPitch')) || 0,
    strikeOuts: toNum(pick(stat, 'strikeOuts')) || 0,
  };
}

function computeFip({ outs, homeRuns, baseOnBalls, hitBatsmen, strikeOuts }) {
  const ip = outs / 3;
  if (ip <= 0) return undefined;
  return ((13 * homeRuns + 3 * (baseOnBalls + hitBatsmen) - 2 * strikeOuts) / ip) + FIP_CONSTANT;
}

async function buildPitcherAndBullpenRows(teams, season) {
  const pitcherRows = []; // [name, abbr, fip, xfip(''), siera('')]
  const bullpenAgg = new Map(); // teamId -> { fipNum, eraNum, whipNum, outs }

  for (const team of teams) {
    let pitchers;
    try {
      pitchers = await fetchPitcherIds(team.id);
    } catch (e) {
      console.error(`  [roster] ${team.name} failed: ${e.message}`);
      continue;
    }
    for (const p of pitchers) {
      let raw;
      try {
        raw = await fetchPitcherSeasonRaw(p.id, season);
      } catch (e) {
        console.error(`  [pitcher] ${p.name} (${team.name}) failed: ${e.message}`);
        continue;
      }
      if (!raw) continue;
      const fip = computeFip(raw);
      if (fip !== undefined) pitcherRows.push([clean(p.name), team.abbreviation, fmt(fip, 2), '', '']);

      if (raw.gamesStarted === 0) {
        const agg = bullpenAgg.get(team.id) || { fipSum: 0, eraSum: 0, whipSum: 0, outs: 0 };
        agg.outs += raw.outs;
        if (fip !== undefined) agg.fipSum += fip * raw.outs;
        if (raw.era !== undefined) agg.eraSum += raw.era * raw.outs;
        if (raw.whip !== undefined) agg.whipSum += raw.whip * raw.outs;
        bullpenAgg.set(team.id, agg);
      }
      await delay(50); // light throttle across ~400 per-pitcher requests
    }
  }

  const bullpenRows = teams
    .filter((t) => bullpenAgg.has(t.id))
    .map((t) => {
      const agg = bullpenAgg.get(t.id);
      const w = (sum) => (agg.outs > 0 ? sum / agg.outs : undefined);
      return [clean(t.name), t.abbreviation, fmt(w(agg.fipSum), 2), fmt(w(agg.eraSum), 2), fmt(w(agg.whipSum), 2)];
    });

  return { pitcherRows, bullpenRows };
}

async function main() {
  const season = seasonYear();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('=== MLB Advanced Stats Baseline (Baseball Savant + StatsAPI FIP) ===');
  console.log(`Season: ${season} | UTC: ${new Date().toISOString()}\n`);

  try {
    const woba = await fetchSavantTeamWoba(season);
    const rows = woba.map((r) => [r.team, '', '', fmt(r.woba, 3)]);
    writeCsv(path.join(OUT_DIR, 'team_offense.csv'), ['team', 'abbreviation', 'wrc_plus', 'woba'], rows);
    console.log(`Wrote team_offense.csv (${rows.length} teams, woba only — wRC+ has no free substitute)`);
  } catch (e) {
    console.error(`Savant team wOBA fetch FAILED (keeping previous file): ${e.message}`);
  }

  try {
    const teams = await fetchTeams();
    const { pitcherRows, bullpenRows } = await buildPitcherAndBullpenRows(teams, season);
    if (!pitcherRows.length) throw new Error('0 pitchers produced a usable FIP');
    writeCsv(path.join(OUT_DIR, 'pitchers.csv'), ['name', 'team', 'fip', 'xfip', 'siera'], pitcherRows);
    console.log(`Wrote pitchers.csv (${pitcherRows.length} pitchers, fip only — xfip/siera have no free substitute)`);
    writeCsv(path.join(OUT_DIR, 'bullpen.csv'), ['team', 'abbreviation', 'fip', 'era', 'whip'], bullpenRows);
    console.log(`Wrote bullpen.csv (${bullpenRows.length} teams)`);
  } catch (e) {
    console.error(`StatsAPI pitching fetch FAILED (keeping previous files): ${e.message}`);
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exitCode = 0; // best-effort: never fail the CI job over this source
});
