// scripts/updateNBAStats.js
// Fetches NBA team stats from ESPN HTML pages and saves to CSV files
// Runs via GitHub Actions every 12 hours

const axios = require('axios');
const cheerio = require('cheerio');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'stats');

/**
 * Load and parse an ESPN stats page
 */
async function loadPage(url) {
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    timeout: 15000
  });
  return cheerio.load(data);
}

/**
 * Extract team name and abbreviation from ESPN table cell
 */
function extractTeamInfo(teamCell) {
  const fullName = teamCell.trim();

  // Map of team names to official abbreviations
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

  return {
    name: fullName,
    abbreviation: abbreviations[fullName] || fullName.substring(0, 3).toUpperCase()
  };
}

async function fetchNBATeamStats() {
  console.log('📊 Fetching NBA stats from ESPN HTML pages...\n');

  try {
    // Scrape Points Per Game
    console.log('  Fetching Points Per Game...');
    const ppgPage = await loadPage('https://www.espn.com/nba/stats/team');
    const ppgData = [];

    ppgPage('table tbody tr').each((_, row) => {
      const tds = ppgPage(row).find('td');

      // ESPN table: [RK, TEAM, GP, W, L, PTS, FGM, FGA, ...]
      // We want: column 1 (TEAM) and column 5 (PTS which is PPG)
      if (tds.length > 5) {
        const teamCell = ppgPage(tds[1]).text().trim();  // Column 1: Team name
        const ppg = parseFloat(ppgPage(tds[5]).text().trim());  // Column 5: Points

        if (teamCell && !isNaN(ppg) && teamCell !== 'TEAM') {
          const teamInfo = extractTeamInfo(teamCell);
          ppgData.push({
            team: teamInfo.name,
            abbreviation: teamInfo.abbreviation,
            ppg
          });
        }
      }
    });
    console.log(`  ✅ Found ${ppgData.length} teams for PPG\n`);

    // Scrape Points Allowed
    console.log('  Fetching Points Allowed...');
    const allowedPage = await loadPage('https://www.espn.com/nba/stats/team/_/view/opponent');
    const allowedData = [];

    allowedPage('table tbody tr').each((_, row) => {
      const tds = allowedPage(row).find('td');

      if (tds.length > 5) {
        const teamCell = allowedPage(tds[1]).text().trim();
        const allowed = parseFloat(allowedPage(tds[5]).text().trim());

        if (teamCell && !isNaN(allowed) && teamCell !== 'TEAM') {
          const teamInfo = extractTeamInfo(teamCell);
          allowedData.push({
            team: teamInfo.name,
            abbreviation: teamInfo.abbreviation,
            allowed
          });
        }
      }
    });
    console.log(`  ✅ Found ${allowedData.length} teams for Points Allowed\n`);

    // Scrape Field Goal Percentage
    console.log('  Fetching Field Goal Percentage...');
    const fgPage = await loadPage('https://www.espn.com/nba/stats/team/_/stat/offense');
    const fieldGoalData = [];

    fgPage('table tbody tr').each((_, row) => {
      const tds = fgPage(row).find('td');

      // Find FG% column (usually around column 8-10)
      if (tds.length > 8) {
        const teamCell = fgPage(tds[1]).text().trim();
        const fgPct = parseFloat(fgPage(tds[8]).text().trim());

        if (teamCell && !isNaN(fgPct) && teamCell !== 'TEAM') {
          const teamInfo = extractTeamInfo(teamCell);
          fieldGoalData.push({
            team: teamInfo.name,
            abbreviation: teamInfo.abbreviation,
            fg_pct: fgPct
          });
        }
      }
    });
    console.log(`  ✅ Found ${fieldGoalData.length} teams for Field Goal %\n`);

    // Scrape Differential Stats (Rebound Margin, Turnover Margin)
    console.log('  Fetching Differential Stats...');
    const diffPage = await loadPage('https://www.espn.com/nba/stats/team/_/view/differential');
    const reboundMarginData = [];
    const turnoverMarginData = [];

    diffPage('table tbody tr').each((_, row) => {
      const tds = diffPage(row).find('td');

      if (tds.length > 4) {
        const teamCell = diffPage(tds[1]).text().trim();
        const reboundMargin = parseFloat(diffPage(tds[2]).text().trim());
        const turnoverMargin = parseFloat(diffPage(tds[4]).text().trim());

        if (teamCell && teamCell !== 'TEAM') {
          const teamInfo = extractTeamInfo(teamCell);

          if (!isNaN(reboundMargin)) {
            reboundMarginData.push({
              team: teamInfo.name,
              abbreviation: teamInfo.abbreviation,
              rebound_margin: reboundMargin
            });
          }
          if (!isNaN(turnoverMargin)) {
            turnoverMarginData.push({
              team: teamInfo.name,
              abbreviation: teamInfo.abbreviation,
              turnover_margin: turnoverMargin
            });
          }
        }
      }
    });
    console.log(`  ✅ Found ${reboundMarginData.length} teams for Rebound Margin`);
    console.log(`  ✅ Found ${turnoverMarginData.length} teams for Turnover Margin\n`);

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
