// scrapers/offense.js - Scrape offensive stats (Points Per Game)
const { loadPage } = require('./utils');

/**
 * GET /api/offense
 * Scrapes ESPN for Points Per Game stats
 */
async function offense(req, res) {
  try {
    const $ = await loadPage('https://www.espn.com/nba/stats/team');

    const teams = [];

    // ESPN uses table structure: tbody > tr > td
    $('table tbody tr').each((_, row) => {
      const tds = $(row).find('td');

      if (tds.length > 0) {
        const team = $(tds[0]).text().trim();
        const ppg = parseFloat($(tds[1]).text().trim());

        if (team && !isNaN(ppg)) {
          teams.push({ team, ppg });
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
    console.error('Error in offense scraper:', error);
    res.status(500).json({
      error: 'Failed to scrape offensive stats',
      details: error.message
    });
  }
}

module.exports = offense;
