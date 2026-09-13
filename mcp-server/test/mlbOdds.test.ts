import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  consensusOdds,
  matchOdds,
  slateDate,
  americanToProbability,
  probabilityToAmerican,
} = require('../../scripts/updateMLBStats.js');

const book = (h2h: [number, number], total: number) => ({
  markets: [
    { key: 'h2h', outcomes: [{ name: 'New York Yankees', price: h2h[0] }, { name: 'Boston Red Sox', price: h2h[1] }] },
    { key: 'totals', outcomes: [{ name: 'Over', price: -110, point: total }, { name: 'Under', price: -110, point: total }] },
  ],
});

describe('MLB sportsbook lines', () => {
  it('builds the slate for the US Eastern day, rolling to tomorrow after 9pm ET', () => {
    expect(slateDate(new Date('2026-09-13T00:30:00Z'))).toBe('2026-09-12'); // 8:30pm EDT
    expect(slateDate(new Date('2026-09-13T03:00:00Z'))).toBe('2026-09-13'); // 11pm EDT → next day
    expect(slateDate(new Date('2026-09-13T15:00:00Z'))).toBe('2026-09-13');
    expect(slateDate(new Date('2026-11-05T02:30:00Z'))).toBe('2026-11-05'); // 9:30pm EST → next day
    expect(slateDate(new Date('2026-12-31T23:00:00Z'))).toBe('2026-12-31'); // 6pm EST
    expect(slateDate(new Date('2027-01-01T03:00:00Z'))).toBe('2027-01-01'); // 10pm EST Dec 31 → Jan 1
  });

  it('takes median totals and moneylines, averaging prices as probabilities', () => {
    const line = consensusOdds({
      home_team: 'New York Yankees', away_team: 'Boston Red Sox', commence_time: '2026-09-13T17:35:00Z',
      bookmakers: [book([-150, 130], 8.5), book([-140, 120], 8.5), book([-145, 125], 9)],
    });
    expect(line).toMatchObject({ total: 8.5, homeMl: -145, awayMl: 125 });
    // Across the ±100 boundary the median of American odds would be nonsense.
    const coinFlip = consensusOdds({
      home_team: 'New York Yankees', away_team: 'Boston Red Sox', commence_time: '2026-09-13T17:35:00Z',
      bookmakers: [book([-105, -115], 8), book([105, -125], 8)],
    });
    expect(coinFlip.homeMl).toBe(100);
    expect(americanToProbability(-150)).toBeCloseTo(0.6, 10);
    expect(probabilityToAmerican(0.6)).toBe(-150);
    expect(probabilityToAmerican(undefined)).toBeUndefined();
  });

  it('matches renamed teams by a unique nickname and picks the right doubleheader game', () => {
    const events = [
      { home: 'Oakland Athletics', away: 'Seattle Mariners', commence: Date.parse('2026-09-13T01:40:00Z'), total: 8 },
      { home: 'Chicago White Sox', away: 'Boston Red Sox', commence: Date.parse('2026-09-13T17:10:00Z'), total: 9 },
      { home: 'Chicago White Sox', away: 'Boston Red Sox', commence: Date.parse('2026-09-13T23:10:00Z'), total: 9.5 },
    ];
    expect(matchOdds({ home: 'Athletics', away: 'Seattle Mariners', gameDate: '2026-09-13T01:40:00Z' }, events)?.total).toBe(8);
    expect(matchOdds({ home: 'Chicago White Sox', away: 'Boston Red Sox', gameDate: '2026-09-13T23:05:00Z' }, events)?.total).toBe(9.5);
    // "Sox" belongs to two teams, so a nickname alone never matches.
    expect(matchOdds({ home: 'Sox', away: 'Boston Red Sox', gameDate: '2026-09-13T17:10:00Z' }, events)).toBeUndefined();
    // A first pitch more than six hours off is a different game.
    expect(matchOdds({ home: 'Athletics', away: 'Seattle Mariners', gameDate: '2026-09-14T01:40:00Z' }, events)).toBeUndefined();
  });
});
