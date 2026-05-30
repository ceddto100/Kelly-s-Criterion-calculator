/**
 * Shared Decision Layer
 * =====================
 * Turns a raw model output (cover% for spreads, over% for totals) into the same
 * disciplined recommendation shape MLB produces: edge vs the book line, a
 * lean (or no-bet), a blended confidence score, plus driver and risk hooks.
 *
 * This is sport-agnostic: football/basketball pass a cover probability and the
 * spread; hockey passes an over probability and the total. The math is the
 * same — compare the model's probability for a side against the vig-free implied
 * probability of that side, and require a minimum edge to fire.
 *
 * Pure functions only — deterministic, no I/O, fully unit-testable.
 */

import { DECISION_CONFIG, STANDARD_VIG_ODDS } from '../config/decisionConfig.js';

// ---------------------------------------------------------------------------
// Odds helpers
// ---------------------------------------------------------------------------

/** American odds -> implied probability as a percentage (0-100), includes vig. */
export function impliedProbabilityPct(americanOdds: number): number {
  return americanOdds > 0
    ? (100 / (americanOdds + 100)) * 100
    : (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100;
}

/**
 * Vig-free implied probability for one side of a two-way market, in %.
 * When both sides are priced the same (e.g. -110/-110) this de-vigs to a clean
 * baseline (e.g. 50%). If only one price is known, we de-vig against its mirror.
 */
export function fairImpliedPct(sideOdds: number, otherSideOdds: number): number {
  const a = impliedProbabilityPct(sideOdds);
  const b = impliedProbabilityPct(otherSideOdds);
  const total = a + b;
  if (total <= 0) return a;
  return (a / total) * 100;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DecisionLean = 'bet' | 'pass' | 'no-bet';
export type ConfidenceLabel = 'low' | 'medium' | 'high';

export interface DecisionInput {
  /** Model probability (0-100) that the chosen side hits (cover% or over%). */
  modelProbabilityPct: number;
  /**
   * Sportsbook price for the chosen side (American odds). Defaults to the
   * standard -110 spread/total price when the caller doesn't supply a line.
   */
  sideOdds?: number;
  /** Sportsbook price for the opposite side, used to de-vig. Defaults to -110. */
  otherSideOdds?: number;
  /** 0-1 completeness of the inputs that fed the model. */
  dataCompleteness: number;
}

export interface DecisionResult {
  /** Vig-free implied probability of the chosen side (%). */
  fairImpliedPct: number;
  /** Model probability minus fair implied probability (percentage points). */
  edgePct: number;
  /** Whether the edge clears the discipline thresholds. */
  recommendation: DecisionLean;
  /** 0-100 blended confidence (edge + decisiveness + data quality). */
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  /** Human-readable, non-hype explanation of the decision. */
  summary: string;
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= DECISION_CONFIG.labels.high) return 'high';
  if (score >= DECISION_CONFIG.labels.medium) return 'medium';
  return 'low';
}

/**
 * Blend edge size, how decisively the model leaves a coin flip, and data
 * quality into a 0-100 confidence. Data quality also acts as a hard ceiling so
 * a big edge on thin inputs can never read as high confidence.
 */
export function calculateConfidence(
  edgePct: number,
  modelProbabilityPct: number,
  dataCompleteness: number,
): number {
  const w = DECISION_CONFIG.confidenceWeights;
  const edgeStrength = clamp(Math.abs(edgePct) / DECISION_CONFIG.edgeStrengthFullPct, 0, 1);
  // Decisiveness: distance of the model prob from 50% (coin flip), scaled so
  // ~65%+ reads as fully decisive.
  const agreement = clamp(Math.abs(modelProbabilityPct - 50) / 15, 0, 1);
  const dataQuality = clamp(dataCompleteness, 0, 1);

  const raw = w.edge * edgeStrength + w.agreement * agreement + w.dataQuality * dataQuality;
  const ceiling = 0.5 + 0.5 * dataQuality;
  return Math.round(clamp(raw, 0, 1) * ceiling * 100);
}

// ---------------------------------------------------------------------------
// Main decision
// ---------------------------------------------------------------------------

/**
 * Evaluate a single side of a market and return the disciplined recommendation.
 * `bet` means the edge clears thresholds; `no-bet` means data is too thin or the
 * edge is too small; `pass` means the model actually disfavors the side.
 */
export function evaluateDecision(input: DecisionInput): DecisionResult {
  const sideOdds = input.sideOdds ?? STANDARD_VIG_ODDS;
  const otherOdds = input.otherSideOdds ?? STANDARD_VIG_ODDS;
  const fairPct = fairImpliedPct(sideOdds, otherOdds);
  const edgePct = input.modelProbabilityPct - fairPct;
  const confidence = calculateConfidence(edgePct, input.modelProbabilityPct, input.dataCompleteness);

  let recommendation: DecisionLean;
  let summary: string;

  if (input.dataCompleteness < DECISION_CONFIG.minDataCompleteness) {
    recommendation = 'no-bet';
    summary =
      'No-bet: not enough input data to trust this projection. A disciplined pass is the smart result.';
  } else if (edgePct < -DECISION_CONFIG.minEdgePct) {
    recommendation = 'pass';
    summary = `Pass: the model projects ${input.modelProbabilityPct.toFixed(1)}% vs a ${fairPct.toFixed(
      1,
    )}% fair line — the price is against this side.`;
  } else if (Math.abs(edgePct) < DECISION_CONFIG.minEdgePct) {
    recommendation = 'no-bet';
    summary = `No-bet: only a ${edgePct.toFixed(
      1,
    )}% edge vs the fair line — too close to claim value. Bankroll discipline says wait.`;
  } else {
    recommendation = 'bet';
    summary = `Possible edge: model ${input.modelProbabilityPct.toFixed(1)}% vs ${fairPct.toFixed(
      1,
    )}% fair line (+${edgePct.toFixed(1)}%). Model projection, not a guaranteed result.`;
  }

  return {
    fairImpliedPct: round1(fairPct),
    edgePct: round1(edgePct),
    recommendation,
    confidence: recommendation === 'bet' ? confidence : Math.min(confidence, 44),
    confidenceLabel: confidenceLabel(recommendation === 'bet' ? confidence : 0),
    summary,
  };
}

// ---------------------------------------------------------------------------
// Data-completeness helper
// ---------------------------------------------------------------------------

/**
 * Compute a 0-1 data-completeness score from how many optional model inputs were
 * actually provided. `required` inputs are assumed present (they gate the call);
 * `optional` counts toward richer, more trustworthy projections.
 */
export function dataCompletenessFrom(optionalPresent: number, optionalTotal: number): number {
  if (optionalTotal <= 0) return 1;
  // Base of 0.6 for having the required inputs, scaling to 1.0 as optionals fill.
  return clamp(0.6 + 0.4 * (optionalPresent / optionalTotal), 0, 1);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
