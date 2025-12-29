/**
 * Bet Outcome Update Tool
 *
 * This module provides a single critical MCP tool for updating the outcome of previously logged bets once the sporting
 * event has concluded. After a user places a bet using the log_bet tool, the bet initially has a "pending" status.
 * Once the game is complete and the result is known, this tool allows updating the bet with the actual outcome, final
 * score, and payout information. Accurate outcome tracking is essential for calculating return on investment (ROI),
 * analyzing betting performance over time, and maintaining comprehensive betting records for statistical analysis.
 *
 * TOOL: update_bet_outcome
 * Updates the result of a previously logged bet by setting its outcome to win, loss, push, or cancelled. This tool
 * requires the unique bet ID (obtained when the bet was originally logged) and the result type. For wins, the bet is
 * marked as won and the payout is calculated based on the original wager and odds - if a specific payout amount is
 * provided, it uses that value, otherwise it calculates the expected payout using the American odds format (positive
 * odds: wager × odds/100, negative odds: wager × 100/|odds|). For losses, the bet is marked as lost with a zero payout.
 * For pushes (ties where the spread was hit exactly), the original wager is returned as the payout. For cancelled bets
 * (when a game is postponed or voided), the payout is zero. The tool also accepts optional parameters for the actual
 * final score of the game, which is valuable for post-game analysis and verifying the correctness of the outcome. Once
 * updated, the bet's settledAt timestamp is automatically set to record when the outcome was determined. The tool prevents
 * double-updating by throwing an error if you attempt to change a bet that has already been settled, ensuring data integrity
 * and preventing accidental overwrites of historical records.
 */

import { z } from 'zod';
import { BetLog } from '../models/BetLog.js';
import { isDatabaseConnected } from '../config/database.js';

// ============================================================================
// INPUT SCHEMA
// ============================================================================

export const updateBetOutcomeInputSchema = z.object({
  betId: z
    .string()
    .min(1)
    .describe('The unique bet ID to update'),

  result: z
    .enum(['win', 'loss', 'push', 'cancelled'])
    .describe('The outcome of the bet: win (bet won), loss (bet lost), push (tie/refund), cancelled (void)'),

  actualScore: z
    .object({
      teamA: z.number().int().min(0).describe('Final score for Team A'),
      teamB: z.number().int().min(0).describe('Final score for Team B')
    })
    .optional()
    .describe('Actual final score of the game'),

  payout: z
    .number()
    .min(0)
    .optional()
    .describe('Actual payout amount received (for wins)')
});

export type UpdateBetOutcomeInput = z.infer<typeof updateBetOutcomeInputSchema>;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const updateBetOutcomeToolDefinition = {
  name: 'update_bet_outcome',
  description: `Set a logged bet to win, loss, push, or cancelled, optionally storing final score and payout.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      betId: {
        type: 'string',
        description: 'The unique bet ID to update',
        minLength: 1
      },
      result: {
        type: 'string',
        enum: ['win', 'loss', 'push', 'cancelled'],
        description: 'The outcome: win, loss, push, or cancelled'
      },
      actualScore: {
        type: 'object',
        description: 'Actual final score of the game',
        properties: {
          teamA: {
            type: 'number',
            description: 'Final score for Team A',
            minimum: 0
          },
          teamB: {
            type: 'number',
            description: 'Final score for Team B',
            minimum: 0
          }
        },
        required: ['teamA', 'teamB']
      },
      payout: {
        type: 'number',
        description: 'Actual payout amount received (for wins)',
        minimum: 0
      }
    },
    required: ['betId', 'result']
  }
};

// ============================================================================
// HANDLER
// ============================================================================

export async function handleUpdateBetOutcome(input: unknown): Promise<UpdateBetOutcomeOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = updateBetOutcomeInputSchema.parse(input);

  const bet = await BetLog.findById(parsed.betId);

  if (!bet) {
    throw new Error(`Bet not found with ID: ${parsed.betId}`);
  }

  // Check if already settled
  if (bet.outcome.result !== 'pending') {
    throw new Error(`Bet is already settled with result: ${bet.outcome.result}. Cannot update a settled bet.`);
  }

  // Update outcome
  bet.outcome.result = parsed.result;
  bet.outcome.settledAt = new Date();

  if (parsed.actualScore) {
    bet.outcome.actualScore = parsed.actualScore;
  }

  // Calculate payout if not provided
  if (parsed.result === 'win') {
    if (parsed.payout !== undefined) {
      bet.outcome.payout = parsed.payout;
    } else {
      // Calculate expected payout
      const wager = bet.actualWager || bet.kelly.recommendedStake;
      const odds = bet.kelly.americanOdds;
      let winnings: number;

      if (odds > 0) {
        winnings = wager * (odds / 100);
      } else {
        winnings = wager * (100 / Math.abs(odds));
      }

      bet.outcome.payout = Math.round((wager + winnings) * 100) / 100;
    }
  } else if (parsed.result === 'push') {
    bet.outcome.payout = bet.actualWager || bet.kelly.recommendedStake;
  } else {
    bet.outcome.payout = 0;
  }

  await bet.save();

  // Calculate profit/loss
  const wager = bet.actualWager || bet.kelly.recommendedStake;
  let profit: number;

  switch (parsed.result) {
    case 'win':
      profit = (bet.outcome.payout || 0) - wager;
      break;
    case 'loss':
      profit = -wager;
      break;
    case 'push':
    case 'cancelled':
    default:
      profit = 0;
  }

  return {
    success: true,
    betId: parsed.betId,
    message: `Bet outcome updated to: ${parsed.result}`,
    bet: {
      id: bet._id.toString(),
      matchup: `${bet.matchup.teamA.name} vs ${bet.matchup.teamB.name}`,
      result: parsed.result,
      wager,
      payout: bet.outcome.payout || 0,
      profit: Math.round(profit * 100) / 100,
      actualScore: parsed.actualScore,
      settledAt: bet.outcome.settledAt?.toISOString() || new Date().toISOString()
    }
  };
}

export interface UpdateBetOutcomeOutput {
  success: boolean;
  betId: string;
  message: string;
  bet: {
    id: string;
    matchup: string;
    result: string;
    wager: number;
    payout: number;
    profit: number;
    actualScore?: { teamA: number; teamB: number };
    settledAt: string;
  };
}
