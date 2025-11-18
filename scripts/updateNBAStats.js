// scripts/updateNBAStats.js
// Fetches NBA team stats from ESPN API and saves to CSV files
// Runs via GitHub Actions every 12 hours

const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'stats');

async function fetchNBATeamStats() {
  console.log('📊 Fetching NBA teams from ESPN API...');

  try {
    // Fetch team list
    const teamsResponse = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
      }
    );

    const teams = teamsResponse.data.sports[0].leagues[0].teams;
    console.log(`✅ Found ${teams.length} NBA teams`);

    // Data arrays for each CSV
    const ppgData = [];
    const allowedData = [];
    const fieldGoalData = [];
    const reboundMarginData = [];
    const turnoverMarginData = [];

    // Fetch stats for each team
    for (const { team } of teams) {
      try {
        console.log(`  Fetching stats for ${team.displayName}...`);

        const statsResponse = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/statistics`,
          {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000
          }
        );

        const stats = statsResponse.data.stats?.splits?.categories || [];
        const offensive = stats.find(cat => cat.name === 'offensive')?.stats || [];
        const defensive = stats.find(cat => cat.name === 'defensive')?.stats || [];

        // Extract specific stats
        const pointsPerGame = parseFloat(offensive.find(s => s.name === 'avgPointsPerGame')?.value || 0);
        const pointsAllowed = parseFloat(defensive.find(s => s.name === 'avgPointsAgainst')?.value || 0);
        const fieldGoalPct = parseFloat(offensive.find(s => s.name === 'fieldGoalPct')?.value || 0);
        const reboundsPerGame = parseFloat(offensive.find(s => s.name === 'avgReboundsPerGame')?.value || 0);
        const reboundsAllowed = parseFloat(defensive.find(s => s.name === 'avgReboundsAllowed')?.value || 0);
        const turnoversPerGame = parseFloat(offensive.find(s => s.name === 'avgTurnoversPerGame')?.value || 0);
        const turnoversForced = parseFloat(defensive.find(s => s.name === 'avgTurnoversForced')?.value || 0);

        // Calculate margins
        const reboundMargin = reboundsPerGame - reboundsAllowed;
        const turnoverMargin = turnoversForced - turnoversPerGame;

        // Add to respective arrays
        ppgData.push({
          team: team.displayName,
          abbreviation: team.abbreviation,
          ppg: pointsPerGame
        });

        allowedData.push({
          team: team.displayName,
          abbreviation: team.abbreviation,
          allowed: pointsAllowed
        });

        fieldGoalData.push({
          team: team.displayName,
          abbreviation: team.abbreviation,
          fg_pct: fieldGoalPct
        });

        reboundMarginData.push({
          team: team.displayName,
          abbreviation: team.abbreviation,
          rebound_margin: reboundMargin.toFixed(1)
        });

        turnoverMarginData.push({
          team: team.displayName,
          abbreviation: team.abbreviation,
          turnover_margin: turnoverMargin.toFixed(1)
        });

      } catch (error) {
        console.error(`  ⚠️ Failed to fetch stats for ${team.displayName}:`, error.message);
      }
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
      console.log(`✅ Created ${file.name} with ${file.data.length} teams`);
    }

    console.log('\n🎉 All NBA stats updated successfully!');
    console.log(`📁 Files saved to: ${STATS_DIR}`);

  } catch (error) {
    console.error('🔥 Error fetching NBA stats:', error.message);
    process.exit(1);
  }
}

// Run the script
fetchNBATeamStats();
