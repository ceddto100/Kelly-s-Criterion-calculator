// scripts/updateNFLStats.js
// Fetches LIVE NFL stats from ESPN's free public API
// Uses multiple endpoints to get comprehensive offensive + defensive stats:
//   - Core API /statistics endpoint for offensive stats (passing, rushing, scoring)
//   - Core API /record endpoint for team record stats (points against, etc.)
//   - Standings endpoint for bulk points for/against data
// Outputs CSVs to frontend/public/stats/nfl/
const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'nfl');

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0' };
const TIMEOUT = 15000;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function round1(val) { return Math.round((val || 0) * 10) / 10; }
function round2(val) { return Math.round((val || 0) * 100) / 100; }

async function fetchWithRetry(url, retries = 3) {
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

function getCurrentSeason() {
  const now = new Date();
  // NFL season spans Sep-Feb; if before September, use previous year
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

async function fetchAllNFLTeams() {
  console.log('Fetching NFL team list from ESPN...');
  const data = await fetchWithRetry(`${ESPN_SITE}/teams`);
  if (!data) throw new Error('Failed to fetch NFL teams list');

  const teams = data.sports[0].leagues[0].teams;
  console.log(`Found ${teams.length} teams\n`);
  return teams.map(({ team }) => ({ id: team.id, name: team.displayName, abbr: team.abbreviation }));
}

// ── Build a flat stat map from ESPN categories ─────────────────
// Normalizes all stat names so we can find them regardless of format

function normalizeStatKey(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildStatMap(categories) {
  const map = new Map();

  for (const cat of categories) {
    const catName = (cat.name || '').toLowerCase();
    for (const stat of (cat.stats || [])) {
      const keys = [
        stat.name,
        stat.displayName,
        stat.shortDisplayName,
        stat.abbreviation,
        // Also store with category prefix for disambiguation
        catName ? `${catName}_${stat.name}` : null,
      ].filter(Boolean);

      const numeric = parseFloat(stat.displayValue ?? stat.value ?? '');
      if (Number.isNaN(numeric)) continue;

      for (const key of keys) {
        const normalized = normalizeStatKey(key);
        if (!normalized) continue;
        if (!map.has(normalized)) map.set(normalized, numeric);
      }
    }
  }

  return map;
}

function getStat(statMap, aliases, fallback = 0) {
  for (const alias of aliases) {
    const normalized = normalizeStatKey(alias);
    if (statMap.has(normalized)) return statMap.get(normalized);
  }
  return fallback;
}

function extractCategories(data) {
  if (data.splits?.categories?.length) return data.splits.categories;
  if (data.stats?.splits?.categories?.length) return data.stats.splits.categories;
  if (data.results?.[0]?.stats?.splits?.categories?.length) return data.results[0].stats.splits.categories;
  if (data.categories?.length) return data.categories;
  if (data.statistics?.length) return data.statistics;
  if (data.team?.statistics) return data.team.statistics;
  return [];
}

// ── Parse record endpoint for points against ───────────────────

function parseRecordItems(data) {
  // The record endpoint returns items[] with stat objects
  // Structure: { items: [{ stats: [{ name, value }] }] }
  const result = {};
  const items = data.items || data.records || [];
  for (const item of items) {
    const stats = item.stats || [];
    for (const s of stats) {
      const name = normalizeStatKey(s.name || s.abbreviation || '');
      const val = parseFloat(s.value ?? s.displayValue ?? '');
      if (name && !isNaN(val)) {
        result[name] = val;
      }
    }
  }
  return result;
}

// ── Fetch standings for all teams (bulk approach) ──────────────

async function fetchStandingsData() {
  console.log('Fetching NFL standings for points for/against...');
  const season = getCurrentSeason();

  // Try the standings endpoint which returns all teams grouped by conference
  const data = await fetchWithRetry(`${ESPN_SITE}/standings?season=${season}&seasontype=2`);
  if (!data) {
    console.warn('  Standings endpoint failed');
    return {};
  }

  const standingsMap = {};

  // Navigate the standings structure
  // Structure: { children: [{ standings: { entries: [{ team, stats }] } }] }
  const groups = data.children || [];
  for (const group of groups) {
    const entries = group.standings?.entries || [];
    for (const entry of entries) {
      const team = entry.team;
      if (!team) continue;

      const abbr = team.abbreviation;
      const stats = {};
      for (const s of (entry.stats || [])) {
        const name = normalizeStatKey(s.name || s.abbreviation || s.shortDisplayName || '');
        const val = parseFloat(s.value ?? s.displayValue ?? '');
        if (name && !isNaN(val)) {
          stats[name] = val;
        }
      }

      standingsMap[abbr] = {
        team: team.displayName || team.name,
        stats,
      };
    }
  }

  console.log(`  Parsed standings for ${Object.keys(standingsMap).length} teams`);

  // Log sample stats available in standings
  const sampleAbbr = Object.keys(standingsMap)[0];
  if (sampleAbbr) {
    const sampleStats = Object.keys(standingsMap[sampleAbbr].stats);
    console.log(`  Sample standings stat keys: ${sampleStats.join(', ')}`);
  }

  return standingsMap;
}

// ── Fetch per-team stats from multiple endpoints ───────────────

async function fetchTeamData(team, season) {
  const result = {
    team: team.name,
    abbreviation: team.abbr,
    // Offensive stats (from statistics endpoint)
    ppg: 0,
    pass_yards: 0,
    rush_yards: 0,
    off_yards: 0,
    completion_pct: 0,
    third_down_pct: 0,
    yards_per_play: 0,
    // Defensive stats (from record/standings endpoints)
    allowed: 0,
    def_yards: 0,
    // Differentials
    turnover_diff: 0,
    scoring_diff: 0,
  };

  // ── 1. Fetch statistics endpoint (offensive stats) ──
  const statsUrls = [
    `${ESPN_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics`,
    `${ESPN_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics/0`,
    `${ESPN_SITE}/teams/${team.id}/statistics`,
  ];

  let categories = [];
  for (const url of statsUrls) {
    const data = await fetchWithRetry(url, 2);
    if (!data) continue;
    categories = extractCategories(data);
    if (categories.length > 0) {
      console.log(`  [${team.abbr}] Got ${categories.length} stat categories from statistics endpoint`);
      break;
    }
  }

  if (categories.length > 0) {
    // Log categories on first team for debugging
    const catNames = categories.map(c => c.name).join(', ');
    console.log(`  [${team.abbr}] Categories: ${catNames}`);

    // Log all stat names for first team for debugging
    if (team.id === '1' || team.abbr === 'ATL') {
      for (const cat of categories) {
        const statNames = (cat.stats || []).map(s => s.name);
        console.log(`  [${team.abbr}]   ${cat.name}: ${statNames.join(', ')}`);
      }
    }

    const statMap = buildStatMap(categories);

    // Points per game
    result.ppg = round1(getStat(statMap, [
      'totalPointsPerGame', 'avgPointsPerGame', 'pointsPerGame', 'avgPoints',
    ]));

    // Passing yards per game
    result.pass_yards = round1(getStat(statMap, [
      'netPassingYardsPerGame', 'passingYardsPerGame', 'netPassingYards', 'avgPassingYards',
      'passing_netPassingYardsPerGame', 'passing_passingYardsPerGame',
    ]));

    // Rushing yards per game
    result.rush_yards = round1(getStat(statMap, [
      'rushingYardsPerGame', 'avgRushingYards', 'rushingYards',
      'rushing_rushingYardsPerGame', 'rushing_avgRushingYards',
    ]));

    // Total offensive yards
    result.off_yards = round1(result.pass_yards + result.rush_yards);

    // Completion percentage
    result.completion_pct = round1(getStat(statMap, [
      'completionPct', 'completionPercentage', 'compPct', 'avgCompletionPercentage',
      'passing_completionPct',
    ]));

    // Third down conversion percentage
    result.third_down_pct = round1(getStat(statMap, [
      'thirdDownConvPct', 'thirdDownPct', 'thirdDownConversionPct',
      'thirdDownEfficiency', 'avgThirdDownConversion',
      'general_thirdDownConvPct', 'miscellaneous_thirdDownConvPct',
    ]));

    // Yards per play
    result.yards_per_play = round2(getStat(statMap, [
      'yardsPerPlay', 'avgYardsPerPlay', 'ypp',
      'general_yardsPerPlay',
    ]));

    // Try to get defensive stats from the statistics endpoint too
    // (these are usually individual player stats, but some endpoints may include team-level)
    const defYardsFromStats = getStat(statMap, [
      'yardsAllowedPerGame', 'totalYardsPerGame', 'avgYardsAllowed',
      'defensive_yardsAllowedPerGame', 'opponentYardsPerGame',
    ]);
    if (defYardsFromStats > 0) result.def_yards = round1(defYardsFromStats);

    const allowedFromStats = getStat(statMap, [
      'avgPointsAgainst', 'avgPointsAllowed', 'pointsAgainst', 'opposingPoints',
      'defensive_avgPointsAgainst', 'opponentPointsPerGame',
    ]);
    if (allowedFromStats > 0) result.allowed = round1(allowedFromStats);

    const turnoverFromStats = getStat(statMap, [
      'turnoverDifferential', 'turnoverMargin', 'turnoverDiff',
      'miscellaneous_turnoverDifferential', 'general_turnoverDifferential',
    ]);
    if (turnoverFromStats !== 0) result.turnover_diff = round1(turnoverFromStats);
  }

  // ── 2. Fetch record endpoint (for points against, etc.) ──
  // Only if we still need defensive stats
  if (result.allowed === 0 || result.def_yards === 0 || result.turnover_diff === 0) {
    const recordData = await fetchWithRetry(
      `${ESPN_CORE}/seasons/${season}/types/2/teams/${team.id}/record`, 2
    );

    if (recordData) {
      const rec = parseRecordItems(recordData);
      const recKeys = Object.keys(rec);
      if (team.id === '1' || team.abbr === 'ATL') {
        console.log(`  [${team.abbr}] Record stat keys: ${recKeys.join(', ')}`);
        console.log(`  [${team.abbr}] Record sample values: ${recKeys.slice(0, 10).map(k => k + '=' + rec[k]).join(', ')}`);
      }

      if (result.allowed === 0) {
        const pa = rec['avgpointsagainst'] || rec['pointsagainst'] || rec['oppointsperga'] || 0;
        if (pa > 0) {
          // avgPointsAgainst is per-game; pointsAgainst is total
          const gp = rec['gamesplayed'] || rec['gp'] || 0;
          result.allowed = round1(pa > 100 && gp > 0 ? pa / gp : pa);
        }
      }

      // Points for from record (if PPG was 0)
      if (result.ppg === 0) {
        const pf = rec['avgpointsfor'] || rec['pointsfor'] || 0;
        const gp = rec['gamesplayed'] || rec['gp'] || 0;
        if (pf > 0) {
          result.ppg = round1(pf > 100 && gp > 0 ? pf / gp : pf);
        }
      }

      // Differential/margin stats from record
      if (result.turnover_diff === 0) {
        const td = rec['turnoverdifferential'] || rec['turnovermargin']
          || rec['takeawaygiveawaydifferential'] || 0;
        if (td !== 0) result.turnover_diff = round1(td);
      }

      // Point differential from record
      const ptDiff = rec['pointdifferential'] || rec['pointsdifferential'] || 0;
      if (ptDiff !== 0) result.scoring_diff = round1(ptDiff);
    }
  }

  return result;
}

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('=== Betgistics NFL Stats Update ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Source: ESPN Public API (statistics + record + standings)`);
  const season = getCurrentSeason();
  console.log(`Season: ${season}\n`);

  const teams = await fetchAllNFLTeams();

  // ── Fetch standings first (bulk data for all teams) ──
  const standingsMap = await fetchStandingsData();

  // ── Fetch per-team stats ──
  const allStats = [];
  let zeroCount = 0;

  for (const team of teams) {
    const stats = await fetchTeamData(team, season);

    // ── Supplement with standings data if available ──
    const standingsEntry = standingsMap[team.abbr];
    if (standingsEntry) {
      const ss = standingsEntry.stats;

      // Points allowed from standings
      if (stats.allowed === 0) {
        // Try various standing stat name patterns
        const pa = ss['pointsagainst'] || ss['avgpointsagainst']
          || ss['opponentpointspergame'] || ss['pa'] || ss['pointsallowed'] || 0;
        const gp = ss['gamesplayed'] || ss['gp'] || ss['wins'] + ss['losses'] + (ss['ties'] || 0) || 0;
        if (pa > 0) {
          stats.allowed = round1(pa > 100 && gp > 0 ? pa / gp : pa);
        }
      }

      // Points for from standings (if PPG still 0)
      if (stats.ppg === 0) {
        const pf = ss['pointsfor'] || ss['avgpointsfor'] || ss['pf'] || 0;
        const gp = ss['gamesplayed'] || ss['gp'] || 0;
        if (pf > 0) {
          stats.ppg = round1(pf > 100 && gp > 0 ? pf / gp : pf);
        }
      }

      // Point differential from standings
      if (stats.scoring_diff === 0) {
        const diff = ss['pointdifferential'] || ss['pointsdifferential'] || ss['differential'] || 0;
        if (diff !== 0) {
          stats.scoring_diff = round1(diff);
        } else if (stats.ppg > 0 && stats.allowed > 0) {
          stats.scoring_diff = round1(stats.ppg - stats.allowed);
        }
      }

      // Turnover differential from standings
      if (stats.turnover_diff === 0) {
        const td = ss['turnoverdifferential'] || ss['turnovermargin'] || ss['to'] || 0;
        if (td !== 0) stats.turnover_diff = round1(td);
      }

      // Defensive yards from standings
      if (stats.def_yards === 0) {
        const dy = ss['yardsagainst'] || ss['opponentyardspergame']
          || ss['totalyardsagainst'] || ss['yardsallowed'] || 0;
        const gp = ss['gamesplayed'] || ss['gp'] || 0;
        if (dy > 0) {
          stats.def_yards = round1(dy > 1000 && gp > 0 ? dy / gp : dy);
        }
      }
    }

    // Calculate scoring diff if we have both PPG and allowed but no diff yet
    if (stats.scoring_diff === 0 && stats.ppg > 0 && stats.allowed > 0) {
      stats.scoring_diff = round1(stats.ppg - stats.allowed);
    }

    allStats.push(stats);
    if (stats.ppg === 0 && stats.allowed === 0) zeroCount++;

    console.log(`  ${stats.team} (${stats.abbreviation}): PPG=${stats.ppg}, PA=${stats.allowed}, ` +
      `OffYds=${stats.off_yards}, DefYds=${stats.def_yards}, TO=${stats.turnover_diff}, ` +
      `PassYds=${stats.pass_yards}, RushYds=${stats.rush_yards}, 3rd%=${stats.third_down_pct}`);

    await delay(300);
  }

  // Warn if all stats are zeros
  if (zeroCount === allStats.length && allStats.length > 0) {
    console.error(`\nWARNING: All ${allStats.length} teams have zero stats!`);
    console.error('The ESPN API response structure may have changed.');
    process.exit(1);
  }

  if (allStats.length < 20) {
    console.error(`\nOnly got ${allStats.length} teams. Aborting.`);
    process.exit(1);
  }

  console.log(`\nFetched stats for ${allStats.length} / ${teams.length} teams`);
  if (zeroCount > 0) console.warn(`  (${zeroCount} teams had zero stats)`);

  // Log warnings for zero stats
  const zeroAllowed = allStats.filter(s => s.allowed === 0).length;
  const zeroDefYards = allStats.filter(s => s.def_yards === 0).length;
  const zeroTO = allStats.filter(s => s.turnover_diff === 0).length;
  if (zeroAllowed > 0) console.warn(`  WARNING: ${zeroAllowed} teams have 0 PA`);
  if (zeroDefYards > 0) console.warn(`  WARNING: ${zeroDefYards} teams have 0 def yards`);
  if (zeroTO === allStats.length) console.warn('  WARNING: All teams have 0 turnover diff');

  // ── Write CSV files ──
  fs.mkdirSync(STATS_DIR, { recursive: true });

  const csvFiles = [
    // Original 5 files (backward compatible)
    { name: 'nfl_ppg.csv', fields: ['team', 'abbreviation', 'ppg'], sort: 'ppg' },
    { name: 'nfl_allowed.csv', fields: ['team', 'abbreviation', 'allowed'], sort: 'allowed', asc: true },
    { name: 'nfl_off_yards.csv', fields: ['team', 'abbreviation', 'off_yards'], sort: 'off_yards' },
    { name: 'nfl_def_yards.csv', fields: ['team', 'abbreviation', 'def_yards'], sort: 'def_yards', asc: true },
    { name: 'nfl_turnover_diff.csv', fields: ['team', 'abbreviation', 'turnover_diff'], sort: 'turnover_diff' },
    // New stats (matching NBA stat coverage)
    { name: 'nfl_pass_yards.csv', fields: ['team', 'abbreviation', 'pass_yards'], sort: 'pass_yards' },
    { name: 'nfl_rush_yards.csv', fields: ['team', 'abbreviation', 'rush_yards'], sort: 'rush_yards' },
    { name: 'nfl_third_down.csv', fields: ['team', 'abbreviation', 'third_down_pct'], sort: 'third_down_pct' },
    { name: 'nfl_completion_pct.csv', fields: ['team', 'abbreviation', 'completion_pct'], sort: 'completion_pct' },
    { name: 'nfl_yards_per_play.csv', fields: ['team', 'abbreviation', 'yards_per_play'], sort: 'yards_per_play' },
    { name: 'nfl_scoring_diff.csv', fields: ['team', 'abbreviation', 'scoring_diff'], sort: 'scoring_diff' },
  ];

  for (const file of csvFiles) {
    const sortKey = file.sort;
    const sorted = [...allStats].sort((a, b) =>
      file.asc ? (a[sortKey] || 0) - (b[sortKey] || 0) : (b[sortKey] || 0) - (a[sortKey] || 0)
    );
    const rows = sorted.map((row) => {
      const out = {};
      for (const f of file.fields) out[f] = row[f] || 0;
      return out;
    });

    const parser = new Parser({ fields: file.fields });
    const csv = parser.parse(rows);
    fs.writeFileSync(path.join(STATS_DIR, file.name), csv);
    console.log(`Saved ${file.name} (${rows.length} teams)`);
  }

  // Copy to legacy stats/ directory for backward compatibility
  const legacyDir = path.join(__dirname, '..', 'stats');
  fs.mkdirSync(legacyDir, { recursive: true });
  for (const file of csvFiles) {
    fs.copyFileSync(path.join(STATS_DIR, file.name), path.join(legacyDir, file.name));
  }
  console.log('Copied to stats/ for backward compatibility');

  console.log(`\nDone! Updated at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
