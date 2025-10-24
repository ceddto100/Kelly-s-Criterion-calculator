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
    'Estimate Basketball Game Probability - Use this to estimate win/cover probability for NBA or college basketball games using team statistics',
    {
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
        content: [{
          type: 'text' as const,
          text: resultText,
          _meta: {
            'openai/outputTemplate': 'ui://widget/probability-estimator.html',
            'openai/widgetAccessible': true,
            'openai/toolInvocation/invoking': 'Estimating basketball probability...',
            'openai/toolInvocation/invoked': 'Estimated basketball probability',
            structuredContent: {
              sport: 'basketball',
              predictedMargin,
              spread: args.spread,
              probability,
              teamStats: {
                pointsFor: args.teamPointsFor,
                pointsAgainst: args.teamPointsAgainst,
                fgPct: args.teamFgPct,
                reboundMargin: args.teamReboundMargin,
                turnoverMargin: args.teamTurnoverMargin
              },
              opponentStats: {
                pointsFor: args.opponentPointsFor,
                pointsAgainst: args.opponentPointsAgainst,
                fgPct: args.opponentFgPct,
                reboundMargin: args.opponentReboundMargin,
                turnoverMargin: args.opponentTurnoverMargin
              }
            }
          }
        }]
      };
    }
  );
}
