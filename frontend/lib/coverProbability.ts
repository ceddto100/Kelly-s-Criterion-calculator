// /lib/coverProbability.ts
// Thin wrapper around the football/basketball models so your UI can import
// A single helper regardless of sport.

import { coverProbabilityNFL, type NFLInputs } from "./coverProbabilityNFL";
import {
  coverProbabilityNBA_Base,
  coverProbabilityNBA_Hybrid,
  sigmaFromNBATotal,
  type NBABaseInputs,
  type NBAHybridInputs,
} from "./coverProbabilityNBA";

export type Sport = "football" | "basketball";

/** Estimate for FOOTBALL (deterministic normal-CDF model). */
export function estimateFootball(inputs: NFLInputs) {
  return coverProbabilityNFL(inputs);
}

/**
 * Estimate for BASKETBALL.
 * Set `useHybrid=true` to include FG% / Rebound / Turnover tilts.
 * Use `useHybrid=false` to stick to points-for/allowed only.
 */
export function estimateBasketball(
  inputs: NBABaseInputs | NBAHybridInputs,
  useHybrid: boolean = true
) {
  return useHybrid
    ? coverProbabilityNBA_Hybrid(inputs as NBAHybridInputs)
    : coverProbabilityNBA_Base(inputs as NBABaseInputs);
}

/** Optional helper: scale σ from market total if you have it. */
export { sigmaFromNBATotal };

/** Convenience default export (optional). */
export default {
  estimateFootball,
  estimateBasketball,
  sigmaFromNBATotal,
};
