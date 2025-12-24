/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Basketball probability estimation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { predictedMarginBasketball, coverProbability, type BasketballStats } from '../utils/calculations.js';
import { loadNBATeamStats, getAllNBATeamNames } from '../utils/loadStats.js';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';

/**
 * Normalize input arguments to handle aliases
 */
function normalizeBasketballArgs(rawArgs: any): {
  sport: string;
  team_favorite: string;
  team_underdog: string;
  spread: number;
} {
  // Handle team_favorite aliases
  const team_favorite = rawArgs.team_favorite
    || rawArgs.favorite_team
    || rawArgs.favorite
    || rawArgs.fav
    || '';

  // Handle team_underdog aliases
  const team_underdog = rawArgs.team_underdog
    || rawArgs.underdog_team
    || rawArgs.underdog
    || rawArgs.dog
    || '';

  return {
    sport: rawArgs.sport || 'basketball',
    team_favorite: String(team_favorite).trim(),
    team_underdog: String(team_underdog).trim(),
    spread: Number(rawArgs.spread)
  };
}

/**
 * Find closest matching team names for suggestions
 */
function getSuggestedTeams(searchTerm: string, sport: 'nba' | 'nfl' = 'nba'): string[] {
  if (sport !== 'nba') return [];

  const allTeams = getAllNBATeamNames();
  const normalized = searchTerm.toLowerCase();

  // Find teams that partially match
  const matches = allTeams.filter(team =>
    team.toLowerCase().includes(normalized) ||
    normalized.includes(team.toLowerCase())
  );

  return matches.slice(0, 5); // Return top 5 suggestions
}

export function registerBasketballProbabilityTool(server: McpServer) {
  server.tool(
    'probability-estimate-basketball',
    {
      title: 'Estimate Basketball Game Probability',
      description: 'Use this when the user wants to estimate the probability of covering a point spread for NBA basketball games. Accepts team names and spread, returns probabilities for both favorite and underdog. Supports field aliases: team_favorite (or favorite_team, favorite, fav) and team_underdog (or underdog_team, underdog, dog). Do not use for football games (use probability-estimate-football instead) or calculating bet sizes (use kelly-calculate after getting probability).',
      inputSchema: {
        sport: z.literal('basketball').optional().default('basketball').describe('Sport type - "basketball"'),
        team_favorite: z.string().optional().describe('Name of the favored team. Can be full name (e.g., "Houston Rockets"), city (e.g., "Rockets"), or abbreviation (e.g., "HOU"). Aliases: favorite_team, favorite, fav'),
        team_underdog: z.string().optional().describe('Name of the underdog team. Can be full name (e.g., "Los Angeles Lakers"), city (e.g., "Lakers"), or abbreviation (e.g., "LAL"). Aliases: underdog_team, underdog, dog'),
        spread: z.number().describe('Point spread from the favorite\'s perspective. Must be negative (e.g., -3.5 means favorite must win by more than 3.5 points to cover). Valid range: -50 to -0.5'),
        // Alias fields
        favorite_team: z.string().optional().describe('Alias for team_favorite'),
        favorite: z.string().optional().describe('Alias for team_favorite'),
        fav: z.string().optional().describe('Alias for team_favorite'),
        underdog_team: z.string().optional().describe('Alias for team_underdog'),
        underdog: z.string().optional().describe('Alias for team_underdog'),
        dog: z.string().optional().describe('Alias for team_underdog')
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/probability-estimator.html',
        'openai/toolInvocation/invoking': 'Estimating basketball probability...',
        'openai/toolInvocation/invoked': 'Estimated basketball probability',
        'openai/widgetAccessible': true
      }
    },
    async (rawArgs, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      // Normalize arguments to handle aliases
      const args = normalizeBasketballArgs(rawArgs);

      // Validate required fields AFTER normalization
      const missingFields: string[] = [];

      if (!args.team_favorite || args.team_favorite === '') {
        missingFields.push('team_favorite (or favorite_team, favorite, fav)');
      }

      if (!args.team_underdog || args.team_underdog === '') {
        missingFields.push('team_underdog (or underdog_team, underdog, dog)');
      }

      if (typeof args.spread !== 'number' || isNaN(args.spread)) {
        missingFields.push('spread');
      }

      if (missingFields.length > 0) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: `Missing required field(s): ${missingFields.join(', ')}`,
            missing_fields: missingFields
          },
          content: [{
            type: 'text',
            text: `Error: Missing required field(s): ${missingFields.join(', ')}`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Validate spread
      if (args.spread >= 0) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Spread must be negative (from favorite\'s perspective)',
            hint: 'The favorite is expected to win, so the spread should be negative (e.g., -3.5)'
          },
          content: [{
            type: 'text',
            text: 'Error: Spread must be negative (e.g., -3.5) from the favorite\'s perspective. The favorite is expected to win, so the spread should be negative.'
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      if (args.spread < -50 || args.spread > -0.5) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Spread out of valid range (-50 to -0.5)'
          },
          content: [{
            type: 'text',
            text: 'Error: Spread must be between -50 and -0.5 points.'
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Load team statistics
      const favoriteStats = loadNBATeamStats(args.team_favorite);
      const underdogStats = loadNBATeamStats(args.team_underdog);

      // Handle team not found with suggestions
      if (!favoriteStats) {
        const suggestions = getSuggestedTeams(args.team_favorite, 'nba');
        return {
          structuredContent: {
            error: 'invalid_input',
            message: `Unknown team name: "${args.team_favorite}"`,
            team_searched: args.team_favorite,
            suggestions: suggestions.length > 0 ? suggestions : ['Please check team name or use abbreviation (e.g., HOU, LAL, NYK)']
          },
          content: [{
            type: 'text',
            text: `Error: Unknown team name "${args.team_favorite}". ${suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?` : 'Please check the team name and try again.'}`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      if (!underdogStats) {
        const suggestions = getSuggestedTeams(args.team_underdog, 'nba');
        return {
          structuredContent: {
            error: 'invalid_input',
            message: `Unknown team name: "${args.team_underdog}"`,
            team_searched: args.team_underdog,
            suggestions: suggestions.length > 0 ? suggestions : ['Please check team name or use abbreviation (e.g., HOU, LAL, NYK)']
          },
          content: [{
            type: 'text',
            text: `Error: Unknown team name "${args.team_underdog}". ${suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?` : 'Please check the team name and try again.'}`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Validate that we have the required stats
      if (favoriteStats.pointsPerGame === null || favoriteStats.pointsAllowed === null ||
          underdogStats.pointsPerGame === null || underdogStats.pointsAllowed === null) {
        return {
          structuredContent: {
            error: 'insufficient_data',
            message: 'Insufficient team statistics available',
            teams: {
              favorite: favoriteStats.team,
              underdog: underdogStats.team
            }
          },
          content: [{
            type: 'text',
            text: `Error: One or both teams (${favoriteStats.team}, ${underdogStats.team}) are missing required statistics (points per game, points allowed). Cannot calculate probability.`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Build stats object for calculation
      const stats: BasketballStats = {
        teamPointsFor: favoriteStats.pointsPerGame,
        teamPointsAgainst: favoriteStats.pointsAllowed,
        opponentPointsFor: underdogStats.pointsPerGame,
        opponentPointsAgainst: underdogStats.pointsAllowed,
        teamFgPct: favoriteStats.fieldGoalPct ?? 0.45,
        opponentFgPct: underdogStats.fieldGoalPct ?? 0.45,
        teamReboundMargin: favoriteStats.reboundMargin ?? 0,
        opponentReboundMargin: underdogStats.reboundMargin ?? 0,
        teamTurnoverMargin: favoriteStats.turnoverMargin ?? 0,
        opponentTurnoverMargin: underdogStats.turnoverMargin ?? 0
      };

      // Calculate predicted margin and probabilities
      const predictedMargin = predictedMarginBasketball(stats);
      const sigma = 12.0;

      const favoriteCoverProb = coverProbability(predictedMargin, args.spread, sigma);
      const underdogCoverProb = 100 - favoriteCoverProb;

      // Normalize probabilities to ensure they sum to exactly 1.00
      const favorite_cover_probability = Number((favoriteCoverProb / 100).toFixed(2));
      const underdog_cover_probability = Number((underdogCoverProb / 100).toFixed(2));

      // Ensure sum is exactly 1.00
      const sum = favorite_cover_probability + underdog_cover_probability;
      const adjustedUnderdog = sum !== 1.0
        ? Number((1.0 - favorite_cover_probability).toFixed(2))
        : underdog_cover_probability;

      // Format result with required schema
      const result = {
        favorite_cover_probability,
        underdog_cover_probability: adjustedUnderdog,
        inputs: {
          team_favorite: args.team_favorite,
          team_underdog: args.team_underdog,
          spread: args.spread
        },
        normalized: {
          team_favorite: favoriteStats.team,
          team_underdog: underdogStats.team
        }
      };

      return {
        structuredContent: result,
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }],
        _meta: {
          'openai/outputTemplate': 'ui://widget/probability-estimator.html',
          'openai/widgetAccessible': true,
          'openai/locale': locale,
          calculation: {
            sport: 'basketball',
            favorite: favoriteStats.team,
            underdog: underdogStats.team,
            spread: args.spread,
            predictedMargin,
            sigma,
            method: 'statistical_analysis'
          },
          favoriteStats: {
            team: favoriteStats.team,
            pointsPerGame: favoriteStats.pointsPerGame,
            pointsAllowed: favoriteStats.pointsAllowed,
            fieldGoalPct: favoriteStats.fieldGoalPct,
            reboundMargin: favoriteStats.reboundMargin,
            turnoverMargin: favoriteStats.turnoverMargin,
            netRating: favoriteStats.pointsPerGame - favoriteStats.pointsAllowed
          },
          underdogStats: {
            team: underdogStats.team,
            pointsPerGame: underdogStats.pointsPerGame,
            pointsAllowed: underdogStats.pointsAllowed,
            fieldGoalPct: underdogStats.fieldGoalPct,
            reboundMargin: underdogStats.reboundMargin,
            turnoverMargin: underdogStats.turnoverMargin,
            netRating: underdogStats.pointsPerGame - underdogStats.pointsAllowed
          }
        }
      };
    }
  );
}
