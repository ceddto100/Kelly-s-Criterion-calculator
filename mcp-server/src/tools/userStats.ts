/**
 * User Statistics Tool
 * Retrieves betting performance metrics and statistics
 */

import { z } from 'zod';
import { BetLog } from '../models/BetLog.js';
import { isDatabaseConnected } from '../config/database.js';

// ============================================================================
// INPUT SCHEMA
// ============================================================================

export const getUserStatsInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier to get statistics for'),

  sport: z
    .enum(['football', 'basketball', 'all'])
    .default('all')
    .describe('Filter statistics by sport or get all sports combined'),

  dateRange: z
    .object({
      start: z.string().optional().describe('Start date (ISO format)'),
      end: z.string().optional().describe('End date (ISO format)')
    })
    .optional()
    .describe('Optional date range filter')
});

export type GetUserStatsInput = z.infer<typeof getUserStatsInputSchema>;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const getUserStatsToolDefinition = {
  name: 'get_user_stats',
  description: `Get comprehensive betting statistics and performance metrics for a user.

Returns:
- Total bets and breakdown by result (wins/losses/pushes)
- Win rate and ROI (return on investment)
- Total wagered and net profit/loss
- Average probability and edge on bets placed
- Performance breakdown by sport (optional)

Use this to analyze betting performance over time and identify areas for improvement.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier to get statistics for',
        minLength: 1
      },
      sport: {
        type: 'string',
        enum: ['football', 'basketball', 'all'],
        description: 'Filter by sport or get all combined',
        default: 'all'
      },
      dateRange: {
        type: 'object',
        description: 'Optional date range filter',
        properties: {
          start: { type: 'string', description: 'Start date (ISO format)' },
          end: { type: 'string', description: 'End date (ISO format)' }
        }
      }
    },
    required: ['userId']
  }
};

// ============================================================================
// HANDLER
// ============================================================================

export async function handleGetUserStats(input: unknown): Promise<UserStatsOutput> {
  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected.');
  }

  const parsed = getUserStatsInputSchema.parse(input);

  // Build match query
  const matchQuery: Record<string, unknown> = { userId: parsed.userId };

  if (parsed.sport && parsed.sport !== 'all') {
    matchQuery['matchup.sport'] = parsed.sport;
  }

  if (parsed.dateRange) {
    const dateFilter: Record<string, Date> = {};
    if (parsed.dateRange.start) {
      dateFilter.$gte = new Date(parsed.dateRange.start);
    }
    if (parsed.dateRange.end) {
      dateFilter.$lte = new Date(parsed.dateRange.end);
    }
    if (Object.keys(dateFilter).length > 0) {
      matchQuery.createdAt = dateFilter;
    }
  }

  // Aggregation pipeline for comprehensive stats
  const pipeline = [
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalBets: { $sum: 1 },
        pendingBets: {
          $sum: { $cond: [{ $eq: ['$outcome.result', 'pending'] }, 1, 0] }
        },
        wins: {
          $sum: { $cond: [{ $eq: ['$outcome.result', 'win'] }, 1, 0] }
        },
        losses: {
          $sum: { $cond: [{ $eq: ['$outcome.result', 'loss'] }, 1, 0] }
        },
        pushes: {
          $sum: { $cond: [{ $eq: ['$outcome.result', 'push'] }, 1, 0] }
        },
        cancelled: {
          $sum: { $cond: [{ $eq: ['$outcome.result', 'cancelled'] }, 1, 0] }
        },
        totalWagered: {
          $sum: {
            $cond: [
              { $in: ['$outcome.result', ['win', 'loss']] },
              { $ifNull: ['$actualWager', '$kelly.recommendedStake'] },
              0
            ]
          }
        },
        totalReturned: {
          $sum: {
            $cond: [
              { $eq: ['$outcome.result', 'win'] },
              {
                $add: [
                  { $ifNull: ['$actualWager', '$kelly.recommendedStake'] },
                  { $ifNull: ['$outcome.payout', 0] }
                ]
              },
              {
                $cond: [
                  { $eq: ['$outcome.result', 'push'] },
                  { $ifNull: ['$actualWager', '$kelly.recommendedStake'] },
                  0
                ]
              }
            ]
          }
        },
        avgProbability: { $avg: '$estimation.calculatedProbability' },
        avgEdge: {
          $avg: {
            $cond: [
              { $ne: ['$estimation.edge', null] },
              '$estimation.edge',
              0
            ]
          }
        },
        avgStakePercentage: { $avg: '$kelly.stakePercentage' },
        maxWin: {
          $max: {
            $cond: [
              { $eq: ['$outcome.result', 'win'] },
              { $ifNull: ['$outcome.payout', 0] },
              0
            ]
          }
        },
        maxLoss: {
          $max: {
            $cond: [
              { $eq: ['$outcome.result', 'loss'] },
              { $ifNull: ['$actualWager', '$kelly.recommendedStake'] },
              0
            ]
          }
        }
      }
    }
  ];

  const results = await BetLog.aggregate(pipeline);

  if (results.length === 0) {
    return {
      success: true,
      userId: parsed.userId,
      sport: parsed.sport,
      stats: {
        summary: {
          totalBets: 0,
          pendingBets: 0,
          settledBets: 0,
          wins: 0,
          losses: 0,
          pushes: 0,
          cancelled: 0
        },
        performance: {
          winRate: 0,
          roi: 0,
          totalWagered: 0,
          totalReturned: 0,
          netProfit: 0
        },
        averages: {
          avgProbability: 0,
          avgEdge: 0,
          avgStakePercentage: 0
        },
        records: {
          biggestWin: 0,
          biggestLoss: 0
        }
      },
      message: 'No betting data found for this user.'
    };
  }

  const data = results[0];
  const settledBets = data.wins + data.losses;
  const winRate = settledBets > 0 ? (data.wins / settledBets) * 100 : 0;
  const netProfit = data.totalReturned - data.totalWagered;
  const roi = data.totalWagered > 0 ? (netProfit / data.totalWagered) * 100 : 0;

  return {
    success: true,
    userId: parsed.userId,
    sport: parsed.sport,
    stats: {
      summary: {
        totalBets: data.totalBets,
        pendingBets: data.pendingBets,
        settledBets,
        wins: data.wins,
        losses: data.losses,
        pushes: data.pushes,
        cancelled: data.cancelled
      },
      performance: {
        winRate: Math.round(winRate * 100) / 100,
        roi: Math.round(roi * 100) / 100,
        totalWagered: Math.round(data.totalWagered * 100) / 100,
        totalReturned: Math.round(data.totalReturned * 100) / 100,
        netProfit: Math.round(netProfit * 100) / 100
      },
      averages: {
        avgProbability: Math.round((data.avgProbability || 0) * 100) / 100,
        avgEdge: Math.round((data.avgEdge || 0) * 100) / 100,
        avgStakePercentage: Math.round((data.avgStakePercentage || 0) * 100) / 100
      },
      records: {
        biggestWin: Math.round((data.maxWin || 0) * 100) / 100,
        biggestLoss: Math.round((data.maxLoss || 0) * 100) / 100
      }
    },
    analysis: generateAnalysis(winRate, roi, data.avgEdge, settledBets)
  };
}

function generateAnalysis(winRate: number, roi: number, avgEdge: number, settledBets: number): string {
  if (settledBets < 10) {
    return 'Insufficient data for meaningful analysis. Continue tracking bets to build a statistically significant sample.';
  }

  const parts: string[] = [];

  if (winRate >= 55) {
    parts.push(`Strong win rate of ${winRate.toFixed(1)}%.`);
  } else if (winRate >= 50) {
    parts.push(`Solid win rate of ${winRate.toFixed(1)}%.`);
  } else if (winRate >= 45) {
    parts.push(`Win rate of ${winRate.toFixed(1)}% is slightly below break-even.`);
  } else {
    parts.push(`Win rate of ${winRate.toFixed(1)}% indicates room for improvement in bet selection.`);
  }

  if (roi > 10) {
    parts.push(`Excellent ROI of ${roi.toFixed(1)}%.`);
  } else if (roi > 0) {
    parts.push(`Positive ROI of ${roi.toFixed(1)}%.`);
  } else if (roi > -10) {
    parts.push(`Slightly negative ROI of ${roi.toFixed(1)}%.`);
  } else {
    parts.push(`ROI of ${roi.toFixed(1)}% suggests reviewing bet sizing or selection criteria.`);
  }

  if (avgEdge > 5) {
    parts.push('Average edge is strong - continue finding high-value opportunities.');
  } else if (avgEdge > 2) {
    parts.push('Average edge is acceptable for long-term profitability.');
  } else if (avgEdge > 0) {
    parts.push('Average edge is thin - consider being more selective with bets.');
  }

  return parts.join(' ');
}

export interface UserStatsOutput {
  success: boolean;
  userId: string;
  sport: string;
  stats: {
    summary: {
      totalBets: number;
      pendingBets: number;
      settledBets: number;
      wins: number;
      losses: number;
      pushes: number;
      cancelled: number;
    };
    performance: {
      winRate: number;
      roi: number;
      totalWagered: number;
      totalReturned: number;
      netProfit: number;
    };
    averages: {
      avgProbability: number;
      avgEdge: number;
      avgStakePercentage: number;
    };
    records: {
      biggestWin: number;
      biggestLoss: number;
    };
  };
  message?: string;
  analysis?: string;
}
