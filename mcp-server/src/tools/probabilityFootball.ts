/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Football probability estimation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { predictedMarginFootball, coverProbability, type FootballStats } from '../utils/calculations.js';

const footballInputSchema = z.object({
  teamPointsFor: z.number().describe('Your team average points scored per game'),
  teamPointsAgainst: z.number().describe('Your team average points allowed per game'),
  opponentPointsFor: z.number().describe('Opponent average points scored per game'),
  opponentPointsAgainst: z.number().describe('Opponent average points allowed per game'),
  teamOffYards: z.number().describe('Your team average offensive yards per game'),
  teamDefYards: z.number().describe('Your team average defensive yards allowed per game'),
  opponentOffYards: z.number().describe('Opponent average offensive yards per game'),
  opponentDefYards: z.number().describe('Opponent average defensive yards allowed per game'),
  teamTurnoverDiff: z.number().describe('Your team turnover differential (positive is good)'),
  opponentTurnoverDiff: z.number().describe('Opponent turnover differential'),
  spread: z.number().describe('Point spread for your team (negative if favored, positive if underdog)')
});

type FootballInput = z.infer<typeof footballInputSchema>;

export function registerFootballProbabilityTool(server: McpServer) {
  server.tool(
    'probability-estimate-football',
    {
      title: 'Estimate Football Game Probability',
      description: 'Estimate Football Game Probability - Use this to estimate win/cover probability for NFL or college football games using team statistics',
      inputSchema: {
        teamPointsFor: z.number().describe('Your team average points scored per game'),
        teamPointsAgainst: z.number().describe('Your team average points allowed per game'),
        opponentPointsFor: z.number().describe('Opponent average points scored per game'),
        opponentPointsAgainst: z.number().describe('Opponent average points allowed per game'),
        teamOffYards: z.number().describe('Your team average offensive yards per game'),
        teamDefYards: z.number().describe('Your team average defensive yards allowed per game'),
        opponentOffYards: z.number().describe('Opponent average offensive yards per game'),
        opponentDefYards: z.number().describe('Opponent average defensive yards allowed per game'),
        teamTurnoverDiff: z.number().describe('Your team turnover differential (positive is good)'),
        opponentTurnoverDiff: z.number().describe('Opponent turnover differential'),
        spread: z.number().describe('Point spread for your team (negative if favored, positive if underdog)')
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/probability-estimator.html',
        'openai/toolInvocation/invoking': 'Estimating football probability...',
        'openai/toolInvocation/invoked': 'Estimated football probability',
        'openai/widgetAccessible': true
      }
    },
    async (args) => {
      const validated = args;

      // Calculate predicted margin
      const stats: FootballStats = {
        teamPointsFor: validated.teamPointsFor,
        teamPointsAgainst: validated.teamPointsAgainst,
        opponentPointsFor: validated.opponentPointsFor,
        opponentPointsAgainst: validated.opponentPointsAgainst,
        teamOffYards: validated.teamOffYards,
        teamDefYards: validated.teamDefYards,
        opponentOffYards: validated.opponentOffYards,
        opponentDefYards: validated.opponentDefYards,
        teamTurnoverDiff: validated.teamTurnoverDiff,
        opponentTurnoverDiff: validated.opponentTurnoverDiff
      };

      const predictedMargin = predictedMarginFootball(stats);
      const sigma = 13.5; // Standard deviation for football
      const probability = coverProbability(predictedMargin, validated.spread, sigma);

      // Format result text
      const resultText = `Based on the team statistics, your team has an estimated ${probability.toFixed(2)}% probability of covering the ${validated.spread > 0 ? '+' : ''}${validated.spread} point spread.\n\n` +
        `Predicted Margin: ${predictedMargin > 0 ? '+' : ''}${predictedMargin.toFixed(1)} points\n\n` +
        `You can use this probability (${probability.toFixed(2)}%) in the Kelly Criterion calculator to determine your optimal bet size.`;

      return {
        content: [{
          type: 'text' as const,
          text: resultText,
          _meta: {
            'openai/outputTemplate': 'ui://widget/probability-estimator.html',
            'openai/widgetAccessible': true,
            'openai/toolInvocation/invoking': 'Estimating football probability...',
            'openai/toolInvocation/invoked': 'Estimated football probability',
            structuredContent: {
              sport: 'football',
              predictedMargin,
              spread: validated.spread,
              probability,
              teamStats: {
                pointsFor: validated.teamPointsFor,
                pointsAgainst: validated.teamPointsAgainst,
                offYards: validated.teamOffYards,
                defYards: validated.teamDefYards,
                turnoverDiff: validated.teamTurnoverDiff
              },
              opponentStats: {
                pointsFor: validated.opponentPointsFor,
                pointsAgainst: validated.opponentPointsAgainst,
                offYards: validated.opponentOffYards,
                defYards: validated.opponentDefYards,
                turnoverDiff: validated.opponentTurnoverDiff
              }
            }
          }
        }]
      };
    }
  );
}
