/**
 * Unit tests for the shared decision layer.
 * Run with: npm test
 */
import { describe, it, expect } from 'vitest';
import {
  impliedProbabilityPct,
  fairImpliedPct,
  confidenceLabel,
  calculateConfidence,
  evaluateDecision,
  dataCompletenessFrom,
} from '../src/utils/decision.js';

describe('odds helpers', () => {
  it('implied probability from American odds', () => {
    expect(impliedProbabilityPct(-110)).toBeCloseTo(52.38, 1);
    expect(impliedProbabilityPct(100)).toBeCloseTo(50, 5);
    expect(impliedProbabilityPct(150)).toBeCloseTo(40, 5);
  });

  it('de-vigs a -110/-110 market to 50%', () => {
    expect(fairImpliedPct(-110, -110)).toBeCloseTo(50, 5);
  });

  it('de-vig favors the shorter price', () => {
    const fav = fairImpliedPct(-200, 170);
    expect(fav).toBeGreaterThan(50);
  });
});

describe('confidence', () => {
  it('labels by score', () => {
    expect(confidenceLabel(70)).toBe('high');
    expect(confidenceLabel(50)).toBe('medium');
    expect(confidenceLabel(20)).toBe('low');
  });

  it('is capped by data quality', () => {
    const thin = calculateConfidence(9, 65, 0.2);
    const rich = calculateConfidence(9, 65, 1);
    expect(rich).toBeGreaterThan(thin);
    expect(thin).toBeLessThanOrEqual(60); // ceiling 0.5 + 0.5*0.2 = 0.6
  });

  it('grows with edge size', () => {
    const small = calculateConfidence(2, 55, 1);
    const big = calculateConfidence(9, 55, 1);
    expect(big).toBeGreaterThan(small);
  });
});

describe('evaluateDecision', () => {
  it('forces no-bet on thin data regardless of edge', () => {
    const d = evaluateDecision({ modelProbabilityPct: 70, dataCompleteness: 0.3 });
    expect(d.recommendation).toBe('no-bet');
    expect(d.confidence).toBeLessThanOrEqual(44);
  });

  it('no-bet when edge is below threshold', () => {
    // -110/-110 fair line is 50%; model 51% => +1% edge, under 3% threshold
    const d = evaluateDecision({ modelProbabilityPct: 51, dataCompleteness: 1 });
    expect(d.recommendation).toBe('no-bet');
  });

  it('bet when edge clears threshold', () => {
    const d = evaluateDecision({ modelProbabilityPct: 58, dataCompleteness: 1 });
    expect(d.recommendation).toBe('bet');
    expect(d.edgePct).toBeGreaterThan(3);
    expect(d.summary).toMatch(/possible edge/i);
  });

  it('pass when the model disfavors the side', () => {
    const d = evaluateDecision({ modelProbabilityPct: 42, dataCompleteness: 1 });
    expect(d.recommendation).toBe('pass');
  });

  it('uses supplied odds to de-vig the fair line', () => {
    // Heavy juice on the side raises the fair line, shrinking the edge.
    const cheap = evaluateDecision({ modelProbabilityPct: 58, sideOdds: 100, otherSideOdds: -120, dataCompleteness: 1 });
    const juiced = evaluateDecision({ modelProbabilityPct: 58, sideOdds: -200, otherSideOdds: 170, dataCompleteness: 1 });
    expect(juiced.fairImpliedPct).toBeGreaterThan(cheap.fairImpliedPct);
    expect(juiced.edgePct).toBeLessThan(cheap.edgePct);
  });

  it('bet confidence exceeds no-bet confidence for same inputs class', () => {
    const bet = evaluateDecision({ modelProbabilityPct: 62, dataCompleteness: 1 });
    const nobet = evaluateDecision({ modelProbabilityPct: 51, dataCompleteness: 1 });
    expect(bet.confidence).toBeGreaterThan(nobet.confidence);
  });
});

describe('dataCompletenessFrom', () => {
  it('returns 1 when there are no optional inputs', () => {
    expect(dataCompletenessFrom(0, 0)).toBe(1);
  });

  it('scales from 0.6 (none) to 1.0 (all)', () => {
    expect(dataCompletenessFrom(0, 4)).toBeCloseTo(0.6, 5);
    expect(dataCompletenessFrom(2, 4)).toBeCloseTo(0.8, 5);
    expect(dataCompletenessFrom(4, 4)).toBeCloseTo(1, 5);
  });
});
