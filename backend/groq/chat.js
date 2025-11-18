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
 */
async function analyzeMatchupRoute(req, res) {
  try {
    const { teamA, teamB } = req.query;

    if (!teamA || !teamB) {
      return res.status(400).json({ error: "Missing teamA or teamB query param." });
    }

    // Import scraper utilities
    const { loadPage } = require("../scrapers/utils");

    // Scrape ESPN pages
    const [offensePage, defensePage, diffPage] = await Promise.all([
      loadPage("https://www.espn.com/nba/stats/team"),
      loadPage("https://www.espn.com/nba/stats/team/_/view/opponent/table/offensive/sort/avgPoints/dir/asc"),
      loadPage("https://www.espn.com/nba/stats/team/_/view/differential")
    ]);

    // Parse offense
    const offenseData = [];
    offensePage("table tbody tr").each((_, row) => {
      const tds = offensePage(row).find("td");
      if (tds.length > 1) {
        offenseData.push({
          team: offensePage(tds[0]).text().trim(),
          ppg: parseFloat(offensePage(tds[1]).text().trim())
        });
      }
    });

    // Parse defense
    const defenseData = [];
    defensePage("table tbody tr").each((_, row) => {
      const tds = defensePage(row).find("td");
      if (tds.length > 1) {
        defenseData.push({
          team: defensePage(tds[0]).text().trim(),
          papg: parseFloat(defensePage(tds[1]).text().trim())
        });
      }
    });

    // Parse differential
    const diffData = [];
    diffPage("table tbody tr").each((_, row) => {
      const tds = diffPage(row).find("td");
      if (tds.length > 4) {
        diffData.push({
          team: diffPage(tds[0]).text().trim(),
          reboundMargin: parseFloat(diffPage(tds[2]).text().trim()),
          turnoverMargin: parseFloat(diffPage(tds[4]).text().trim())
        });
      }
    });

    // Helper
    function getStats(name) {
      const key = name.toLowerCase();

      const off = offenseData.find(t => t.team.toLowerCase().includes(key)) || {};
      const def = defenseData.find(t => t.team.toLowerCase().includes(key)) || {};
      const df = diffData.find(t => t.team.toLowerCase().includes(key)) || {};

      return {
        team: off.team || def.team || df.team || name,
        points_per_game: off.ppg ?? null,
        points_allowed: def.papg ?? null,
        rebound_margin: df.reboundMargin ?? null,
        turnover_margin: df.turnoverMargin ?? null
      };
    }

    const teamAStats = getStats(teamA);
    const teamBStats = getStats(teamB);

    const matchupData = { teamA: teamAStats, teamB: teamBStats };

    // ⭐ FIXED: GROQ call guaranteed to fire
    const analysis = await analyzeMatchup(teamA, teamB, matchupData);

    res.json({
      teamA,
      teamB,
      stats: matchupData,
      analysis
    });

  } catch (err) {
    console.error("🔥 ERROR in /api/analyze:", err);
    res.status(500).json({ error: "Matchup analysis failed", details: err.message });
  }
}

module.exports = {
  analyzeMatchup,
  analyzeMatchupRoute
};
