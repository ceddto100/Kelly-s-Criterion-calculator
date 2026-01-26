/**
 * NHL Projection Calculations
 * Implements the 4-step algorithm for projecting NHL game totals
 * and calculating over/under probabilities using Poisson/CDF
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Stats for a single NHL team (7 metrics)
 */
export interface NHLTeamStats {
  xGF60: number;           // Expected Goals For per 60 minutes
  xGA60: number;           // Expected Goals Against per 60 minutes
  GSAx60: number;          // Goalie Goals Saved Above Expected per 60
  HDCF60: number;          // High Danger Chances For per 60 (Pace indicator)
  PP: number;              // Power Play Percentage (0-100)
  PK: number;              // Penalty Kill Percentage (0-100)
  timesShorthandedPerGame: number;  // Average times shorthanded per game
}

/**
 * Combined stats for home and away teams (14 total metrics)
 */
export interface NHLProjectionInput {
  home: NHLTeamStats;
  away: NHLTeamStats;
}

/**
 * Result of the NHL projection calculation
 */
export interface NHLProjectionResult {
  homeScore: number;           // Projected home team score
  awayScore: number;           // Projected away team score
  projectedTotal: number;      // Total projected goals
  paceAdjustment: number;      // Pace adjustment applied
  specialTeamsAdjustment: number;  // Special teams adjustment applied
  standardDeviation: number;   // Standard deviation for probability calc
  zScore: number;              // Z-score relative to the line
  overProbability: number;     // Probability of going OVER the line (0-100)
  underProbability: number;    // Probability of going UNDER the line (0-100)
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normal Cumulative Distribution Function (CDF)
 * Uses the Abramowitz-Stegun approximation for the standard normal distribution
 *
 * @param x - The z-score value
 * @returns The cumulative probability P(Z <= x) for standard normal distribution
 */
export function normalCDF(x: number): number {
  // Constants for Abramowitz-Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Handle the sign for symmetry
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);

  // Approximation formula
  const t = 1.0 / (1.0 + p * absX);
  const t2 = t * t;
  const t3 = t2 * t;
  const t4 = t3 * t;
  const t5 = t4 * t;

  const y = 1.0 - (a1 * t + a2 * t2 + a3 * t3 + a4 * t4 + a5 * t5) * Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

// ============================================================================
// MAIN PROJECTION FUNCTION
// ============================================================================

/**
 * Calculate NHL game projection and over/under probability
 *
 * Follows the exact 4-step algorithm:
 * Step A: Base Score Calculation using xGF, xGA, and goalie GSAx
 * Step B: Pace Adjustment based on combined HDCF
 * Step C: Special Teams Mismatch bonuses
 * Step D: Final totals and probability calculation
 *
 * @param stats - Combined home and away team statistics
 * @param userLine - The over/under line to calculate probability against
 * @returns Complete projection result with scores and probabilities
 */
export function calculateNHLProjection(
  stats: NHLProjectionInput,
  userLine: number
): NHLProjectionResult {
  const { home, away } = stats;

  // ========================================================================
  // STEP A: Base Score Calculation
  // ========================================================================
  // Home_Score = ((Home_xGF + Away_xGA) / 2) - Away_Goalie_GSAx
  // Away_Score = ((Away_xGF + Home_xGA) / 2) - Home_Goalie_GSAx

  const homeScore = ((home.xGF60 + away.xGA60) / 2) - away.GSAx60;
  const awayScore = ((away.xGF60 + home.xGA60) / 2) - home.GSAx60;

  // ========================================================================
  // STEP B: Pace Adjustment
  // ========================================================================
  // IF (Home_HDCF + Away_HDCF) > 25 THEN add 0.25 to Total, ELSE add 0

  const combinedHDCF = home.HDCF60 + away.HDCF60;
  const paceAdjustment = combinedHDCF > 25 ? 0.25 : 0;

  // ========================================================================
  // STEP C: Special Teams Mismatch (The "Bonus")
  // ========================================================================
  // Home Advantage: IF (Home_PP + (100 - Away_PK)) * Away_Times_Shorthanded > 150
  //                 THEN add 0.35 to Total
  // Away Advantage: IF (Away_PP + (100 - Home_PK)) * Home_Times_Shorthanded > 150
  //                 THEN add 0.35 to Total

  let specialTeamsAdjustment = 0;

  // Home team special teams advantage
  const homeSpecialTeamsScore = (home.PP + (100 - away.PK)) * away.timesShorthandedPerGame;
  if (homeSpecialTeamsScore > 150) {
    specialTeamsAdjustment += 0.35;
  }

  // Away team special teams advantage
  const awaySpecialTeamsScore = (away.PP + (100 - home.PK)) * home.timesShorthandedPerGame;
  if (awaySpecialTeamsScore > 150) {
    specialTeamsAdjustment += 0.35;
  }

  // ========================================================================
  // STEP D: Final Totals
  // ========================================================================
  // Projected Total = Home_Score + Away_Score + Pace_Adj + Special_Teams_Adj

  const projectedTotal = homeScore + awayScore + paceAdjustment + specialTeamsAdjustment;

  // ========================================================================
  // PROBABILITY ENGINE (Poisson/CDF)
  // ========================================================================
  // Standard Deviation = sqrt(Projected Total)
  // Z-Score = (Projected Total - userLine) / Standard Deviation
  // Over Probability = 1 - CDF(zScore)

  const standardDeviation = Math.sqrt(projectedTotal);
  const zScore = (projectedTotal - userLine) / standardDeviation;

  // 1 - CDF gives probability of OVER
  const overProbability = (1 - normalCDF(zScore)) * 100;
  const underProbability = 100 - overProbability;

  return {
    homeScore: Math.round(homeScore * 100) / 100,
    awayScore: Math.round(awayScore * 100) / 100,
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    paceAdjustment,
    specialTeamsAdjustment,
    standardDeviation: Math.round(standardDeviation * 1000) / 1000,
    zScore: Math.round(zScore * 1000) / 1000,
    overProbability: Math.round(overProbability * 100) / 100,
    underProbability: Math.round(underProbability * 100) / 100
  };
}

// ============================================================================
// REACT STATE INITIALIZATION HELPER
// ============================================================================

/**
 * Default initial state for NHL team stats
 * Use this with useState to initialize the 14 stats (7 home + 7 away)
 */
export const initialNHLStats: NHLProjectionInput = {
  home: {
    xGF60: 0,
    xGA60: 0,
    GSAx60: 0,
    HDCF60: 0,
    PP: 0,
    PK: 0,
    timesShorthandedPerGame: 0
  },
  away: {
    xGF60: 0,
    xGA60: 0,
    GSAx60: 0,
    HDCF60: 0,
    PP: 0,
    PK: 0,
    timesShorthandedPerGame: 0
  }
};

/**
 * Example useState hook setup for React components:
 *
 * ```typescript
 * import { useState } from 'react';
 * import {
 *   NHLProjectionInput,
 *   initialNHLStats,
 *   calculateNHLProjection
 * } from '../utils/nhlProjection';
 *
 * function NHLProjectionComponent() {
 *   // Initialize state with all 14 stats (7 for home, 7 for away)
 *   const [stats, setStats] = useState<NHLProjectionInput>(initialNHLStats);
 *   const [userLine, setUserLine] = useState<number>(6.5);
 *
 *   // Update a specific stat
 *   const updateHomeStat = (key: keyof NHLTeamStats, value: number) => {
 *     setStats(prev => ({
 *       ...prev,
 *       home: { ...prev.home, [key]: value }
 *     }));
 *   };
 *
 *   const updateAwayStat = (key: keyof NHLTeamStats, value: number) => {
 *     setStats(prev => ({
 *       ...prev,
 *       away: { ...prev.away, [key]: value }
 *     }));
 *   };
 *
 *   // Calculate projection
 *   const result = calculateNHLProjection(stats, userLine);
 *
 *   return (
 *     <div>
 *       <p>Projected Total: {result.projectedTotal}</p>
 *       <p>Over {userLine} Probability: {result.overProbability}%</p>
 *     </div>
 *   );
 * }
 * ```
 */
