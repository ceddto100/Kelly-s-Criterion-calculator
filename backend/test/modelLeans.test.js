// Unit tests for the public "Model leans" panel helpers (no database needed).
const assert = require('assert');
const { leanLabel, gradeLean, describeLean, leanRecord, latestDay } = require('../utils/modelLeans');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; }
}

const spread = (side, line, extra = {}) => ({
  _id: 'a1', league: 'NBA', homeTeam: 'Boston Celtics', awayTeam: 'Miami Heat', gameDate: new Date('2026-11-25T00:00:00Z'),
  track: { market: 'spread', line, side, modelProbability: 57.3, marketProbability: 50 }, trackResult: 'pending', ...extra,
});

test('labels a home spread lean with the home line', () => {
  assert.strictEqual(leanLabel(spread('home', -4.5)), 'Boston Celtics -4.5');
});
test('labels an away spread lean with the flipped line', () => {
  assert.strictEqual(leanLabel(spread('away', -4.5)), 'Miami Heat +4.5');
  assert.strictEqual(leanLabel(spread('away', 0)), 'Miami Heat PK');
});
test('labels totals', () => {
  assert.strictEqual(leanLabel({ track: { market: 'total', line: 6.5, side: 'under' } }), 'Under 6.5');
});

test('grades spreads and totals, with pushes', () => {
  assert.strictEqual(gradeLean({ market: 'spread', line: -4.5, side: 'home' }, 110, 105), 'win');
  assert.strictEqual(gradeLean({ market: 'spread', line: -4.5, side: 'away' }, 110, 105), 'loss');
  assert.strictEqual(gradeLean({ market: 'spread', line: -5, side: 'home' }, 110, 105), 'push');
  assert.strictEqual(gradeLean({ market: 'total', line: 6.5, side: 'over' }, 4, 3), 'win');
  assert.strictEqual(gradeLean({ market: 'total', line: 6, side: 'under' }, 3, 3), 'push');
});

test('a graded lean uses the stored final score', () => {
  const l = describeLean(spread('home', -4.5, { trackResult: 'loss', finalHomeScore: 101, finalAwayScore: 99 }));
  assert.strictEqual(l.result, 'loss');
  assert.strictEqual(l.status, 'final');
  assert.strictEqual(l.home.score, 101);
  assert.strictEqual(l.gap, 7.3);
});

test('a live lean shows how it stands now, without a result', () => {
  const game = { status: 'in_progress', statusDetail: 'Q3 4:10', homeScore: 80, awayScore: 70, homeTeam: 'Boston Celtics', awayTeam: 'Miami Heat' };
  const l = describeLean(spread('home', -4.5), game);
  assert.strictEqual(l.result, null);
  assert.strictEqual(l.currentGrade, 'win');
  assert.strictEqual(l.statusDetail, 'Q3 4:10');
});

test('a final game shows its result before the daily grading run', () => {
  const game = { status: 'final', statusDetail: 'Final', homeScore: 100, awayScore: 98 };
  assert.strictEqual(describeLean(spread('home', -4.5), game).result, 'loss');
});

test('a scheduled lean has no score', () => {
  const l = describeLean(spread('home', -4.5), { status: 'scheduled', startTime: '2026-11-26T00:30Z' });
  assert.strictEqual(l.home.score, null);
  assert.strictEqual(l.status, 'scheduled');
});

test('record counts graded leans per sport', () => {
  const r = leanRecord([
    { league: 'NBA', trackResult: 'win', gameDate: '2026-11-24' },
    { league: 'NBA', trackResult: 'loss', gameDate: '2026-11-25' },
    { league: 'NHL', trackResult: 'win', gameDate: '2026-11-24' },
    { league: 'NHL', trackResult: 'push', gameDate: '2026-11-24' },
    { league: 'NFL', trackResult: 'pending', gameDate: '2026-11-25' },
  ]);
  assert.deepStrictEqual([r.wins, r.losses, r.pushes], [2, 1, 1]);
  assert.strictEqual(r.winRate, 66.7);
  assert.strictEqual(r.since, '2026-11-24');
  assert.deepStrictEqual(r.bySport.map((s) => s.sport), ['NBA', 'NHL']);
});

test('empty record', () => {
  const r = leanRecord([]);
  assert.strictEqual(r.winRate, null);
  assert.deepStrictEqual(r.bySport, []);
});

test('latest slate day', () => {
  assert.strictEqual(latestDay([{ gameDate: '2026-11-24T00:00:00Z' }, { gameDate: '2026-11-25T00:00:00Z' }]), '2026-11-25');
  assert.strictEqual(latestDay([]), null);
});

test('re-derives an old total lean as the value side', () => {
  // Model 51.5% over, market 58.2% over: the model's lean vs the line is the under.
  // Stored as an over that lost on a 2-2 (4-goal) final; re-derived, the under won.
  const doc = { league: 'NHL', homeTeam: 'H', awayTeam: 'A', trackResult: 'loss', finalHomeScore: 2, finalAwayScore: 2,
    track: { market: 'total', line: 5.5, side: 'over', modelProbability: 51.5, marketProbability: 58.2, modelOver: 51.5, fairOver: 58.2 } };
  assert.strictEqual(leanLabel(doc), 'Under 5.5');
  const l = describeLean(doc);
  assert.strictEqual(l.result, 'win');
  assert.strictEqual(l.gap, 6.7);
  assert.strictEqual(leanRecord([{ ...doc, gameDate: '2026-11-25' }]).wins, 1);
});

console.log(`modelLeans: ${passed} passed`);
