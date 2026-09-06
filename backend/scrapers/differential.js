// scrapers/differential.js - Scrape differential stats (Rebound & Turnover Margins)
const { loadPage } = require('./utils');

/**
 * GET /api/differential
 * Scrapes ESPN for Rebound Margin and Turnover Margin stats
 */
async function differential(req, res) {
  try {
    const $ = await loadPage(
      'https://www.espn.com/nba/stats/team/_/view/differential'
    );

    const teams = [];

    // ESPN uses table structure: tbody > tr > td
    $('table tbody tr').each((_, row) => {
      const tds = $(row).find('td');

      if (tds.length > 4) {
        const team = $(tds[0]).text().trim();
        // Column indices may vary - adjust based on actual ESPN table structure
        // Typically: Team, GP, REB margin, AST margin, TO margin, etc.
        const reboundMargin = parseFloat($(tds[2]).text().trim());
        const turnoverMargin = parseFloat($(tds[4]).text().trim());

        if (team && !isNaN(reboundMargin) && !isNaN(turnoverMargin)) {
          teams.push({ team, reboundMargin, turnoverMargin });
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
    console.error('Error in differential scraper:', error);
    res.status(500).json({
      error: 'Failed to scrape differential stats',
      details: error.message
    });
  }
}

module.exports = differential;
