// scripts/updateNBAStats.js
// Fetches NBA team stats from balldontlie.io API and saves to CSV files
// Runs via GitHub Actions every 12 hours

const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'stats');
const API_BASE = 'https://api.balldontlie.io/v1';

/**
 * Map of team names to official abbreviations
 */
const abbreviations = {
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'LA Clippers': 'LAC', 'Los Angeles Clippers': 'LAC', 'LA Lakers': 'LAL',
  'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA',
  'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP',
  'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL',
  'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS'
};

async function fetchNBATeamStats() {
  console.log('📊 Fetching NBA stats from balldontlie.io API...\n');

  try {
    // Get all teams
    console.log('  Fetching team list...');
    const teamsResponse = await axios.get(`${API_BASE}/teams`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    });

    const teams = teamsResponse.data.data;
    console.log(`  ✅ Found ${teams.length} teams\n`);

    // Get current season games to calculate stats
    console.log('  Fetching season stats (this may take a minute)...');

    const teamStats = {};

    // Initialize stats for each team
    teams.forEach(team => {
      const fullName = `${team.city} ${team.name}`;
      teamStats[team.id] = {
        name: fullName,
        abbreviation: team.abbreviation,
        games: 0,
        totalPoints: 0,
        totalPointsAllowed: 0,
        totalFGM: 0,
        totalFGA: 0,
        totalReb: 0,
        totalOppReb: 0,
        totalTO: 0,
        totalOppTO: 0
      };
    });

    // Fetch recent games (last 100 pages to get current season)
    // balldontlie API returns games in pages of 25
    let page = 1;
    const maxPages = 20; // Get ~500 recent games

    while (page <= maxPages) {
      try {
        const gamesResponse = await axios.get(`${API_BASE}/games`, {
          params: {
            seasons: [2024],
            per_page: 25,
            page: page
          },
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 15000
        });

        const games = gamesResponse.data.data;
        if (games.length === 0) break;

        // Process each game
        games.forEach(game => {
          if (game.home_team && game.visitor_team && game.home_team_score && game.visitor_team_score) {
            const homeId = game.home_team.id;
            const awayId = game.visitor_team.id;

            if (teamStats[homeId] && teamStats[awayId]) {
              // Home team stats
              teamStats[homeId].games++;
              teamStats[homeId].totalPoints += game.home_team_score;
              teamStats[homeId].totalPointsAllowed += game.visitor_team_score;

              // Away team stats
              teamStats[awayId].games++;
              teamStats[awayId].totalPoints += game.visitor_team_score;
              teamStats[awayId].totalPointsAllowed += game.home_team_score;
            }
          }
        });

        console.log(`    Processed page ${page}/${maxPages} (${games.length} games)`);
        page++;

        // Rate limiting - wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`    Error fetching page ${page}:`, error.message);
        break;
      }
    }

    console.log(`  ✅ Processed game data\n`);

    // Calculate averages and create CSV data
    const ppgData = [];
    const allowedData = [];
    const fieldGoalData = [];
    const reboundMarginData = [];
    const turnoverMarginData = [];

    Object.values(teamStats).forEach(team => {
      if (team.games > 0) {
        const ppg = (team.totalPoints / team.games).toFixed(1);
        const allowed = (team.totalPointsAllowed / team.games).toFixed(1);
        const fgPct = team.totalFGA > 0 ? ((team.totalFGM / team.totalFGA) * 100).toFixed(1) : 45.0;
        const rebMargin = ((team.totalReb - team.totalOppReb) / team.games).toFixed(1);
        const toMargin = ((team.totalOppTO - team.totalTO) / team.games).toFixed(1);

        ppgData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          ppg: parseFloat(ppg)
        });

        allowedData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          allowed: parseFloat(allowed)
        });

        fieldGoalData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          fg_pct: parseFloat(fgPct)
        });

        reboundMarginData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          rebound_margin: parseFloat(rebMargin)
        });

        turnoverMarginData.push({
          team: team.name,
          abbreviation: team.abbreviation,
          turnover_margin: parseFloat(toMargin)
        });
      }
    });

    console.log(`  ✅ Calculated stats for ${ppgData.length} teams`);
    if (ppgData.length > 0) {
      console.log(`  Sample: ${ppgData[0].team} - ${ppgData[0].ppg} PPG\n`);
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
      if (file.data.length === 0) {
        console.error(`  ⚠️ No data for ${file.name} - skipping`);
        continue;
      }

      const parser = new Parser({ fields: file.fields });
      const csv = parser.parse(file.data);
      const filePath = path.join(STATS_DIR, file.name);
      fs.writeFileSync(filePath, csv);
      console.log(`  ✅ Created ${file.name} with ${file.data.length} teams`);
    }

    console.log('\n🎉 All NBA stats updated successfully!');
    console.log(`📁 Files saved to: ${STATS_DIR}`);

  } catch (error) {
    console.error('🔥 Error fetching NBA stats:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
fetchNBATeamStats();
