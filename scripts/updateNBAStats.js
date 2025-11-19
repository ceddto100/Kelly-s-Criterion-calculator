// scripts/updateNBAStats.js
// Using Node.js built-in fetch (available in Node 18+)
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'stats');

// Current NBA season (format: YYYY-YY)
const CURRENT_SEASON = '2024-25'; // 2024-25 season

/**
 * Fetch NBA team statistics from NBA.com stats API
 * @param {string} measureType - 'Base' for offensive stats, 'Opponent' for defensive stats
 */
async function fetchNBATeamStats(measureType = 'Base') {
  const url = 'https://stats.nba.com/stats/leaguedashteamstats';

  // NBA.com requires specific headers
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.nba.com/',
    'Origin': 'https://www.nba.com',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive'
  };

  // Parameters for the API request
  const params = new URLSearchParams({
    'Season': CURRENT_SEASON,
    'SeasonType': 'Regular Season',
    'MeasureType': measureType,
    'PerMode': 'PerGame',
    'PlusMinus': 'N',
    'PaceAdjust': 'N',
    'Rank': 'N',
    'Outcome': '',
    'Location': '',
    'Month': '0',
    'SeasonSegment': '',
    'DateFrom': '',
    'DateTo': '',
    'OpponentTeamID': '0',
    'VsConference': '',
    'VsDivision': '',
    'GameSegment': '',
    'Period': '0',
    'LastNGames': '0'
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`, { headers });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`  ⚠️  Error fetching NBA stats:`, error.message);
    throw error;
  }
}

/**
 * Main function to generate NBA stats
 */
async function generateNBAStats() {
  console.log('📊 Fetching REAL NBA team stats from NBA.com...\n');

  try {
    // Fetch both offensive and defensive stats
    console.log('  Fetching offensive team statistics...');
    const offensiveData = await fetchNBATeamStats('Base');

    console.log('  Fetching defensive team statistics (opponent stats)...');
    const defensiveData = await fetchNBATeamStats('Opponent');

    // NBA.com API returns data in format: { resultSets: [{ headers: [...], rowSet: [[...], [...]] }] }
    const offensiveResultSet = offensiveData.resultSets[0];
    const defensiveResultSet = defensiveData.resultSets[0];

    const offHeaders = offensiveResultSet.headers;
    const defHeaders = defensiveResultSet.headers;

    const offTeams = offensiveResultSet.rowSet;
    const defTeams = defensiveResultSet.rowSet;

    // Find indices for offensive stats
    const teamNameIdx = offHeaders.indexOf('TEAM_NAME');
    const teamAbbrevIdx = offHeaders.indexOf('TEAM_ABBREVIATION');
    const teamIdIdx = offHeaders.indexOf('TEAM_ID');
    const ptsIdx = offHeaders.indexOf('PTS'); // Points per game
    const fgPctIdx = offHeaders.indexOf('FG_PCT'); // Field goal percentage
    const rebIdx = offHeaders.indexOf('REB'); // Rebounds per game
    const tovIdx = offHeaders.indexOf('TOV'); // Turnovers per game

    // Find indices for defensive stats (opponent)
    const defTeamIdIdx = defHeaders.indexOf('TEAM_ID');
    // In opponent stats, PTS represents points allowed
    const defPtsIdx = defHeaders.indexOf('OPP_PTS') !== -1
      ? defHeaders.indexOf('OPP_PTS')
      : defHeaders.indexOf('PTS');

    console.log(`  ✅ Found ${offTeams.length} NBA teams\n`);

    // Create a map of defensive stats by team ID for easy lookup
    const defenseMap = new Map();
    for (const defRow of defTeams) {
      const teamId = defRow[defTeamIdIdx];
      const oppPts = defRow[defPtsIdx];
      defenseMap.set(teamId, oppPts);
    }

    const ppgData = [];
    const allowedData = [];
    const fieldGoalData = [];
    const reboundMarginData = [];
    const turnoverMarginData = [];

    // Process each team's stats
    for (const teamRow of offTeams) {
      const teamName = teamRow[teamNameIdx];
      const teamAbbrev = teamRow[teamAbbrevIdx];
      const teamId = teamRow[teamIdIdx];
      const ppg = teamRow[ptsIdx];
      const fgPct = teamRow[fgPctIdx];
      const reb = teamRow[rebIdx];
      const tov = teamRow[tovIdx];

      // Get opponent PPG (points allowed) from defensive data
      const pointsAllowed = defenseMap.get(teamId) || 0;

      console.log(`  Processing ${teamName}: ${ppg} PPG, ${pointsAllowed.toFixed(1)} allowed, ${(fgPct * 100).toFixed(1)}% FG`);

      ppgData.push({
        team: teamName,
        abbreviation: teamAbbrev,
        ppg: parseFloat(ppg.toFixed(1))
      });

      allowedData.push({
        team: teamName,
        abbreviation: teamAbbrev,
        allowed: parseFloat(pointsAllowed.toFixed(1))
      });

      fieldGoalData.push({
        team: teamName,
        abbreviation: teamAbbrev,
        fg_pct: parseFloat((fgPct * 100).toFixed(1)) // Convert to percentage
      });

      reboundMarginData.push({
        team: teamName,
        abbreviation: teamAbbrev,
        rebound_margin: parseFloat(reb.toFixed(1))
      });

      turnoverMarginData.push({
        team: teamName,
        abbreviation: teamAbbrev,
        turnover_margin: parseFloat(tov.toFixed(1))
      });
    }

    console.log(`\n  ✅ Successfully processed stats for ${ppgData.length} teams\n`);

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
    console.log(`📅 Data from: ${CURRENT_SEASON} NBA Season`);

  } catch (error) {
    console.error('🔥 Error generating NBA stats:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
generateNBAStats();
