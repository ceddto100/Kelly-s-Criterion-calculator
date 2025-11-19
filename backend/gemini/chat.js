// gemini/chat.js - Gemini AI Integration for NBA Matchup Analysis (Node.js, CommonJS)

/**
 * Analyze an NBA matchup using Google's Gemini AI
 */
async function analyzeMatchup(teamA, teamB, data) {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Add it to your Render environment.");
    }

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

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('🔥 Gemini API Error:', errorData);
      throw new Error(`Gemini API failed with status: ${response.status}`);
    }

    const responseData = await response.json();

    // Extract response text from Gemini's response format
    const analysisText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!analysisText) {
      throw new Error('Invalid response from Gemini API');
    }

    return analysisText;

  } catch (err) {
    console.error("🔥 Gemini API Error:", err.message);
    throw new Error("Gemini request failed: " + err.message);
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

    // STRATEGY 1: Try CSV files first (fastest, updated every 12 hours)
    try {
      console.log('📊 Strategy 1: Trying CSV files...');
      const { loadCSV, findTeam } = require("../utils/loadCSV");

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
        }
      } catch (apiError) {
        console.warn('⚠️ ESPN API failed:', apiError.message);
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

    // Call Gemini for AI analysis (optional - only if API key is set)
    let analysis = null;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (geminiApiKey && geminiApiKey !== 'your_gemini_api_key_here') {
      try {
        console.log('🤖 Generating AI analysis with Gemini...');
        analysis = await analyzeMatchup(teamA, teamB, matchupData);
      } catch (aiError) {
        console.warn('⚠️ AI analysis failed, returning stats only:', aiError.message);
        analysis = null;
      }
    } else {
      console.log('ℹ️ No Gemini API key configured - returning stats only');
    }

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
      suggestion: "AI service may be temporarily unavailable. Try again in a moment."
    });
  }
}

module.exports = {
  analyzeMatchup,
  analyzeMatchupRoute
};
