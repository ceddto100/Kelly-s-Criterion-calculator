// scrapers/defense.js - Scrape defensive stats (Points Allowed Per Game)
const { loadPage } = require('./utils');

/**
 * GET /api/defense
 * Scrapes ESPN for Points Allowed Per Game stats
 */
async function defense(req, res) {
  try {
    const $ = await loadPage(
      'https://www.espn.com/nba/stats/team/_/view/opponent/table/offensive/sort/avgPoints/dir/asc'
    );

    const teams = [];

    // ESPN uses table structure: tbody > tr > td
    $('table tbody tr').each((_, row) => {
      const tds = $(row).find('td');

      if (tds.length > 0) {
        const team = $(tds[0]).text().trim();
        const papg = parseFloat($(tds[1]).text().trim());

        if (team && !isNaN(papg)) {
          teams.push({ team, papg });
        }
      }
    });

    if (teams.length === 0) {
      return res.status(500).json({
        error: 'No data found. ESPN page structure may have changed.'
      });
    }

    res.json(teams);
  } catch (error) {
    console.error('Error in defense scraper:', error);
    res.status(500).json({
      error: 'Failed to scrape defensive stats',
      details: error.message
    });
  }
}

module.exports = defense;
