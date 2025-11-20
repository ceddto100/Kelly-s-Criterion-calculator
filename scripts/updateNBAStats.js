// scripts/updateNBAStats.js
// Fetches REAL NBA stats from ESPN API for 2025-26 season
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'stats');

// Current NBA season (2025-26 season = year 2026 in ESPN API)
const SEASON_YEAR = 2026;
const SEASON_TYPE = 2; // 1=preseason, 2=regular, 3=playoffs

/**
 * Fetch all NBA teams from ESPN
 */
async function fetchNBATeams() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';

  console.log('  Fetching NBA teams from ESPN...');
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch teams: ${response.status}`);
  }

  const data = await response.json();

  if (!data.sports?.[0]?.leagues?.[0]?.teams) {
    throw new Error('Unexpected API response structure');
  }

  const teams = data.sports[0].leagues[0].teams.map(t => ({
    id: t.team.id,
    name: t.team.displayName,
    abbreviation: t.team.abbreviation
  }));

  console.log(`  ✅ Found ${teams.length} NBA teams\n`);
  return teams;
}

/**
 * Fetch team statistics from ESPN
 */
async function fetchTeamStats(teamId, teamName) {
  const url = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${SEASON_YEAR}/types/${SEASON_TYPE}/teams/${teamId}/statistics`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.log(`  ⚠️  No stats available for ${teamName} (${response.status})`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.log(`  ⚠️  Error fetching ${teamName}: ${error.message}`);
    return null;
  }
}

/**
 * Extract a specific stat value from ESPN's nested structure
 */
function getStat(statsData, categoryName, statName) {
  try {
    if (!statsData?.splits?.categories) return null;

    const category = statsData.splits.categories.find(c => c.name === categoryName);
    if (!category?.stats) return null;

    const stat = category.stats.find(s => s.name === statName);
    return stat?.value ?? null;
  } catch (error) {
    return null;
  }
}

/**
 * Calculate per-game average if we only have totals
 */
function calculateAverage(total, gamesPlayed) {
  if (!total || !gamesPlayed || gamesPlayed === 0) return null;
  return total / gamesPlayed;
}

/**
 * Fetch scoreboard to get games played count
 */
async function fetchGamesPlayed() {
  try {
    const url = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings';
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    const gamesMap = new Map();

    // Extract games played from standings
    if (data.children?.[0]?.standings?.entries) {
      for (const entry of data.children[0].standings.entries) {
        if (entry.team?.id && entry.stats) {
          const gamesPlayed = entry.stats.find(s => s.name === 'gamesPlayed')?.value;
          if (gamesPlayed) {
            gamesMap.set(entry.team.id, gamesPlayed);
          }
        }
      }
    }

    return gamesMap;
  } catch (error) {
    console.log('  ℹ️  Could not fetch games played data');
    return null;
  }
}

/**
 * Main function to generate NBA stats
 */
async function generateNBAStats() {
  console.log('📊 Fetching REAL NBA team stats from ESPN API\n');
  console.log(`📅 Season: 2025-26 (Year ${SEASON_YEAR})\n`);

  try {
    // Fetch all teams
    const teams = await fetchNBATeams();

    // Fetch games played for each team
    console.log('  Fetching games played data...');
    const gamesPlayedMap = await fetchGamesPlayed();
    if (gamesPlayedMap) {
      console.log(`  ✅ Found games played for ${gamesPlayedMap.size} teams\n`);
    } else {
      console.log('  ⚠️  Games played data unavailable\n');
    }

    const ppgData = [];
    const allowedData = [];
    const fieldGoalData = [];
    const reboundMarginData = [];
    const turnoverMarginData = [];

    // Fetch stats for each team
    console.log('  Fetching team statistics...\n');
    let successCount = 0;
    let failCount = 0;

    for (const team of teams) {
      console.log(`  Processing ${team.name}...`);

      const stats = await fetchTeamStats(team.id, team.name);

      if (stats) {
        // Get games played for this team
        const gamesPlayed = gamesPlayedMap?.get(team.id) || null;

        // Extract stats - try both per-game and total versions
        let ppg = getStat(stats, 'scoring', 'avgPoints');
        let pointsAllowed = getStat(stats, 'defensive', 'avgPointsAllowed');

        // If we only have totals, calculate averages
        if (!ppg && gamesPlayed) {
          const totalPoints = getStat(stats, 'scoring', 'points');
          ppg = calculateAverage(totalPoints, gamesPlayed);
        }

        if (!pointsAllowed && gamesPlayed) {
          const totalPointsAllowed = getStat(stats, 'defensive', 'pointsAllowed');
          pointsAllowed = calculateAverage(totalPointsAllowed, gamesPlayed);
        }

        const fgPct = getStat(stats, 'fieldGoals', 'fieldGoalPct');
        const reboundMargin = getStat(stats, 'rebounding', 'reboundMargin');
        const turnoverMargin = getStat(stats, 'turnovers', 'turnoverMargin');

        // Only add if we have at least PPG data
        if (ppg !== null) {
          ppgData.push({
            team: team.name,
            abbreviation: team.abbreviation,
            ppg: parseFloat(ppg.toFixed(1))
          });

          allowedData.push({
            team: team.name,
            abbreviation: team.abbreviation,
            allowed: pointsAllowed !== null ? parseFloat(pointsAllowed.toFixed(1)) : 0
          });

          fieldGoalData.push({
            team: team.name,
            abbreviation: team.abbreviation,
            fg_pct: fgPct !== null ? parseFloat(fgPct.toFixed(1)) : 0
          });

          reboundMarginData.push({
            team: team.name,
            abbreviation: team.abbreviation,
            rebound_margin: reboundMargin !== null ? parseFloat(reboundMargin.toFixed(1)) : 0
          });

          turnoverMarginData.push({
            team: team.name,
            abbreviation: team.abbreviation,
            turnover_margin: turnoverMargin !== null ? parseFloat(turnoverMargin.toFixed(1)) : 0
          });

          console.log(`    ✅ ${ppg.toFixed(1)} PPG, ${pointsAllowed?.toFixed(1) || 'N/A'} allowed, ${fgPct?.toFixed(1) || 'N/A'}% FG`);
          successCount++;
        } else {
          console.log(`    ⚠️  No valid stats available`);
          failCount++;
        }
      } else {
        console.log(`    ❌ Failed to fetch stats`);
        failCount++;
      }

      // Rate limiting - be respectful to ESPN
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    console.log(`\n📊 Stats Summary:`);
    console.log(`  ✅ Successfully fetched: ${successCount} teams`);
    console.log(`  ❌ Failed to fetch: ${failCount} teams\n`);

    if (successCount === 0) {
      throw new Error('No stats were successfully fetched. Season may not have started yet.');
    }

    // Create stats directory if it doesn't exist
    if (!fs.existsSync(STATS_DIR)) {
      fs.mkdirSync(STATS_DIR, { recursive: true });
    }

    // Convert to CSV and save
    const files = [
      { name: 'ppg.csv', data: ppgData, fields: ['team', 'abbreviation', 'ppg'] },
      { name: 'allowed.csv', data: allowedData, fields: ['team', 'abbreviation', 'allowed'] },
      { name: 'fieldgoal.csv', data: fieldGoalData, fields: ['team', 'abbreviation', 'fg_pct'] },
      { name: 'rebound_margin.csv', data: reboundMarginData, fields: ['team', 'abbreviation', 'rebound_margin'] },
      { name: 'turnover_margin.csv', data: turnoverMarginData, fields: ['team', 'abbreviation', 'turnover_margin'] }
    ];

    for (const file of files) {
      const parser = new Parser({ fields: file.fields });
      const csv = parser.parse(file.data);
      const filePath = path.join(STATS_DIR, file.name);
      fs.writeFileSync(filePath, csv);
      console.log(`  ✅ Saved ${file.name} (${file.data.length} teams)`);
    }

    console.log('\n🎉 NBA stats successfully fetched and saved!');
    console.log(`📁 Location: ${STATS_DIR}`);
    console.log(`📅 Season: 2025-26 NBA Regular Season`);
    console.log(`🔄 Last updated: ${new Date().toISOString()}\n`);

  } catch (error) {
    console.error('\n🔥 Error generating NBA stats:');
    console.error(`   ${error.message}\n`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
generateNBAStats();
