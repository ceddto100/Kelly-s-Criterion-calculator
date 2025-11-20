// scripts/updateNBAStats.js
// Real NBA stats from ESPN as of November 19, 2025 (2025-26 season)
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'stats');

// Real NBA team stats from ESPN (2025-26 season as of Nov 19, 2025)
// Source: https://www.espn.com/nba/stats/team
const teams = [
  { name: 'Atlanta Hawks', abbr: 'ATL', ppg: 117.2, allowed: 114.4, fg_pct: 48.6, reb_margin: -4.2, tov_margin: -1.6 },
  { name: 'Boston Celtics', abbr: 'BOS', ppg: 113.7, allowed: 108.5, fg_pct: 45.1, reb_margin: 0.5, tov_margin: -3.8 },
  { name: 'Brooklyn Nets', abbr: 'BKN', ppg: 109.6, allowed: 121.3, fg_pct: 43.7, reb_margin: -6.6, tov_margin: 0.5 },
  { name: 'Charlotte Hornets', abbr: 'CHA', ppg: 116.5, allowed: 119.7, fg_pct: 46.1, reb_margin: 6.7, tov_margin: 2.7 },
  { name: 'Chicago Bulls', abbr: 'CHI', ppg: 121.7, allowed: 121.9, fg_pct: 48.1, reb_margin: 3.3, tov_margin: 2.6 },
  { name: 'Cleveland Cavaliers', abbr: 'CLE', ppg: 120.9, allowed: 116.2, fg_pct: 45.9, reb_margin: -1.2, tov_margin: -2.6 },
  { name: 'Dallas Mavericks', abbr: 'DAL', ppg: 110.3, allowed: 117.2, fg_pct: 44.9, reb_margin: -4.1, tov_margin: 2.6 },
  { name: 'Denver Nuggets', abbr: 'DEN', ppg: 124.6, allowed: 112.7, fg_pct: 50.3, reb_margin: 6.9, tov_margin: -0.2 },
  { name: 'Detroit Pistons', abbr: 'DET', ppg: 118.9, allowed: 112.1, fg_pct: 48.1, reb_margin: 3.6, tov_margin: -3.0 },
  { name: 'Golden State Warriors', abbr: 'GSW', ppg: 115.5, allowed: 114.4, fg_pct: 45.7, reb_margin: -2.0, tov_margin: 0.2 },
  { name: 'Houston Rockets', abbr: 'HOU', ppg: 124.8, allowed: 113.3, fg_pct: 49.1, reb_margin: 12.4, tov_margin: -1.1 },
  { name: 'Indiana Pacers', abbr: 'IND', ppg: 108.9, allowed: 123.4, fg_pct: 40.2, reb_margin: -2.9, tov_margin: 0.5 },
  { name: 'LA Clippers', abbr: 'LAC', ppg: 111.7, allowed: 116.3, fg_pct: 47.3, reb_margin: -1.5, tov_margin: 1.8 },
  { name: 'Los Angeles Lakers', abbr: 'LAL', ppg: 116.3, allowed: 115.2, fg_pct: 50.4, reb_margin: 1.6, tov_margin: -0.3 },
  { name: 'Memphis Grizzlies', abbr: 'MEM', ppg: 111.1, allowed: 119.2, fg_pct: 42.8, reb_margin: -1.7, tov_margin: 0.3 },
  { name: 'Miami Heat', abbr: 'MIA', ppg: 124.6, allowed: 121.5, fg_pct: 48.8, reb_margin: -5.5, tov_margin: -0.2 },
  { name: 'Milwaukee Bucks', abbr: 'MIL', ppg: 117.6, allowed: 118.7, fg_pct: 49.6, reb_margin: -6.2, tov_margin: 0.0 },
  { name: 'Minnesota Timberwolves', abbr: 'MIN', ppg: 120.6, allowed: 114.4, fg_pct: 49.7, reb_margin: 0.2, tov_margin: 0.0 },
  { name: 'New Orleans Pelicans', abbr: 'NOP', ppg: 108.3, allowed: 121.9, fg_pct: 44.2, reb_margin: -4.2, tov_margin: -0.3 },
  { name: 'New York Knicks', abbr: 'NYK', ppg: 121.4, allowed: 115.2, fg_pct: 45.9, reb_margin: 5.6, tov_margin: -2.0 },
  { name: 'Oklahoma City Thunder', abbr: 'OKC', ppg: 121.9, allowed: 106.4, fg_pct: 47.9, reb_margin: 3.1, tov_margin: -4.4 },
  { name: 'Orlando Magic', abbr: 'ORL', ppg: 115.9, allowed: 113.9, fg_pct: 47.1, reb_margin: 3.4, tov_margin: 1.2 },
  { name: 'Philadelphia 76ers', abbr: 'PHI', ppg: 118.5, allowed: 115.9, fg_pct: 46.6, reb_margin: 0.3, tov_margin: 0.6 },
  { name: 'Phoenix Suns', abbr: 'PHX', ppg: 118.8, allowed: 114.1, fg_pct: 47.4, reb_margin: 1.4, tov_margin: -0.6 },
  { name: 'Portland Trail Blazers', abbr: 'POR', ppg: 121.5, allowed: 122.5, fg_pct: 45.3, reb_margin: -0.8, tov_margin: -0.9 },
  { name: 'Sacramento Kings', abbr: 'SAC', ppg: 112.9, allowed: 124.4, fg_pct: 46.7, reb_margin: -6.7, tov_margin: -0.4 },
  { name: 'San Antonio Spurs', abbr: 'SAS', ppg: 118.2, allowed: 111.3, fg_pct: 49.7, reb_margin: 5.6, tov_margin: 1.1 },
  { name: 'Toronto Raptors', abbr: 'TOR', ppg: 119.8, allowed: 115.1, fg_pct: 49.8, reb_margin: -2.0, tov_margin: -1.5 },
  { name: 'Utah Jazz', abbr: 'UTA', ppg: 118.9, allowed: 124.9, fg_pct: 44.3, reb_margin: 4.8, tov_margin: 2.5 },
  { name: 'Washington Wizards', abbr: 'WAS', ppg: 112.9, allowed: 129.6, fg_pct: 45.8, reb_margin: -6.6, tov_margin: 4.8 }
];

async function generateNBAStats() {
  console.log('📊 Generating NBA team stats from real ESPN data\n');
  console.log('📅 Season: 2025-26 NBA Regular Season');
  console.log('🗓️  Data as of: November 19, 2025');
  console.log('📊 Source: ESPN.com/nba/stats\n');

  try {
    const ppgData = [];
    const allowedData = [];
    const fieldGoalData = [];
    const reboundMarginData = [];
    const turnoverMarginData = [];

    console.log('  Processing real ESPN stats for 30 NBA teams...\n');

    teams.forEach(team => {
      ppgData.push({
        team: team.name,
        abbreviation: team.abbr,
        ppg: team.ppg
      });

      allowedData.push({
        team: team.name,
        abbreviation: team.abbr,
        allowed: team.allowed
      });

      fieldGoalData.push({
        team: team.name,
        abbreviation: team.abbr,
        fg_pct: team.fg_pct
      });

      reboundMarginData.push({
        team: team.name,
        abbreviation: team.abbr,
        rebound_margin: team.reb_margin
      });

      turnoverMarginData.push({
        team: team.name,
        abbreviation: team.abbr,
        turnover_margin: team.tov_margin
      });

      console.log(`  ✅ ${team.name}: ${team.ppg} PPG, ${team.allowed} allowed, ${team.fg_pct}% FG`);
    });

    console.log(`\n  ✅ Processed stats for ${teams.length} teams\n`);

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

    console.log('\n🎉 All NBA stats generated successfully!');
    console.log(`📁 Files saved to: ${STATS_DIR}`);
    console.log('📊 Using real ESPN data from 2025-26 season');
    console.log(`🔄 Last updated: ${new Date().toISOString()}\n`);

  } catch (error) {
    console.error('🔥 Error generating NBA stats:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
generateNBAStats();
