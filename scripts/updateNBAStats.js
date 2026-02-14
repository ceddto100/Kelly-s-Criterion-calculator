// scripts/updateNBAStats.js
// Fetches LIVE NBA stats from ESPN's free public API
// Outputs CSVs to frontend/public/stats/nba/ (where the app reads them)
const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'nba');

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 15000;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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
  // NBA season spans Oct-June; if before October, use current year
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

async function fetchAllNBATeams() {
  console.log('Fetching NBA team list from ESPN...');
  const data = await fetchWithRetry(`${ESPN_SITE}/teams`);
  if (!data) throw new Error('Failed to fetch NBA teams list');

  const teams = data.sports[0].leagues[0].teams;
  console.log(`Found ${teams.length} teams\n`);
  return teams.map(({ team }) => ({ id: team.id, name: team.displayName, abbr: team.abbreviation }));
}

function extractStatsFromCategories(categories) {
  const offensive = categories.find((c) => c.name === 'offensive')?.stats || [];
  const defensive = categories.find((c) => c.name === 'defensive')?.stats || [];
  const general = categories.find((c) => c.name === 'general')?.stats || [];
  return { offensive, defensive, general };
}

function extractStatsFromSplitCategories(splits) {
  const categories = splits?.categories || [];
  return extractStatsFromCategories(categories);
}

function parseNBAStats(data, team) {
  // Try multiple known response structures
  let offensive = [], defensive = [], general = [];

  // Format 1: data.stats.splits.categories (old site API format)
  if (data.stats?.splits?.categories?.length) {
    console.log(`  [${team.abbr}] Using stats.splits.categories format`);
    ({ offensive, defensive, general } = extractStatsFromSplitCategories(data.stats.splits));
  }
  // Format 2: data.results[0].stats.splits.categories
  else if (data.results?.[0]?.stats?.splits?.categories?.length) {
    console.log(`  [${team.abbr}] Using results[0].stats.splits.categories format`);
    ({ offensive, defensive, general } = extractStatsFromSplitCategories(data.results[0].stats.splits));
  }
  // Format 3: data.splits.categories (core API format)
  else if (data.splits?.categories?.length) {
    console.log(`  [${team.abbr}] Using splits.categories format`);
    ({ offensive, defensive, general } = extractStatsFromSplitCategories(data.splits));
  }
  // Format 4: flat categories array at top level
  else if (data.categories?.length) {
    console.log(`  [${team.abbr}] Using top-level categories format`);
    ({ offensive, defensive, general } = extractStatsFromCategories(data.categories));
  }
  // Format 5: data.statistics array (core API alternative)
  else if (data.statistics?.length) {
    console.log(`  [${team.abbr}] Using statistics array format`);
    // Flatten all stats from all categories
    for (const cat of data.statistics) {
      const stats = cat.stats || [];
      if (cat.name === 'offensive') offensive = stats;
      else if (cat.name === 'defensive') defensive = stats;
      else if (cat.name === 'general') general = stats;
    }
  }
  else {
    // Debug: log available keys so we can identify new formats
    console.error(`  [${team.abbr}] WARNING: Unknown response structure. Top keys: ${JSON.stringify(Object.keys(data))}`);
    if (data.stats) console.error(`    stats keys: ${JSON.stringify(Object.keys(data.stats))}`);
    if (data.stats?.splits) console.error(`    splits keys: ${JSON.stringify(Object.keys(data.stats.splits))}`);
    return null;
  }

  const allStats = [...offensive, ...defensive, ...general];
  if (allStats.length === 0) {
    console.error(`  [${team.abbr}] WARNING: Found structure but no stats in it`);
    return null;
  }

  // Log first few available stat names for debugging
  const statNames = allStats.slice(0, 8).map(s => s.name);
  console.log(`  [${team.abbr}] Available stat names (sample): ${statNames.join(', ')}`);

  const ppg = findStat(offensive, 'avgPoints', 'avgPointsPerGame', 'pointsPerGame', 'points')
    || findStat(general, 'avgPoints', 'avgPointsPerGame', 'pointsPerGame', 'points');
  const allowed = findStat(defensive, 'avgPointsAgainst', 'avgPointsAllowed', 'pointsAgainst', 'opposingPoints')
    || findStat(general, 'avgPointsAgainst', 'avgPointsAllowed');
  const fgPct = findStat(offensive, 'fieldGoalPct', 'FGP', 'fieldGoalPercentage')
    || findStat(general, 'fieldGoalPct', 'FGP');
  const rebounds = findStat(offensive, 'avgRebounds', 'avgReboundsPerGame', 'reboundsPerGame', 'totalRebounds')
    || findStat(general, 'avgRebounds', 'avgReboundsPerGame');
  const turnovers = findStat(offensive, 'avgTurnovers', 'avgTurnoversPerGame', 'turnoversPerGame', 'turnovers')
    || findStat(general, 'avgTurnovers', 'avgTurnoversPerGame');
  const oppRebounds = findStat(defensive, 'avgRebounds', 'avgReboundsPerGame', 'reboundsPerGame')
    || findStat(general, 'oppReboundsPerGame');
  const oppTurnovers = findStat(defensive, 'avgTurnovers', 'avgTurnoversPerGame', 'turnoversPerGame')
    || findStat(general, 'oppTurnoversPerGame');

  const rebMargin = Math.round((rebounds - oppRebounds) * 10) / 10;
  const tovMargin = Math.round((oppTurnovers - turnovers) * 10) / 10;

  console.log(`  ${team.name} (${team.abbr}): ${ppg} PPG, ${allowed} allowed, ${fgPct}% FG`);

  return {
    team: team.name,
    abbreviation: team.abbr,
    ppg,
    allowed,
    fg_pct: fgPct,
    rebound_margin: rebMargin,
    turnover_margin: tovMargin,
  };
}

async function fetchTeamStats(team) {
  const season = getCurrentSeason();

  // Try core API first (more reliable for stats), then fall back to site API
  const urls = [
    `${ESPN_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics`,
    `${ESPN_SITE}/teams/${team.id}/statistics`,
    `${ESPN_SITE}/teams/${team.id}?enable=roster,stats`,
  ];

  for (const url of urls) {
    const data = await fetchWithRetry(url, 2);
    if (!data) continue;

    // For the ?enable=stats endpoint, stats are nested under team.record or team.statistics
    let statsData = data;
    if (data.team?.statistics) {
      statsData = { statistics: data.team.statistics };
    }

    const result = parseNBAStats(statsData, team);
    if (result && (result.ppg > 0 || result.allowed > 0)) {
      return result;
    }
    console.log(`  [${team.abbr}] Endpoint returned zero stats, trying next...`);
  }

  console.error(`  SKIP: Could not fetch valid stats for ${team.name} from any endpoint`);
  return null;
}

async function main() {
  console.log('=== Betgistics NBA Stats Update ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Source: ESPN Public API (free, no key required)`);
  console.log(`Season: ${getCurrentSeason()}\n`);

  const teams = await fetchAllNBATeams();
  const allStats = [];
  let zeroCount = 0;

  for (const team of teams) {
    const stats = await fetchTeamStats(team);
    if (stats) {
      allStats.push(stats);
      if (stats.ppg === 0 && stats.allowed === 0) zeroCount++;
    }
    await delay(300); // polite rate limiting
  }

  // Warn if all stats are zeros (API structure likely changed again)
  if (zeroCount === allStats.length && allStats.length > 0) {
    console.error(`\nWARNING: All ${allStats.length} teams have zero stats!`);
    console.error('The ESPN API response structure may have changed.');
    console.error('Check the debug output above for "Available stat names" to identify correct field names.');
    process.exit(1);
  }

  if (allStats.length < 20) {
    console.error(`\nOnly got ${allStats.length} teams - something went wrong. Aborting.`);
    process.exit(1);
  }

  console.log(`\nSuccessfully fetched stats for ${allStats.length} / ${teams.length} teams`);
  if (zeroCount > 0) console.warn(`  (${zeroCount} teams had zero stats)\n`);

  fs.mkdirSync(STATS_DIR, { recursive: true });

  const csvFiles = [
    { name: 'ppg.csv', fields: ['team', 'abbreviation', 'ppg'], sort: 'ppg' },
    { name: 'allowed.csv', fields: ['team', 'abbreviation', 'allowed'], sort: 'allowed', asc: true },
    { name: 'fieldgoal.csv', fields: ['team', 'abbreviation', 'fg_pct'], sort: 'fg_pct' },
    { name: 'rebound_margin.csv', fields: ['team', 'abbreviation', 'rebound_margin'], sort: 'rebound_margin' },
    { name: 'turnover_margin.csv', fields: ['team', 'abbreviation', 'turnover_margin'], sort: 'turnover_margin' },
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

  // Also copy to legacy stats/ directory for backward compatibility
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
