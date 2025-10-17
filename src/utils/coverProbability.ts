export interface CoverProbabilityInput {
  spread: number;
  projectedMargin: number;
  standardDeviation?: number;
}

export interface CoverProbabilityResult extends Record<string, unknown> {
  probability: number;
  zScore: number;
  details: {
    spread: number;
    projectedMargin: number;
    standardDeviation: number;
  };
}

const DEFAULT_STD_DEV = 13.5; // based on historical NFL margin of victory distribution

const erf = (x: number): number => {
  // Numerical approximation of the error function
  const sign = x >= 0 ? 1 : -1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const absX = Math.abs(x);
  const t = 1 / (1 + p * absX);
  const y = 1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absX * absX);

  return sign * y;
};

const cumulativeNormal = (x: number): number => {
  return 0.5 * (1 + erf(x / Math.SQRT2));
};

export const calculateCoverProbability = (
  input: CoverProbabilityInput
): CoverProbabilityResult => {
  const standardDeviation = input.standardDeviation ?? DEFAULT_STD_DEV;
  const zScore = (input.projectedMargin - input.spread) / standardDeviation;
  const probability = cumulativeNormal(zScore);

  return {
    probability,
    zScore,
    details: {
      spread: input.spread,
      projectedMargin: input.projectedMargin,
      standardDeviation,
    },
  };
};

export default calculateCoverProbability;
