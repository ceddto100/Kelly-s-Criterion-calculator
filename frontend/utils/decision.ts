/**
 * Shared Decision Layer (frontend)
 * ================================
 * Client mirror of mcp-server/src/utils/decision.ts so the football/basketball/
 * hockey results can show the same disciplined recommendation (edge vs a fair
 * line, bet/pass/no-bet, confidence) the backend produces. Keep in sync with the
 * backend module. Follows the existing pattern of mirroring math client-side
 * (see utils/nhlProjection.ts, utils/mlbProjection.ts).
 */

export const DECISION_CONFIG = {
  minEdgePct: 3,
  minDataCompleteness: 0.5,
  confidenceWeights: { edge: 0.4, agreement: 0.3, dataQuality: 0.3 },
  edgeStrengthFullPct: 9,
  labels: { high: 65, medium: 45 },
};

export const STANDARD_VIG_ODDS = -110;

export type DecisionLean = 'bet' | 'pass' | 'no-bet';
export type ConfidenceLabel = 'low' | 'medium' | 'high';

export interface DecisionResult {
  fairImpliedPct: number;
  edgePct: number;
  recommendation: DecisionLean;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
  summary: string;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function impliedProbabilityPct(americanOdds: number): number {
  return americanOdds > 0
    ? (100 / (americanOdds + 100)) * 100
    : (Math.abs(americanOdds) / (Math.abs(americanOdds) + 100)) * 100;
}

export function fairImpliedPct(sideOdds: number, otherSideOdds: number): number {
  const a = impliedProbabilityPct(sideOdds);
  const b = impliedProbabilityPct(otherSideOdds);
  const total = a + b;
  if (total <= 0) return a;
  return (a / total) * 100;
}

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= DECISION_CONFIG.labels.high) return 'high';
  if (score >= DECISION_CONFIG.labels.medium) return 'medium';
  return 'low';
}

export function calculateConfidence(
  edgePct: number,
  modelProbabilityPct: number,
  dataCompleteness: number,
): number {
  const w = DECISION_CONFIG.confidenceWeights;
  const edgeStrength = clamp(Math.abs(edgePct) / DECISION_CONFIG.edgeStrengthFullPct, 0, 1);
  const agreement = clamp(Math.abs(modelProbabilityPct - 50) / 15, 0, 1);
  const dataQuality = clamp(dataCompleteness, 0, 1);
  const raw = w.edge * edgeStrength + w.agreement * agreement + w.dataQuality * dataQuality;
  const ceiling = 0.5 + 0.5 * dataQuality;
  return Math.round(clamp(raw, 0, 1) * ceiling * 100);
}

export interface DecisionInput {
  modelProbabilityPct: number;
  sideOdds?: number;
  otherSideOdds?: number;
  dataCompleteness: number;
}

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
    summary = 'No-bet: not enough input data to trust this projection. A disciplined pass is the smart result.';
  } else if (edgePct < -DECISION_CONFIG.minEdgePct) {
    recommendation = 'pass';
    summary = `Pass: the model projects ${input.modelProbabilityPct.toFixed(1)}% vs a ${fairPct.toFixed(1)}% fair line — the price is against this side.`;
  } else if (Math.abs(edgePct) < DECISION_CONFIG.minEdgePct) {
    recommendation = 'no-bet';
    summary = `No-bet: only a ${edgePct.toFixed(1)}% edge vs the fair line — too close to claim value. Bankroll discipline says wait.`;
  } else {
    recommendation = 'bet';
    summary = `Possible edge: model ${input.modelProbabilityPct.toFixed(1)}% vs ${fairPct.toFixed(1)}% fair line (+${edgePct.toFixed(1)}%). Model projection, not a guaranteed result.`;
  }

  return {
    fairImpliedPct: Math.round(fairPct * 10) / 10,
    edgePct: Math.round(edgePct * 10) / 10,
    recommendation: recommendation,
    confidence: recommendation === 'bet' ? confidence : Math.min(confidence, 44),
    confidenceLabel: confidenceLabel(recommendation === 'bet' ? confidence : 0),
    summary,
  };
}

export function dataCompletenessFrom(optionalPresent: number, optionalTotal: number): number {
  if (optionalTotal <= 0) return 1;
  return clamp(0.6 + 0.4 * (optionalPresent / optionalTotal), 0, 1);
}
