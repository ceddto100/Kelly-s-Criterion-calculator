// routes/trackRecord.js - Public, read-only summary of the admin's logged bets.
//
// Powers the "Founder's Track Record" panel on the Matchup Lab page. It exposes
// the admin's record, ROI, units, dollar profit/stakes and recent form — never
// bankroll, notes, or anything about other users.

const express = require('express');
const BetLog = require('../models/BetLog');
const { User } = require('../config/database');
const { ADMIN_EMAILS } = require('../config/admin');
const { asyncHandler } = require('../middleware/errorHandler');
const { checkPendingBets, espnDate } = require('../utils/betGrading');

const router = express.Router();

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
  const round2 = (n) => Math.round(n * 100) / 100;

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
      profit: round2(r.profit),
    }))
    .sort((a, b) => b.wins + b.losses + b.pushes - (a.wins + a.losses + a.pushes));

  const recent = settled.slice(-10).reverse().map((b) => ({
    sport: sportLabel(b.matchup?.sport),
    matchup: `${b.matchup?.teamA?.name || ''} vs ${b.matchup?.teamB?.name || ''}`,
    pick: pickLabel(b),
    stake: round2(b.actualWager || 0),
    profit: round2(betProfit(b)),
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
    profit: round2(profit),
    wagered: round2(wagered),
    avgStake: round2(unit),
    profitTrend: settled.reduce((acc, b) => { acc.push(round2((acc[acc.length - 1] || 0) + betProfit(b))); return acc; }, []),
    streak,
    unitsTrend,
    bySport,
    recent,
    since: settled.length ? settled[0].outcome?.settledAt || settled[0].createdAt : null,
  };
}

// ---- Today's top auto-logged picks -----------------------------------------

const LEAGUE_TAGS = ['nba', 'nfl', 'nhl', 'mlb', 'wnba', 'cfb', 'cbb'];
const TOP_PICKS = 5;
const TOP_PICKS_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** League of an auto-logged bet: its sport tag ("nba") beats the generic sport ("basketball"). */
function pickLeague(bet) {
  const tag = (bet.tags || []).find((t) => LEAGUE_TAGS.includes(t));
  return tag ? tag.toUpperCase() : sportLabel(bet.matchup?.sport);
}

/**
 * The latest batch of auto-logged bets (all logged on the same US/Eastern
 * day), highest edge first, limited to `limit`. Pure so it can be unit-tested.
 */
function selectTopPicks(bets, limit = TOP_PICKS) {
  const auto = bets.filter((b) => (b.tags || []).includes('auto') && b.outcome?.result !== 'cancelled');
  if (!auto.length) return { day: null, picks: [] };
  const day = auto.reduce((max, b) => {
    const d = espnDate(new Date(b.createdAt).getTime());
    return d > max ? d : max;
  }, '');
  const picks = auto
    .filter((b) => espnDate(new Date(b.createdAt).getTime()) === day)
    .sort((a, b) => (b.estimation?.edge ?? -Infinity) - (a.estimation?.edge ?? -Infinity))
    .slice(0, limit);
  return { day, picks };
}

/**
 * Shape one top pick for the Lab card: who's playing (away @ home), the score,
 * the game clock and whether the bet won, lost or is winning right now.
 * `live` is this bet's entry from checkPendingBets (pending bets only).
 */
function describePick(bet, live) {
  const A = bet.matchup?.teamA || {};
  const B = bet.matchup?.teamB || {};
  const settled = ['win', 'loss', 'push'].includes(bet.outcome?.result);
  const teamAIsHome = live?.matched ? live.teamAIsHome : bet.matchup?.venue !== 'away';
  let scoreA = null;
  let scoreB = null;
  let status = 'unknown';
  let statusDetail = '';
  let result = null;
  let currentGrade = null;
  if (settled) {
    status = 'final';
    statusDetail = 'Final';
    result = bet.outcome.result;
    scoreA = bet.outcome.actualScore?.teamA ?? null;
    scoreB = bet.outcome.actualScore?.teamB ?? null;
  } else if (live?.matched) {
    status = live.status;
    statusDetail = live.statusDetail || '';
    scoreA = live.scoreA;
    scoreB = live.scoreB;
    currentGrade = live.currentGrade || null;
    // The game is over but the bet hasn't been saved as graded yet.
    if (status === 'final') result = currentGrade;
  }
  const team = (t, score) => ({ name: t.name || '', abbr: t.abbreviation || '', score });
  const home = teamAIsHome ? team(A, scoreA) : team(B, scoreB);
  const away = teamAIsHome ? team(B, scoreB) : team(A, scoreA);
  const stake = bet.actualWager || 0;
  const round2 = (n) => Math.round(n * 100) / 100;
  return {
    id: String(bet._id),
    sport: pickLeague(bet),
    pick: pickLabel(bet),
    market: bet.estimation?.betType || 'spread',
    edge: typeof bet.estimation?.edge === 'number' ? Math.round(bet.estimation.edge * 10) / 10 : null,
    probability: typeof bet.estimation?.calculatedProbability === 'number'
      ? Math.round(bet.estimation.calculatedProbability * 10) / 10 : null,
    stake: round2(stake),
    home,
    away,
    status,
    statusDetail,
    startTime: live?.startTime || null,
    result,
    currentGrade,
    profit: settled ? round2(betProfit(bet)) : null,
  };
}

// GET /api/track-record/top-picks — public.
// The five highest-edge bets from the admin's latest auto-log run, each with
// its live or final score, game clock and result (from ESPN's scoreboard).
// Read-only: finals are graded for display; the Bets tab saves the grade.
router.get('/top-picks', asyncHandler(async (_req, res) => {
  const ids = await adminIds();
  const bets = ids.length
    ? await BetLog.find({
        userId: { $in: ids },
        tags: 'auto',
        createdAt: { $gte: new Date(Date.now() - TOP_PICKS_LOOKBACK_MS) },
        'outcome.result': { $ne: 'cancelled' },
      })
        .select('matchup estimation actualWager outcome tags createdAt')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean()
    : [];

  const { day, picks } = selectTopPicks(bets);
  const { live } = await checkPendingBets(picks.filter((b) => b.outcome?.result === 'pending'));

  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    updatedAt: new Date().toISOString(),
    day: day ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}` : null,
    picks: picks.map((b) => describePick(b, live[String(b._id)])),
  });
}));

/** Identifiers the admin's bets may be logged under. */
async function adminIds() {
  const admins = await User.find({ email: { $in: ADMIN_EMAILS } }).select('identifier _id').lean();
  return admins.flatMap((u) => [u.identifier, String(u._id)]).filter(Boolean);
}

// GET /api/track-record — public.
// Always computed live from the admin's bet log (no cache), so it matches the
// admin's Bets tab the moment a bet is logged or graded.
router.get('/', asyncHandler(async (_req, res) => {

  const ids = await adminIds();
  const bets = ids.length
    ? await BetLog.find({ userId: { $in: ids }, 'outcome.result': { $ne: 'cancelled' } })
        .select('matchup.sport matchup.teamA.name matchup.teamB.name estimation.betType estimation.totalSide estimation.pointSpread actualWager outcome.result outcome.payout outcome.settledAt createdAt')
        .lean()
    : [];

  res.set('Cache-Control', 'no-store');
  res.json({ success: true, updatedAt: new Date().toISOString(), ...summarize(bets) });
}));

module.exports = router;
module.exports.summarize = summarize;
module.exports.selectTopPicks = selectTopPicks;
module.exports.describePick = describePick;
