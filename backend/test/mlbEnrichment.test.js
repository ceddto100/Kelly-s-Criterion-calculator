// backend/test/mlbEnrichment.test.js
// Plain-node tests (no framework) for the pure helpers in mlbEnrichment.js.
// Run with: node test/mlbEnrichment.test.js  (or `npm test` from backend/).
const assert = require('assert');
const {
  getParkFactor,
  getCfBearing,
  roofClosedFromType,
  classifyWindDirection,
  angularDiff,
  pickHourly,
  ipToOuts,
  parseBoxscoreReliefOuts,
} = require('../scrapers/mlbEnrichment');

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    console.error(`FAIL: ${name}`);
    console.error(err.message);
    process.exitCode = 1;
  }
}

// --- park table ---------------------------------------------------------------

test('park factor lookup is case/punctuation tolerant', () => {
  assert.strictEqual(getParkFactor('Coors Field'), 112);
  assert.strictEqual(getParkFactor('T-Mobile Park'), 92);
  assert.strictEqual(getParkFactor('Oriole Park at Camden Yards'), 98);
  assert.strictEqual(getParkFactor('camden yards'), 98); // synonym
  assert.strictEqual(getParkFactor('Unknown Stadium'), undefined);
});

test('cf bearing lookup', () => {
  assert.strictEqual(getCfBearing('Fenway Park'), 52);
  assert.strictEqual(getCfBearing('Unknown Stadium'), undefined);
});

test('roof type mapping', () => {
  assert.strictEqual(roofClosedFromType('Dome'), true);
  assert.strictEqual(roofClosedFromType('Open'), false);
  assert.strictEqual(roofClosedFromType('Retractable'), undefined);
  assert.strictEqual(roofClosedFromType(undefined), undefined);
});

// --- wind ----------------------------------------------------------------------

test('angularDiff handles wraparound', () => {
  assert.strictEqual(angularDiff(350, 10), 20);
  assert.strictEqual(angularDiff(10, 350), 20);
  assert.strictEqual(angularDiff(90, 270), 180);
  assert.strictEqual(angularDiff(45, 45), 0);
});

test('wind blowing toward CF classifies as out', () => {
  // CF bearing 45 (NE): wind FROM 225 (SW) pushes air home plate -> CF.
  assert.strictEqual(classifyWindDirection(225, 45), 'out');
  assert.strictEqual(classifyWindDirection(200, 45), 'out'); // within 45°
});

test('wind from CF classifies as in', () => {
  assert.strictEqual(classifyWindDirection(45, 45), 'in');
  assert.strictEqual(classifyWindDirection(80, 45), 'in');
});

test('perpendicular wind classifies as crosswind', () => {
  assert.strictEqual(classifyWindDirection(135, 45), 'crosswind');
  assert.strictEqual(classifyWindDirection(315, 45), 'crosswind');
});

test('wind classification handles missing inputs', () => {
  assert.strictEqual(classifyWindDirection(undefined, 45), undefined);
  assert.strictEqual(classifyWindDirection(225, undefined), undefined);
});

// --- innings notation ------------------------------------------------------------

test('ipToOuts converts baseball notation', () => {
  assert.strictEqual(ipToOuts('2.1'), 7); // 2 1/3 innings
  assert.strictEqual(ipToOuts('0.2'), 2);
  assert.strictEqual(ipToOuts('1.0'), 3);
  assert.strictEqual(ipToOuts(3), 9);
  assert.strictEqual(ipToOuts(''), 0);
  assert.strictEqual(ipToOuts(undefined), 0);
});

// --- boxscore relief parsing ------------------------------------------------------

test('parseBoxscoreReliefOuts skips the starter and sums relievers', () => {
  const box = {
    teams: {
      home: {
        team: { id: 119 },
        pitchers: [1, 2, 3], // starter then two relievers
        players: {
          ID1: { stats: { pitching: { inningsPitched: '6.0' } } },
          ID2: { stats: { pitching: { inningsPitched: '1.2' } } },
          ID3: { stats: { pitching: { inningsPitched: '1.1' } } },
        },
      },
      away: {
        team: { id: 115 },
        pitchers: [9], // complete game: no relief
        players: { ID9: { stats: { pitching: { inningsPitched: '9.0' } } } },
      },
    },
  };
  const result = parseBoxscoreReliefOuts(box);
  assert.deepStrictEqual(result, [
    { teamId: 119, reliefOuts: 5 + 4 }, // 1.2 -> 5 outs, 1.1 -> 4 outs
    { teamId: 115, reliefOuts: 0 },
  ]);
});

test('parseBoxscoreReliefOuts tolerates malformed boxscores', () => {
  assert.deepStrictEqual(parseBoxscoreReliefOuts(null), []);
  assert.deepStrictEqual(parseBoxscoreReliefOuts({}), []);
  assert.deepStrictEqual(parseBoxscoreReliefOuts({ teams: { home: {} } }), []);
});

// --- forecast hour picking ---------------------------------------------------------

test('pickHourly selects the hour nearest first pitch', () => {
  const hourly = {
    time: ['2026-06-12T17:00', '2026-06-12T18:00', '2026-06-12T19:00'],
    temperature_2m: [70, 75, 80],
    wind_speed_10m: [5, 10, 15],
    wind_direction_10m: [200, 225, 250],
  };
  const wx = pickHourly(hourly, '2026-06-12T18:10:00Z');
  assert.deepStrictEqual(wx, { temperatureF: 75, windSpeedMph: 10, windFromDeg: 225 });
});

test('pickHourly handles empty/invalid input', () => {
  assert.strictEqual(pickHourly(undefined, '2026-06-12T18:00:00Z'), null);
  assert.strictEqual(pickHourly({ time: [] }, '2026-06-12T18:00:00Z'), null);
  assert.strictEqual(pickHourly({ time: ['2026-06-12T17:00'] }, 'not-a-date'), null);
});

if (process.exitCode) {
  console.error(`\n${passed} passed, with failures (see above).`);
} else {
  console.log(`All ${passed} mlbEnrichment tests passed.`);
}
