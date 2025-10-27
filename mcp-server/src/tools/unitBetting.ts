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
      _meta: {
        'openai/outputTemplate': 'ui://widget/unit-calculator.html',
        'openai/toolInvocation/invoking': 'Calculating unit betting stake...',
        'openai/toolInvocation/invoked': 'Calculated unit betting stake',
        'openai/widgetAccessible': true
      }
    },
    async (args) => {
      const { bankroll, unitSize, unitsToWager } = args;

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
