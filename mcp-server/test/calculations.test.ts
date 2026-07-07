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
  it('reproduces the recalibrated weighted formula', () => {
    // points: (8 - (-2)) * 0.5 = 5.0
    // yards:  ((60 - (-20))/15) * 0.25 = (80/15)*0.25 = 1.33333
    // turn:   (3 - (-2)) * 4 * 0.5 * 0.06 = 5*0.12 = 0.6
    // total = 6.93333
    expect(predictedMarginFootball(baseFootball)).toBeCloseTo(6.93333, 4);
  });

  it('CFB weights season turnover diff more per unit (shorter season)', () => {
    // points 5.0 + yards 1.33333 + turnovers 5*4*0.5*0.08 = 0.8 => 7.13333
    expect(predictedMarginFootball(baseFootball, 'CFB')).toBeCloseTo(7.13333, 4);
  });

  it('clamps extreme turnover differentials', () => {
    const extreme = { ...baseFootball, teamTurnoverDiff: 50, opponentTurnoverDiff: -50 };
    // clamps to +10/-10 => (10 - (-10))*4*0.5*0.06 = 2.4 turnover component
    // points 5.0 + yards 1.33333 + turnover 2.4 = 8.73333
    expect(predictedMarginFootball(extreme)).toBeCloseTo(8.73333, 4);
  });

  it('applies a clamped QB edge when provided', () => {
    const base = predictedMarginFootball(baseFootball);
    const withQb = { ...baseFootball, qbEdge: 3 };
    expect(predictedMarginFootball(withQb)).toBeCloseTo(base + 3, 5);
    // clamp at NFL qbValue (7)
    const huge = { ...baseFootball, qbEdge: 99 };
    expect(predictedMarginFootball(huge)).toBeCloseTo(base + 7, 5);
  });

  it('blends recent form toward season via decay rate (NFL 0.9)', () => {
    // teamPPG season 28, recent 38 => effective 0.9*28 + 0.1*38 = 29.0 (+1)
    const recent = { ...baseFootball, teamRecentPPG: 38 };
    const delta = predictedMarginFootball(recent) - predictedMarginFootball(baseFootball);
    // +1 PPG flows through net points * 0.5 weight = +0.5
    expect(delta).toBeCloseTo(0.5, 5);
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
  it('reproduces the recalibrated weighted formula', () => {
    // Scoring (primary): ppg (115-110)*0.4 = 2.0, allowed (112-108)*0.4 = 1.6
    // Skill (secondary): fg (47-45)*2.0*0.15 = 0.60
    //                    3p% (37-35)*1.0*0.06 = 0.12
    //                    3prate (0.4-0.38)*15*0.05 = 0.015
    //                    rebounds (3-(-1))*0.5*0.10 = 0.20
    //                    turnovers (2-(-1))*1.0*0.08 = 0.24
    // total = 3.6 + 1.175 = 4.775
    expect(predictedMarginBasketball(baseBasketball)).toBeCloseTo(4.775, 3);
  });

  it('NBA pace multiplier scales only per-possession skill components', () => {
    const fast = { ...baseBasketball, teamPace: 110, opponentPace: 110 };
    // Scoring stays 3.6 (PPG already embeds pace); skill 1.175 * 1.10 = 1.2925
    expect(predictedMarginBasketball(fast)).toBeCloseTo(3.6 + 1.175 * 1.1, 3);
  });

  it('CBB uses a 68-possession pace baseline (bug fix)', () => {
    const cbbPaced = { ...baseBasketball, teamPace: 68, opponentPace: 68 };
    // With the correct CBB baseline (68), pace factor = 1.0 (no distortion).
    expect(predictedMarginBasketball(cbbPaced, 'CBB')).toBeCloseTo(4.775, 3);
  });

  it('blends recent form toward season via decay rate (NBA 0.85)', () => {
    // teamPPG season 115, recent 125 => 0.85*115 + 0.15*125 = 116.5 (+1.5)
    const recent = { ...baseBasketball, teamRecentPPG: 125 };
    const delta = predictedMarginBasketball(recent) - predictedMarginBasketball(baseBasketball);
    // +1.5 PPG * 0.4 weight = +0.6
    expect(delta).toBeCloseTo(0.6, 4);
  });

  it('omits optional components gracefully', () => {
    const minimal: BasketballStats = {
      teamPPG: 115, teamAllowed: 108, opponentPPG: 110, opponentAllowed: 112,
    };
    // only ppg (2.0) + allowed (1.6) = 3.6
    expect(predictedMarginBasketball(minimal)).toBeCloseTo(3.6, 5);
  });
});
