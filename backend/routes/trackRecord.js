// routes/trackRecord.js - Public, read-only summary of the admin's logged bets.
//
// Powers the "Founder's Track Record" panel on the Matchup Lab page. It only
// ever exposes aggregates (record, ROI, units, recent form) — never dollar
// amounts, bankroll, notes, or anything about other users.

const express = require('express');
const BetLog = require('../models/BetLog');
const { User } = require('../config/database');
const { ADMIN_EMAILS } = require('../config/admin');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const CACHE_MS = 5 * 60 * 1000;
let cached = null; // { at, body }

const SPORT_LABELS = {
  football: 'NFL', nfl: 'NFL', basketball: 'NBA', nba: 'NBA', hockey: 'NHL', nhl: 'NHL',
  baseball: 'MLB', mlb: 'MLB', cfb: 'CFB', ncaaf: 'CFB', cbb: 'CBB', ncaab: 'CBB', wnba: 'WNBA',
};
const sportLabel = (s) => SPORT_LABELS[(s || '').toLowerCase()] || (s || 'Other').toUpperCase();

/** Profit on one settled bet, in dollars (payout includes the returned stake). */
function betProfit(bet) {
  const r = bet.outcome?.result;
  if (r === 'win') return (bet.outcome?.payout || 0) - (bet.actualWager || 0);
  if (r === 'loss') return -(bet.actualWager || 0);
  return 0;
}

function pickLabel(bet) {
  const e = bet.estimation || {};
  const isTotal = e.betType === 'total' || (!e.betType && ['hockey', 'nhl'].includes(bet.matchup?.sport));
  if (isTotal) {
    const side = e.totalSide ? e.totalSide[0].toUpperCase() + e.totalSide.slice(1) : 'Total';
    return `${side} ${e.pointSpread ?? ''}`.trim();
  }
  if (e.betType === 'moneyline') return `${bet.matchup?.teamA?.name} ML`;
  const sp = e.pointSpread;
  const spText = sp === undefined || sp === null ? '' : sp === 0 ? ' PK' : ` ${sp > 0 ? '+' : ''}${sp}`;
  return `${bet.matchup?.teamA?.name}${spText}`;
}

/** Pure summary so it can be unit-tested without a database. */
function summarize(bets) {
  const settled = bets
    .filter((b) => ['win', 'loss', 'push'].includes(b.outcome?.result))
    .sort((a, b) => new Date(a.outcome?.settledAt || a.createdAt) - new Date(b.outcome?.settledAt || b.createdAt));

  const wins = settled.filter((b) => b.outcome.result === 'win').length;
  const losses = settled.filter((b) => b.outcome.result === 'loss').length;
  const pushes = settled.length - wins - losses;
  const wagered = settled.reduce((s, b) => s + (b.actualWager || 0), 0);
  const profit = settled.reduce((s, b) => s + betProfit(b), 0);
  // A "unit" is the average stake, so the record reads the same at any bankroll.
  const unit = settled.length ? wagered / settled.length : 0;
  const round1 = (n) => Math.round(n * 10) / 10;

  // Cumulative units after each bet, for the trend line.
  let running = 0;
  const unitsTrend = settled.map((b) => {
    running += unit ? betProfit(b) / unit : 0;
    return round1(running);
  });

  // Current streak (pushes don't break or extend it).
  let streak = { type: null, count: 0 };
  for (let i = settled.length - 1; i >= 0; i--) {
    const r = settled[i].outcome.result;
    if (r === 'push') continue;
    if (!streak.type) streak = { type: r, count: 1 };
    else if (streak.type === r) streak.count++;
    else break;
  }

  const bySportMap = new Map();
  for (const b of settled) {
    const key = sportLabel(b.matchup?.sport);
    const row = bySportMap.get(key) || { sport: key, wins: 0, losses: 0, pushes: 0, profit: 0, wagered: 0 };
    row[b.outcome.result === 'win' ? 'wins' : b.outcome.result === 'loss' ? 'losses' : 'pushes']++;
    row.profit += betProfit(b);
    row.wagered += b.actualWager || 0;
    bySportMap.set(key, row);
  }
  const bySport = [...bySportMap.values()]
    .map((r) => ({
      sport: r.sport, wins: r.wins, losses: r.losses, pushes: r.pushes,
      roi: r.wagered ? round1((r.profit / r.wagered) * 100) : 0,
    }))
    .sort((a, b) => b.wins + b.losses + b.pushes - (a.wins + a.losses + a.pushes));

  const recent = settled.slice(-10).reverse().map((b) => ({
    sport: sportLabel(b.matchup?.sport),
    matchup: `${b.matchup?.teamA?.name || ''} vs ${b.matchup?.teamB?.name || ''}`,
    pick: pickLabel(b),
    result: b.outcome.result,
    date: b.outcome?.settledAt || b.createdAt,
  }));

  return {
    settled: settled.length,
    pending: bets.filter((b) => b.outcome?.result === 'pending').length,
    wins, losses, pushes,
    winRate: wins + losses ? round1((wins / (wins + losses)) * 100) : 0,
    roi: wagered ? round1((profit / wagered) * 100) : 0,
    units: unit ? round1(profit / unit) : 0,
    streak,
    unitsTrend,
    bySport,
    recent,
    since: settled.length ? settled[0].outcome?.settledAt || settled[0].createdAt : null,
  };
}

// GET /api/track-record — public.
router.get('/', asyncHandler(async (_req, res) => {
  if (cached && Date.now() - cached.at < CACHE_MS) return res.json(cached.body);

  const admins = await User.find({ email: { $in: ADMIN_EMAILS } }).select('identifier _id').lean();
  const ids = admins.flatMap((u) => [u.identifier, String(u._id)]).filter(Boolean);
  const bets = ids.length
    ? await BetLog.find({ userId: { $in: ids }, 'outcome.result': { $ne: 'cancelled' } })
        .select('matchup.sport matchup.teamA.name matchup.teamB.name estimation.betType estimation.totalSide estimation.pointSpread actualWager outcome.result outcome.payout outcome.settledAt createdAt')
        .lean()
    : [];

  const body = { success: true, updatedAt: new Date().toISOString(), ...summarize(bets) };
  cached = { at: Date.now(), body };
  res.json(body);
}));

module.exports = router;
module.exports.summarize = summarize;
