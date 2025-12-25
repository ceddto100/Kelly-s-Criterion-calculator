/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Football probability estimation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { predictedMarginFootball, coverProbability, type FootballStats } from '../utils/calculations.js';
import { loadNFLTeamStats, getAllNFLTeamNames } from '../utils/loadStats.js';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';
import { normalizeProbabilityArgs } from '../utils/probabilityArgs.js';

/**
 * Find closest matching team names for suggestions
 */
function getSuggestedTeams(searchTerm: string, sport: 'nba' | 'nfl' = 'nfl'): string[] {
  if (sport !== 'nfl') return [];

  const allTeams = getAllNFLTeamNames();
  const normalized = searchTerm.toLowerCase();

  // Find teams that partially match
  const matches = allTeams.filter(team =>
    team.toLowerCase().includes(normalized) ||
    normalized.includes(team.toLowerCase())
  );

  return matches.slice(0, 5); // Return top 5 suggestions
}

export function registerFootballProbabilityTool(server: McpServer) {
  server.tool(
    'probability-estimate-football',
    {
      title: 'Estimate Football Game Probability',
      description: 'Use this when the user wants to estimate the probability of covering a point spread for NFL football games. Accepts team names and spread, returns probabilities for both favorite and underdog. Supports field aliases: team_favorite (or favorite_team, favorite, fav) and team_underdog (or underdog_team, underdog, dog). Do not use for basketball games (use probability-estimate-basketball instead) or calculating bet sizes (use kelly-calculate after getting probability).',
      inputSchema: {
        sport: z.literal('football').default('football').describe('Sport type - "football"'),
        team_favorite: z.string().optional().describe('Name of the favored team. Can be full name (e.g., "Dallas Cowboys"), city (e.g., "Cowboys"), or abbreviation (e.g., "DAL"). Many aliases supported.'),
        team_underdog: z.string().optional().describe('Name of the underdog team. Can be full name (e.g., "New York Giants"), city (e.g., "Giants"), or abbreviation (e.g., "NYG"). Many aliases supported.'),
        spread: z.number().optional().describe('Point spread from the favorite\'s perspective. Must be negative (e.g., -6.5 means favorite must win by more than 6.5 points to cover). Valid range: -50 to -0.5'),
        // Team 1 aliases
        favorite_team: z.string().optional().describe('Alias for team_favorite'),
        favorite: z.string().optional().describe('Alias for team_favorite'),
        fav: z.string().optional().describe('Alias for team_favorite'),
        team1: z.string().optional().describe('Alias for team_favorite'),
        team_1: z.string().optional().describe('Alias for team_favorite'),
        teamA: z.string().optional().describe('Alias for team_favorite'),
        team_a: z.string().optional().describe('Alias for team_favorite'),
        home_team: z.string().optional().describe('Alias for team_favorite'),
        home: z.string().optional().describe('Alias for team_favorite'),
        homeTeam: z.string().optional().describe('Alias for team_favorite'),
        first_team: z.string().optional().describe('Alias for team_favorite'),
        firstTeam: z.string().optional().describe('Alias for team_favorite'),
        // Team 2 aliases
        underdog_team: z.string().optional().describe('Alias for team_underdog'),
        underdog: z.string().optional().describe('Alias for team_underdog'),
        dog: z.string().optional().describe('Alias for team_underdog'),
        team2: z.string().optional().describe('Alias for team_underdog'),
        team_2: z.string().optional().describe('Alias for team_underdog'),
        teamB: z.string().optional().describe('Alias for team_underdog'),
        team_b: z.string().optional().describe('Alias for team_underdog'),
        away_team: z.string().optional().describe('Alias for team_underdog'),
        away: z.string().optional().describe('Alias for team_underdog'),
        awayTeam: z.string().optional().describe('Alias for team_underdog'),
        second_team: z.string().optional().describe('Alias for team_underdog'),
        secondTeam: z.string().optional().describe('Alias for team_underdog'),
        // Spread aliases
        point_spread: z.number().optional().describe('Alias for spread'),
        pointSpread: z.number().optional().describe('Alias for spread'),
        line: z.number().optional().describe('Alias for spread'),
        points: z.number().optional().describe('Alias for spread')
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/probability-estimator.html',
        'openai/toolInvocation/invoking': 'Estimating football probability...',
        'openai/toolInvocation/invoked': 'Estimated football probability',
        'openai/widgetAccessible': true
      }
    },
    async (rawArgs, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      // Normalize arguments to handle aliases and JSON-string inputs
      const { normalized: args, missingFields } = normalizeProbabilityArgs(rawArgs, { defaultSport: 'football' });

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

      // Handle spread - auto-convert positive to negative (favorite's perspective)
      let spread = args.spread;
      if (spread > 0) {
        spread = -spread; // Convert to favorite's perspective
      }

      // Validate spread is not zero
      if (spread === 0) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Spread cannot be zero - there must be a point spread',
            hint: 'Provide a non-zero spread (e.g., -6.5 or 6.5 for the favorite)'
          },
          content: [{
            type: 'text',
            text: 'Error: Spread cannot be zero. Please provide a point spread (e.g., -6.5 or 6.5).'
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      if (spread < -50 || spread > -0.5) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Spread out of valid range (should be between 0.5 and 50 points)',
            spread_provided: args.spread,
            spread_converted: spread
          },
          content: [{
            type: 'text',
            text: `Error: Spread ${args.spread} is out of valid range. Spread should be between 0.5 and 50 points.`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Load team statistics
      const favoriteStats = loadNFLTeamStats(args.team_favorite);
      const underdogStats = loadNFLTeamStats(args.team_underdog);

      // Handle team not found with suggestions
      if (!favoriteStats) {
        const suggestions = getSuggestedTeams(args.team_favorite, 'nfl');
        return {
          structuredContent: {
            error: 'invalid_input',
            message: `Unknown team name: "${args.team_favorite}"`,
            team_searched: args.team_favorite,
            suggestions: suggestions.length > 0 ? suggestions : ['Please check team name or use abbreviation (e.g., DAL, KC, PHI)']
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
        const suggestions = getSuggestedTeams(args.team_underdog, 'nfl');
        return {
          structuredContent: {
            error: 'invalid_input',
            message: `Unknown team name: "${args.team_underdog}"`,
            team_searched: args.team_underdog,
            suggestions: suggestions.length > 0 ? suggestions : ['Please check team name or use abbreviation (e.g., NYG, WSH, DAL)']
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
      const stats: FootballStats = {
        teamPointsFor: favoriteStats.pointsPerGame,
        teamPointsAgainst: favoriteStats.pointsAllowed,
        opponentPointsFor: underdogStats.pointsPerGame,
        opponentPointsAgainst: underdogStats.pointsAllowed,
        teamOffYards: favoriteStats.offensiveYards ?? 350,
        teamDefYards: favoriteStats.defensiveYards ?? 350,
        opponentOffYards: underdogStats.offensiveYards ?? 350,
        opponentDefYards: underdogStats.defensiveYards ?? 350,
        teamTurnoverDiff: favoriteStats.turnoverDiff ?? 0,
        opponentTurnoverDiff: underdogStats.turnoverDiff ?? 0
      };

      // Calculate predicted margin and probabilities
      const predictedMargin = predictedMarginFootball(stats);
      const sigma = 13.5;

      const favoriteCoverProb = coverProbability(predictedMargin, spread, sigma);
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
          spread: args.spread,
          spread_normalized: spread
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
            sport: 'football',
            favorite: favoriteStats.team,
            underdog: underdogStats.team,
            spread,
            spread_input: args.spread,
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
