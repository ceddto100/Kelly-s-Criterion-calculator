/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kelly Criterion calculation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { americanToDecimal, kellyFraction, formatCurrency } from '../utils/calculations.js';
import { getAnalystInsight } from '../utils/gemini.js';
import { t, formatCurrencyLocalized } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';

const kellyInputSchema = z.object({
  bankroll: z.number().positive().describe('Available betting bankroll in USD'),
  odds: z.number().describe('American odds (negative for favorites like -110, positive for underdogs like +150)'),
  probability: z.number().min(0.1).max(99.9).describe('Estimated win probability as percentage (0.1-99.9)'),
  fraction: z.enum(['1', '0.5', '0.25']).default('1').describe('Kelly fraction: 1 for full Kelly, 0.5 for half, 0.25 for quarter')
});

type KellyInput = z.infer<typeof kellyInputSchema>;

export function registerKellyTool(server: McpServer) {
  server.tool(
    'kelly-calculate',
    {
      title: 'Calculate Kelly Criterion Stake',
      description: 'Use this when the user wants to calculate the optimal bet size using the Kelly Criterion formula based on bankroll, odds, and win probability. Returns the recommended stake amount and percentage of bankroll to wager. Do not use for unit-based betting (use unit-calculate instead), probability estimation (use probability-estimate-football or probability-estimate-basketball first), or when the user wants to place a bet without calculating optimal sizing.',
      inputSchema: {
        bankroll: z.number().positive().describe('Available betting bankroll in USD. Must be a positive number. Example: 1000 for $1,000 bankroll, 5000 for $5,000 bankroll. Valid range: $0.01 to $1,000,000,000'),
        odds: z.number().describe('American odds format. Negative for favorites (team expected to win), positive for underdogs. Example: -110 (bet $110 to win $100), +150 (bet $100 to win $150), -200 (strong favorite), +300 (strong underdog). Must be <= -100 or >= 100'),
        probability: z.number().min(0.1).max(99.9).describe('Estimated win probability as a percentage. Example: 55 for 55% chance of winning, 65.5 for 65.5% chance. Valid range: 0.1% to 99.9%. Use probability estimation tools first if you need to calculate this'),
        fraction: z.enum(['1', '0.5', '0.25']).default('1').describe('Kelly fraction multiplier for conservative betting. Options: "1" (full Kelly, aggressive), "0.5" (half Kelly, moderate - recommended for most bettors), "0.25" (quarter Kelly, conservative). Example: "0.5" to bet half the Kelly recommendation. Defaults to "1"')
      },
      annotations: {
        readOnlyHint: false
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/kelly-calculator.html',
        'openai/toolInvocation/invoking': 'Calculating optimal stake...',
        'openai/toolInvocation/invoked': 'Calculated Kelly stake',
        'openai/widgetAccessible': true
      }
    },
    async (args, extra?: any) => {
      // Extract locale from request or use current server locale
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { bankroll, odds, probability, fraction } = args;

      // Input validation
      if (typeof bankroll !== 'number' || isNaN(bankroll)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: t('error_invalid_bankroll', locale)
          },
          content: [{
            type: 'text',
            text: t('validation_bankroll_positive', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      if (bankroll <= 0 || bankroll > 1000000000) {
        return {
          structuredContent: {
            error: 'invalid_bankroll',
            message: t('error_invalid_bankroll', locale),
            validRange: t('error_bankroll_range', locale)
          },
          content: [{
            type: 'text',
            text: t('error_bankroll_range', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      if (typeof odds !== 'number' || isNaN(odds)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: t('error_invalid_odds', locale)
          },
          content: [{
            type: 'text',
            text: t('validation_odds_american', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      if (typeof probability !== 'number' || isNaN(probability)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: t('error_invalid_probability', locale)
          },
          content: [{
            type: 'text',
            text: t('validation_probability_range', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      // Convert types
      const numFraction = parseFloat(fraction);
      const probDecimal = probability / 100;

      // Validate odds range
      if (odds > -100 && odds < 100 && odds !== 0) {
        return {
          structuredContent: {
            error: 'invalid_odds',
            message: t('error_invalid_odds', locale),
            validRange: t('error_odds_range', locale)
          },
          content: [{
            type: 'text',
            text: t('error_odds_range', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      // Calculate
      const decimalOdds = americanToDecimal(odds);
      const k = kellyFraction(probDecimal, decimalOdds);
      const hasValue = k > 0;
      const stake = hasValue ? bankroll * k * numFraction : 0;
      const stakePercentage = hasValue ? k * 100 * numFraction : 0;

      // Get AI insight (optional)
      let insight = '';
      try {
        insight = await getAnalystInsight({
          stake,
          stakePercentage,
          hasValue,
          bankroll,
          odds,
          probability
        });
      } catch (error) {
        console.error('Failed to get analyst insight:', error);
      }

      // Return results
      const resultText = hasValue
        ? t('kelly_stake_text', locale, {
            stake: formatCurrencyLocalized(stake, locale),
            percentage: stakePercentage.toFixed(2)
          })
        : t('kelly_no_value', locale);

      const structuredContent: Record<string, any> = {
        hasValue,
        stake,
        stakePercentage,
        bankroll,
        odds,
        probability,
        decimalOdds,
        fraction: numFraction,
        kellyFraction: k,
        lastCalculated: new Date().toISOString()
      };

      if (insight) {
        structuredContent.insight = insight;
      }

      return {
        // Model sees: concise summary of calculation
        structuredContent,

        // Optional: natural language text for model
        content: [{
          type: 'text' as const,
          text: resultText + (insight ? `\n\nAnalyst Insight: ${insight}` : '')
        }],

        // Component sees: complete data for UI rendering
        _meta: {
          'openai/outputTemplate': 'ui://widget/kelly-calculator.html',
          'openai/widgetAccessible': true,
          'openai/toolInvocation/invoking': t('kelly_calculating', locale),
          'openai/toolInvocation/invoked': t('kelly_calculated', locale),
          'openai/locale': locale,

          // Complete calculation details
          calculation: {
            bankroll,
            odds,
            decimalOdds,
            probability,
            probDecimal,
            fraction: numFraction,
            kellyFraction: k,
            stake,
            stakePercentage,
            hasValue,
            insight
          },

          // UI display preferences
          displaySettings: {
            currency: 'USD',
            decimalPlaces: 2,
            locale
          }
        }
      };
    }
  );
}
