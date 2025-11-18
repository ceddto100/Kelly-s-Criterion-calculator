// scrapers/matchup.js - Combine all stats for a team matchup (CSV-based)
const { loadCSV, findTeam } = require('../utils/loadCSV');

/**
 * GET /api/matchup?teamA=Lakers&teamB=Warriors
 * Reads stats from CSV files updated by GitHub Actions
 */
async function matchup(req, res) {
  try {
    const { teamA, teamB } = req.query;

    if (!teamA || !teamB) {
      return res.status(400).json({
        error: 'Missing required parameters. Please provide teamA and teamB in the query string.'
      });
    }

    console.log(`🏀 Loading matchup: ${teamA} vs ${teamB} (from CSV files)`);

    // Load all CSV files in parallel
    const [ppgData, allowedData, fieldGoalData, reboundMarginData, turnoverMarginData] = await Promise.all([
      loadCSV('ppg.csv'),
      loadCSV('allowed.csv'),
      loadCSV('fieldgoal.csv'),
      loadCSV('rebound_margin.csv'),
      loadCSV('turnover_margin.csv')
    ]);

    /**
     * Combine stats for a given team from all CSV files
     * @param {string} team - Team name to search for
     * @returns {object} - Combined stats for the team
     */
    function getStats(team) {
      const ppgTeam = findTeam(ppgData, team);
      const allowedTeam = findTeam(allowedData, team);
      const fgTeam = findTeam(fieldGoalData, team);
      const reboundTeam = findTeam(reboundMarginData, team);
      const turnoverTeam = findTeam(turnoverMarginData, team);

      // If no data found for this team
      if (!ppgTeam && !allowedTeam && !fgTeam && !reboundTeam && !turnoverTeam) {
        return null;
      }

      return {
        team: ppgTeam?.team || allowedTeam?.team || fgTeam?.team || reboundTeam?.team || turnoverTeam?.team || team,
        points_per_game: ppgTeam ? parseFloat(ppgTeam.ppg) : null,
        points_allowed: allowedTeam ? parseFloat(allowedTeam.allowed) : null,
        field_goal_pct: fgTeam ? parseFloat(fgTeam.fg_pct) : null,
        rebound_margin: reboundTeam ? parseFloat(reboundTeam.rebound_margin) : null,
        turnover_margin: turnoverTeam ? parseFloat(turnoverTeam.turnover_margin) : null
      };
    }

    const teamAStats = getStats(teamA);
    const teamBStats = getStats(teamB);

    // Check if we found both teams
    if (!teamAStats) {
      return res.status(404).json({
        error: `Team "${teamA}" not found in CSV data. Please check the team name.`
      });
    }

    if (!teamBStats) {
      return res.status(404).json({
        error: `Team "${teamB}" not found in CSV data. Please check the team name.`
      });
    }

    res.json({
      teamA: teamAStats,
      teamB: teamBStats,
      dataSource: 'CSV files (updated every 12 hours via GitHub Actions)',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('🔥 Error in matchup route:', error);

    // If CSV files don't exist yet, provide helpful error
    if (error.message.includes('CSV file not found')) {
      return res.status(503).json({
        error: 'Stats data not available yet',
        details: 'CSV files have not been generated. Please wait for the first GitHub Actions run or manually run: node scripts/updateNBAStats.js',
        suggestion: 'The GitHub Actions workflow runs every 12 hours. You can also trigger it manually from the Actions tab.'
      });
    }

    res.status(500).json({
      error: 'Failed to retrieve matchup data',
      details: error.message
    });
  }
}

module.exports = matchup;
