/**
 * BetLog model for tracking betting history
 * Mirrors the backend BetLog model structure
 */

import mongoose, { Document, Model, Schema } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

export interface IMatchup {
  sport: 'football' | 'basketball';
  teamA: {
    name: string;
    abbreviation?: string;
    stats?: Record<string, number>;
  };
  teamB: {
    name: string;
    abbreviation?: string;
    stats?: Record<string, number>;
  };
  venue: 'home' | 'away' | 'neutral';
}

export interface IEstimation {
  pointSpread: number;
  calculatedProbability: number;
  expectedMargin?: number;
  impliedProbability?: number;
  edge?: number;
}

export interface IKelly {
  bankroll: number;
  americanOdds: number;
  kellyFraction: 0.25 | 0.5 | 1;
  recommendedStake: number;
  stakePercentage: number;
}

export interface IOutcome {
  result: 'pending' | 'win' | 'loss' | 'push' | 'cancelled';
  actualScore?: {
    teamA: number;
    teamB: number;
  };
  payout?: number;
  settledAt?: Date;
}

export interface IBetLog extends Document {
  userId: string;
  matchup: IMatchup;
  estimation: IEstimation;
  kelly: IKelly;
  actualWager?: number;
  outcome: IOutcome;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  calculatePotentialPayout(): number;
  calculateProfit(): number;
}

export interface IBetLogModel extends Model<IBetLog> {
  getUserStats(userId: string): Promise<UserBetStats>;
}

export interface UserBetStats {
  totalBets: number;
  pendingBets: number;
  wins: number;
  losses: number;
  pushes: number;
  cancelled: number;
  winRate: number;
  totalWagered: number;
  totalPayout: number;
  netProfit: number;
  roi: number;
  avgProbability: number;
  avgEdge: number;
}

// ============================================================================
// SCHEMA
// ============================================================================

const betLogSchema = new Schema<IBetLog>(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    matchup: {
      sport: {
        type: String,
        required: true,
        enum: ['football', 'basketball']
      },
      teamA: {
        name: { type: String, required: true },
        abbreviation: { type: String },
        stats: { type: Map, of: Number }
      },
      teamB: {
        name: { type: String, required: true },
        abbreviation: { type: String },
        stats: { type: Map, of: Number }
      },
      venue: {
        type: String,
        required: true,
        enum: ['home', 'away', 'neutral']
      }
    },
    estimation: {
      pointSpread: { type: Number, required: true },
      calculatedProbability: { type: Number, required: true },
      expectedMargin: { type: Number },
      impliedProbability: { type: Number },
      edge: { type: Number }
    },
    kelly: {
      bankroll: { type: Number, required: true },
      americanOdds: { type: Number, required: true },
      kellyFraction: {
        type: Number,
        required: true,
        enum: [0.25, 0.5, 1]
      },
      recommendedStake: { type: Number, required: true },
      stakePercentage: { type: Number, required: true }
    },
    actualWager: { type: Number },
    outcome: {
      result: {
        type: String,
        default: 'pending',
        enum: ['pending', 'win', 'loss', 'push', 'cancelled']
      },
      actualScore: {
        teamA: { type: Number },
        teamB: { type: Number }
      },
      payout: { type: Number },
      settledAt: { type: Date }
    },
    notes: { type: String },
    tags: [{ type: String }]
  },
  {
    timestamps: true
  }
);

// Indexes for efficient querying
betLogSchema.index({ userId: 1, createdAt: -1 });
betLogSchema.index({ userId: 1, 'outcome.result': 1 });
betLogSchema.index({ userId: 1, 'matchup.sport': 1 });

// ============================================================================
// INSTANCE METHODS
// ============================================================================

betLogSchema.methods.calculatePotentialPayout = function (): number {
  const wager = this.actualWager || this.kelly.recommendedStake;
  const odds = this.kelly.americanOdds;

  if (odds > 0) {
    return wager * (odds / 100);
  } else {
    return wager * (100 / Math.abs(odds));
  }
};

betLogSchema.methods.calculateProfit = function (): number {
  const wager = this.actualWager || this.kelly.recommendedStake;

  switch (this.outcome.result) {
    case 'win':
      return this.outcome.payout || this.calculatePotentialPayout();
    case 'loss':
      return -wager;
    case 'push':
      return 0;
    default:
      return 0;
  }
};

// ============================================================================
// STATIC METHODS
// ============================================================================

betLogSchema.statics.getUserStats = async function (userId: string): Promise<UserBetStats> {
  const pipeline = [
    { $match: { userId } },
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
              { $in: ['$outcome.result', ['win', 'loss', 'push']] },
              { $ifNull: ['$actualWager', '$kelly.recommendedStake'] },
              0
            ]
          }
        },
        totalPayout: {
          $sum: {
            $cond: [
              { $eq: ['$outcome.result', 'win'] },
              { $ifNull: ['$outcome.payout', 0] },
              0
            ]
          }
        },
        avgProbability: { $avg: '$estimation.calculatedProbability' },
        avgEdge: { $avg: '$estimation.edge' }
      }
    }
  ];

  const results = await this.aggregate(pipeline);

  if (results.length === 0) {
    return {
      totalBets: 0,
      pendingBets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      cancelled: 0,
      winRate: 0,
      totalWagered: 0,
      totalPayout: 0,
      netProfit: 0,
      roi: 0,
      avgProbability: 0,
      avgEdge: 0
    };
  }

  const stats = results[0];
  const settledBets = stats.wins + stats.losses;
  const winRate = settledBets > 0 ? (stats.wins / settledBets) * 100 : 0;
  const netProfit = stats.totalPayout - stats.totalWagered + (stats.wins * stats.totalWagered / settledBets || 0);
  const roi = stats.totalWagered > 0 ? (netProfit / stats.totalWagered) * 100 : 0;

  return {
    totalBets: stats.totalBets,
    pendingBets: stats.pendingBets,
    wins: stats.wins,
    losses: stats.losses,
    pushes: stats.pushes,
    cancelled: stats.cancelled,
    winRate: Math.round(winRate * 100) / 100,
    totalWagered: Math.round(stats.totalWagered * 100) / 100,
    totalPayout: Math.round(stats.totalPayout * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    roi: Math.round(roi * 100) / 100,
    avgProbability: Math.round((stats.avgProbability || 0) * 100) / 100,
    avgEdge: Math.round((stats.avgEdge || 0) * 100) / 100
  };
};

// ============================================================================
// MODEL
// ============================================================================

export const BetLog = mongoose.model<IBetLog, IBetLogModel>('BetLog', betLogSchema);
