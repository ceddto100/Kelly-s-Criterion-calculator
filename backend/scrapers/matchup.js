// scrapers/matchup.js - Combine all stats for a team matchup
const axios = require('axios');

/**
 * GET /api/matchup?teamA=Lakers&teamB=Warriors
 * Combines offensive, defensive, and differential stats for two teams
 */
async function matchup(req, res) {
  try {
    const { teamA, teamB } = req.query;

    if (!teamA || !teamB) {
      return res.status(400).json({
        error: 'Missing required parameters. Please provide teamA and teamB in the query string.'
      });
    }

    // Fetch all stats in parallel
    const [offense, defense, diff] = await Promise.all([
      axios.get('http://localhost:3000/api/offense'),
      axios.get('http://localhost:3000/api/defense'),
      axios.get('http://localhost:3000/api/differential'),
    ]);

    /**
     * Find stats for a given team (case-insensitive partial match)
     * @param {string} team - Team name to search for
     * @returns {object} - Combined stats for the team
     */
    function getStats(team) {
      const teamLower = team.toLowerCase();

      const off = offense.data.find(t =>
        t.team.toLowerCase().includes(teamLower)
      ) || {};

      const def = defense.data.find(t =>
        t.team.toLowerCase().includes(teamLower)
      ) || {};

      const df = diff.data.find(t =>
        t.team.toLowerCase().includes(teamLower)
      ) || {};

      return {
        team: off.team || def.team || df.team || team,
        points_per_game: off.ppg || null,
        points_allowed: def.papg || null,
        rebound_margin: df.reboundMargin || null,
        turnover_margin: df.turnoverMargin || null
      };
    }

    const teamAStats = getStats(teamA);
    const teamBStats = getStats(teamB);

    // Check if we found both teams
    if (!teamAStats.points_per_game && !teamAStats.points_allowed) {
      return res.status(404).json({
        error: `Team "${teamA}" not found. Please check the team name.`
      });
    }

    if (!teamBStats.points_per_game && !teamBStats.points_allowed) {
      return res.status(404).json({
        error: `Team "${teamB}" not found. Please check the team name.`
      });
    }

    res.json({
      teamA: teamAStats,
      teamB: teamBStats
    });
  } catch (error) {
    console.error('Error in matchup scraper:', error);
    res.status(500).json({
      error: 'Failed to retrieve matchup data',
      details: error.message
    });
  }
}

module.exports = matchup;
