// scripts/updateNFLStats.js
// Fetches LIVE NFL stats from ESPN's free public API
// Outputs CSVs to frontend/public/stats/nfl/
const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'nfl');

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 15000;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
      return res.data;
    } catch (err) {
      console.error(`  Attempt ${i + 1} failed: ${err.message}`);
      if (i < retries - 1) await delay(2000 * (i + 1));
    }
  }
  return null;
}

function findStat(statsArray, ...statNames) {
  for (const statName of statNames) {
    const stat = statsArray.find((s) => s.name === statName || s.shortDisplayName === statName || s.abbreviation === statName);
    if (stat) {
      const val = parseFloat(stat.displayValue || stat.value);
      if (!isNaN(val)) return val;
    }
  }
  return 0;
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

function extractStatsFromCategories(categories) {
  const result = {};
  for (const cat of categories) {
    result[cat.name] = cat.stats || [];
  }
  return result;
}

function parseNFLStats(data, team) {
  let catMap = {};

  // Format 1: data.stats.splits.categories (old site API format)
  if (data.stats?.splits?.categories?.length) {
    console.log(`  [${team.abbr}] Using stats.splits.categories format`);
    catMap = extractStatsFromCategories(data.stats.splits.categories);
  }
  // Format 2: data.results[0].stats.splits.categories
  else if (data.results?.[0]?.stats?.splits?.categories?.length) {
    console.log(`  [${team.abbr}] Using results[0].stats.splits.categories format`);
    catMap = extractStatsFromCategories(data.results[0].stats.splits.categories);
  }
  // Format 3: data.splits.categories (core API format)
  else if (data.splits?.categories?.length) {
    console.log(`  [${team.abbr}] Using splits.categories format`);
    catMap = extractStatsFromCategories(data.splits.categories);
  }
  // Format 4: flat categories at top level
  else if (data.categories?.length) {
    console.log(`  [${team.abbr}] Using top-level categories format`);
    catMap = extractStatsFromCategories(data.categories);
  }
  // Format 5: data.statistics array
  else if (data.statistics?.length) {
    console.log(`  [${team.abbr}] Using statistics array format`);
    catMap = extractStatsFromCategories(data.statistics);
  }
  else {
    console.error(`  [${team.abbr}] WARNING: Unknown response structure. Top keys: ${JSON.stringify(Object.keys(data))}`);
    if (data.stats) console.error(`    stats keys: ${JSON.stringify(Object.keys(data.stats))}`);
    if (data.stats?.splits) console.error(`    splits keys: ${JSON.stringify(Object.keys(data.stats.splits))}`);
    return null;
  }

  // Log available categories and sample stat names
  const catNames = Object.keys(catMap);
  console.log(`  [${team.abbr}] Categories found: ${catNames.join(', ')}`);
  for (const [catName, stats] of Object.entries(catMap)) {
    if (stats.length > 0) {
      const names = stats.slice(0, 5).map(s => s.name);
      console.log(`  [${team.abbr}]   ${catName}: ${names.join(', ')}...`);
    }
  }

  const passing = catMap['passing'] || [];
  const rushing = catMap['rushing'] || [];
  const scoring = catMap['scoring'] || [];
  const defensive = catMap['defensive'] || [];
  const general = catMap['general'] || [];
  const miscellaneous = catMap['miscellaneous'] || [];

  // Points per game - try multiple possible stat names
  const ppg = findStat(scoring, 'totalPointsPerGame', 'avgPointsPerGame', 'pointsPerGame', 'avgPoints')
    || findStat(general, 'avgPointsPerGame', 'pointsPerGame', 'avgPoints', 'totalPointsPerGame');

  // Points allowed
  const allowed = findStat(defensive, 'avgPointsAgainst', 'avgPointsAllowed', 'pointsAgainst', 'opposingPoints')
    || findStat(general, 'avgPointsAgainst', 'avgPointsAllowed');

  // Offensive yards (passing + rushing)
  const passYards = findStat(passing, 'netPassingYardsPerGame', 'passingYardsPerGame', 'netPassingYards', 'avgPassingYards')
    || findStat(general, 'netPassingYardsPerGame');
  const rushYards = findStat(rushing, 'rushingYardsPerGame', 'avgRushingYards', 'rushingYards')
    || findStat(general, 'rushingYardsPerGame');
  const offYards = Math.round((passYards + rushYards) * 10) / 10;

  // Defensive yards allowed
  const defYards = findStat(defensive, 'yardsAllowedPerGame', 'totalYardsPerGame', 'yardsPerGame', 'avgYardsAllowed')
    || findStat(general, 'yardsAllowedPerGame');

  // Turnover differential
  const turnovers = findStat(miscellaneous, 'turnoverDifferential', 'turnoverMargin', 'turnoverDiff')
    || findStat(general, 'turnoverDifferential', 'turnoverMargin');

  console.log(`  ${team.name} (${team.abbr}): ${ppg} PPG, ${allowed} allowed, ${offYards} off yds`);

  return {
    team: team.name,
    abbreviation: team.abbr,
    ppg,
    allowed,
    off_yards: offYards,
    def_yards: defYards,
    turnover_diff: turnovers,
  };
}

async function fetchTeamStats(team) {
  const season = getCurrentSeason();

  // Try core API first (season type 2 = regular season), then fall back to site API
  // Also try season type 3 (postseason) if regular season fails
  const urls = [
    `${ESPN_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics`,
    `${ESPN_CORE}/seasons/${season}/types/3/teams/${team.id}/statistics`,
    `${ESPN_SITE}/teams/${team.id}/statistics`,
    `${ESPN_SITE}/teams/${team.id}?enable=roster,stats`,
  ];

  for (const url of urls) {
    const data = await fetchWithRetry(url, 2);
    if (!data) continue;

    // For the ?enable=stats endpoint, stats are nested under team.statistics
    let statsData = data;
    if (data.team?.statistics) {
      statsData = { statistics: data.team.statistics };
    }

    const result = parseNFLStats(statsData, team);
    if (result && (result.ppg > 0 || result.allowed > 0)) {
      return result;
    }
    console.log(`  [${team.abbr}] Endpoint returned zero stats, trying next...`);
  }

  console.error(`  SKIP: Could not fetch valid stats for ${team.name} from any endpoint`);
  return null;
}

async function main() {
  console.log('=== Betgistics NFL Stats Update ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Source: ESPN Public API`);
  console.log(`Season: ${getCurrentSeason()}\n`);

  const teams = await fetchAllNFLTeams();
  const allStats = [];
  let zeroCount = 0;

  for (const team of teams) {
    const stats = await fetchTeamStats(team);
    if (stats) {
      allStats.push(stats);
      if (stats.ppg === 0 && stats.allowed === 0) zeroCount++;
    }
    await delay(300);
  }

  // Warn if all stats are zeros
  if (zeroCount === allStats.length && allStats.length > 0) {
    console.error(`\nWARNING: All ${allStats.length} teams have zero stats!`);
    console.error('The ESPN API response structure may have changed.');
    console.error('Check the debug output above for category and stat names to identify correct field names.');
    process.exit(1);
  }

  if (allStats.length < 20) {
    console.error(`\nOnly got ${allStats.length} teams. Aborting.`);
    process.exit(1);
  }

  console.log(`\nFetched stats for ${allStats.length} / ${teams.length} teams`);
  if (zeroCount > 0) console.warn(`  (${zeroCount} teams had zero stats)\n`);

  fs.mkdirSync(STATS_DIR, { recursive: true });

  const csvFiles = [
    { name: 'nfl_ppg.csv', fields: ['team', 'abbreviation', 'ppg'], sort: 'ppg' },
    { name: 'nfl_allowed.csv', fields: ['team', 'abbreviation', 'allowed'], sort: 'allowed', asc: true },
    { name: 'nfl_off_yards.csv', fields: ['team', 'abbreviation', 'off_yards'], sort: 'off_yards' },
    { name: 'nfl_def_yards.csv', fields: ['team', 'abbreviation', 'def_yards'], sort: 'def_yards', asc: true },
    { name: 'nfl_turnover_diff.csv', fields: ['team', 'abbreviation', 'turnover_diff'], sort: 'turnover_diff' },
  ];

  for (const file of csvFiles) {
    const sortKey = file.sort;
    const sorted = [...allStats].sort((a, b) => file.asc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);
    const rows = sorted.map((row) => {
      const out = {};
      for (const f of file.fields) out[f] = row[f];
      return out;
    });

    const parser = new Parser({ fields: file.fields });
    const csv = parser.parse(rows);
    fs.writeFileSync(path.join(STATS_DIR, file.name), csv);
    console.log(`Saved ${file.name} (${rows.length} teams)`);
  }

  console.log(`\nDone! Updated at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
