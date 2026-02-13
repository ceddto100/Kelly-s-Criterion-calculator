// scripts/updateNFLStats.js
// Fetches LIVE NFL stats from ESPN's free public API
// Outputs CSVs to frontend/public/stats/nfl/
const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'nfl');

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
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

function findStat(statsArray, statName) {
  const stat = statsArray.find((s) => s.name === statName);
  return stat ? parseFloat(stat.value) : 0;
}

async function fetchAllNFLTeams() {
  console.log('Fetching NFL team list from ESPN...');
  const data = await fetchWithRetry(`${ESPN_BASE}/teams`);
  if (!data) throw new Error('Failed to fetch NFL teams list');

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
  const passing = categories.find((c) => c.name === 'passing')?.stats || [];
  const rushing = categories.find((c) => c.name === 'rushing')?.stats || [];
  const scoring = categories.find((c) => c.name === 'scoring')?.stats || [];
  const defensive = categories.find((c) => c.name === 'defensive')?.stats || [];
  const general = categories.find((c) => c.name === 'general')?.stats || [];
  const miscellaneous = categories.find((c) => c.name === 'miscellaneous')?.stats || [];

  // Points per game
  const ppg = findStat(scoring, 'totalPointsPerGame')
    || findStat(general, 'avgPointsPerGame')
    || findStat(scoring, 'avgPointsPerGame');

  // Points allowed
  const allowed = findStat(defensive, 'avgPointsAgainst')
    || findStat(general, 'avgPointsAgainst');

  // Offensive yards (passing + rushing)
  const passYards = findStat(passing, 'netPassingYardsPerGame')
    || findStat(passing, 'passingYardsPerGame');
  const rushYards = findStat(rushing, 'rushingYardsPerGame');
  const offYards = Math.round((passYards + rushYards) * 10) / 10;

  // Defensive yards allowed
  const defYards = findStat(defensive, 'yardsAllowedPerGame')
    || findStat(defensive, 'totalYardsPerGame');

  // Turnover differential
  const turnovers = findStat(miscellaneous, 'turnoverDifferential')
    || findStat(general, 'turnoverDifferential');

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

async function main() {
  console.log('=== Betgistics NFL Stats Update ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Source: ESPN Public API\n`);

  const teams = await fetchAllNFLTeams();
  const allStats = [];

  for (const team of teams) {
    const stats = await fetchTeamStats(team);
    if (stats) allStats.push(stats);
    await delay(300);
  }

  if (allStats.length < 20) {
    console.error(`\nOnly got ${allStats.length} teams. Aborting.`);
    process.exit(1);
  }

  console.log(`\nFetched stats for ${allStats.length} / ${teams.length} teams\n`);

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
