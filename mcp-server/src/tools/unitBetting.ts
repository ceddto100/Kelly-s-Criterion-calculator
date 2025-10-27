/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit betting calculation tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { formatCurrency } from '../utils/calculations.js';

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
    async (args) => {
      const { bankroll, unitSize, unitsToWager } = args;

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

      if (typeof unitSize !== 'number' || isNaN(unitSize)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Unit size must be a valid number'
          },
          content: [{
            type: 'text',
            text: 'Invalid unit size. Must be a valid number between 0 and 5.'
          }],
          isError: true
        };
      }

      if (unitSize < 0 || unitSize > 5) {
        return {
          structuredContent: {
            error: 'invalid_unit_size',
            message: 'Unit size out of range',
            validRange: 'Must be between 0 and 5'
          },
          content: [{
            type: 'text',
            text: 'Invalid unit size. Must be between 0% and 5% of bankroll.'
          }],
          isError: true
        };
      }

      if (typeof unitsToWager !== 'number' || isNaN(unitsToWager)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Units to wager must be a valid number'
          },
          content: [{
            type: 'text',
            text: 'Invalid units to wager. Must be a valid positive number.'
          }],
          isError: true
        };
      }

      if (unitsToWager <= 0 || unitsToWager > 100) {
        return {
          structuredContent: {
            error: 'invalid_units',
            message: 'Units to wager out of range',
            validRange: 'Must be between 1 and 100'
          },
          content: [{
            type: 'text',
            text: 'Invalid units to wager. Must be a positive number between 1 and 100.'
          }],
          isError: true
        };
      }

      if (!Number.isFinite(unitsToWager)) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Units to wager must be a finite number'
          },
          content: [{
            type: 'text',
            text: 'Invalid units to wager. Must be a finite number.'
          }],
          isError: true
        };
      }

      // Calculate
      const calculatedUnitSize = bankroll * (unitSize / 100);
      const recommendedStake = calculatedUnitSize * unitsToWager;
      const stakePercentage = (recommendedStake / bankroll) * 100;

      // Format result text
      const resultText = `Based on your unit betting strategy:\n\nBankroll: ${formatCurrency(bankroll)}\nUnit Size: ${unitSize}% (${formatCurrency(calculatedUnitSize)} per unit)\nUnits to Wager: ${unitsToWager}\n\nRecommended Stake: ${formatCurrency(recommendedStake)}`;

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
          'openai/toolInvocation/invoking': 'Calculating unit betting stake...',
          'openai/toolInvocation/invoked': 'Calculated unit betting stake',

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
            showBreakdown: true
          }
        }
      };
    }
  );
}
