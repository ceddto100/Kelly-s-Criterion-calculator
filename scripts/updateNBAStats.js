// scripts/updateNBAStats.js
const fetch = require('node-fetch');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'stats');

// Current NBA season
const CURRENT_SEASON = 2026; // 2025-26 season
const SEASON_TYPE = 2; // Regular season (1 = preseason, 2 = regular, 3 = playoffs)

/**
 * Fetch all NBA teams from ESPN
 */
async function fetchNBATeams() {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
  const response = await fetch(url);
  const data = await response.json();
  
  return data.sports[0].leagues[0].teams.map(t => ({
    id: t.team.id,
    name: t.team.displayName,
    abbreviation: t.team.abbreviation
  }));
}

/**
 * Fetch team statistics from ESPN
 */
async function fetchTeamStats(teamId) {
  const url = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${CURRENT_SEASON}/types/${SEASON_TYPE}/teams/${teamId}/statistics`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`  ⚠️  Failed to fetch stats for team ${teamId}`);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(`  ⚠️  Error fetching team ${teamId}:`, error.message);
    return null;
  }
}

/**
 * Extract specific stat from ESPN data structure
 */
function getStat(stats, categoryName, statName) {
  if (!stats || !stats.splits || !stats.splits.categories) return null;
  
  const category = stats.splits.categories.find(c => c.name === categoryName);
  if (!category || !category.stats) return null;
  
  const stat = category.stats.find(s => s.name === statName);
  return stat ? stat.value : null;
}

/**
 * Main function to generate NBA stats
 */
async function generateNBAStats() {
  console.log('📊 Fetching REAL NBA team stats from ESPN...\n');

  try {
    // Fetch all teams
    console.log('  Fetching NBA teams...');
    const teams = await fetchNBATeams();
    console.log(`  ✅ Found ${teams.length} NBA teams\n`);

    const ppgData = [];
    const allowedData = [];
    const fieldGoalData = [];
    const reboundMarginData = [];
    const turnoverMarginData = [];

    // Fetch stats for each team
    for (const team of teams) {
      console.log(`  Fetching stats for ${team.name}...`);
      
      const stats = await fetchTeamStats(team.id);
      
      if (stats) {
        // Extract stats from ESPN data
        const ppg = getStat(stats, 'scoring', 'avgPoints');
        const pointsAllowed = getStat(stats, 'defensive', 'avgPointsAllowed');
        const fgPct = getStat(stats, 'fieldGoals', 'fieldGoalPct');
        const reboundMargin = getStat(stats, 'rebounding', 'reboundMargin');
        const turnoverMargin = getStat(stats, 'turnovers', 'turnoverMargin');

        ppgData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          ppg: ppg ? parseFloat(ppg.toFixed(1)) : 0
        });

        allowedData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          allowed: pointsAllowed ? parseFloat(pointsAllowed.toFixed(1)) : 0
        });

        fieldGoalData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          fg_pct: fgPct ? parseFloat(fgPct.toFixed(1)) : 0
        });

        reboundMarginData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          rebound_margin: reboundMargin ? parseFloat(reboundMargin.toFixed(1)) : 0
        });

        turnoverMarginData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          turnover_margin: turnoverMargin ? parseFloat(turnoverMargin.toFixed(1)) : 0
        });
      }

      // Be respectful - add delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`\n  ✅ Successfully fetched stats for ${ppgData.length} teams\n`);

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
      console.log(`  ✅ Created ${file.name} with ${file.data.length} teams`);
    }

    console.log('\n🎉 All NBA stats fetched and saved successfully!');
    console.log(`📁 Files saved to: ${STATS_DIR}`);
    console.log(`📅 Data from: ${CURRENT_SEASON - 1}-${CURRENT_SEASON} NBA Season`);

  } catch (error) {
    console.error('🔥 Error generating NBA stats:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
generateNBAStats();
