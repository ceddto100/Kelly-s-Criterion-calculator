/**
 * Bet History Tool
 *
 * This module provides three MCP tools for querying and retrieving betting history from the MongoDB database. These
 * tools enable users to review their past betting decisions, analyze patterns in their betting behavior, track pending
 * bets that need outcome updates, and retrieve detailed information about specific bets. The ability to query historical
 * data is crucial for performance analysis, identifying successful betting strategies, learning from mistakes, and
 * maintaining comprehensive records for tax and accounting purposes. The tools support pagination, filtering, and
 * sorting to help users efficiently navigate potentially large bet histories.
 *
 * TOOL: get_bet_history
 * Retrieves a paginated, filterable, and sortable list of all bets for a specific user. This is the primary tool for
 * browsing betting history and supports multiple query options: pagination with configurable page size (1-100 bets per
 * page, default 20), filtering by sport (football or basketball) to focus on specific betting markets, filtering by
 * outcome status (pending, win, loss, push, cancelled, or all) to analyze performance or find bets needing updates,
 * sorting by creation date, update date, stake percentage, or edge to organize results meaningfully, and ascending or
 * descending sort order. The tool returns a comprehensive list of bet summaries, each containing matchup details (teams,
 * sport, venue), probability estimations (spread, calculated probability, edge), Kelly Criterion data (bankroll, odds,
 * recommended stake), actual wager amount, outcome information (result, payout, score, settlement date), notes and tags,
 * and creation/update timestamps. The response includes pagination metadata showing the current page, total number of
 * bets, total pages, and whether more results are available, making it easy to implement infinite scroll or pagination
 * controls in user interfaces.
 *
 * TOOL: get_bet
 * Retrieves complete details for a single specific bet using its unique bet ID. While get_bet_history returns summarized
 * information for multiple bets, this tool provides the full, comprehensive data for one bet, including all fields stored
 * in the database. This is useful when users want to review the complete details of a particular betting decision, verify
 * calculations, or display a detailed bet summary page. The bet ID is obtained from the log_bet tool when the bet is
 * initially created, or from the results of get_bet_history queries. The tool returns all matchup information, complete
 * probability estimations including expected margin and implied probability, full Kelly Criterion calculations, actual
 * wager details, complete outcome data, user notes and tags, and precise creation and update timestamps. This level of
 * detail supports thorough post-bet analysis and record-keeping.
 *
 * TOOL: get_pending_bets
 * Retrieves all bets that have a "pending" outcome status for a specific user, sorted by creation date with newest first.
 * This tool is specifically designed to help users identify bets that were placed but haven't been settled yet, making it
 * easy to find bets that need outcome updates after games conclude. The tool accepts a user ID and an optional limit
 * parameter (1-50, default 20) to control how many pending bets are returned. This is particularly useful for creating
 * a "needs attention" list in user interfaces, allowing users to quickly update results after game days, and ensuring
 * that no bets are forgotten without having their outcomes recorded. The response includes the same comprehensive bet
 * information as get_bet_history, but filtered exclusively to pending bets, making it a streamlined workflow for bet
 * settlement and record maintenance.
 */

import { z } from 'zod';
import { BetLog, IBetLog } from '../models/BetLog.js';
import { isDatabaseConnected } from '../config/database.js';

// ============================================================================
// INPUT SCHEMA
// ============================================================================

export const getBetHistoryInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier to retrieve bets for'),

  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe('Page number for pagination (starts at 1)'),

  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Number of bets per page (max 100)'),

  sport: z
    .enum(['football', 'basketball'])
    .optional()
    .describe('Filter by sport'),

  status: z
    .enum(['pending', 'win', 'loss', 'push', 'cancelled', 'all'])
    .default('all')
    .describe('Filter by outcome status'),

  sortBy: z
    .enum(['createdAt', 'updatedAt', 'stakePercentage', 'edge'])
    .default('createdAt')
    .describe('Field to sort by'),

  sortOrder: z
    .enum(['asc', 'desc'])
    .default('desc')
    .describe('Sort order: ascending or descending')
});

export const getBetByIdInputSchema = z.object({
  betId: z
    .string()
    .min(1)
    .describe('The unique bet ID to retrieve')
});

export const getPendingBetsInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier'),

  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('Maximum number of pending bets to return')
});

export type GetBetHistoryInput = z.infer<typeof getBetHistoryInputSchema>;
export type GetBetByIdInput = z.infer<typeof getBetByIdInputSchema>;
export type GetPendingBetsInput = z.infer<typeof getPendingBetsInputSchema>;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const getBetHistoryToolDefinition = {
  name: 'get_bet_history',
  description: `Retrieve betting history for a user from the database.

Supports:
- Pagination (page and limit)
- Filtering by sport (football/basketball)
- Filtering by status (pending/win/loss/push/cancelled)
- Sorting by date, stake percentage, or edge

Returns bet details including matchup, odds, probability, stake, and outcome.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier to retrieve bets for',
        minLength: 1
      },
      page: {
        type: 'number',
        description: 'Page number for pagination (starts at 1)',
        minimum: 1,
        default: 1
      },
      limit: {
        type: 'number',
        description: 'Number of bets per page (max 100)',
        minimum: 1,
        maximum: 100,
        default: 20
      },
      sport: {
        type: 'string',
        enum: ['football', 'basketball'],
        description: 'Filter by sport'
      },
      status: {
        type: 'string',
        enum: ['pending', 'win', 'loss', 'push', 'cancelled', 'all'],
        description: 'Filter by outcome status',
        default: 'all'
      },
      sortBy: {
        type: 'string',
        enum: ['createdAt', 'updatedAt', 'stakePercentage', 'edge'],
        description: 'Field to sort by',
        default: 'createdAt'
      },
      sortOrder: {
        type: 'string',
        enum: ['asc', 'desc'],
        description: 'Sort order',
        default: 'desc'
      }
    },
    required: ['userId']
  }
};

export const getBetByIdToolDefinition = {
  name: 'get_bet',
  description: `Retrieve a specific bet by its ID.

Returns complete bet details including all matchup information, probability calculations, Kelly Criterion data, and outcome.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      betId: {
        type: 'string',
        description: 'The unique bet ID to retrieve',
        minLength: 1
      }
    },
    required: ['betId']
  }
};

export const getPendingBetsToolDefinition = {
  name: 'get_pending_bets',
  description: `Get all pending bets for a user that haven't been settled yet.

Useful for reviewing active bets that need outcome updates. Returns bets sorted by creation date (newest first).`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier',
        minLength: 1
      },
      limit: {
        type: 'number',
        description: 'Maximum number of pending bets to return',
        minimum: 1,
        maximum: 50,
        default: 20
      }
    },
    required: ['userId']
  }
};

// ============================================================================
// HANDLERS
// ============================================================================

export async function handleGetBetHistory(input: unknown): Promise<BetHistoryOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = getBetHistoryInputSchema.parse(input);

  const query: Record<string, unknown> = { userId: parsed.userId };

  if (parsed.sport) {
    query['matchup.sport'] = parsed.sport;
  }

  if (parsed.status && parsed.status !== 'all') {
    query['outcome.result'] = parsed.status;
  }

  const sortField = parsed.sortBy === 'stakePercentage' ? 'kelly.stakePercentage'
    : parsed.sortBy === 'edge' ? 'estimation.edge'
    : parsed.sortBy;
  const sortOrder = parsed.sortOrder === 'asc' ? 1 : -1;

  const skip = (parsed.page - 1) * parsed.limit;

  const [bets, totalCount] = await Promise.all([
    BetLog.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(parsed.limit)
      .lean(),
    BetLog.countDocuments(query)
  ]);

  const totalPages = Math.ceil(totalCount / parsed.limit);

  return {
    success: true,
    pagination: {
      page: parsed.page,
      limit: parsed.limit,
      totalBets: totalCount,
      totalPages,
      hasMore: parsed.page < totalPages
    },
    bets: bets.map(formatBetForOutput)
  };
}

export async function handleGetBetById(input: unknown): Promise<SingleBetOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = getBetByIdInputSchema.parse(input);

  const bet = await BetLog.findById(parsed.betId).lean();

  if (!bet) {
    throw new Error(`Bet not found with ID: ${parsed.betId}`);
  }

  return {
    success: true,
    bet: formatBetForOutput(bet)
  };
}

export async function handleGetPendingBets(input: unknown): Promise<BetHistoryOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = getPendingBetsInputSchema.parse(input);

  const bets = await BetLog.find({
    userId: parsed.userId,
    'outcome.result': 'pending'
  })
    .sort({ createdAt: -1 })
    .limit(parsed.limit)
    .lean();

  const totalCount = await BetLog.countDocuments({
    userId: parsed.userId,
    'outcome.result': 'pending'
  });

  return {
    success: true,
    pagination: {
      page: 1,
      limit: parsed.limit,
      totalBets: totalCount,
      totalPages: 1,
      hasMore: false
    },
    bets: bets.map(formatBetForOutput)
  };
}

function formatBetForOutput(bet: Record<string, unknown>): BetSummary {
  const betDoc = bet as unknown as IBetLog;
  return {
    id: betDoc._id?.toString() || '',
    matchup: {
      sport: betDoc.matchup.sport,
      teamA: betDoc.matchup.teamA.name,
      teamB: betDoc.matchup.teamB.name,
      venue: betDoc.matchup.venue
    },
    estimation: {
      spread: betDoc.estimation.pointSpread,
      probability: betDoc.estimation.calculatedProbability,
      expectedMargin: betDoc.estimation.expectedMargin,
      impliedProbability: betDoc.estimation.impliedProbability,
      edge: betDoc.estimation.edge
    },
    kelly: {
      bankroll: betDoc.kelly.bankroll,
      odds: betDoc.kelly.americanOdds,
      fraction: betDoc.kelly.kellyFraction,
      recommendedStake: betDoc.kelly.recommendedStake,
      stakePercentage: betDoc.kelly.stakePercentage
    },
    actualWager: betDoc.actualWager,
    outcome: {
      result: betDoc.outcome.result,
      payout: betDoc.outcome.payout,
      actualScore: betDoc.outcome.actualScore,
      settledAt: betDoc.outcome.settledAt?.toISOString()
    },
    notes: betDoc.notes,
    tags: betDoc.tags,
    createdAt: betDoc.createdAt.toISOString(),
    updatedAt: betDoc.updatedAt.toISOString()
  };
}

export interface BetSummary {
  id: string;
  matchup: {
    sport: string;
    teamA: string;
    teamB: string;
    venue: string;
  };
  estimation: {
    spread: number;
    probability: number;
    expectedMargin?: number;
    impliedProbability?: number;
    edge?: number;
  };
  kelly: {
    bankroll: number;
    odds: number;
    fraction: number;
    recommendedStake: number;
    stakePercentage: number;
  };
  actualWager?: number;
  outcome: {
    result: string;
    payout?: number;
    actualScore?: { teamA: number; teamB: number };
    settledAt?: string;
  };
  notes?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BetHistoryOutput {
  success: boolean;
  pagination: {
    page: number;
    limit: number;
    totalBets: number;
    totalPages: number;
    hasMore: boolean;
  };
  bets: BetSummary[];
}

export interface SingleBetOutput {
  success: boolean;
  bet: BetSummary;
}
