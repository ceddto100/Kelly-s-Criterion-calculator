// scrapers/matchup.js - Combine all stats for a team matchup
const { loadPage } = require('./utils');

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

    // Arrays to store scraped data
    const offenseData = [];
    const defenseData = [];
    const diffData = [];

    // Fetch all stats in parallel by scraping ESPN directly
    const [offensePage, defensePage, diffPage] = await Promise.all([
      loadPage('https://www.espn.com/nba/stats/team'),
      loadPage('https://www.espn.com/nba/stats/team/_/view/opponent/table/offensive/sort/avgPoints/dir/asc'),
      loadPage('https://www.espn.com/nba/stats/team/_/view/differential')
    ]);

    // Parse offense stats
    offensePage('table tbody tr').each((_, row) => {
      const tds = offensePage(row).find('td');
      if (tds.length > 0) {
        const team = offensePage(tds[0]).text().trim();
        const ppg = parseFloat(offensePage(tds[1]).text().trim());
        if (team && !isNaN(ppg)) {
          offenseData.push({ team, ppg });
        }
      }
    });

    // Parse defense stats
    defensePage('table tbody tr').each((_, row) => {
      const tds = defensePage(row).find('td');
      if (tds.length > 0) {
        const team = defensePage(tds[0]).text().trim();
        const papg = parseFloat(defensePage(tds[1]).text().trim());
        if (team && !isNaN(papg)) {
          defenseData.push({ team, papg });
        }
      }
    });

    // Parse differential stats
    diffPage('table tbody tr').each((_, row) => {
      const tds = diffPage(row).find('td');
      if (tds.length > 4) {
        const team = diffPage(tds[0]).text().trim();
        const reboundMargin = parseFloat(diffPage(tds[2]).text().trim());
        const turnoverMargin = parseFloat(diffPage(tds[4]).text().trim());
        if (team && !isNaN(reboundMargin) && !isNaN(turnoverMargin)) {
          diffData.push({ team, reboundMargin, turnoverMargin });
        }
      }
    });

    /**
     * Find stats for a given team (case-insensitive partial match)
     * @param {string} team - Team name to search for
     * @returns {object} - Combined stats for the team
     */
    function getStats(team) {
      const teamLower = team.toLowerCase();

      const off = offenseData.find(t =>
        t.team.toLowerCase().includes(teamLower)
      ) || {};

      const def = defenseData.find(t =>
        t.team.toLowerCase().includes(teamLower)
      ) || {};

      const df = diffData.find(t =>
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
