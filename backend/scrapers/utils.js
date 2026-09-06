// scrapers/utils.js - Helper functions for web scraping
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Load a webpage and return a Cheerio instance for parsing
 * @param {string} url - The URL to fetch
 * @returns {Promise<CheerioAPI>} - Cheerio instance loaded with the page HTML
 */
async function loadPage(url) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000 // 10 second timeout
    });
    return cheerio.load(data);
  } catch (error) {
    console.error(`Error loading page ${url}:`, error.message);
    throw new Error(`Failed to load page: ${error.message}`);
  }
}

module.exports = { loadPage };
