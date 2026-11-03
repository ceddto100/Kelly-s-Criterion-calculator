// Unit tests for the public track-record summary (no database needed).
const assert = require('assert');
const { summarize } = require('../routes/trackRecord');

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

console.log(`trackRecord: ${passed} passed`);
