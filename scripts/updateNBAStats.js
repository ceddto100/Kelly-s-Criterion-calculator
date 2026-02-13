// scripts/updateNBAStats.js
// Fetches LIVE NBA stats from ESPN's free public API
// Outputs CSVs to frontend/public/stats/nba/ (where the app reads them)
const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'nba');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
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

function findStat(statsArray, statName) {
  const stat = statsArray.find((s) => s.name === statName);
  return stat ? parseFloat(stat.value) : 0;
}

async function fetchAllNBATeams() {
  console.log('Fetching NBA team list from ESPN...');
  const data = await fetchWithRetry(`${ESPN_BASE}/teams`);
  if (!data) throw new Error('Failed to fetch NBA teams list');

  const teams = data.sports[0].leagues[0].teams;
  console.log(`Found ${teams.length} teams\n`);
  return teams.map(({ team }) => ({ id: team.id, name: team.displayName, abbr: team.abbreviation }));
}

async function fetchTeamStats(team) {
  const data = await fetchWithRetry(`${ESPN_BASE}/teams/${team.id}/statistics`);
  if (!data) {
    console.error(`  SKIP: Could not fetch stats for ${team.name}`);
    return null;
  }

  const categories = data.stats?.splits?.categories || [];
  const offensive = categories.find((c) => c.name === 'offensive')?.stats || [];
  const defensive = categories.find((c) => c.name === 'defensive')?.stats || [];
  const general = categories.find((c) => c.name === 'general')?.stats || [];

  const ppg = findStat(offensive, 'avgPointsPerGame') || findStat(general, 'avgPointsPerGame');
  const allowed = findStat(defensive, 'avgPointsAgainst') || findStat(general, 'avgPointsAgainst');
  const fgPct = findStat(offensive, 'fieldGoalPct');
  const rebounds = findStat(offensive, 'avgReboundsPerGame');
  const turnovers = findStat(offensive, 'avgTurnoversPerGame');
  const oppRebounds = findStat(defensive, 'avgReboundsPerGame');
  const oppTurnovers = findStat(defensive, 'avgTurnoversPerGame');

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

async function main() {
  console.log('=== Betgistics NBA Stats Update ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Source: ESPN Public API (free, no key required)\n`);

  const teams = await fetchAllNBATeams();
  const allStats = [];

  for (const team of teams) {
    const stats = await fetchTeamStats(team);
    if (stats) allStats.push(stats);
    await delay(300); // polite rate limiting
  }

  if (allStats.length < 20) {
    console.error(`\nOnly got ${allStats.length} teams - something went wrong. Aborting.`);
    process.exit(1);
  }

  console.log(`\nSuccessfully fetched stats for ${allStats.length} / ${teams.length} teams\n`);

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
