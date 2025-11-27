// groq/chat.js - Fixed Groq LLM Integration (Node.js, CommonJS)
const Groq = require("groq-sdk");

// Lazy initialization of Groq client
let client = null;

function getGroqClient() {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set. Add it to your Render environment.");
    }

    client = new Groq({ apiKey });
  }

  return client;
}

/**
 * Analyze an NBA matchup using Groq's llama3-70b-8192 model
 */
async function analyzeMatchup(teamA, teamB, data) {
  try {
    const groq = getGroqClient();

    const prompt = `
You are a professional NBA matchup analyst.

Compare: ${teamA} vs ${teamB}

Using the following stats:
${JSON.stringify(data, null, 2)}

Provide:
- Key statistical edges
- Strengths & weaknesses
- Who has the advantage overall
Keep it concise and data-driven.
`;

    // ⭐ FIXED: Correct Groq model + correct API call
    const response = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 600,
      temperature: 0.7
    });

    // Return response text
    return response.choices[0].message.content;

  } catch (err) {
    console.error("🔥 Groq API Error:", err.response?.data || err.message);

    throw new Error("Groq request failed: " + (err.response?.data?.error || err.message));
  }
}

/**
 * Express route handler: GET /api/analyze?teamA=X&teamB=Y
 * Uses 3-tier fallback: CSV Files → ESPN API → Estimated Data
 */
async function analyzeMatchupRoute(req, res) {
  try {
    const { teamA, teamB } = req.query;

    if (!teamA || !teamB) {
      return res.status(400).json({ error: "Missing teamA or teamB query param." });
    }

    console.log(`🏀 Analyzing matchup: ${teamA} vs ${teamB}`);

    let matchupData = null;
    let dataSource = 'unknown';
    let teamAFound = false;
    let teamBFound = false;

    // STRATEGY 1: Try CSV files first (fastest, updated every 12 hours)
    try {
      console.log('📊 Strategy 1: Trying CSV files...');
      const { loadCSV, findTeam } = require("../utils/loadCSV");
      const { getTeamSuggestions } = require("../utils/fuzzyTeamMatch");

      const [ppgData, allowedData, fieldGoalData, reboundMarginData, turnoverMarginData] = await Promise.all([
        loadCSV('ppg.csv'),
        loadCSV('allowed.csv'),
        loadCSV('fieldgoal.csv'),
        loadCSV('rebound_margin.csv'),
        loadCSV('turnover_margin.csv')
      ]);

      function getStatsFromCSV(team) {
        const ppgTeam = findTeam(ppgData, team);
        const allowedTeam = findTeam(allowedData, team);
        const fgTeam = findTeam(fieldGoalData, team);
        const reboundTeam = findTeam(reboundMarginData, team);
        const turnoverTeam = findTeam(turnoverMarginData, team);

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

      const teamAStats = getStatsFromCSV(teamA);
      const teamBStats = getStatsFromCSV(teamB);

      if (teamAStats && teamBStats) {
        matchupData = { teamA: teamAStats, teamB: teamBStats };
        dataSource = 'CSV files (updated every 12 hours via GitHub Actions)';
        console.log('✅ Successfully loaded data from CSV files');
        teamAFound = true;
        teamBFound = true;
      } else {
        // Track which teams were not found in CSV
        teamAFound = !!teamAStats;
        teamBFound = !!teamBStats;
        console.log(`CSV results: teamA=${teamAFound}, teamB=${teamBFound}`);
      }
    } catch (csvError) {
      console.warn('⚠️ CSV loading failed:', csvError.message);
    }

    // STRATEGY 2: Fall back to ESPN API if CSV failed
    if (!matchupData) {
      console.log('📊 Strategy 2: Trying ESPN API...');
      try {
        const { fetchNBATeamStats, findTeamByName } = require("../scrapers/nbaStatsApi");

        const allTeams = await fetchNBATeamStats();
        const teamAStats = findTeamByName(allTeams, teamA);
        const teamBStats = findTeamByName(allTeams, teamB);

        if (teamAStats && teamBStats) {
          matchupData = {
            teamA: {
              team: teamAStats.name,
              points_per_game: teamAStats.stats.pointsPerGame,
              points_allowed: teamAStats.stats.pointsAllowed,
              field_goal_pct: teamAStats.stats.fieldGoalPct,
              rebounds_per_game: teamAStats.stats.reboundsPerGame,
              turnovers_per_game: teamAStats.stats.turnoversPerGame
            },
            teamB: {
              team: teamBStats.name,
              points_per_game: teamBStats.stats.pointsPerGame,
              points_allowed: teamBStats.stats.pointsAllowed,
              field_goal_pct: teamBStats.stats.fieldGoalPct,
              rebounds_per_game: teamBStats.stats.reboundsPerGame,
              turnovers_per_game: teamBStats.stats.turnoversPerGame
            }
          };
          dataSource = 'ESPN API (live fallback)';
          console.log('✅ Successfully fetched data from ESPN API');
          teamAFound = true;
          teamBFound = true;
        } else {
          // Track which teams were not found in ESPN API
          if (!teamAFound) teamAFound = !!teamAStats;
          if (!teamBFound) teamBFound = !!teamBStats;
          console.log(`ESPN API results: teamA=${!!teamAStats}, teamB=${!!teamBStats}`);
        }
      } catch (apiError) {
        console.warn('⚠️ ESPN API failed:', apiError.message);
      }
    }

    // Before falling back to estimated data, check if teams were not found
    // If so, return suggestions instead
    if (!matchupData && (!teamAFound || !teamBFound)) {
      console.log(`⚠️ Team(s) not found - returning suggestions`);

      try {
        const { loadCSV } = require("../utils/loadCSV");
        const { getTeamSuggestions } = require("../utils/fuzzyTeamMatch");

        // Load at least one CSV file to get team list for suggestions
        const ppgData = await loadCSV('ppg.csv');

        const suggestions = {};

        if (!teamAFound) {
          suggestions.teamA = getTeamSuggestions(teamA, ppgData, 1);
        }

        if (!teamBFound) {
          suggestions.teamB = getTeamSuggestions(teamB, ppgData, 1);
        }

        return res.status(404).json({
          error: "Team not found",
          notFound: {
            teamA: !teamAFound ? teamA : null,
            teamB: !teamBFound ? teamB : null
          },
          suggestions,
          message: "Did you mean this team?"
        });
      } catch (suggestionError) {
        console.warn('⚠️ Could not generate suggestions:', suggestionError.message);
      }
    }

    // STRATEGY 3: Use fallback data if both failed
    if (!matchupData) {
      console.log('📊 Strategy 3: Using estimated data...');
      matchupData = {
        teamA: {
          team: teamA,
          points_per_game: 110.5,
          points_allowed: 108.2,
          rebound_margin: 2.1,
          turnover_margin: 0.5,
          note: "Stats unavailable - using league averages"
        },
        teamB: {
          team: teamB,
          points_per_game: 108.3,
          points_allowed: 110.8,
          rebound_margin: -1.2,
          turnover_margin: -0.8,
          note: "Stats unavailable - using league averages"
        }
      };
      dataSource = 'Estimated (Data sources unavailable)';
      console.log('⚠️ Using fallback estimated data');
    }

    // Call Groq for AI analysis
    console.log('🤖 Generating AI analysis with Groq...');
    const analysis = await analyzeMatchup(teamA, teamB, matchupData);

    res.json({
      teamA,
      teamB,
      stats: matchupData,
      analysis,
      dataSource,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error("🔥 ERROR in /api/analyze:", err);
    res.status(500).json({
      error: "Matchup analysis failed",
      details: err.message,
      suggestion: "ESPN may be temporarily unavailable. Try again in a moment."
    });
  }
}

module.exports = {
  analyzeMatchup,
  analyzeMatchupRoute
};
