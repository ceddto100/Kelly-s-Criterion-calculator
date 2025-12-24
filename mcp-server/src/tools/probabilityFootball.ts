/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Football probability estimation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { predictedMarginFootball, coverProbability, type FootballStats } from '../utils/calculations.js';
import { loadNFLTeamStats } from '../utils/loadStats.js';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';

export function registerFootballProbabilityTool(server: McpServer) {
  server.tool(
    'probability-estimate-football',
    {
      title: 'Estimate Football Game Probability',
      description: 'Use this when the user wants to estimate the probability of covering a point spread for NFL football games. Accepts team names and spread, returns probabilities for both favorite and underdog. Do not use for basketball games (use probability-estimate-basketball instead) or calculating bet sizes (use kelly-calculate after getting probability).',
      inputSchema: {
        sport: z.literal('football').default('football').describe('Sport type - must be "football"'),
        team_favorite: z.string().describe('Name of the favored team. Can be full name (e.g., "Dallas Cowboys"), city (e.g., "Cowboys"), or abbreviation (e.g., "DAL"). The favorite is the team expected to win.'),
        team_underdog: z.string().describe('Name of the underdog team. Can be full name (e.g., "New York Giants"), city (e.g., "Giants"), or abbreviation (e.g., "NYG"). The underdog is the team expected to lose.'),
        spread: z.number().describe('Point spread from the favorite\'s perspective. Must be negative (e.g., -6.5 means favorite must win by more than 6.5 points to cover, -7 means favorite must win by more than 7 points). Valid range: -50 to -0.5')
      },
      annotations: {
        readOnlyHint: true, // Only performs calculations, no data modification
        openWorldHint: false, // All calculations are local, no external API calls
        destructiveHint: false // No data deletion or permanent modification
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/probability-estimator.html',
        'openai/toolInvocation/invoking': 'Estimating football probability...',
        'openai/toolInvocation/invoked': 'Estimated football probability',
        'openai/widgetAccessible': true
      }
    },
    async (args, extra?: any) => {
      // Extract locale from request or use current server locale
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      // Input validation
      if (!args.team_favorite || typeof args.team_favorite !== 'string' || args.team_favorite.trim() === '') {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Favorite team name is required'
          },
          content: [{
            type: 'text',
            text: 'Error: Favorite team name is required and must be a non-empty string.'
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      if (!args.team_underdog || typeof args.team_underdog !== 'string' || args.team_underdog.trim() === '') {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Underdog team name is required'
          },
          content: [{
            type: 'text',
            text: 'Error: Underdog team name is required and must be a non-empty string.'
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      if (typeof args.spread !== 'number' || isNaN(args.spread)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Spread must be a valid number'
          },
          content: [{
            type: 'text',
            text: 'Error: Spread is required and must be a valid number.'
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      if (args.spread >= 0) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Spread must be negative (from favorite\'s perspective)'
          },
          content: [{
            type: 'text',
            text: 'Error: Spread must be negative (e.g., -6.5) from the favorite\'s perspective. The favorite is expected to win, so the spread should be negative.'
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
      const favoriteStats = loadNFLTeamStats(args.team_favorite);
      const underdogStats = loadNFLTeamStats(args.team_underdog);

      if (!favoriteStats) {
        return {
          structuredContent: {
            error: 'team_not_found',
            message: `Favorite team "${args.team_favorite}" not found in NFL database`,
            searchedTerm: args.team_favorite
          },
          content: [{
            type: 'text',
            text: `Error: Could not find team "${args.team_favorite}" in NFL statistics. Please check the team name and try again. You can use full names (e.g., "Dallas Cowboys"), city names (e.g., "Cowboys"), or abbreviations (e.g., "DAL").`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      if (!underdogStats) {
        return {
          structuredContent: {
            error: 'team_not_found',
            message: `Underdog team "${args.team_underdog}" not found in NFL database`,
            searchedTerm: args.team_underdog
          },
          content: [{
            type: 'text',
            text: `Error: Could not find team "${args.team_underdog}" in NFL statistics. Please check the team name and try again. You can use full names (e.g., "New York Giants"), city names (e.g., "Giants"), or abbreviations (e.g., "NYG").`
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
            message: 'Insufficient team statistics available'
          },
          content: [{
            type: 'text',
            text: 'Error: One or both teams are missing required statistics (points per game, points allowed). Cannot calculate probability.'
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Build stats object for calculation
      const stats: FootballStats = {
        teamPointsFor: favoriteStats.pointsPerGame,
        teamPointsAgainst: favoriteStats.pointsAllowed,
        opponentPointsFor: underdogStats.pointsPerGame,
        opponentPointsAgainst: underdogStats.pointsAllowed,
        teamOffYards: favoriteStats.offensiveYards ?? 350, // Default to league average if missing
        teamDefYards: favoriteStats.defensiveYards ?? 350,
        opponentOffYards: underdogStats.offensiveYards ?? 350,
        opponentDefYards: underdogStats.defensiveYards ?? 350,
        teamTurnoverDiff: favoriteStats.turnoverDiff ?? 0,
        opponentTurnoverDiff: underdogStats.turnoverDiff ?? 0
      };

      // Calculate predicted margin and probabilities
      const predictedMargin = predictedMarginFootball(stats);
      const sigma = 13.5; // Standard deviation for football

      // Favorite's probability to cover (beat spread)
      const favoriteCoverProb = coverProbability(predictedMargin, args.spread, sigma);

      // Underdog's probability to cover
      const underdogCoverProb = 100 - favoriteCoverProb;

      // Determine confidence level based on spread and predicted margin
      let modelConfidence: 'high' | 'medium' | 'low';
      const probDiff = Math.abs(favoriteCoverProb - 50);
      if (probDiff > 20) {
        modelConfidence = 'high';
      } else if (probDiff > 10) {
        modelConfidence = 'medium';
      } else {
        modelConfidence = 'low';
      }

      // Normalize probabilities to ensure they sum to exactly 1.00
      const favorite_cover_probability = Number((favoriteCoverProb / 100).toFixed(2));
      const underdog_cover_probability = Number((1 - favorite_cover_probability).toFixed(2));

      // Format result
      const result = {
        favorite_cover_probability,
        underdog_cover_probability,
        model_confidence: modelConfidence,
        inputs_normalized: true
      };

      return {
        // Model sees: required output format
        structuredContent: result,

        // Optional: natural language text for model
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2)
        }],

        // Component sees: complete data for UI rendering
        _meta: {
          'openai/outputTemplate': 'ui://widget/probability-estimator.html',
          'openai/widgetAccessible': true,
          'openai/locale': locale,

          // Additional metadata
          calculation: {
            sport: 'football',
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
            offensiveYards: favoriteStats.offensiveYards,
            defensiveYards: favoriteStats.defensiveYards,
            turnoverDiff: favoriteStats.turnoverDiff,
            netRating: favoriteStats.pointsPerGame - favoriteStats.pointsAllowed,
            yardDiff: (favoriteStats.offensiveYards ?? 0) - (favoriteStats.defensiveYards ?? 0)
          },

          underdogStats: {
            team: underdogStats.team,
            pointsPerGame: underdogStats.pointsPerGame,
            pointsAllowed: underdogStats.pointsAllowed,
            offensiveYards: underdogStats.offensiveYards,
            defensiveYards: underdogStats.defensiveYards,
            turnoverDiff: underdogStats.turnoverDiff,
            netRating: underdogStats.pointsPerGame - underdogStats.pointsAllowed,
            yardDiff: (underdogStats.offensiveYards ?? 0) - (underdogStats.defensiveYards ?? 0)
          }
        }
      };
    }
  );
}
