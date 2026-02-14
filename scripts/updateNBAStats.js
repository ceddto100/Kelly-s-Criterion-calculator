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

function findStatFuzzy(statsArray, ...keywords) {
  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    const stat = statsArray.find((s) => (s.name || '').toLowerCase().includes(kwLower));
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

  // Log ALL stat names per category for debugging (helps identify correct field names)
  if (offensive.length) console.log(`  [${team.abbr}] offensive stats: ${offensive.map(s => s.name).join(', ')}`);
  if (defensive.length) console.log(`  [${team.abbr}] defensive stats: ${defensive.map(s => s.name).join(', ')}`);
  if (general.length) console.log(`  [${team.abbr}] general stats: ${general.map(s => s.name).join(', ')}`);

  const ppg = findStat(offensive, 'avgPoints', 'avgPointsPerGame', 'pointsPerGame', 'points')
    || findStat(general, 'avgPoints', 'avgPointsPerGame', 'pointsPerGame', 'points')
    || findStatFuzzy(allStats, 'avgPoints', 'pointsPerGame');
  const allowed = findStat(defensive, 'avgPointsAgainst', 'avgPointsAllowed', 'pointsAgainst', 'opposingPoints')
    || findStat(general, 'avgPointsAgainst', 'avgPointsAllowed')
    || findStat(allStats, 'avgPointsAgainst', 'avgPointsAllowed', 'pointsAgainst', 'opposingPoints')
    || findStatFuzzy(defensive, 'pointsagainst', 'pointsallowed', 'opposingpoints')
    || findStatFuzzy(allStats, 'pointsagainst', 'pointsallowed', 'opposingpoints');
  const fgPct = findStat(offensive, 'fieldGoalPct', 'FGP', 'fieldGoalPercentage')
    || findStat(general, 'fieldGoalPct', 'FGP')
    || findStatFuzzy(allStats, 'fieldGoalPct', 'fieldGoalPercentage');
  const rebounds = findStat(offensive, 'avgRebounds', 'avgReboundsPerGame', 'reboundsPerGame', 'totalRebounds')
    || findStat(general, 'avgRebounds', 'avgReboundsPerGame')
    || findStatFuzzy(allStats, 'avgRebounds', 'reboundsPerGame');
  const turnovers = findStat(offensive, 'avgTurnovers', 'avgTurnoversPerGame', 'turnoversPerGame', 'turnovers')
    || findStat(general, 'avgTurnovers', 'avgTurnoversPerGame')
    || findStatFuzzy(offensive, 'turnover');
  const oppRebounds = findStat(defensive, 'avgRebounds', 'avgReboundsPerGame', 'reboundsPerGame')
    || findStat(general, 'oppReboundsPerGame')
    || findStatFuzzy(defensive, 'rebound');
  const oppTurnovers = findStat(defensive, 'avgTurnovers', 'avgTurnoversPerGame', 'turnoversPerGame')
    || findStat(general, 'oppTurnoversPerGame')
    || findStatFuzzy(defensive, 'turnover');

  // Log if points allowed is still 0 - helps debug in GitHub Actions
  if (allowed === 0) {
    console.warn(`  [${team.abbr}] WARNING: Points allowed is 0! Defensive stat names: ${defensive.map(s => s.name + '=' + (s.displayValue || s.value)).join(', ')}`);
  }

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
    if (result && result.ppg > 0) {
      return result;
    }
    console.log(`  [${team.abbr}] Endpoint returned zero PPG, trying next...`);
  }

  console.error(`  SKIP: Could not fetch valid stats for ${team.name} from any endpoint`);
  return null;
}

// Fetch points allowed from standings and record endpoints
// ESPN's team statistics endpoint doesn't include "points against" for NBA -
// it's a team record stat that lives in the standings/records APIs instead
async function fetchPointsAllowed() {
  const season = getCurrentSeason();
  console.log('\nFetching points-allowed from standings...');

  const paMap = {};

  // Try multiple standings endpoint formats
  const standingsUrls = [
    `${ESPN_SITE}/standings?season=${season}&seasontype=2`,
    `${ESPN_SITE}/standings?season=${season}`,
    `${ESPN_SITE}/standings`,
  ];

  for (const url of standingsUrls) {
    const data = await fetchWithRetry(url, 2);
    if (!data?.children) continue;

    console.log(`  Parsing standings from: ${url}`);

    for (const conf of data.children) {
      for (const entry of (conf.standings?.entries || [])) {
        const teamData = entry.team;
        if (!teamData) continue;

        const stats = entry.stats || [];
        let pointsAgainst = 0;
        let pointsFor = 0;
        let gamesPlayed = 0;
        let avgPointsAgainst = 0;

        // Log all stat names for first team to help debug
        if (Object.keys(paMap).length === 0) {
          console.log(`  [${teamData.abbreviation}] Standings stat names: ${stats.map(s => s.name || s.abbreviation).join(', ')}`);
          console.log(`  [${teamData.abbreviation}] Standings stat values: ${stats.map(s => (s.name || s.abbreviation) + '=' + (s.displayValue || s.value)).join(', ')}`);
        }

        for (const s of stats) {
          const name = (s.name || '').toLowerCase();
          const abbr = (s.abbreviation || '').toLowerCase();
          const val = parseFloat(s.value || 0);
          const displayVal = parseFloat(s.displayValue || 0);

          // Points Against (total)
          if (name === 'pointsagainst' || name === 'pointagainst' || abbr === 'pa'
              || name === 'opppoints' || name === 'pointsallowed') {
            pointsAgainst = val;
          }
          // Average Points Against (per game)
          if (name === 'avgpointsagainst' || name === 'ppga' || name === 'avgopp'
              || abbr === 'ppga' || abbr === 'avgpa'
              || name === 'avgpointsallowed' || name === 'opppointspergame') {
            avgPointsAgainst = val || displayVal;
          }
          // Points For
          if (name === 'pointsfor' || name === 'pointfor' || abbr === 'pf') {
            pointsFor = val;
          }
          // Games played
          if (name === 'gamesplayed' || abbr === 'gp') {
            gamesPlayed = val;
          }
        }

        // Also derive games played from W-L record
        if (gamesPlayed === 0) {
          for (const s of stats) {
            const name = (s.name || '').toLowerCase();
            if (name === 'overall' || name === 'record') {
              const record = (s.displayValue || '').split('-');
              if (record.length >= 2) {
                gamesPlayed = record.reduce((sum, v) => sum + parseInt(v || 0), 0);
              }
            }
            // Or sum wins + losses
            if (name === 'wins' || name === 'losses') {
              gamesPlayed += val;
            }
          }
        }

        // Use average if directly available
        if (avgPointsAgainst > 0) {
          paMap[teamData.abbreviation] = Math.round(avgPointsAgainst * 10) / 10;
          console.log(`  ${teamData.displayName} (${teamData.abbreviation}): ${paMap[teamData.abbreviation]} PA/G (from avg stat)`);
        }
        // Otherwise compute from total / games
        else if (pointsAgainst > 0 && gamesPlayed > 0) {
          const ppga = Math.round((pointsAgainst / gamesPlayed) * 10) / 10;
          paMap[teamData.abbreviation] = ppga;
          console.log(`  ${teamData.displayName} (${teamData.abbreviation}): ${ppga} PA/G (${pointsAgainst} in ${gamesPlayed} games)`);
        }
      }
    }

    if (Object.keys(paMap).length >= 20) break; // got enough data
  }

  // Fallback: try fetching each team's record individually from core API
  if (Object.keys(paMap).length < 10) {
    console.log('  Standings fallback insufficient, trying team record endpoint...');

    const teamsData = await fetchWithRetry(`${ESPN_SITE}/teams`);
    if (teamsData?.sports?.[0]?.leagues?.[0]?.teams) {
      const teams = teamsData.sports[0].leagues[0].teams;
      for (const { team } of teams) {
        if (paMap[team.abbreviation]) continue; // already have it

        const recordUrl = `${ESPN_CORE}/seasons/${season}/types/2/teams/${team.id}/record`;
        const recordData = await fetchWithRetry(recordUrl, 1);
        if (recordData?.items) {
          for (const item of recordData.items) {
            const stats = item.stats || [];
            for (const s of stats) {
              const name = (s.name || '').toLowerCase();
              if (name === 'pointsagainst' || name === 'avgpointsagainst' || name === 'ppga') {
                const val = parseFloat(s.value || 0);
                if (val > 10) { // sanity check - NBA teams score > 10 PPG
                  paMap[team.abbreviation] = Math.round(val * 10) / 10;
                  console.log(`  ${team.displayName} (${team.abbreviation}): ${paMap[team.abbreviation]} PA/G (from record)`);
                }
              }
            }
          }
        }
        await delay(200);
      }
    }
  }

  console.log(`  Total: Got points-allowed for ${Object.keys(paMap).length} teams`);
  return paMap;
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

  // Always fetch points-allowed from standings since the stats endpoint
  // typically doesn't include it for NBA (it's a team record stat, not a box score stat)
  const zeroAllowedCount = allStats.filter(s => s.allowed === 0).length;
  if (zeroAllowedCount > 0) {
    console.log(`\n${zeroAllowedCount}/${allStats.length} teams missing points-allowed. Fetching from standings...`);
    const paMap = await fetchPointsAllowed();
    if (Object.keys(paMap).length > 0) {
      let filled = 0;
      for (const stat of allStats) {
        if (stat.allowed === 0 && paMap[stat.abbreviation] !== undefined) {
          stat.allowed = paMap[stat.abbreviation];
          filled++;
        }
      }
      console.log(`  Filled points-allowed for ${filled} teams from standings`);
    }
    const stillZero = allStats.filter(s => s.allowed === 0).length;
    if (stillZero > 0) {
      console.warn(`  WARNING: ${stillZero} teams still have 0 points-allowed after all fallbacks`);
    }
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
