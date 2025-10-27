/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit betting calculation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatCurrency } from '../utils/calculations.js';
import { t, formatCurrencyLocalized } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';

export function registerUnitBettingTool(server: McpServer) {
  server.tool(
    'unit-calculate',
    {
      title: 'Calculate Unit Betting Stake',
      description: 'Calculate Unit Betting Stake - Use this for simple unit-based bankroll management, a simpler alternative to Kelly Criterion',
      inputSchema: {
        bankroll: z.number().positive().describe('Available betting bankroll in USD'),
        unitSize: z.number().min(0).max(5).describe('Unit size as percentage of bankroll (0-5%)'),
        unitsToWager: z.number().positive().describe('Number of units to wager (typically 1-5)')
      },
      annotations: {
        readOnlyHint: true
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/unit-calculator.html',
        'openai/toolInvocation/invoking': 'Calculating unit betting stake...',
        'openai/toolInvocation/invoked': 'Calculated unit betting stake',
        'openai/widgetAccessible': true
      }
    },
    async (args, extra?: any) => {
      // Extract locale from request or use current server locale
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { bankroll, unitSize, unitsToWager } = args;

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

      if (typeof unitSize !== 'number' || isNaN(unitSize)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: t('error_invalid_unit_size', locale)
          },
          content: [{
            type: 'text',
            text: t('validation_unit_size_range', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      if (unitSize < 0 || unitSize > 5) {
        return {
          structuredContent: {
            error: 'invalid_unit_size',
            message: t('error_invalid_unit_size', locale),
            validRange: t('validation_unit_size_range', locale)
          },
          content: [{
            type: 'text',
            text: t('validation_unit_size_range', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      if (typeof unitsToWager !== 'number' || isNaN(unitsToWager)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: t('error_invalid_units', locale)
          },
          content: [{
            type: 'text',
            text: t('validation_units_range', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      if (unitsToWager <= 0 || unitsToWager > 100) {
        return {
          structuredContent: {
            error: 'invalid_units',
            message: t('error_invalid_units', locale),
            validRange: t('validation_units_range', locale)
          },
          content: [{
            type: 'text',
            text: t('validation_units_range', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      if (!Number.isFinite(unitsToWager)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: t('error_invalid_units', locale)
          },
          content: [{
            type: 'text',
            text: t('validation_units_range', locale)
          }],
          isError: true,
          _meta: {
            'openai/locale': locale
          }
        };
      }

      // Calculate
      const calculatedUnitSize = bankroll * (unitSize / 100);
      const recommendedStake = calculatedUnitSize * unitsToWager;
      const stakePercentage = (recommendedStake / bankroll) * 100;

      // Format result text
      const resultText = `${t('unit_result_text', locale)}:\n\n${t('bankroll', locale)}: ${formatCurrencyLocalized(bankroll, locale)}\n${t('unit_per_unit', locale)}: ${unitSize}% (${formatCurrencyLocalized(calculatedUnitSize, locale)} ${t('unit_per_unit', locale)})\n${t('unit_per_unit', locale)}: ${unitsToWager}\n\n${t('unit_recommended_stake', locale)}: ${formatCurrencyLocalized(recommendedStake, locale)}`;

      return {
        // Model sees: concise summary of calculation
        structuredContent: {
          recommendedStake,
          stakePercentage,
          bankroll,
          unitSize,
          unitsToWager,
          calculatedAt: new Date().toISOString()
        },

        // Optional: natural language text for model
        content: [{
          type: 'text' as const,
          text: resultText
        }],

        // Component sees: complete data for UI rendering
        _meta: {
          'openai/outputTemplate': 'ui://widget/unit-calculator.html',
          'openai/widgetAccessible': true,
          'openai/toolInvocation/invoking': t('unit_calculating', locale),
          'openai/toolInvocation/invoked': t('unit_calculated', locale),
          'openai/locale': locale,

          // Complete calculation details
          calculation: {
            bankroll,
            unitSize,
            unitSizePercentage: unitSize,
            calculatedUnitSize,
            unitsToWager,
            recommendedStake,
            stakePercentage,
            method: 'unit_betting'
          },

          // Bankroll breakdown for visualization
          breakdown: {
            totalBankroll: bankroll,
            oneUnitValue: calculatedUnitSize,
            remainingBankroll: bankroll - recommendedStake,
            riskPercentage: stakePercentage
          },

          // UI display settings
          displaySettings: {
            currency: 'USD',
            decimalPlaces: 2,
            showBreakdown: true,
            locale
          }
        }
      };
    }
  );
}
