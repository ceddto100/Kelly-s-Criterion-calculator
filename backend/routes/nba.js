// routes/nba.js - NBA Games API proxy (API-Sports Basketball)
const express = require('express');
const router = express.Router();
const { asyncHandler, logger } = require('../middleware/errorHandler');

// Simple in-memory cache (15 second TTL)
const cache = new Map();
const CACHE_TTL_MS = 15 * 1000;

/**
 * GET /api/nba/games
 *
 * Proxies requests to API-Sports Basketball API
 * Query params:
 *   - date (required): YYYY-MM-DD format
 *   - timezone (optional): defaults to America/New_York
 *   - refresh (optional): set to "1" to bypass cache
 */
router.get('/games', asyncHandler(async (req, res) => {
  const { date, timezone = 'America/New_York', refresh } = req.query;

  // Validate required date parameter
  if (!date) {
    return res.status(400).json({
      error: 'Missing required parameter: date',
      message: 'Please provide a date in YYYY-MM-DD format'
    });
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({
      error: 'Invalid date format',
      message: 'Date must be in YYYY-MM-DD format'
    });
  }

  // Check for API key
  const apiKey = process.env.APISPORTS_KEY;
  if (!apiKey) {
    logger.error('APISPORTS_KEY environment variable is not set');
    return res.status(500).json({
      error: 'API configuration error',
      message: 'NBA API key is not configured on the server'
    });
  }

  // Cache key based on date and timezone
  const cacheKey = `${date}:${timezone}`;

  // Check cache (unless refresh is requested)
  if (refresh !== '1' && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      logger.info('NBA games cache hit', { date, timezone });
      return res.json(cached.data);
    }
    // Cache expired, remove it
    cache.delete(cacheKey);
  }

  // Build API URL
  const apiUrl = new URL('https://v1.basketball.api-sports.io/games');
  apiUrl.searchParams.set('date', date);
  apiUrl.searchParams.set('timezone', timezone);

  try {
    logger.info('Fetching NBA games from API-Sports', { date, timezone });

    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('API-Sports error', {
        status: response.status,
        error: errorText
      });
      return res.status(response.status).json({
        error: 'API request failed',
        message: errorText
      });
    }

    const data = await response.json();

    // Cache the successful response
    cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });

    // Clean up old cache entries (basic memory management)
    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }

    logger.info('NBA games fetched successfully', {
      date,
      timezone,
      gamesCount: data.response?.length || 0
    });

    return res.json(data);

  } catch (error) {
    logger.error('Failed to fetch NBA games', {
      error: error.message,
      date,
      timezone
    });
    return res.status(500).json({
      error: 'Failed to fetch games',
      message: error.message
    });
  }
}));

module.exports = router;
