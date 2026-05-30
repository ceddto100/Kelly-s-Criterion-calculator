/**
 * Shared Decision-Layer Configuration
 * -----------------------------------
 * Thresholds and weights that turn a raw model probability/projection into a
 * disciplined recommendation (edge, lean, confidence, no-bet). Centralized so
 * every sport behaves consistently and the discipline can be tuned/backtested
 * without touching sport math. No magic numbers in the decision code itself.
 *
 * MLB has its own tuned constants in config/mlbConfig.ts (run-scale market);
 * this file governs the point-spread (football/basketball) and goal-total
 * (hockey) markets that share the cover/over probability model.
 */

/** Default sportsbook price for a standard spread/total (-110 both sides). */
export const STANDARD_VIG_ODDS = -110;

export const DECISION_CONFIG = {
  /**
   * Minimum probability edge (model cover% minus the vig-free implied%) required
   * to lean on a bet. Below this the price already reflects the projection.
   * Expressed in probability points (e.g. 3 = 3%).
   */
  minEdgePct: 3,

  /**
   * Data completeness (0-1) below which we force no-bet regardless of edge,
   * because the projection rests on too few inputs to trust.
   */
  minDataCompleteness: 0.5,

  /**
   * Confidence blend weights (sum to 1.0). Confidence is NOT just edge size:
   *   - edge:        how large the probability edge is
   *   - agreement:   how decisively the model separates from a coin flip
   *   - dataQuality: input completeness
   */
  confidenceWeights: {
    edge: 0.4,
    agreement: 0.3,
    dataQuality: 0.3,
  },

  /** Edge (in %) that maps to a "full strength" edge component (=1.0). */
  edgeStrengthFullPct: 9,

  /** Confidence label cutoffs (0-100). */
  labels: {
    high: 65,
    medium: 45,
  },
} as const;
