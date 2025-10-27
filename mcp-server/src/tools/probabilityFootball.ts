/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Football probability estimation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { predictedMarginFootball, coverProbability, type FootballStats } from '../utils/calculations.js';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';

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
      description: 'Use this when the user wants to estimate the probability of covering a point spread for NFL or college football games using statistical analysis of team performance metrics. Returns win probability, predicted margin, and detailed team statistics. Do not use for basketball games (use probability-estimate-basketball instead), calculating bet sizes (use kelly-calculate after getting probability), or unit betting (use unit-calculate instead).',
      inputSchema: {
        teamPointsFor: z.number().describe('Your team\'s average points scored per game. Example: 24.5 for a team averaging 24.5 points scored, 31.2 for a high-scoring offense. Valid range: 0-100 points'),
        teamPointsAgainst: z.number().describe('Your team\'s average points allowed per game (defensive stat). Example: 18.3 for a team allowing 18.3 points per game, 28.7 for a weak defense. Valid range: 0-100 points'),
        opponentPointsFor: z.number().describe('Opponent\'s average points scored per game. Example: 27.8 for opponent averaging 27.8 points scored. Valid range: 0-100 points'),
        opponentPointsAgainst: z.number().describe('Opponent\'s average points allowed per game. Example: 21.4 for opponent allowing 21.4 points. Valid range: 0-100 points'),
        teamOffYards: z.number().describe('Your team\'s average offensive yards per game (total yards). Example: 375 for 375 yards per game, 420 for a strong offense. Valid range: 0-1000 yards'),
        teamDefYards: z.number().describe('Your team\'s average defensive yards allowed per game. Example: 310 for allowing 310 yards, 280 for a strong defense. Valid range: 0-1000 yards'),
        opponentOffYards: z.number().describe('Opponent\'s average offensive yards per game. Example: 390 for 390 yards per game. Valid range: 0-1000 yards'),
        opponentDefYards: z.number().describe('Opponent\'s average defensive yards allowed per game. Example: 325 for allowing 325 yards. Valid range: 0-1000 yards'),
        teamTurnoverDiff: z.number().describe('Your team\'s turnover differential per game (turnovers forced minus turnovers committed). Positive is better. Example: +0.8 for a team with +0.8 differential, -1.2 for a team that gives up more turnovers. Valid range: -50 to +50'),
        opponentTurnoverDiff: z.number().describe('Opponent\'s turnover differential per game. Example: -0.5 for opponent with -0.5 differential. Valid range: -50 to +50'),
        spread: z.number().describe('Point spread for your team. Negative if favored (expected to win), positive if underdog. Example: -7 if your team is 7-point favorite, +3.5 if your team is 3.5-point underdog. Valid range: -100 to +100')
      },
      annotations: {
        readOnlyHint: true
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
        validateStat(args.teamPointsFor, 'Team points for', 0, 100);
        validateStat(args.teamPointsAgainst, 'Team points against', 0, 100);
        validateStat(args.opponentPointsFor, 'Opponent points for', 0, 100);
        validateStat(args.opponentPointsAgainst, 'Opponent points against', 0, 100);
        validateStat(args.teamOffYards, 'Team offensive yards', 0, 1000);
        validateStat(args.teamDefYards, 'Team defensive yards', 0, 1000);
        validateStat(args.opponentOffYards, 'Opponent offensive yards', 0, 1000);
        validateStat(args.opponentDefYards, 'Opponent defensive yards', 0, 1000);
        validateStat(args.teamTurnoverDiff, 'Team turnover differential', -50, 50);
        validateStat(args.opponentTurnoverDiff, 'Opponent turnover differential', -50, 50);
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
      const spreadText = `${validated.spread > 0 ? '+' : ''}${validated.spread}`;
      const resultText = t('probability_result_text', locale, {
        probability: probability.toFixed(2),
        spread: spreadText
      }) + '\n\n' +
        `${t('probability_predicted_margin', locale)}: ${predictedMargin > 0 ? '+' : ''}${predictedMargin.toFixed(1)} ${t('points', locale)}\n\n` +
        t('probability_use_with_kelly', locale, { probability: probability.toFixed(2) });

      return {
        // Model sees: concise summary of probability estimate
        structuredContent: {
          sport: 'football',
          probability,
          predictedMargin,
          spread: validated.spread,
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
            sport: 'football',
            predictedMargin,
            spread: validated.spread,
            probability,
            sigma,
            method: 'statistical_analysis'
          },

          // Full team statistics for charting
          teamStats: {
            pointsFor: validated.teamPointsFor,
            pointsAgainst: validated.teamPointsAgainst,
            offYards: validated.teamOffYards,
            defYards: validated.teamDefYards,
            turnoverDiff: validated.teamTurnoverDiff,
            netRating: validated.teamPointsFor - validated.teamPointsAgainst,
            yardDiff: validated.teamOffYards - validated.teamDefYards
          },

          // Full opponent statistics for charting
          opponentStats: {
            pointsFor: validated.opponentPointsFor,
            pointsAgainst: validated.opponentPointsAgainst,
            offYards: validated.opponentOffYards,
            defYards: validated.opponentDefYards,
            turnoverDiff: validated.opponentTurnoverDiff,
            netRating: validated.opponentPointsFor - validated.opponentPointsAgainst,
            yardDiff: validated.opponentOffYards - validated.opponentDefYards
          },

          // UI display settings
          displaySettings: {
            sportType: 'football',
            showAdvancedStats: true,
            locale
          }
        }
      };
    }
  );
}
