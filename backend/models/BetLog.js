// models/BetLog.js - Stores logged bets with full calculation history
const mongoose = require('mongoose');

const betLogSchema = new mongoose.Schema({
  // User reference (Google OAuth user)
  userId: {
    type: String,
    required: true,
    index: true
  },

  // Matchup Information
  matchup: {
    sport: {
      type: String,
      enum: ['nfl', 'cfb', 'nba', 'wnba', 'cbb', 'mlb', 'nhl', 'football', 'basketball', 'hockey', 'baseball'],
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
    // What kind of wager this is. 'total' = over/under on combined score
    // (e.g. NHL goals); for totals, pointSpread holds the total line and
    // totalSide says which side was bet. Older bets have no betType and are
    // treated as spreads, except hockey bets, which were always totals.
    betType: { type: String, enum: ['spread', 'total', 'moneyline'] },
    totalSide: { type: String, enum: ['over', 'under'] },
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
    settledAt: Date,
    // true when graded automatically from the ESPN final score
    autoGraded: { type: Boolean, default: false },
    gameId: String // ESPN event id the bet was matched to
  },

  // Metadata
  notes: {
    type: String,
    maxlength: 500
  },
  tags: [{
    type: String,
    maxlength: 120 // auto-pick game tags (game-<date>-<sport>-<away>-at-<home>) run ~70 chars
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

// Static method to get user's betting stats.
// Profit is computed bet-by-bet from settled results only (same formula as the
// public Founder's Track Record), so the Bets tab and the Lab panel always agree:
//   win  -> payout - stake, loss -> -stake, push -> 0; pending/cancelled ignored.
betLogSchema.statics.getUserStats = async function(userId) {
  const bets = await this.find({ userId })
    .select('actualWager outcome.result outcome.payout estimation.calculatedProbability estimation.edge')
    .lean();
  return computeStats(bets);
};

function computeStats(bets) {
  const counted = bets.filter((b) => b.outcome?.result !== 'cancelled');
  const count = (r) => counted.filter((b) => b.outcome?.result === r).length;
  const wins = count('win');
  const losses = count('loss');
  const pushes = count('push');
  const pendingBets = count('pending');
  const settled = counted.filter((b) => ['win', 'loss', 'push'].includes(b.outcome?.result));

  const settledWagered = settled.reduce((s, b) => s + (b.actualWager || 0), 0);
  const netProfit = settled.reduce((s, b) => {
    if (b.outcome.result === 'win') return s + (b.outcome.payout || 0) - (b.actualWager || 0);
    if (b.outcome.result === 'loss') return s - (b.actualWager || 0);
    return s;
  }, 0);
  const totalPayout = settled
    .filter((b) => b.outcome.result === 'win')
    .reduce((s, b) => s + (b.outcome.payout || 0), 0);
  const avg = (key) => {
    const vals = counted.map((b) => b.estimation?.[key]).filter((v) => typeof v === 'number');
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };
  const decided = wins + losses;
  const round2 = (n) => Math.round(n * 100) / 100;

  return {
    totalBets: counted.length,
    pendingBets,
    wins,
    losses,
    pushes,
    winRate: (decided ? (wins / decided) * 100 : 0).toFixed(1),
    totalWagered: round2(settledWagered),
    totalPayout: round2(totalPayout),
    netProfit: round2(netProfit),
    roi: (settledWagered ? (netProfit / settledWagered) * 100 : 0).toFixed(1),
    avgProbability: avg('calculatedProbability').toFixed(1),
    avgEdge: avg('edge').toFixed(1)
  };
}

// Index for efficient queries
betLogSchema.index({ userId: 1, createdAt: -1 });
betLogSchema.index({ userId: 1, 'outcome.result': 1 });
betLogSchema.index({ userId: 1, 'matchup.sport': 1 });

module.exports = mongoose.model('BetLog', betLogSchema);
