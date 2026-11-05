import { describe, it, expect } from 'vitest';
import { easternDate, isGameOnDate } from '../tools/gamesOfDay.js';
import { selectAllPicks, gameIdTag, PickCandidate } from '../tools/dailyCalc.js';

describe('easternDate / isGameOnDate', () => {
  it('puts a 7:30 PM ET tip-off on the Eastern date, not the UTC date', () => {
    // 2026-11-05 19:30 EST == 2026-11-06 00:30 UTC
    expect(easternDate('2026-11-06T00:30Z')).toBe('2026-11-05');
    expect(isGameOnDate({ startTime: '2026-11-06T00:30Z' }, '2026-11-05')).toBe(true);
  });

  it('excludes Sunday NFL games from a Thursday slate', () => {
    expect(isGameOnDate({ startTime: '2026-11-08T18:00Z' }, '2026-11-05')).toBe(false);
  });

  it('excludes yesterday’s games', () => {
    expect(isGameOnDate({ startTime: '2026-11-05T00:00Z' }, '2026-11-05')).toBe(false);
  });
});

describe('selectAllPicks cross-day dedupe', () => {
  const pick = (id: string): PickCandidate => ({
    sport: 'NBA',
    sportLabel: 'basketball',
    homeTeam: 'Boston Celtics',
    awayTeam: 'Miami Heat',
    market: 'spread',
    pick: 'Boston Celtics -3.5',
    pickedSide: 'home',
    line: -3.5,
    probability: 58,
    gameIdTag: gameIdTag('espn', 'NBA', id),
  });

  it('skips a game whose provider id was logged on an earlier day', () => {
    const logged = new Set([gameIdTag('espn', 'NBA', '401')!]);
    expect(selectAllPicks([pick('401')], ['NBA'], '2026-11-05', logged)).toHaveLength(0);
    expect(selectAllPicks([pick('402')], ['NBA'], '2026-11-05', logged)).toHaveLength(1);
  });
});
