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

/**
 * Extract team name from a table row (looks for <a> tag)
 */
function extractTeamName($, row) {
  // Team names are typically in an <a> tag
  const link = $(row).find('a');
  if (link.length > 0) {
    return link.first().text().trim();
  }
  return null;
}

async function fetchNBATeamStats() {
  console.log('📊 Fetching NBA stats from ESPN HTML pages...\n');

  try {
    // Scrape Points Per Game
    console.log('  Fetching Points Per Game...');
    const ppgPage = await loadPage('https://www.espn.com/nba/stats/team');
    const ppgData = [];

    ppgPage('table tbody tr').each((_, row) => {
      const teamName = extractTeamName(ppgPage, row);

      if (teamName) {
        const tds = ppgPage(row).find('td');

        // Find the PTS column (scan all columns for the points value)
        for (let i = 0; i < tds.length; i++) {
          const val = parseFloat(ppgPage(tds[i]).text().trim());
          // PPG is typically 100-130 range
          if (!isNaN(val) && val >= 90 && val <= 140) {
            ppgData.push({
              team: teamName,
              abbreviation: abbreviations[teamName] || teamName.substring(0, 3).toUpperCase(),
              ppg: val
            });
            break;
          }
        }
      }
    });
    console.log(`  ✅ Found ${ppgData.length} teams for PPG`);
    if (ppgData.length > 0) {
      console.log(`  Sample: ${ppgData[0].team} - ${ppgData[0].ppg} PPG\n`);
    }

    // Scrape Points Allowed
    console.log('  Fetching Points Allowed...');
    const allowedPage = await loadPage('https://www.espn.com/nba/stats/team/_/view/opponent');
    const allowedData = [];

    allowedPage('table tbody tr').each((_, row) => {
      const teamName = extractTeamName(allowedPage, row);

      if (teamName) {
        const tds = allowedPage(row).find('td');

        for (let i = 0; i < tds.length; i++) {
          const val = parseFloat(allowedPage(tds[i]).text().trim());
          if (!isNaN(val) && val >= 90 && val <= 140) {
            allowedData.push({
              team: teamName,
              abbreviation: abbreviations[teamName] || teamName.substring(0, 3).toUpperCase(),
              allowed: val
            });
            break;
          }
        }
      }
    });
    console.log(`  ✅ Found ${allowedData.length} teams for Points Allowed`);
    if (allowedData.length > 0) {
      console.log(`  Sample: ${allowedData[0].team} - ${allowedData[0].allowed} allowed\n`);
    }

    // Scrape Field Goal Percentage
    console.log('  Fetching Field Goal Percentage...');
    const fgPage = await loadPage('https://www.espn.com/nba/stats/team/_/stat/offense');
    const fieldGoalData = [];

    fgPage('table tbody tr').each((_, row) => {
      const teamName = extractTeamName(fgPage, row);

      if (teamName) {
        const tds = fgPage(row).find('td');

        // FG% is typically 40-50 range
        for (let i = 0; i < tds.length; i++) {
          const val = parseFloat(fgPage(tds[i]).text().trim());
          if (!isNaN(val) && val >= 35 && val <= 60) {
            fieldGoalData.push({
              team: teamName,
              abbreviation: abbreviations[teamName] || teamName.substring(0, 3).toUpperCase(),
              fg_pct: val
            });
            break;
          }
        }
      }
    });
    console.log(`  ✅ Found ${fieldGoalData.length} teams for Field Goal %`);
    if (fieldGoalData.length > 0) {
      console.log(`  Sample: ${fieldGoalData[0].team} - ${fieldGoalData[0].fg_pct}% FG\n`);
    }

    // Scrape Differential Stats (Rebound Margin, Turnover Margin)
    console.log('  Fetching Differential Stats...');
    const diffPage = await loadPage('https://www.espn.com/nba/stats/team/_/view/differential');
    const reboundMarginData = [];
    const turnoverMarginData = [];

    diffPage('table tbody tr').each((_, row) => {
      const teamName = extractTeamName(diffPage, row);

      if (teamName) {
        const tds = diffPage(row).find('td');
        const abbrev = abbreviations[teamName] || teamName.substring(0, 3).toUpperCase();

        // Margins can be negative, typically -10 to +10
        const margins = [];
        for (let i = 0; i < tds.length; i++) {
          const val = parseFloat(diffPage(tds[i]).text().trim());
          if (!isNaN(val) && val >= -20 && val <= 20 && val !== 0) {
            margins.push(val);
          }
        }

        // Usually first margin is rebound, second is turnover
        if (margins.length >= 2) {
          reboundMarginData.push({
            team: teamName,
            abbreviation: abbrev,
            rebound_margin: margins[0]
          });
          turnoverMarginData.push({
            team: teamName,
            abbreviation: abbrev,
            turnover_margin: margins[1]
          });
        }
      }
    });
    console.log(`  ✅ Found ${reboundMarginData.length} teams for Rebound Margin`);
    console.log(`  ✅ Found ${turnoverMarginData.length} teams for Turnover Margin`);
    if (reboundMarginData.length > 0) {
      console.log(`  Sample: ${reboundMarginData[0].team} - ${reboundMarginData[0].rebound_margin} REB margin\n`);
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
