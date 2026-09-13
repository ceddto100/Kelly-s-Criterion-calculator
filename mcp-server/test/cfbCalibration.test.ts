import { describe, it, expect } from 'vitest';
import {
  FACTOR_NAMES,
  buildGameRecords,
  calibrate,
  fitSigma,
  leastSquares,
  scoreProbabilities,
} from '../../scripts/lib/cfbCalibration.mjs';

/** Deterministic PRNG so the simulated seasons are identical on every run. */
function rng(seed: number) {
  let t = seed >>> 0;
  const uniform = () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
  return { uniform, normal };
}

const NO = { bye: false, shortWeek: false, travel: false, altitude: false, bounceback: false, lookahead: false };

/**
 * Simulated seasons with KNOWN truth: home field 2.5, 25 Elo = 1 point, a bye
 * worth +2, a long trip worth -2, and a margin spread of 14 widening past a
 * 14-point line. The market prices everything, with a little noise.
 */
function simulate(seed: number, games: number) {
  const { uniform, normal } = rng(seed);
  return Array.from({ length: games }, (_, id) => {
    const eloDiff = normal() * 300;
    const neutral = uniform() < 0.1;
    const home = { ...NO, bye: uniform() < 0.12, travel: uniform() < 0.05 };
    const away = { ...NO, bye: uniform() < 0.12, travel: uniform() < 0.25 };
    const net = Object.fromEntries(FACTOR_NAMES.map((f) => [f, Number(home[f as keyof typeof NO]) - Number(away[f as keyof typeof NO])]));
    const mean = eloDiff / 25 + (neutral ? 0 : 2.5) + 2 * net.bye - 2 * net.travel;
    const spread = 14 + 0.15 * Math.max(0, Math.abs(mean) - 14);
    const homeMargin = Math.round(mean + normal() * spread) || 1;
    const closeHome = Math.round((-mean + normal() * 1.5) * 2) / 2;
    return { id, season: 2020, week: 1, neutral, homeMargin, closeHome, eloDiff, auto: { home, away }, net };
  });
}

describe('calibration math', () => {
  it('recovers known coefficients with honest standard errors', () => {
    const { uniform, normal } = rng(7);
    const rows: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 4000; i += 1) {
      const x = normal();
      const d = uniform() < 0.3 ? 1 : 0;
      rows.push([1, x, d, 0]); // last column never varies
      y.push(1 + 2 * x - 3 * d + normal());
    }
    const fit = leastSquares(rows, y, ['intercept', 'x', 'd', 'constant']);
    expect(fit.coef.x).toBeCloseTo(2, 1);
    expect(fit.coef.d).toBeCloseTo(-3, 1);
    expect(fit.se.x).toBeGreaterThan(0.005);
    expect(fit.se.x).toBeLessThan(0.03);
    expect(fit.coef.constant).toBeUndefined();
  });

  it('scores probabilities with log loss, Brier and reliability bins', () => {
    const s = scoreProbabilities([{ p: 0.5, y: 1 }, { p: 0.5, y: 0 }]);
    expect(s.logLoss).toBeCloseTo(Math.log(2), 10);
    expect(s.brier).toBeCloseTo(0.25, 10);
    expect(s.reliability[5]).toMatchObject({ count: 2, observedRate: 0.5 });
    expect(scoreProbabilities([]).count).toBe(0);
  });

  it('finds the truth in simulated seasons and only suggests what the data supports', () => {
    const train = simulate(1, 6000);
    const validate = simulate(2, 2000);
    const sigma = fitSigma(train)!;
    expect(sigma.base).toBeGreaterThan(13);
    expect(sigma.base).toBeLessThan(15.5);

    const report = calibrate({ train, validate });
    expect(report.homeField.fromFinalScores.estimate).toBeGreaterThan(1.5);
    expect(report.homeField.fromFinalScores.estimate).toBeLessThan(3.5);
    expect(report.pointsPerEloPoint.estimate).toBeCloseTo(0.04, 2);
    const factor = (name: string) => report.factors.find((f: { name: string }) => f.name === name)!;
    expect(factor('bye').suggested).toBeGreaterThan(1);
    expect(factor('travel').suggested).toBeLessThan(-1);
    // Altitude never occurs in the simulation: no evidence, so the default stays.
    expect(factor('altitude').suggested).toBe(-1);
    // A market that prices every factor shows no mispricing.
    expect(Math.abs(factor('bye').marketMispricing.estimate)).toBeLessThan(3 * factor('bye').marketMispricing.se);
    expect(report.validation.current.againstTheSpread.count).toBeGreaterThan(1000);
    expect(report.validation.suggested.outrightWinnerFromClosingLine.logLoss)
      .toBeLessThanOrEqual(report.validation.current.outrightWinnerFromClosingLine.logLoss + 0.002);
  });
});

describe('historical game records', () => {
  const teams = [
    { id: 1, school: 'Fixture State', location: { id: 101, timezone: 'America/New_York', elevation: '60' } },
    { id: 2, school: 'Sample Tech', location: { id: 102, timezone: 'America/Los_Angeles', elevation: '30' } },
    { id: 3, school: 'Mock University', location: { id: 103, timezone: 'America/Denver', elevation: '2195' } },
  ];
  const venues = teams.map((t) => ({ id: t.location.id, ...t.location }));
  const g = (id: number, week: number, start: string, home: number, away: number, extra = {}) => ({
    id, season: 2025, week, seasonType: 'regular', startDate: start, completed: true, neutralSite: false,
    venueId: 100 + home, homeId: home, homeTeam: teams[home - 1]?.school ?? 'FCS U', homeClassification: 'fbs',
    awayId: away, awayTeam: teams[away - 1]?.school ?? 'FCS U', awayClassification: away === 99 ? 'fcs' : 'fbs',
    homePoints: 30, awayPoints: 20, homePregameElo: 1600, awayPregameElo: 1500, ...extra,
  });
  const games = [
    g(10, 1, '2025-08-30T16:00:00Z', 1, 99),
    g(11, 2, '2025-09-06T16:00:00Z', 2, 3, { awayPoints: 45, homePoints: 10 }),
    g(12, 3, '2025-09-13T16:00:00Z', 1, 2),
    g(13, 4, '2025-09-20T20:00:00Z', 3, 1, { homePregameElo: null }),
    g(14, 1, '2026-01-01T20:00:00Z', 2, 1, { seasonType: 'postseason' }),
  ];
  const line = (id: number, home: string, away: string, text: string) => ({ id, homeTeam: home, awayTeam: away, lines: [{ formattedSpread: text }] });
  const lines = [
    line(10, 'Fixture State', 'FCS U', 'Fixture State -30'),
    line(11, 'Sample Tech', 'Mock University', 'Mock University -6'),
    line(12, 'Fixture State', 'Sample Tech', 'Fixture State -3.5'),
    line(13, 'Mock University', 'Fixture State', 'Mock University -1'),
    line(14, 'Sample Tech', 'Fixture State', 'Sample Tech -2'),
  ];
  const pollWeeks = [
    { seasonType: 'regular', week: 3, polls: [{ poll: 'AP Top 25', ranks: [{ rank: 5, teamId: 3 }] }] },
    { seasonType: 'regular', week: 4, polls: [{ poll: 'AP Top 25', ranks: [{ rank: 1, teamId: 1 }] }] },
  ];

  it('keeps only completed regular-season FBS games with Elo and a closing line, using pre-game polls', () => {
    const records = buildGameRecords({ games, lines, teams, venues, pollWeeks });
    expect(records.map((r: { id: number }) => r.id)).toEqual([11, 12]);
    const week3 = records.find((r: { id: number }) => r.id === 12);
    expect(week3).toMatchObject({ homeMargin: 10, closeHome: -3.5, eloDiff: 100 });
    // Sample Tech lost by 35 the week before, then flew three time zones east.
    expect(week3.auto.away).toMatchObject({ bounceback: true, travel: true });
    // Fixture State's next opponent is #5 in the poll released before week 3 — not the later #1 poll.
    expect(week3.home.nextOpponentRank).toBe(5);
    expect(week3.net.travel).toBe(-1);
  });
});
