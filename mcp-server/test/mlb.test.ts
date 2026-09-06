/**
 * Unit tests for the MLB projection engine.
 * Run with: npm test
 */
import { describe, it, expect } from 'vitest';
import {
  normalizeStat,
  clamp,
  calculateOffenseScore,
  calculatePitchingMultiplier,
  calculateParkMultiplier,
  calculateWeatherMultiplier,
  calculateLineupMultiplier,
  calculateRecentFormMultiplier,
  bullpenFatiguePenalty,
  runMarginToWinProb,
  determineTotalLean,
  calculateConfidenceScore,
  devig,
  projectMLBGame,
  type MLBTeamInput,
  type MLBProjectionInput,
} from '../src/utils/mlb.js';

describe('generic helpers', () => {
  it('normalizeStat returns 1.0 at baseline', () => {
    expect(normalizeStat(4.3, 4.3)).toBe(1);
  });

  it('normalizeStat is monotonic with sensitivity', () => {
    const low = normalizeStat(5, 4.3, 1);
    const high = normalizeStat(5, 4.3, 2);
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(1);
  });

  it('clamp bounds values', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('offense score', () => {
  it('average offense (wRC+ 100) yields ~1.0 multiplier', () => {
    const r = calculateOffenseScore({ wrcPlus: 100 });
    expect(Math.abs(r.multiplier - 1)).toBeLessThan(0.001);
    expect(r.coverage).toBeGreaterThan(0);
  });

  it('elite offense raises multiplier above 1', () => {
    const r = calculateOffenseScore({ wrcPlus: 125, ops: 0.82 });
    expect(r.multiplier).toBeGreaterThan(1.05);
  });

  it('weak offense lowers multiplier below 1', () => {
    const r = calculateOffenseScore({ wrcPlus: 80, ops: 0.66 });
    expect(r.multiplier).toBeLessThan(0.95);
  });

  it('coverage is 0 when no stats provided', () => {
    const r = calculateOffenseScore({});
    expect(r.coverage).toBe(0);
    expect(r.multiplier).toBe(1);
  });
});

describe('pitching', () => {
  it('ace starter suppresses opposing runs (multiplier < 1)', () => {
    const r = calculatePitchingMultiplier(
      { fip: 2.8, siera: 2.9, xfip: 3.0, era: 2.7 },
      { fip: 3.5, era: 3.4, whip: 1.15 },
    );
    expect(r.multiplier).toBeLessThan(0.95);
  });

  it('poor pitching inflates opposing runs (multiplier > 1)', () => {
    const r = calculatePitchingMultiplier(
      { fip: 5.4, siera: 5.2, era: 5.6 },
      { fip: 5.0, era: 5.1, whip: 1.55 },
    );
    expect(r.multiplier).toBeGreaterThan(1.05);
  });

  it('bullpen fatigue penalty grows with usage', () => {
    const fresh = bullpenFatiguePenalty({ inningsLast1d: 0, inningsLast3d: 2 });
    const tired = bullpenFatiguePenalty({ inningsLast1d: 4, inningsLast3d: 14 });
    expect(fresh).toBe(1);
    expect(tired).toBeGreaterThan(1);
  });
});

describe('environment', () => {
  it('neutral park = 1.0, Coors-like park > 1, missing = 1', () => {
    expect(calculateParkMultiplier({ parkFactor: 100 })).toBe(1);
    expect(calculateParkMultiplier({ parkFactor: 112 })).toBeGreaterThan(1);
    expect(calculateParkMultiplier(undefined)).toBe(1);
  });

  it('closed roof neutralizes weather', () => {
    expect(
      calculateWeatherMultiplier({
        roofClosed: true,
        temperatureF: 95,
        windSpeedMph: 20,
        windDirection: 'out',
      }),
    ).toBe(1);
  });

  it('hot weather + wind out raises runs; cold + wind in lowers', () => {
    const hot = calculateWeatherMultiplier({ temperatureF: 95, windSpeedMph: 12, windDirection: 'out' });
    const cold = calculateWeatherMultiplier({ temperatureF: 45, windSpeedMph: 12, windDirection: 'in' });
    expect(hot).toBeGreaterThan(1);
    expect(cold).toBeLessThan(1);
  });

  it('weather effect is capped', () => {
    const extreme = calculateWeatherMultiplier({ temperatureF: 130, windSpeedMph: 100, windDirection: 'out' });
    expect(extreme).toBeLessThanOrEqual(1.08001);
  });
});

describe('lineup & recent form', () => {
  it('stars out reduces lineup multiplier; platoon edge raises it', () => {
    expect(calculateLineupMultiplier({ starsOut: 2 })).toBeLessThan(1);
    expect(calculateLineupMultiplier({ platoonAdvantage: true })).toBeGreaterThan(1);
    expect(calculateLineupMultiplier(undefined)).toBe(1);
  });

  it('recent form is capped and regressed', () => {
    const hot = calculateRecentFormMultiplier({ recentRunsPerGame: 8 });
    expect(hot).toBeGreaterThan(1);
    expect(hot).toBeLessThanOrEqual(1.05001);
    expect(calculateRecentFormMultiplier({})).toBe(1);
  });
});

describe('probability + decision', () => {
  it('run margin maps to win probability sensibly', () => {
    expect(Math.abs(runMarginToWinProb(0) - 0.5)).toBeLessThan(1e-9);
    expect(runMarginToWinProb(1)).toBeGreaterThan(0.55);
    expect(runMarginToWinProb(-1)).toBeLessThan(0.45);
  });

  it('no-bet when edge below threshold or data thin', () => {
    expect(determineTotalLean(0.2, 0.9)).toBe('no-bet');
    expect(determineTotalLean(1.2, 0.3)).toBe('no-bet');
    expect(determineTotalLean(1.2, 0.9)).toBe('over');
    expect(determineTotalLean(-1.2, 0.9)).toBe('under');
  });

  it('confidence is capped by data quality', () => {
    const thin = calculateConfidenceScore({ edgeStrength: 1, agreement: 1, dataQuality: 0.2 });
    const rich = calculateConfidenceScore({ edgeStrength: 1, agreement: 1, dataQuality: 1 });
    expect(rich).toBeGreaterThan(thin);
    expect(thin).toBeLessThanOrEqual(60);
  });

  it('devig produces normalized fair probabilities', () => {
    const fair = devig(-150, 130);
    expect(Math.abs(fair.home + fair.away - 1)).toBeLessThan(1e-9);
    expect(fair.home).toBeGreaterThan(fair.away);
  });
});

function team(name: string, opts: Partial<MLBTeamInput> = {}): MLBTeamInput {
  return {
    name,
    offense: { wrcPlus: 100, ops: 0.72 },
    starter: { fip: 4.25, era: 4.25, confirmed: true },
    bullpen: { fip: 4.25, era: 4.25, whip: 1.3, closerAvailable: true },
    lineup: { confirmed: true },
    ...opts,
  };
}

describe('end to end projection', () => {
  it('two perfectly average teams project ~league total', () => {
    const input: MLBProjectionInput = {
      home: team('Home'),
      away: team('Away'),
      environment: { parkFactor: 100 },
      line: { total: 8.5 },
    };
    const r = projectMLBGame(input);
    expect(Math.abs(r.totals.projectedTotal - 8.6)).toBeLessThan(0.3);
    expect(r.totals.market).toBe('total');
  });

  it('strong offenses + weak pitching lean over with drivers', () => {
    const input: MLBProjectionInput = {
      home: team('Home', { offense: { wrcPlus: 120 }, starter: { fip: 5.2, confirmed: true } }),
      away: team('Away', { offense: { wrcPlus: 118 }, starter: { fip: 5.0, confirmed: true } }),
      environment: { parkFactor: 108, temperatureF: 88, windSpeedMph: 10, windDirection: 'out' },
      line: { total: 8.0 },
    };
    const r = projectMLBGame(input);
    expect(r.totals.projectedTotal).toBeGreaterThan(9);
    expect(r.totals.lean).toBe('over');
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  it('unconfirmed starters surface a risk factor and reduce data completeness', () => {
    const input: MLBProjectionInput = {
      home: team('Home', { starter: { fip: 3.5, confirmed: false } }),
      away: team('Away'),
      line: { total: 8.5 },
    };
    const r = projectMLBGame(input);
    expect(r.riskFactors.some((s) => /not confirmed/i.test(s))).toBe(true);
    expect(r.dataCompleteness).toBeLessThan(1);
  });

  it('moneyline produces edges and lean when odds supplied', () => {
    const input: MLBProjectionInput = {
      home: team('Home', { offense: { wrcPlus: 115 }, starter: { fip: 3.2, confirmed: true } }),
      away: team('Away', { offense: { wrcPlus: 92 }, starter: { fip: 4.8, confirmed: true } }),
      line: { homeMoneyline: -120, awayMoneyline: 100, total: 8.5 },
    };
    const r = projectMLBGame(input);
    expect(r.moneyline.market).toBe('moneyline');
    expect(r.moneyline.homeWinProbability).toBeGreaterThan(50);
    expect(r.moneyline.homeEdge).not.toBeNull();
  });

  it('tiny total edge yields no-bet', () => {
    const input: MLBProjectionInput = {
      home: team('Home'),
      away: team('Away'),
      line: { total: 8.6 },
    };
    const r = projectMLBGame(input);
    expect(r.totals.lean).toBe('no-bet');
  });

  it('result always includes a non-guarantee disclaimer', () => {
    const r = projectMLBGame({ home: team('H'), away: team('A') });
    expect(r.disclaimer).toMatch(/not a guaranteed|guaranteed result/i);
  });
});
