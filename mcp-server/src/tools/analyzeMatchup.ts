/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AI-powered matchup analysis tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getMatchupStats, type NBATeamStats, type NFLTeamStats } from '../utils/loadStats.js';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';
import { normalizeMatchupArgs, teamAAliasLabel, teamBAliasLabel } from '../utils/probabilityArgs.js';

/**
 * Analyze matchup using Gemini AI
 */
async function getAIAnalysis(
  teamA: string,
  teamB: string,
  sport: 'nba' | 'nfl',
  statsA: NBATeamStats | NFLTeamStats,
  statsB: NBATeamStats | NFLTeamStats
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return ''; // Skip AI analysis if no API key
  }

  try {
    const sportName = sport === 'nfl' ? 'NFL football' : 'NBA basketball';
    const prompt = `You are a professional ${sportName} matchup analyst.

Compare: ${teamA} vs ${teamB}

Using the following stats:
Team A (${teamA}): ${JSON.stringify(statsA, null, 2)}
Team B (${teamB}): ${JSON.stringify(statsB, null, 2)}

Provide a concise analysis (3-4 sentences max):
- Key statistical advantages for each team
- Who has the overall edge and why
- Any notable matchup factors

Be direct and data-driven. Focus on actionable insights for betting.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return '';
    }

    const data = await response.json() as any;
    return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    return '';
  }
}

export function registerAnalyzeMatchupTool(server: McpServer) {
  server.tool(
    'analyze-matchup',
    {
      title: 'Analyze Team Matchup with AI',
      description: `Use this when the user wants an AI-powered analysis of a sports matchup. Retrieves team statistics and provides intelligent analysis of advantages, weaknesses, and betting insights. Best used when the user asks "who will win", "analyze this game", or wants betting recommendations for a specific matchup.

**Flexible Input - Use ANY of these parameter names:**
- Team A: teamA, team_a, team1, home_team, favorite, fav
- Team B: teamB, team_b, team2, away_team, underdog, dog
- Sport: sport (nba/nfl/basketball/football), default is nba`,
      inputSchema: {
        teamA: z.string().optional().describe('First team name. Can be full name, city, or abbreviation. Example: "Lakers", "Los Angeles Lakers", "LAL", "Chiefs", "Kansas City"'),
        teamB: z.string().optional().describe('Second team name. Can be full name, city, or abbreviation. Example: "Warriors", "Golden State", "GSW", "Bills", "Buffalo"'),
        sport: z.enum(['nba', 'nfl', 'basketball', 'football']).optional().default('nba').describe('Sport league. Use "nba"/"basketball" for NBA, "nfl"/"football" for NFL. Default is "nba".'),
        // Team A aliases
        team_a: z.string().optional().describe('Alias for teamA'),
        team1: z.string().optional().describe('Alias for teamA'),
        team_1: z.string().optional().describe('Alias for teamA'),
        home_team: z.string().optional().describe('Alias for teamA'),
        home: z.string().optional().describe('Alias for teamA'),
        homeTeam: z.string().optional().describe('Alias for teamA'),
        favorite: z.string().optional().describe('Alias for teamA'),
        fav: z.string().optional().describe('Alias for teamA'),
        team_favorite: z.string().optional().describe('Alias for teamA'),
        favorite_team: z.string().optional().describe('Alias for teamA'),
        first_team: z.string().optional().describe('Alias for teamA'),
        firstTeam: z.string().optional().describe('Alias for teamA'),
        // Team B aliases
        team_b: z.string().optional().describe('Alias for teamB'),
        team2: z.string().optional().describe('Alias for teamB'),
        team_2: z.string().optional().describe('Alias for teamB'),
        away_team: z.string().optional().describe('Alias for teamB'),
        away: z.string().optional().describe('Alias for teamB'),
        awayTeam: z.string().optional().describe('Alias for teamB'),
        underdog: z.string().optional().describe('Alias for teamB'),
        dog: z.string().optional().describe('Alias for teamB'),
        team_underdog: z.string().optional().describe('Alias for teamB'),
        underdog_team: z.string().optional().describe('Alias for teamB'),
        second_team: z.string().optional().describe('Alias for teamB'),
        secondTeam: z.string().optional().describe('Alias for teamB'),
        // Sport alias
        league: z.string().optional().describe('Alias for sport')
      },
      annotations: {
        readOnlyHint: true, // Reads data and requests analysis, no modifications
        openWorldHint: true, // Calls external Gemini API for AI analysis
        destructiveHint: false // No data deletion or permanent modification
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Analyzing matchup...',
        'openai/toolInvocation/invoked': 'Matchup analysis complete'
      }
    },
    async (rawArgs, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      // Normalize arguments to handle aliases
      const { normalized: args, missingFields } = normalizeMatchupArgs(rawArgs, { defaultSport: 'nba' });
      const { teamA, teamB, sport } = args;

      if (missingFields.length > 0) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: `Missing required field(s): ${missingFields.join(', ')}`,
            missing_fields: missingFields,
            hint: 'Provide two team names. Example: teamA="Oklahoma City Thunder", teamB="San Antonio Spurs"'
          },
          content: [{
            type: 'text' as const,
            text: `Error: Missing required field(s): ${missingFields.join(', ')}\n\nHint: Provide two team names.\nExample: teamA="Oklahoma City Thunder", teamB="San Antonio Spurs"`
          }],
          isError: true
        };
      }

      try {
        // Get team statistics
        const matchup = getMatchupStats(teamA, teamB, sport);

        if (!matchup.teamA) {
          return {
            structuredContent: {
              error: 'team_not_found',
              message: `Team "${teamA}" not found in ${sport.toUpperCase()} data`
            },
            content: [{
              type: 'text' as const,
              text: `Could not find team "${teamA}" in ${sport.toUpperCase()} statistics. Please check the team name.`
            }],
            isError: true
          };
        }

        if (!matchup.teamB) {
          return {
            structuredContent: {
              error: 'team_not_found',
              message: `Team "${teamB}" not found in ${sport.toUpperCase()} data`
            },
            content: [{
              type: 'text' as const,
              text: `Could not find team "${teamB}" in ${sport.toUpperCase()} statistics. Please check the team name.`
            }],
            isError: true
          };
        }

        // Get AI analysis
        const analysis = await getAIAnalysis(
          matchup.teamA.team,
          matchup.teamB.team,
          sport,
          matchup.teamA,
          matchup.teamB
        );

        // Build response text
        let statsComparison: string;
        if (sport === 'nfl') {
          const a = matchup.teamA as NFLTeamStats;
          const b = matchup.teamB as NFLTeamStats;

          // Calculate point differential
          const aNetPoints = (a.pointsPerGame || 0) - (a.pointsAllowed || 0);
          const bNetPoints = (b.pointsPerGame || 0) - (b.pointsAllowed || 0);

          statsComparison = `## ${a.team} vs ${b.team}\n\n` +
            `### Key Statistics\n` +
            `| Metric | ${a.team} | ${b.team} |\n` +
            `|--------|----------|----------|\n` +
            `| Points/Game | ${a.pointsPerGame?.toFixed(1) ?? 'N/A'} | ${b.pointsPerGame?.toFixed(1) ?? 'N/A'} |\n` +
            `| Points Allowed | ${a.pointsAllowed?.toFixed(1) ?? 'N/A'} | ${b.pointsAllowed?.toFixed(1) ?? 'N/A'} |\n` +
            `| Net Points | ${aNetPoints > 0 ? '+' : ''}${aNetPoints.toFixed(1)} | ${bNetPoints > 0 ? '+' : ''}${bNetPoints.toFixed(1)} |\n` +
            `| Off. Yards | ${a.offensiveYards?.toFixed(0) ?? 'N/A'} | ${b.offensiveYards?.toFixed(0) ?? 'N/A'} |\n` +
            `| Def. Yards | ${a.defensiveYards?.toFixed(0) ?? 'N/A'} | ${b.defensiveYards?.toFixed(0) ?? 'N/A'} |\n` +
            `| Turnover Diff | ${a.turnoverDiff !== null ? (a.turnoverDiff > 0 ? '+' : '') + a.turnoverDiff.toFixed(1) : 'N/A'} | ${b.turnoverDiff !== null ? (b.turnoverDiff > 0 ? '+' : '') + b.turnoverDiff.toFixed(1) : 'N/A'} |`;
        } else {
          const a = matchup.teamA as NBATeamStats;
          const b = matchup.teamB as NBATeamStats;

          const aNetPoints = (a.pointsPerGame || 0) - (a.pointsAllowed || 0);
          const bNetPoints = (b.pointsPerGame || 0) - (b.pointsAllowed || 0);

          statsComparison = `## ${a.team} vs ${b.team}\n\n` +
            `### Key Statistics\n` +
            `| Metric | ${a.team} | ${b.team} |\n` +
            `|--------|----------|----------|\n` +
            `| Points/Game | ${a.pointsPerGame?.toFixed(1) ?? 'N/A'} | ${b.pointsPerGame?.toFixed(1) ?? 'N/A'} |\n` +
            `| Points Allowed | ${a.pointsAllowed?.toFixed(1) ?? 'N/A'} | ${b.pointsAllowed?.toFixed(1) ?? 'N/A'} |\n` +
            `| Net Rating | ${aNetPoints > 0 ? '+' : ''}${aNetPoints.toFixed(1)} | ${bNetPoints > 0 ? '+' : ''}${bNetPoints.toFixed(1)} |\n` +
            `| FG% | ${a.fieldGoalPct !== null ? (a.fieldGoalPct * 100).toFixed(1) + '%' : 'N/A'} | ${b.fieldGoalPct !== null ? (b.fieldGoalPct * 100).toFixed(1) + '%' : 'N/A'} |\n` +
            `| Reb. Margin | ${a.reboundMargin !== null ? (a.reboundMargin > 0 ? '+' : '') + a.reboundMargin.toFixed(1) : 'N/A'} | ${b.reboundMargin !== null ? (b.reboundMargin > 0 ? '+' : '') + b.reboundMargin.toFixed(1) : 'N/A'} |\n` +
            `| TO Margin | ${a.turnoverMargin !== null ? (a.turnoverMargin > 0 ? '+' : '') + a.turnoverMargin.toFixed(1) : 'N/A'} | ${b.turnoverMargin !== null ? (b.turnoverMargin > 0 ? '+' : '') + b.turnoverMargin.toFixed(1) : 'N/A'} |`;
        }

        const fullText = analysis
          ? `${statsComparison}\n\n### AI Analysis\n${analysis}`
          : `${statsComparison}\n\n_AI analysis not available. Use the statistics above with probability-estimate tools for betting calculations._`;

        return {
          structuredContent: {
            sport: sport,
            teamA: matchup.teamA,
            teamB: matchup.teamB,
            analysis: analysis || null,
            dataSource: matchup.dataSource,
            analyzedAt: new Date().toISOString()
          },
          content: [{
            type: 'text' as const,
            text: fullText + '\n\n_Use probability-estimate tools with a point spread to calculate cover probabilities, then kelly-calculate for optimal bet sizing._'
          }],
          _meta: {
            'openai/locale': locale
          }
        };
      } catch (error) {
        console.error('Error analyzing matchup:', error);
        return {
          structuredContent: {
            error: 'analysis_error',
            message: error instanceof Error ? error.message : 'Failed to analyze matchup'
          },
          content: [{
            type: 'text' as const,
            text: 'An error occurred while analyzing the matchup. Please try again.'
          }],
          isError: true
        };
      }
    }
  );
}
