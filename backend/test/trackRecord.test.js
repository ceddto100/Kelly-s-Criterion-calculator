// Unit tests for the public track-record summary (no database needed).
const assert = require('assert');
const { summarize, selectTopPicks, describePick } = require('../routes/trackRecord');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
}

const bet = (result, wager, payout, day, extra = {}) => ({
  matchup: { sport: 'football', teamA: { name: 'Packers' }, teamB: { name: 'Bears' } },
  estimation: { betType: 'spread', pointSpread: -3.5 },
  actualWager: wager,
  outcome: { result, payout, settledAt: new Date(2026, 10, day) },
  createdAt: new Date(2026, 10, day),
  ...extra,
});

test('empty input', () => {
  const s = summarize([]);
  assert.strictEqual(s.settled, 0);
  assert.strictEqual(s.units, 0);
  assert.deepStrictEqual(s.recent, []);
});

test('record, ROI and units', () => {
  // win +100 (payout 200 on 100), loss -100, win +91 (payout 191), push
  const s = summarize([bet('win', 100, 200, 1), bet('loss', 100, 0, 2), bet('win', 100, 191, 3), bet('push', 100, 100, 4), bet('pending', 50, 0, 5)]);
  assert.strictEqual(s.wins, 2);
  assert.strictEqual(s.losses, 1);
  assert.strictEqual(s.pushes, 1);
  assert.strictEqual(s.pending, 1);
  assert.strictEqual(s.winRate, 66.7);
  assert.strictEqual(s.roi, 22.8); // 91 / 400
  assert.strictEqual(s.units, 0.9); // 91 / 100 avg stake
  assert.deepStrictEqual(s.unitsTrend, [1, 0, 0.9, 0.9]);
  assert.deepStrictEqual(s.streak, { type: 'win', count: 1 }); // push skipped
  assert.strictEqual(s.profit, 91);
  assert.strictEqual(s.wagered, 400);
  assert.strictEqual(s.avgStake, 100);
  assert.deepStrictEqual(s.profitTrend, [100, 0, 91, 91]);
});

test('recent is newest first with per-bet stake and profit', () => {
  const s = summarize([bet('win', 100, 200, 1), bet('loss', 100, 0, 2)]);
  assert.strictEqual(s.recent[0].result, 'loss');
  assert.strictEqual(s.recent[0].pick, 'Packers -3.5');
  assert.strictEqual(s.recent[0].stake, 100);
  assert.strictEqual(s.recent[0].profit, -100);
  assert.strictEqual(s.recent[1].profit, 100);
  assert.ok(!('notes' in s.recent[0]) && !('payout' in s.recent[0]));
});

test('by sport and totals label', () => {
  const s = summarize([
    bet('win', 100, 190, 1, { matchup: { sport: 'hockey', teamA: { name: 'Flames' }, teamB: { name: 'Sharks' } }, estimation: { betType: 'total', totalSide: 'under', pointSpread: 6.5 } }),
    bet('loss', 100, 0, 2),
  ]);
  assert.deepStrictEqual(s.bySport.map((r) => r.sport).sort(), ['NFL', 'NHL']);
  assert.strictEqual(s.recent[1].pick, 'Under 6.5');
});

// ---- top picks ----
// Times are noon UTC (morning US/Eastern) so the ET day is unambiguous.
const autoBet = (id, edge, day, extra = {}) => ({
  _id: id,
  tags: ['auto', 'all-picks', 'nba'],
  matchup: { sport: 'basketball', venue: 'home', teamA: { name: 'Boston Celtics', abbreviation: 'BOS' }, teamB: { name: 'Miami Heat', abbreviation: 'MIA' } },
  estimation: { betType: 'spread', pointSpread: -3.5, edge, calculatedProbability: 52.4 + edge },
  actualWager: 50,
  outcome: { result: 'pending' },
  createdAt: new Date(Date.UTC(2026, 10, day, 12)),
  ...extra,
});

test('top picks: latest auto day, highest edge first, max 5', () => {
  const bets = [
    autoBet('old', 30, 4),
    ...[1, 9, 4, 7, 2, 6].map((e, i) => autoBet('b' + i, e, 5)),
    autoBet('manual', 50, 5, { tags: ['nba'] }),
  ];
  const { day, picks } = selectTopPicks(bets);
  assert.strictEqual(day, '20261105');
  assert.deepStrictEqual(picks.map((p) => p.estimation.edge), [9, 7, 6, 4, 2]);
});

test('top picks: none', () => {
  assert.deepStrictEqual(selectTopPicks([]), { day: null, picks: [] });
});

test('describe pick: live game keeps away @ home and clock', () => {
  const b = autoBet('x', 5, 5);
  const p = describePick(b, { matched: true, status: 'in_progress', statusDetail: 'Q3 5:42', scoreA: 70, scoreB: 61, teamAIsHome: true, currentGrade: 'win', startTime: '2026-11-05T23:30Z' });
  assert.strictEqual(p.sport, 'NBA');
  assert.strictEqual(p.pick, 'Boston Celtics -3.5');
  assert.deepStrictEqual([p.away.name, p.away.score, p.home.name, p.home.score], ['Miami Heat', 61, 'Boston Celtics', 70]);
  assert.strictEqual(p.statusDetail, 'Q3 5:42');
  assert.strictEqual(p.currentGrade, 'win');
  assert.strictEqual(p.result, null);
});

test('describe pick: settled bet uses saved score and result', () => {
  const b = autoBet('y', 5, 5, {
    matchup: { sport: 'basketball', venue: 'away', teamA: { name: 'Miami Heat' }, teamB: { name: 'Boston Celtics' } },
    outcome: { result: 'loss', actualScore: { teamA: 98, teamB: 110 }, payout: 0 },
  });
  const p = describePick(b, undefined);
  assert.strictEqual(p.status, 'final');
  assert.strictEqual(p.result, 'loss');
  assert.strictEqual(p.profit, -50);
  assert.deepStrictEqual([p.away.score, p.home.score], [98, 110]);
});

test('describe pick: final on scoreboard but not yet saved', () => {
  const p = describePick(autoBet('z', 5, 5), { matched: true, status: 'final', statusDetail: 'Final', scoreA: 100, scoreB: 90, teamAIsHome: true, currentGrade: 'win' });
  assert.strictEqual(p.result, 'win');
});

console.log(`trackRecord: ${passed} passed`);
