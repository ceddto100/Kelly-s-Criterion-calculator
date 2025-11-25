// models/BetLog.js - Stores logged bets with full calculation history
const mongoose = require('mongoose');

const betLogSchema = new mongoose.Schema({
  // User reference (Google OAuth user)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Matchup Information
  matchup: {
    sport: {
      type: String,
      enum: ['football', 'basketball'],
      required: true
    },
    teamA: {
      name: { type: String, required: true },
      abbreviation: { type: String },
      // Store the stats used at time of bet
      stats: {
        pointsFor: Number,
        pointsAgainst: Number,
        // Football-specific
        offYards: Number,
        defYards: Number,
        turnoverDiff: Number,
        // Basketball-specific
        fgPct: Number,
        reboundMargin: Number,
        turnoverMargin: Number
      }
    },
    teamB: {
      name: { type: String, required: true },
      abbreviation: { type: String },
      stats: {
        pointsFor: Number,
        pointsAgainst: Number,
        offYards: Number,
        defYards: Number,
        turnoverDiff: Number,
        fgPct: Number,
        reboundMargin: Number,
        turnoverMargin: Number
      }
    },
    venue: {
      type: String,
      enum: ['home', 'away', 'neutral'],
      default: 'neutral'
    }
  },

  // Probability Estimation Data
  estimation: {
    pointSpread: { type: Number, required: true },
    calculatedProbability: { type: Number, required: true }, // The probability % calculated
    expectedMargin: { type: Number }, // Predicted point margin
    impliedProbability: { type: Number }, // Bookmaker's implied probability from odds
    edge: { type: Number } // User's edge (calculated - implied)
  },

  // Kelly Criterion Calculation
  kelly: {
    bankroll: { type: Number, required: true },
    americanOdds: { type: Number, required: true },
    kellyFraction: {
      type: Number,
      default: 1,
      enum: [0.25, 0.5, 1] // Quarter, Half, Full Kelly
    },
    recommendedStake: { type: Number, required: true },
    stakePercentage: { type: Number, required: true } // % of bankroll
  },

  // Actual Bet Placed
  actualWager: {
    type: Number,
    required: true
  },

  // Outcome Tracking
  outcome: {
    result: {
      type: String,
      enum: ['pending', 'win', 'loss', 'push', 'cancelled'],
      default: 'pending'
    },
    actualScore: {
      teamA: Number,
      teamB: Number
    },
    payout: Number, // Amount won (or 0 for loss, refund for push)
    settledAt: Date
  },

  // Metadata
  notes: {
    type: String,
    maxlength: 500
  },
  tags: [{
    type: String,
    maxlength: 50
  }],

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp on save
betLogSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate potential payout based on odds and wager
betLogSchema.methods.calculatePotentialPayout = function() {
  const odds = this.kelly.americanOdds;
  const wager = this.actualWager;

  if (odds > 0) {
    // Positive odds: profit = wager * (odds / 100)
    return wager + (wager * (odds / 100));
  } else {
    // Negative odds: profit = wager * (100 / |odds|)
    return wager + (wager * (100 / Math.abs(odds)));
  }
};

// Calculate actual profit/loss after outcome
betLogSchema.methods.calculateProfit = function() {
  if (this.outcome.result === 'pending') return null;
  if (this.outcome.result === 'cancelled' || this.outcome.result === 'push') return 0;
  if (this.outcome.result === 'loss') return -this.actualWager;
  if (this.outcome.result === 'win') {
    return this.outcome.payout - this.actualWager;
  }
  return null;
};

// Static method to get user's betting stats
betLogSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
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
        totalWagered: { $sum: '$actualWager' },
        totalPayout: {
          $sum: {
            $cond: [
              { $eq: ['$outcome.result', 'win'] },
              '$outcome.payout',
              0
            ]
          }
        },
        avgProbability: { $avg: '$estimation.calculatedProbability' },
        avgEdge: { $avg: '$estimation.edge' }
      }
    }
  ]);

  if (stats.length === 0) {
    return {
      totalBets: 0,
      pendingBets: 0,
      wins: 0,
      losses: 0,
      pushes: 0,
      winRate: 0,
      totalWagered: 0,
      totalPayout: 0,
      netProfit: 0,
      roi: 0,
      avgProbability: 0,
      avgEdge: 0
    };
  }

  const s = stats[0];
  const settledBets = s.wins + s.losses;
  const winRate = settledBets > 0 ? (s.wins / settledBets) * 100 : 0;
  const netProfit = s.totalPayout - (s.totalWagered - s.pendingBets * (s.totalWagered / s.totalBets));
  const settledWagered = s.totalWagered * (settledBets / s.totalBets);
  const roi = settledWagered > 0 ? (netProfit / settledWagered) * 100 : 0;

  return {
    totalBets: s.totalBets,
    pendingBets: s.pendingBets,
    wins: s.wins,
    losses: s.losses,
    pushes: s.pushes,
    winRate: winRate.toFixed(1),
    totalWagered: s.totalWagered,
    totalPayout: s.totalPayout,
    netProfit,
    roi: roi.toFixed(1),
    avgProbability: s.avgProbability?.toFixed(1) || 0,
    avgEdge: s.avgEdge?.toFixed(1) || 0
  };
};

// Index for efficient queries
betLogSchema.index({ userId: 1, createdAt: -1 });
betLogSchema.index({ userId: 1, 'outcome.result': 1 });
betLogSchema.index({ userId: 1, 'matchup.sport': 1 });

module.exports = mongoose.model('BetLog', betLogSchema);
