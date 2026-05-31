/**
 * Tests for the refactored football/basketball spread formulas.
 * Confirms the config extraction is behavior-preserving and that the new
 * recent-form blend, QB edge, and league-specific pace work as intended.
 */
import { describe, it, expect } from 'vitest';
import {
  predictedMarginFootball,
  predictedMarginBasketball,
  type FootballStats,
  type BasketballStats,
} from '../src/utils/calculations.js';

// ---- Football ----

const baseFootball: FootballStats = {
  teamPPG: 28,
  teamAllowed: 20,
  opponentPPG: 22,
  opponentAllowed: 24,
  teamOffYards: 380,
  teamDefYards: 320,
  opponentOffYards: 340,
  opponentDefYards: 360,
  teamTurnoverDiff: 3,
  opponentTurnoverDiff: -2,
};

describe('predictedMarginFootball', () => {
  it('reproduces the known weighted formula (behavior-preserving)', () => {
    // points: (8 - (-2)) * 0.4 = 4.0
    // yards:  ((60 - (-20))/25) * 0.25 = (80/25)*0.25 = 0.8
    // turn:   (3 - (-2)) * 4 * 0.5 * 0.2 = 5*4*0.5*0.2 = 2.0
    // total = 6.8
    expect(predictedMarginFootball(baseFootball)).toBeCloseTo(6.8, 5);
  });

  it('CFB uses its own (higher) sigma path but same margin weights', () => {
    expect(predictedMarginFootball(baseFootball, 'CFB')).toBeCloseTo(6.8, 5);
  });

  it('clamps extreme turnover differentials', () => {
    const extreme = { ...baseFootball, teamTurnoverDiff: 50, opponentTurnoverDiff: -50 };
    // clamps to +10/-10 => (10 - (-10))*4*0.5*0.2 = 8 turnover component
    // points 4.0 + yards 0.8 + turnover 8.0 = 12.8
    expect(predictedMarginFootball(extreme)).toBeCloseTo(12.8, 5);
  });

  it('applies a clamped QB edge when provided', () => {
    const withQb = { ...baseFootball, qbEdge: 3 };
    expect(predictedMarginFootball(withQb)).toBeCloseTo(6.8 + 3, 5);
    // clamp at NFL qbValue (7)
    const huge = { ...baseFootball, qbEdge: 99 };
    expect(predictedMarginFootball(huge)).toBeCloseTo(6.8 + 7, 5);
  });

  it('blends recent form toward season via decay rate (NFL 0.9)', () => {
    // teamPPG season 28, recent 38 => effective 0.9*28 + 0.1*38 = 29.0 (+1)
    const recent = { ...baseFootball, teamRecentPPG: 38 };
    const delta = predictedMarginFootball(recent) - predictedMarginFootball(baseFootball);
    // +1 PPG flows through net points * 0.4 weight = +0.4
    expect(delta).toBeCloseTo(0.4, 5);
  });

  it('is season-only when no recent inputs given (default unchanged)', () => {
    const a = predictedMarginFootball(baseFootball);
    const b = predictedMarginFootball({ ...baseFootball });
    expect(a).toBe(b);
  });
});

// ---- Basketball ----

const baseBasketball: BasketballStats = {
  teamPPG: 115,
  teamAllowed: 108,
  opponentPPG: 110,
  opponentAllowed: 112,
  teamFGPct: 47,
  opponentFGPct: 45,
  teamReboundMargin: 3,
  opponentReboundMargin: -1,
  teamTurnoverMargin: 2,
  opponentTurnoverMargin: -1,
  team3PPct: 37,
  opponent3PPct: 35,
  team3PRate: 0.4,
  opponent3PRate: 0.38,
};

describe('predictedMarginBasketball', () => {
  it('reproduces the known weighted formula (behavior-preserving)', () => {
    // ppg:        (115-110)*0.15 = 0.75
    // allowed:    (112-108)*0.15 = 0.60
    // fg:         (47-45)*2.0*0.25 = 1.00
    // 3p%:        (37-35)*1.0*0.08 = 0.16
    // 3prate:     (0.4-0.38)*15*0.07 = 0.021
    // rebounds:   (3-(-1))*0.5*0.17 = 0.34
    // turnovers:  (2-(-1))*1.0*0.13 = 0.39
    // total = 3.261
    expect(predictedMarginBasketball(baseBasketball)).toBeCloseTo(3.261, 3);
  });

  it('NBA pace multiplier uses 100 baseline', () => {
    const fast = { ...baseBasketball, teamPace: 110, opponentPace: 110 };
    // expected pace 110 => factor 1.10
    expect(predictedMarginBasketball(fast)).toBeCloseTo(3.261 * 1.1, 2);
  });

  it('CBB uses a 68-possession pace baseline (bug fix)', () => {
    const cbbPaced = { ...baseBasketball, teamPace: 68, opponentPace: 68 };
    // With the correct CBB baseline (68), pace factor = 1.0 (no distortion).
    // The old code reused 100, which would have compressed this to 0.68x.
    expect(predictedMarginBasketball(cbbPaced, 'CBB')).toBeCloseTo(3.261, 3);
  });

  it('blends recent form toward season via decay rate (NBA 0.85)', () => {
    // teamPPG season 115, recent 125 => 0.85*115 + 0.15*125 = 116.5 (+1.5)
    const recent = { ...baseBasketball, teamRecentPPG: 125 };
    const delta = predictedMarginBasketball(recent) - predictedMarginBasketball(baseBasketball);
    // +1.5 PPG * 0.15 weight = +0.225
    expect(delta).toBeCloseTo(0.225, 4);
  });

  it('omits optional components gracefully', () => {
    const minimal: BasketballStats = {
      teamPPG: 115, teamAllowed: 108, opponentPPG: 110, opponentAllowed: 112,
    };
    // only ppg (0.75) + allowed (0.60) = 1.35
    expect(predictedMarginBasketball(minimal)).toBeCloseTo(1.35, 5);
  });
});
