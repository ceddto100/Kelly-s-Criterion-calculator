// backend/test/teamLogos.test.js
// Plain-node tests for team logo data: scoreboard logo fields and the team directory parser.
// Run with: node test/teamLogos.test.js
const assert = require('assert');
const { parseScoreboard } = require('../scrapers/dailyGames');
const { parseTeams, pickLogos } = require('../scrapers/teamDirectory');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; } catch (err) {
    console.error(`FAIL: ${name}`); console.error(err.message); process.exitCode = 1;
  }
}

test('scoreboard games carry team id, logo and color', () => {
  const data = { events: [{ id: '401', date: '2026-11-04T00:00Z', competitions: [{
    status: { type: { state: 'pre', shortDetail: '7:00 PM' } },
    competitors: [
      { homeAway: 'home', score: '0', team: { id: 13, abbreviation: 'LAL', displayName: 'Los Angeles Lakers', logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png', color: '552583' } },
      { homeAway: 'away', score: '0', team: { id: 2, abbreviation: 'BOS', displayName: 'Boston Celtics' } },
    ],
  }] }] };
  const [g] = parseScoreboard(data, 'NBA');
  assert.strictEqual(g.homeId, '13');
  assert.strictEqual(g.homeLogo, 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png');
  assert.strictEqual(g.homeColor, '#552583');
  assert.strictEqual(g.awayLogo, '');
  assert.strictEqual(g.awayColor, '');
});

test('pickLogos prefers full/default and finds the dark variant', () => {
  const logos = [
    { href: 'scoreboard.png', rel: ['full', 'scoreboard'] },
    { href: 'default.png', rel: ['full', 'default'] },
    { href: 'dark.png', rel: ['full', 'dark'] },
  ];
  assert.deepStrictEqual(pickLogos(logos), { logo: 'default.png', logoDark: 'dark.png' });
  assert.deepStrictEqual(pickLogos(undefined), { logo: '', logoDark: '' });
});

test('parseTeams flattens the ESPN teams payload', () => {
  const data = { sports: [{ leagues: [{ teams: [
    { team: { id: '17', abbreviation: 'BKN', displayName: 'Brooklyn Nets', shortDisplayName: 'Nets', name: 'Nets', location: 'Brooklyn', color: '000000', logos: [{ href: 'bkn.png', rel: ['full', 'default'] }] } },
    { team: { abbreviation: 'NOID' } },
  ] }] }] };
  const teams = parseTeams(data);
  assert.strictEqual(teams.length, 1);
  assert.deepStrictEqual(teams[0], {
    id: '17', abbreviation: 'BKN', displayName: 'Brooklyn Nets', shortDisplayName: 'Nets',
    name: 'Nets', location: 'Brooklyn', color: '#000000', logo: 'bkn.png', logoDark: '',
  });
  assert.deepStrictEqual(parseTeams({}), []);
});

console.log(`teamLogos: ${passed} passed`);
