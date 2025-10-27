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
      description: 'Calculate Kelly Criterion Stake - Use this when user wants to calculate optimal bet size using Kelly Criterion formula',
      inputSchema: {
        bankroll: z.number().positive().describe('Available betting bankroll in USD'),
        odds: z.number().describe('American odds (negative for favorites like -110, positive for underdogs like +150)'),
        probability: z.number().min(0.1).max(99.9).describe('Estimated win probability as percentage (0.1-99.9)'),
        fraction: z.enum(['1', '0.5', '0.25']).default('1').describe('Kelly fraction: 1 for full Kelly, 0.5 for half, 0.25 for quarter')
      },
      annotations: {
        readOnlyHint: true
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/kelly-calculator.html',
        'openai/toolInvocation/invoking': 'Calculating optimal stake...',
        'openai/toolInvocation/invoked': 'Calculated Kelly stake',
        'openai/widgetAccessible': true
      }
    },
    async (args) => {
      const { bankroll, odds, probability, fraction } = args;

      // Input validation
      if (typeof bankroll !== 'number' || isNaN(bankroll)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Bankroll must be a valid number'
          },
          content: [{
            type: 'text',
            text: 'Invalid bankroll. Must be a valid positive number.'
          }],
          isError: true
        };
      }

      if (bankroll <= 0 || bankroll > 1000000000) {
        return {
          structuredContent: {
            error: 'invalid_bankroll',
            message: 'Bankroll out of range',
            validRange: 'Must be between 0 and 1,000,000,000'
          },
          content: [{
            type: 'text',
            text: 'Invalid bankroll. Must be a positive number up to $1,000,000,000.'
          }],
          isError: true
        };
      }

      if (typeof odds !== 'number' || isNaN(odds)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Odds must be a valid number'
          },
          content: [{
            type: 'text',
            text: 'Invalid odds. Must be a valid number in American format.'
          }],
          isError: true
        };
      }

      if (typeof probability !== 'number' || isNaN(probability)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Probability must be a valid number'
          },
          content: [{
            type: 'text',
            text: 'Invalid probability. Must be a valid number between 0.1 and 99.9.'
          }],
          isError: true
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
            message: 'Invalid odds range',
            validRange: 'Must be <= -100 or >= 100'
          },
          content: [{
            type: 'text',
            text: 'Invalid odds. American odds must be <= -100 for favorites or >= 100 for underdogs.'
          }],
          isError: true
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
        ? `Kelly Criterion recommends staking ${formatCurrency(stake)} (${stakePercentage.toFixed(2)}% of bankroll) on this bet.`
        : `No Value - Do Not Bet. The Kelly Criterion indicates negative expected value for this bet.`;

      return {
        // Model sees: concise summary of calculation
        structuredContent: {
          hasValue,
          stake,
          stakePercentage,
          bankroll,
          odds,
          probability,
          lastCalculated: new Date().toISOString()
        },

        // Optional: natural language text for model
        content: [{
          type: 'text' as const,
          text: resultText + (insight ? `\n\nAnalyst Insight: ${insight}` : '')
        }],

        // Component sees: complete data for UI rendering
        _meta: {
          'openai/outputTemplate': 'ui://widget/kelly-calculator.html',
          'openai/widgetAccessible': true,
          'openai/toolInvocation/invoking': 'Calculating optimal stake...',
          'openai/toolInvocation/invoked': 'Calculated Kelly stake',

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
            decimalPlaces: 2
          }
        }
      };
    }
  );
}
