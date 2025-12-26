/**
 * Bankroll Management Tools
 *
 * This module provides three essential MCP tools for managing user bankroll, which is the total amount of money
 * a user has dedicated for betting purposes. Proper bankroll management is crucial for Kelly Criterion calculations
 * and long-term betting success. The tools enable retrieving current bankroll, setting absolute bankroll values,
 * and making incremental adjustments based on betting activity (wins, losses, deposits, withdrawals, etc.).
 *
 * TOOL: get_bankroll
 * Retrieves the current bankroll amount for a specified user from the MongoDB database. This is used to understand
 * how much capital a user currently has available for betting, which is essential for calculating optimal bet sizes
 * using the Kelly Criterion. The tool returns the bankroll value along with the last updated timestamp, allowing
 * users and AI agents to make informed betting decisions based on current capital levels.
 *
 * TOOL: set_bankroll
 * Sets an absolute bankroll value for a user, completely replacing the previous amount. This tool is typically used
 * when users make significant deposits, withdraw funds, or need to reconcile their account balance with actual funds.
 * Unlike the adjust_bankroll tool which makes incremental changes, set_bankroll establishes a new baseline amount.
 * The tool tracks both the previous and new bankroll values and calculates the change for audit purposes.
 *
 * TOOL: adjust_bankroll
 * Makes incremental adjustments to a user's bankroll by adding or subtracting a specified amount. This is the primary
 * tool for recording betting outcomes (wins add to bankroll, losses subtract), as well as tracking deposits and
 * withdrawals. The tool requires a reason parameter to categorize the adjustment (bet_win, bet_loss, deposit, withdrawal,
 * correction, or other), which helps maintain a clear audit trail of bankroll changes. The adjustment amount can be
 * positive or negative, and the tool ensures the bankroll never goes below zero to prevent invalid states.
 */

import { z } from 'zod';
import { User } from '../models/User.js';
import { isDatabaseConnected } from '../config/database.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const getBankrollInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier to get bankroll for')
});

export const setBankrollInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier'),

  amount: z
    .number()
    .min(0)
    .describe('New bankroll amount in USD')
});

export const adjustBankrollInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier'),

  adjustment: z
    .number()
    .describe('Amount to add (positive) or subtract (negative) from bankroll'),

  reason: z
    .enum(['deposit', 'withdrawal', 'bet_win', 'bet_loss', 'correction', 'other'])
    .default('other')
    .describe('Reason for the adjustment')
});

export type GetBankrollInput = z.infer<typeof getBankrollInputSchema>;
export type SetBankrollInput = z.infer<typeof setBankrollInputSchema>;
export type AdjustBankrollInput = z.infer<typeof adjustBankrollInputSchema>;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const getBankrollToolDefinition = {
  name: 'get_bankroll',
  description: `Get the current bankroll amount for a user.

Returns the user's total betting bankroll used for Kelly Criterion calculations.
If the user doesn't exist, returns an error.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier to get bankroll for',
        minLength: 1
      }
    },
    required: ['userId']
  }
};

export const setBankrollToolDefinition = {
  name: 'set_bankroll',
  description: `Set the bankroll amount for a user.

Use this to set an absolute bankroll value (e.g., after depositing funds or reconciling account).
For incremental changes (wins/losses), use adjust_bankroll instead.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier',
        minLength: 1
      },
      amount: {
        type: 'number',
        description: 'New bankroll amount in USD',
        minimum: 0
      }
    },
    required: ['userId', 'amount']
  }
};

export const adjustBankrollToolDefinition = {
  name: 'adjust_bankroll',
  description: `Adjust the bankroll by adding or subtracting an amount.

Use for:
- Recording bet wins (positive adjustment)
- Recording bet losses (negative adjustment)
- Deposits (positive adjustment)
- Withdrawals (negative adjustment)

Tracks the reason for the adjustment for record-keeping.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier',
        minLength: 1
      },
      adjustment: {
        type: 'number',
        description: 'Amount to add (positive) or subtract (negative)'
      },
      reason: {
        type: 'string',
        enum: ['deposit', 'withdrawal', 'bet_win', 'bet_loss', 'correction', 'other'],
        description: 'Reason for the adjustment',
        default: 'other'
      }
    },
    required: ['userId', 'adjustment']
  }
};

// ============================================================================
// HANDLERS
// ============================================================================

export async function handleGetBankroll(input: unknown): Promise<BankrollOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = getBankrollInputSchema.parse(input);

  const user = await User.findOne({ identifier: parsed.userId });

  if (!user) {
    throw new Error(`User not found with ID: ${parsed.userId}`);
  }

  return {
    success: true,
    userId: parsed.userId,
    bankroll: user.currentBankroll,
    lastUpdated: user.lastActive.toISOString()
  };
}

export async function handleSetBankroll(input: unknown): Promise<BankrollOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = setBankrollInputSchema.parse(input);

  const user = await User.findOne({ identifier: parsed.userId });

  if (!user) {
    throw new Error(`User not found with ID: ${parsed.userId}`);
  }

  const previousBankroll = user.currentBankroll;
  await user.updateBankroll(parsed.amount);

  return {
    success: true,
    userId: parsed.userId,
    bankroll: parsed.amount,
    previousBankroll,
    change: Math.round((parsed.amount - previousBankroll) * 100) / 100,
    lastUpdated: new Date().toISOString(),
    message: `Bankroll updated from $${previousBankroll.toFixed(2)} to $${parsed.amount.toFixed(2)}`
  };
}

export async function handleAdjustBankroll(input: unknown): Promise<BankrollAdjustOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = adjustBankrollInputSchema.parse(input);

  const user = await User.findOne({ identifier: parsed.userId });

  if (!user) {
    throw new Error(`User not found with ID: ${parsed.userId}`);
  }

  const previousBankroll = user.currentBankroll;
  const newBankroll = Math.max(0, previousBankroll + parsed.adjustment);

  await user.updateBankroll(newBankroll);

  const reasonDescriptions: Record<string, string> = {
    deposit: 'Deposit',
    withdrawal: 'Withdrawal',
    bet_win: 'Bet win',
    bet_loss: 'Bet loss',
    correction: 'Correction',
    other: 'Adjustment'
  };

  return {
    success: true,
    userId: parsed.userId,
    adjustment: {
      amount: parsed.adjustment,
      reason: parsed.reason,
      description: reasonDescriptions[parsed.reason]
    },
    bankroll: {
      previous: previousBankroll,
      current: newBankroll,
      change: Math.round((newBankroll - previousBankroll) * 100) / 100
    },
    lastUpdated: new Date().toISOString(),
    message: `${reasonDescriptions[parsed.reason]}: ${parsed.adjustment >= 0 ? '+' : ''}$${parsed.adjustment.toFixed(2)}. New bankroll: $${newBankroll.toFixed(2)}`
  };
}

export interface BankrollOutput {
  success: boolean;
  userId: string;
  bankroll: number;
  previousBankroll?: number;
  change?: number;
  lastUpdated: string;
  message?: string;
}

export interface BankrollAdjustOutput {
  success: boolean;
  userId: string;
  adjustment: {
    amount: number;
    reason: string;
    description: string;
  };
  bankroll: {
    previous: number;
    current: number;
    change: number;
  };
  lastUpdated: string;
  message: string;
}
