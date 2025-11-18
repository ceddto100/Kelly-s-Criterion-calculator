// groq/chat.js - Groq LLM Integration for Sports Analysis
const Groq = require('groq-sdk');

// Lazy initialization - only create client when needed
let client = null;

function getGroqClient() {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set. Please add it to your Render environment variables.');
    }

    client = new Groq({ apiKey });
  }

  return client;
}

/**
 * Analyze a sports matchup using Groq's Llama-3.2 model
 * @param {string} teamA - First team name
 * @param {string} teamB - Second team name
 * @param {object} data - Matchup stats data containing teamA and teamB stats
 * @returns {Promise<string>} - LLM analysis of the matchup
 */
async function analyzeMatchup(teamA, teamB, data) {
  try {
    const groqClient = getGroqClient();

    const prompt = `
You are a professional sports analysis assistant specializing in NBA matchups.

User asked about: ${teamA} vs ${teamB}

Here are the current season stats for both teams:

${JSON.stringify(data, null, 2)}

Provide a comprehensive comparison covering:
- Points Per Game (offensive power)
- Points Allowed (defensive strength)
- Rebound Margin (board control)
- Turnover Margin (ball security)

Format your analysis as a clear, structured comparison highlighting:
1. Key statistical advantages for each team
2. Overall strengths and weaknesses
3. A brief prediction or insight based on the data

Keep your response concise (under 600 tokens) and data-driven.
`;

    const response = await groqClient.chat.completions.create({
      model: 'llama-3.2-90b-text-preview', // Using Llama 3.2 90B (free tier)
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.7 // Balanced between creativity and consistency
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error calling Groq API:', error);

    // Provide helpful error message
    if (error.message.includes('GROQ_API_KEY')) {
      throw new Error('Groq API key is not configured. Please add GROQ_API_KEY to your environment variables.');
    }

    throw new Error(`Failed to generate analysis: ${error.message}`);
  }
}

/**
 * Express route handler for matchup analysis
 * GET /api/analyze?teamA=Lakers&teamB=Warriors
 */
async function analyzeMatchupRoute(req, res) {
  try {
    const { teamA, teamB } = req.query;

    if (!teamA || !teamB) {
      return res.status(400).json({
        error: 'Missing required parameters. Please provide teamA and teamB.'
      });
    }

    // Import the matchup scraper logic directly instead of making HTTP call
    const { loadPage } = require('../scrapers/utils');

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

    // Helper function to get stats for a team
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

    const matchupData = {
      teamA: teamAStats,
      teamB: teamBStats
    };

    // Then analyze it with Groq
    const analysis = await analyzeMatchup(teamA, teamB, matchupData);

    res.json({
      teamA,
      teamB,
      stats: matchupData,
      analysis
    });
  } catch (error) {
    console.error('Error in analyze route:', error);
    res.status(500).json({
      error: 'Failed to analyze matchup',
      details: error.message
    });
  }
}

module.exports = {
  analyzeMatchup,
  analyzeMatchupRoute
};
