/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Basketball probability estimation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { predictedMarginBasketball, coverProbability, type BasketballStats } from '../utils/calculations.js';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';

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
      annotations: {
        readOnlyHint: true
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/probability-estimator.html',
        'openai/toolInvocation/invoking': 'Estimating basketball probability...',
        'openai/toolInvocation/invoked': 'Estimated basketball probability',
        'openai/widgetAccessible': true
      }
    },
    async (args, extra?: any) => {
      // Extract locale from request or use current server locale
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      // Input validation
      const validateStat = (value: number, name: string, min: number, max: number) => {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(t('validation_stat_range', locale, { stat: name, min: String(min), max: String(max) }));
        }
        if (value < min || value > max) {
          throw new Error(t('validation_stat_range', locale, { stat: name, min: String(min), max: String(max) }));
        }
      };

      try {
        // Validate all inputs
        validateStat(args.teamPointsFor, 'Team points for', 0, 200);
        validateStat(args.teamPointsAgainst, 'Team points against', 0, 200);
        validateStat(args.opponentPointsFor, 'Opponent points for', 0, 200);
        validateStat(args.opponentPointsAgainst, 'Opponent points against', 0, 200);
        validateStat(args.teamFgPct, 'Team FG%', 0, 1);
        validateStat(args.opponentFgPct, 'Opponent FG%', 0, 1);
        validateStat(args.teamReboundMargin, 'Team rebound margin', -50, 50);
        validateStat(args.opponentReboundMargin, 'Opponent rebound margin', -50, 50);
        validateStat(args.teamTurnoverMargin, 'Team turnover margin', -50, 50);
        validateStat(args.opponentTurnoverMargin, 'Opponent turnover margin', -50, 50);
        validateStat(args.spread, 'Spread', -100, 100);
      } catch (error) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: error instanceof Error ? error.message : t('error_invalid_input', locale)
          },
          content: [{
            type: 'text',
            text: `${t('error_stat_validation', locale)}: ${error instanceof Error ? error.message : t('error_invalid_input', locale)}`
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }
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
      const spreadText = `${args.spread > 0 ? '+' : ''}${args.spread}`;
      const resultText = t('probability_result_text', locale, {
        probability: probability.toFixed(2),
        spread: spreadText
      }) + '\n\n' +
        `${t('probability_predicted_margin', locale)}: ${predictedMargin > 0 ? '+' : ''}${predictedMargin.toFixed(1)} ${t('points', locale)}\n\n` +
        t('probability_use_with_kelly', locale, { probability: probability.toFixed(2) });

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
          'openai/toolInvocation/invoking': t('probability_estimating', locale),
          'openai/toolInvocation/invoked': t('probability_estimated', locale),
          'openai/locale': locale,

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
            showAdvancedStats: true,
            locale
          }
        }
      };
    }
  );
}
