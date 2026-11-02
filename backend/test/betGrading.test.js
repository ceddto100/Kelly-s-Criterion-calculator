// backend/test/betGrading.test.js
// Plain-node tests for live-score matching and automatic bet grading.
// Run with: node test/betGrading.test.js
const assert = require('assert');
const { teamMatches, gradeBet, findGameForBet, checkPendingBets, espnDate } = require('../utils/betGrading');

let passed = 0;
const pending = [];
function test(name, fn) {
  const run = async () => {
    try { await fn(); passed += 1; } catch (err) {
      console.error(`FAIL: ${name}`); console.error(err.message); process.exitCode = 1;
    }
  };
  pending.push(run());
}

const bet = (over = {}) => ({
  _id: 'b1',
  createdAt: '2026-11-01T23:30:00Z',
  matchup: { sport: 'nhl', teamA: { name: 'New York Rangers', abbreviation: 'NYR' }, teamB: { name: 'Edmonton Oilers', abbreviation: 'EDM' } },
  estimation: { betType: 'total', totalSide: 'under', pointSpread: 6.5 },
  outcome: { result: 'pending' },
  ...over,
});
const game = (over = {}) => ({
  gameId: '401', sport: 'NHL', homeTeam: 'New York Rangers', homeAbbr: 'NYR', homeShort: 'Rangers',
  awayTeam: 'Edmonton Oilers', awayAbbr: 'EDM', awayShort: 'Oilers',
  startTime: '2026-11-01T23:00:00Z', status: 'final', statusDetail: 'Final', homeScore: 1, awayScore: 3, ...over,
});

test('team matching: full name, abbr, nickname', () => {
  const g = ['New York Rangers', 'NYR', 'Rangers'];
  assert(teamMatches({ name: 'New York Rangers' }, ...g));
  assert(teamMatches({ name: 'nyr' }, ...g));
  assert(teamMatches({ name: 'Rangers' }, ...g));
  assert(teamMatches({ name: 'NY Rangers', abbreviation: 'NYR' }, ...g));
  assert(!teamMatches({ name: 'New York' }, ...g), 'bare city is ambiguous');
  assert(!teamMatches({ name: 'Islanders' }, ...g));
});

test('totals: over/under/push', () => {
  assert.strictEqual(gradeBet(bet(), 3, 1), 'win'); // 4 < 6.5 under
  assert.strictEqual(gradeBet(bet(), 5, 3), 'loss');
  assert.strictEqual(gradeBet(bet({ estimation: { betType: 'total', totalSide: 'over', pointSpread: 6.5 } }), 5, 3), 'win');
  assert.strictEqual(gradeBet(bet({ estimation: { betType: 'total', totalSide: 'over', pointSpread: 6 } }), 4, 2), 'push');
  assert.strictEqual(gradeBet(bet({ estimation: { betType: 'total', pointSpread: 6.5 } }), 4, 2), null, 'no side');
});

test('legacy hockey bet without betType is a total', () => {
  assert.strictEqual(gradeBet(bet({ estimation: { totalSide: 'over', pointSpread: 5.5 } }), 4, 2), 'win');
});

test('spread and moneyline', () => {
  const sp = (line) => bet({ matchup: { sport: 'nfl', teamA: { name: 'Chiefs' }, teamB: { name: 'Bills' } }, estimation: { betType: 'spread', pointSpread: line } });
  assert.strictEqual(gradeBet(sp(-3.5), 27, 20), 'win');
  assert.strictEqual(gradeBet(sp(-3.5), 23, 20), 'loss');
  assert.strictEqual(gradeBet(sp(-3), 23, 20), 'push');
  assert.strictEqual(gradeBet(sp(+7), 17, 20), 'win');
  const ml = bet({ estimation: { betType: 'moneyline', pointSpread: 0 } });
  assert.strictEqual(gradeBet(ml, 2, 1), 'win');
  assert.strictEqual(gradeBet(ml, 1, 2), 'loss');
});

test('orientation: teamA can be home or away', () => {
  const m = findGameForBet(bet(), [game()]);
  assert.strictEqual(m.scoreA, 1); assert.strictEqual(m.scoreB, 3);
  const swapped = bet({ matchup: { sport: 'nhl', teamA: { name: 'EDM' }, teamB: { name: 'NYR' } } });
  const m2 = findGameForBet(swapped, [game()]);
  assert.strictEqual(m2.scoreA, 3); assert.strictEqual(m2.scoreB, 1);
});

test('skips a game that started long before the bet (series)', () => {
  const yesterday = game({ gameId: '400', startTime: '2026-10-31T23:00:00Z' });
  const today = game({ gameId: '401' });
  assert.strictEqual(findGameForBet(bet(), [yesterday, today]).game.gameId, '401');
});

test('espnDate uses US/Eastern', () => {
  assert.strictEqual(espnDate(Date.parse('2026-11-02T03:00:00Z')), '20261101');
});

test('checkPendingBets: live game reported, final game graded', async () => {
  const live = bet({ _id: 'live', matchup: { sport: 'nhl', teamA: { name: 'Anaheim Ducks' }, teamB: { name: 'Ottawa Senators' } } });
  const done = bet({ _id: 'done' });
  const board = [
    game(),
    game({ gameId: '402', homeTeam: 'Anaheim Ducks', homeAbbr: 'ANA', homeShort: 'Ducks', awayTeam: 'Ottawa Senators', awayAbbr: 'OTT', awayShort: 'Senators', status: 'in_progress', statusDetail: '16:04 - 1st', homeScore: 0, awayScore: 0, startTime: '2026-11-02T03:00:00Z' }),
  ];
  const fetch = async (league) => (league === 'NHL' ? board : []);
  const { live: info, toGrade } = await checkPendingBets([live, done], { fetch, now: Date.parse('2026-11-02T03:20:00Z') });
  assert.strictEqual(info.live.status, 'in_progress');
  assert.strictEqual(info.live.currentGrade, 'win');
  assert.strictEqual(toGrade.length, 1);
  assert.strictEqual(toGrade[0].bet._id, 'done');
  assert.strictEqual(toGrade[0].result, 'win');
});

Promise.all(pending).then(() => console.log(`betGrading: ${passed} passed`));
