// routes/bets.js - API routes for bet logging
const express = require('express');
const router = express.Router();
const BetLog = require('../models/BetLog');
const { ensureAuthenticated } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// All routes require authentication
router.use(ensureAuthenticated);

// Helper function to get user ID from various OAuth providers
const getUserId = (req) => {
  return req.user._id || req.user.id || req.user.googleId;
};

// POST /api/bets - Log a new bet
router.post('/', asyncHandler(async (req, res) => {
  const {
    matchup,
    estimation,
    kelly,
    actualWager,
    notes,
    tags
  } = req.body;

  // Validate required fields
  if (!matchup || !estimation || !kelly || actualWager === undefined) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['matchup', 'estimation', 'kelly', 'actualWager']
    });
  }

  // Create the bet log
  const betLog = new BetLog({
    userId: getUserId(req),
    matchup: {
      sport: matchup.sport,
      teamA: {
        name: matchup.teamA.name,
        abbreviation: matchup.teamA.abbreviation,
        stats: matchup.teamA.stats
      },
      teamB: {
        name: matchup.teamB.name,
        abbreviation: matchup.teamB.abbreviation,
        stats: matchup.teamB.stats
      },
      venue: matchup.venue || 'neutral'
    },
    estimation: {
      pointSpread: estimation.pointSpread,
      calculatedProbability: estimation.calculatedProbability,
      expectedMargin: estimation.expectedMargin,
      impliedProbability: estimation.impliedProbability,
      edge: estimation.edge
    },
    kelly: {
      bankroll: kelly.bankroll,
      americanOdds: kelly.americanOdds,
      kellyFraction: kelly.kellyFraction || 1,
      recommendedStake: kelly.recommendedStake,
      stakePercentage: kelly.stakePercentage
    },
    actualWager,
    notes: notes || '',
    tags: tags || []
  });

  await betLog.save();

  res.status(201).json({
    success: true,
    message: 'Bet logged successfully',
    bet: betLog
  });
}));

// GET /api/bets - Get user's bet history
router.get('/', asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    sport,
    result,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter
  const filter = { userId: getUserId(req) };

  if (sport && ['football', 'basketball'].includes(sport)) {
    filter['matchup.sport'] = sport;
  }

  if (result && ['pending', 'win', 'loss', 'push', 'cancelled'].includes(result)) {
    filter['outcome.result'] = result;
  }

  // Build sort
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [bets, total] = await Promise.all([
    BetLog.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .lean(),
    BetLog.countDocuments(filter)
  ]);

  res.json({
    bets,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    }
  });
}));

// GET /api/bets/stats - Get user's betting statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await BetLog.getUserStats(getUserId(req));
  res.json(stats);
}));

// GET /api/bets/pending - Get only pending bets
router.get('/pending', asyncHandler(async (req, res) => {
  const bets = await BetLog.find({
    userId: getUserId(req),
    'outcome.result': 'pending'
  })
    .sort({ createdAt: -1 })
    .lean();

  res.json({ bets });
}));

// GET /api/bets/:id - Get a specific bet
router.get('/:id', asyncHandler(async (req, res) => {
  const bet = await BetLog.findOne({
    _id: req.params.id,
    userId: getUserId(req)
  }).lean();

  if (!bet) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  res.json(bet);
}));

// PATCH /api/bets/:id/outcome - Update bet outcome (win/loss/push)
router.patch('/:id/outcome', asyncHandler(async (req, res) => {
  const { result, actualScore, payout } = req.body;

  if (!result || !['win', 'loss', 'push', 'cancelled'].includes(result)) {
    return res.status(400).json({
      error: 'Invalid result',
      valid: ['win', 'loss', 'push', 'cancelled']
    });
  }

  const bet = await BetLog.findOne({
    _id: req.params.id,
    userId: getUserId(req)
  });

  if (!bet) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  // Update outcome
  bet.outcome.result = result;
  bet.outcome.settledAt = new Date();

  if (actualScore) {
    bet.outcome.actualScore = {
      teamA: actualScore.teamA,
      teamB: actualScore.teamB
    };
  }

  // Calculate payout based on result
  if (result === 'win') {
    // If payout provided, use it; otherwise calculate from odds
    if (payout !== undefined) {
      bet.outcome.payout = payout;
    } else {
      bet.outcome.payout = bet.calculatePotentialPayout();
    }
  } else if (result === 'push' || result === 'cancelled') {
    bet.outcome.payout = bet.actualWager; // Return original wager
  } else {
    bet.outcome.payout = 0;
  }

  await bet.save();

  res.json({
    success: true,
    message: `Bet marked as ${result}`,
    bet
  });
}));

// PATCH /api/bets/:id - Update bet details (notes, tags, actualWager)
router.patch('/:id', asyncHandler(async (req, res) => {
  const { notes, tags, actualWager } = req.body;

  const bet = await BetLog.findOne({
    _id: req.params.id,
    userId: getUserId(req)
  });

  if (!bet) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  // Only allow updates if bet is still pending
  if (bet.outcome.result !== 'pending') {
    return res.status(400).json({
      error: 'Cannot modify settled bets'
    });
  }

  if (notes !== undefined) bet.notes = notes;
  if (tags !== undefined) bet.tags = tags;
  if (actualWager !== undefined) bet.actualWager = actualWager;

  await bet.save();

  res.json({
    success: true,
    message: 'Bet updated',
    bet
  });
}));

// DELETE /api/bets/:id - Delete a bet
router.delete('/:id', asyncHandler(async (req, res) => {
  const bet = await BetLog.findOneAndDelete({
    _id: req.params.id,
    userId: getUserId(req)
  });

  if (!bet) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  res.json({
    success: true,
    message: 'Bet deleted'
  });
}));

// GET /api/bets/export/csv - Export bets as CSV
router.get('/export/csv', asyncHandler(async (req, res) => {
  const bets = await BetLog.find({ userId: getUserId(req) })
    .sort({ createdAt: -1 })
    .lean();

  // Build CSV
  const headers = [
    'Date',
    'Sport',
    'Team A',
    'Team B',
    'Spread',
    'Probability',
    'Edge',
    'Odds',
    'Bankroll',
    'Recommended',
    'Actual Wager',
    'Result',
    'Payout',
    'Profit',
    'Notes'
  ];

  const rows = bets.map(bet => {
    const profit = bet.outcome.result === 'win'
      ? bet.outcome.payout - bet.actualWager
      : bet.outcome.result === 'loss'
        ? -bet.actualWager
        : 0;

    return [
      new Date(bet.createdAt).toLocaleDateString(),
      bet.matchup.sport,
      bet.matchup.teamA.name,
      bet.matchup.teamB.name,
      bet.estimation.pointSpread,
      bet.estimation.calculatedProbability?.toFixed(1) + '%',
      (bet.estimation.edge > 0 ? '+' : '') + bet.estimation.edge?.toFixed(1) + '%',
      bet.kelly.americanOdds,
      bet.kelly.bankroll,
      bet.kelly.recommendedStake?.toFixed(2),
      bet.actualWager,
      bet.outcome.result,
      bet.outcome.payout || '',
      profit || '',
      bet.notes?.replace(/,/g, ';') || ''
    ];
  });

  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=bet-history.csv');
  res.send(csv);
}));

module.exports = router;
