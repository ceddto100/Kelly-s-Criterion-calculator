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
      description: 'Use this when the user wants to estimate the probability of covering a point spread for NBA or college basketball games using statistical analysis of team performance metrics. Returns win probability, predicted margin, and detailed team statistics. Do not use for football games (use probability-estimate-football instead), calculating bet sizes (use kelly-calculate after getting probability), or unit betting (use unit-calculate instead).',
      inputSchema: {
        teamPointsFor: z.number().describe('Your team\'s average points scored per game. Example: 112.5 for NBA team averaging 112.5 points, 75.8 for college team. Valid range: 0-200 points'),
        teamPointsAgainst: z.number().describe('Your team\'s average points allowed per game (defensive stat). Example: 108.2 for NBA team allowing 108.2 points, 68.4 for strong college defense. Valid range: 0-200 points'),
        opponentPointsFor: z.number().describe('Opponent\'s average points scored per game. Example: 115.3 for high-scoring NBA opponent, 72.1 for college opponent. Valid range: 0-200 points'),
        opponentPointsAgainst: z.number().describe('Opponent\'s average points allowed per game. Example: 110.7 for NBA opponent, 70.5 for college opponent. Valid range: 0-200 points'),
        teamFgPct: z.number().describe('Your team\'s field goal percentage as a decimal (0-1). Example: 0.465 for 46.5% shooting, 0.52 for excellent 52% shooting, 0.42 for poor 42% shooting. Valid range: 0-1'),
        opponentFgPct: z.number().describe('Opponent\'s field goal percentage as a decimal (0-1). Example: 0.48 for 48% shooting, 0.445 for 44.5% shooting. Valid range: 0-1'),
        teamReboundMargin: z.number().describe('Your team\'s rebound margin per game (rebounds grabbed minus rebounds allowed). Positive is better. Example: +3.5 for team with +3.5 rebound advantage, -2.1 for team being outrebounded. Valid range: -50 to +50'),
        opponentReboundMargin: z.number().describe('Opponent\'s rebound margin per game. Example: +1.8 for opponent with slight rebounding advantage, -4.2 for weak rebounding team. Valid range: -50 to +50'),
        teamTurnoverMargin: z.number().describe('Your team\'s turnover margin per game (turnovers forced minus turnovers committed). Positive is better. Example: +2.3 for team forcing more turnovers, -1.5 for turnover-prone team. Valid range: -50 to +50'),
        opponentTurnoverMargin: z.number().describe('Opponent\'s turnover margin per game. Example: +0.8 for opponent with positive margin, -2.7 for careless opponent. Valid range: -50 to +50'),
        spread: z.number().describe('Point spread for your team. Negative if favored (expected to win), positive if underdog. Example: -5.5 if your team is 5.5-point favorite, +7 if your team is 7-point underdog. Valid range: -100 to +100')
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

      const teamStats = {
        pointsFor: args.teamPointsFor,
        pointsAgainst: args.teamPointsAgainst,
        fgPct: args.teamFgPct,
        reboundMargin: args.teamReboundMargin,
        turnoverMargin: args.teamTurnoverMargin,
        netRating: args.teamPointsFor - args.teamPointsAgainst
      };

      const opponentStats = {
        pointsFor: args.opponentPointsFor,
        pointsAgainst: args.opponentPointsAgainst,
        fgPct: args.opponentFgPct,
        reboundMargin: args.opponentReboundMargin,
        turnoverMargin: args.opponentTurnoverMargin,
        netRating: args.opponentPointsFor - args.opponentPointsAgainst
      };

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
          teamStats,
          opponentStats,
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
          teamStats,

          // Full opponent statistics for charting
          opponentStats,

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
