// groq/chat.js - Groq LLM Integration for Sports Analysis
const Groq = require('groq-sdk');

// Initialize Groq client with API key from environment
const client = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/**
 * Analyze a sports matchup using Groq's Llama-3.2 model
 * @param {string} teamA - First team name
 * @param {string} teamB - Second team name
 * @param {object} data - Matchup stats data containing teamA and teamB stats
 * @returns {Promise<string>} - LLM analysis of the matchup
 */
async function analyzeMatchup(teamA, teamB, data) {
  try {
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

    const response = await client.chat.completions.create({
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

    // First, get the matchup data
    const axios = require('axios');
    const matchupData = await axios.get(
      `http://localhost:3000/api/matchup?teamA=${teamA}&teamB=${teamB}`
    );

    // Then analyze it with Groq
    const analysis = await analyzeMatchup(teamA, teamB, matchupData.data);

    res.json({
      teamA,
      teamB,
      stats: matchupData.data,
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
