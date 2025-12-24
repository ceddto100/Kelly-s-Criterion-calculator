/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bankroll management tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';

// In-memory bankroll storage per session
const bankrollStorage: Map<string, BankrollRecord> = new Map();

interface BankrollRecord {
  amount: number;
  currency: string;
  lastUpdated: string;
  history: { amount: number; reason: string; timestamp: string }[];
}

function getSessionId(extra?: any): string {
  return extra?._meta?.sessionId || 'default';
}

function getBankroll(sessionId: string): BankrollRecord {
  if (!bankrollStorage.has(sessionId)) {
    bankrollStorage.set(sessionId, {
      amount: 1000, // Default starting bankroll
      currency: 'USD',
      lastUpdated: new Date().toISOString(),
      history: [{
        amount: 1000,
        reason: 'Initial bankroll',
        timestamp: new Date().toISOString()
      }]
    });
  }
  return bankrollStorage.get(sessionId)!;
}

export function registerBankrollTools(server: McpServer) {
  // Get current bankroll
  server.tool(
    'get-bankroll',
    {
      title: 'Get Current Bankroll',
      description: 'Use this when the user wants to check their current bankroll amount. Returns the current bankroll balance that should be used for Kelly calculations.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Checking bankroll...',
        'openai/toolInvocation/invoked': 'Retrieved bankroll'
      }
    },
    async (args, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const sessionId = getSessionId(extra);
      const record = getBankroll(sessionId);

      return {
        structuredContent: {
          bankroll: record.amount,
          currency: record.currency,
          lastUpdated: record.lastUpdated
        },
        content: [{
          type: 'text' as const,
          text: `**Current Bankroll:** ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(record.amount)}\n\n_Use this value with the kelly-calculate tool to determine optimal bet sizes._`
        }],
        _meta: {
          'openai/locale': locale
        }
      };
    }
  );

  // Set/update bankroll
  server.tool(
    'set-bankroll',
    {
      title: 'Set Bankroll Amount',
      description: 'Use this when the user wants to set or update their bankroll amount. This should be called when starting a new betting session, after making deposits/withdrawals, or to correct the bankroll amount.',
      inputSchema: {
        amount: z.number().positive().describe('New bankroll amount in USD. Must be positive. Example: 1500 for $1,500'),
        reason: z.string().default('Manual update').describe('Optional reason for the change. Examples: "Initial deposit", "Weekly withdrawal", "Correction"')
      },
      annotations: {
        readOnlyHint: false
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Updating bankroll...',
        'openai/toolInvocation/invoked': 'Bankroll updated'
      }
    },
    async (args, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { amount, reason } = args;

      if (amount <= 0) {
        return {
          structuredContent: {
            error: 'invalid_amount',
            message: 'Bankroll amount must be positive'
          },
          content: [{
            type: 'text' as const,
            text: 'Bankroll amount must be greater than $0.'
          }],
          isError: true
        };
      }

      const sessionId = getSessionId(extra);
      const record = getBankroll(sessionId);
      const previousAmount = record.amount;

      record.amount = amount;
      record.lastUpdated = new Date().toISOString();
      record.history.push({
        amount,
        reason: reason || 'Manual update',
        timestamp: record.lastUpdated
      });

      const change = amount - previousAmount;
      const changeText = change >= 0 ? `+$${change.toFixed(2)}` : `-$${Math.abs(change).toFixed(2)}`;

      return {
        structuredContent: {
          bankroll: amount,
          previousAmount,
          change,
          reason,
          updatedAt: record.lastUpdated
        },
        content: [{
          type: 'text' as const,
          text: `## Bankroll Updated\n\n` +
            `- **New Balance:** $${amount.toFixed(2)}\n` +
            `- **Previous:** $${previousAmount.toFixed(2)}\n` +
            `- **Change:** ${changeText}\n` +
            `- **Reason:** ${reason || 'Manual update'}\n\n` +
            `_Your new bankroll of $${amount.toFixed(2)} will be used for future Kelly calculations._`
        }],
        _meta: {
          'openai/locale': locale
        }
      };
    }
  );

  // Adjust bankroll (add/subtract)
  server.tool(
    'adjust-bankroll',
    {
      title: 'Adjust Bankroll',
      description: 'Use this when the user wants to add or subtract money from their bankroll. Use positive numbers for deposits/wins, negative numbers for withdrawals/losses. This is more convenient than set-bankroll when making incremental changes.',
      inputSchema: {
        adjustment: z.number().describe('Amount to add (positive) or subtract (negative) from bankroll. Example: 100 to add $100, -50 to subtract $50'),
        reason: z.string().default('Adjustment').describe('Reason for the adjustment. Examples: "Bet won", "Bet lost", "Deposit", "Withdrawal"')
      },
      annotations: {
        readOnlyHint: false
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Adjusting bankroll...',
        'openai/toolInvocation/invoked': 'Bankroll adjusted'
      }
    },
    async (args, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { adjustment, reason } = args;
      const sessionId = getSessionId(extra);
      const record = getBankroll(sessionId);
      const previousAmount = record.amount;
      const newAmount = previousAmount + adjustment;

      if (newAmount < 0) {
        return {
          structuredContent: {
            error: 'insufficient_funds',
            message: 'Adjustment would result in negative bankroll',
            currentBankroll: previousAmount,
            attemptedAdjustment: adjustment
          },
          content: [{
            type: 'text' as const,
            text: `Cannot subtract $${Math.abs(adjustment).toFixed(2)} from bankroll of $${previousAmount.toFixed(2)}. This would result in a negative balance.`
          }],
          isError: true
        };
      }

      record.amount = newAmount;
      record.lastUpdated = new Date().toISOString();
      record.history.push({
        amount: newAmount,
        reason: reason || (adjustment >= 0 ? 'Deposit' : 'Withdrawal'),
        timestamp: record.lastUpdated
      });

      const changeText = adjustment >= 0 ? `+$${adjustment.toFixed(2)}` : `-$${Math.abs(adjustment).toFixed(2)}`;
      const emoji = adjustment >= 0 ? '📈' : '📉';

      return {
        structuredContent: {
          bankroll: newAmount,
          previousAmount,
          adjustment,
          reason,
          updatedAt: record.lastUpdated
        },
        content: [{
          type: 'text' as const,
          text: `## Bankroll Adjusted ${emoji}\n\n` +
            `- **New Balance:** $${newAmount.toFixed(2)}\n` +
            `- **Change:** ${changeText}\n` +
            `- **Reason:** ${reason || 'Adjustment'}\n`
        }],
        _meta: {
          'openai/locale': locale
        }
      };
    }
  );

  // Get bankroll history
  server.tool(
    'get-bankroll-history',
    {
      title: 'Get Bankroll History',
      description: 'Use this when the user wants to see the history of their bankroll changes. Shows deposits, withdrawals, and adjustments over time.',
      inputSchema: {
        limit: z.number().min(1).max(50).default(10).describe('Maximum number of history entries to return. Default is 10.')
      },
      annotations: {
        readOnlyHint: true
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Loading bankroll history...',
        'openai/toolInvocation/invoked': 'History loaded'
      }
    },
    async (args, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { limit } = args;
      const sessionId = getSessionId(extra);
      const record = getBankroll(sessionId);

      const recentHistory = record.history.slice(-limit).reverse();

      let responseText = `## Bankroll History\n\n` +
        `**Current Balance:** $${record.amount.toFixed(2)}\n\n` +
        `| Date | Amount | Reason |\n` +
        `|------|--------|--------|\n`;

      for (const entry of recentHistory) {
        const date = new Date(entry.timestamp).toLocaleDateString();
        responseText += `| ${date} | $${entry.amount.toFixed(2)} | ${entry.reason} |\n`;
      }

      // Calculate stats
      if (record.history.length >= 2) {
        const firstEntry = record.history[0];
        const totalChange = record.amount - firstEntry.amount;
        const changePercent = ((record.amount - firstEntry.amount) / firstEntry.amount) * 100;

        responseText += `\n### Performance\n` +
          `- **Starting Bankroll:** $${firstEntry.amount.toFixed(2)}\n` +
          `- **Current Bankroll:** $${record.amount.toFixed(2)}\n` +
          `- **Net Change:** ${totalChange >= 0 ? '+' : ''}$${totalChange.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(1)}%)\n`;
      }

      return {
        structuredContent: {
          currentBankroll: record.amount,
          history: recentHistory,
          totalEntries: record.history.length
        },
        content: [{
          type: 'text' as const,
          text: responseText
        }],
        _meta: {
          'openai/locale': locale
        }
      };
    }
  );
}
