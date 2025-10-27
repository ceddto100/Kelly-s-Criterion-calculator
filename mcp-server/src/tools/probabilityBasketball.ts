/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Basketball probability estimation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { predictedMarginBasketball, coverProbability, type BasketballStats } from '../utils/calculations.js';

export function registerBasketballProbabilityTool(server: McpServer) {
  server.tool(
    'probability-estimate-basketball',
    {
      title: 'Estimate Basketball Game Probability',
      description: 'Estimate Basketball Game Probability - Use this to estimate win/cover probability for NBA or college basketball games using team statistics',
      inputSchema: {
        teamPointsFor: z.number().describe('Your team average points scored per game'),
        teamPointsAgainst: z.number().describe('Your team average points allowed per game'),
        opponentPointsFor: z.number().describe('Opponent average points scored per game'),
        opponentPointsAgainst: z.number().describe('Opponent average points allowed per game'),
        teamFgPct: z.number().describe('Your team field goal percentage (as decimal, e.g., 0.45 for 45%)'),
        opponentFgPct: z.number().describe('Opponent field goal percentage (as decimal)'),
        teamReboundMargin: z.number().describe('Your team rebound margin per game'),
        opponentReboundMargin: z.number().describe('Opponent rebound margin per game'),
        teamTurnoverMargin: z.number().describe('Your team turnover margin per game'),
        opponentTurnoverMargin: z.number().describe('Opponent turnover margin per game'),
        spread: z.number().describe('Point spread for your team (negative if favored, positive if underdog)')
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/probability-estimator.html',
        'openai/toolInvocation/invoking': 'Estimating basketball probability...',
        'openai/toolInvocation/invoked': 'Estimated basketball probability',
        'openai/widgetAccessible': true
      }
    },
    async (args) => {
      // Calculate predicted margin
      const stats: BasketballStats = {
        teamPointsFor: args.teamPointsFor,
        teamPointsAgainst: args.teamPointsAgainst,
        opponentPointsFor: args.opponentPointsFor,
        opponentPointsAgainst: args.opponentPointsAgainst,
        teamFgPct: args.teamFgPct,
        opponentFgPct: args.opponentFgPct,
        teamReboundMargin: args.teamReboundMargin,
        opponentReboundMargin: args.opponentReboundMargin,
        teamTurnoverMargin: args.teamTurnoverMargin,
        opponentTurnoverMargin: args.opponentTurnoverMargin
      };

      const predictedMargin = predictedMarginBasketball(stats);
      const sigma = 12.0; // Standard deviation for basketball
      const probability = coverProbability(predictedMargin, args.spread, sigma);

      // Format result text
      const spreadDisplay = args.spread > 0 ? `+${args.spread}` : args.spread.toString();
      const marginDisplay = predictedMargin > 0 ? `+${predictedMargin.toFixed(1)}` : predictedMargin.toFixed(1);
      const resultText = `Based on the team statistics, your team has an estimated ${probability.toFixed(2)}% probability of covering the ${spreadDisplay} point spread.\n\nPredicted Margin: ${marginDisplay} points\n\nYou can use this probability (${probability.toFixed(2)}%) in the Kelly Criterion calculator to determine your optimal bet size.`;

      return {
        // Model sees: concise summary of probability estimate
        structuredContent: {
          sport: 'basketball',
          probability,
          predictedMargin,
          spread: args.spread,
          sigma,
          estimatedAt: new Date().toISOString()
        },

        // Optional: natural language text for model
        content: [{
          type: 'text' as const,
          text: resultText
        }],

        // Component sees: complete data for UI rendering
        _meta: {
          'openai/outputTemplate': 'ui://widget/probability-estimator.html',
          'openai/widgetAccessible': true,
          'openai/toolInvocation/invoking': 'Estimating basketball probability...',
          'openai/toolInvocation/invoked': 'Estimated basketball probability',

          // Complete calculation details
          calculation: {
            sport: 'basketball',
            predictedMargin,
            spread: args.spread,
            probability,
            sigma,
            method: 'statistical_analysis'
          },

          // Full team statistics for charting
          teamStats: {
            pointsFor: args.teamPointsFor,
            pointsAgainst: args.teamPointsAgainst,
            fgPct: args.teamFgPct,
            reboundMargin: args.teamReboundMargin,
            turnoverMargin: args.teamTurnoverMargin,
            netRating: args.teamPointsFor - args.teamPointsAgainst
          },

          // Full opponent statistics for charting
          opponentStats: {
            pointsFor: args.opponentPointsFor,
            pointsAgainst: args.opponentPointsAgainst,
            fgPct: args.opponentFgPct,
            reboundMargin: args.opponentReboundMargin,
            turnoverMargin: args.opponentTurnoverMargin,
            netRating: args.opponentPointsFor - args.opponentPointsAgainst
          },

          // UI display settings
          displaySettings: {
            sportType: 'basketball',
            showAdvancedStats: true
          }
        }
      };
    }
  );
}
