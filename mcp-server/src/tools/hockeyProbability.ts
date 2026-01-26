/**
 * NHL Hockey Over/Under Probability Estimation Tool
 *
 * This module implements the 4-step NHL projection algorithm for estimating the probability
 * that a hockey game will go over or under a given total goals line. The algorithm uses
 * advanced hockey analytics including expected goals (xG), goaltender performance (GSAx),
 * pace indicators (HDCF), and special teams metrics to project game totals.
 *
 * TOOL: estimate_hockey_probability
 * Calculates the probability that an NHL game will go over or under a specified total goals line
 * using a sophisticated 4-step algorithm:
 *
 * Step A - Base Score Calculation:
 *   Home_Score = ((Home_xGF60 + Away_xGA60) / 2) - Away_GSAx60
 *   Away_Score = ((Away_xGF60 + Home_xGA60) / 2) - Home_GSAx60
 *
 * Step B - Pace Adjustment:
 *   IF (Home_HDCF60 + Away_HDCF60) > 25 THEN add +0.25 to total
 *
 * Step C - Special Teams Mismatch:
 *   Home advantage: IF (Home_PP + (100 - Away_PK)) * Away_TimesShorthanded > 150 THEN +0.35
 *   Away advantage: IF (Away_PP + (100 - Home_PK)) * Home_TimesShorthanded > 150 THEN +0.35
 *
 * Step D - Probability Calculation:
 *   Standard Deviation = sqrt(Projected Total) [Poisson-like variance]
 *   Z-Score = (Projected Total - Line) / Standard Deviation
 *   Over Probability = (1 - CDF(Z)) * 100
 *
 * The tool requires 7 statistics for each team (14 total):
 * - xGF60: Expected Goals For per 60 minutes
 * - xGA60: Expected Goals Against per 60 minutes
 * - GSAx60: Goalie Goals Saved Above Expected per 60
 * - HDCF60: High Danger Chances For per 60 (pace indicator)
 * - PP: Power Play Percentage (0-100)
 * - PK: Penalty Kill Percentage (0-100)
 * - timesShorthandedPerGame: Average times shorthanded per game
 *
 * The response includes projected scores for each team, total projected goals, pace and special
 * teams adjustments applied, standard deviation used, z-score, and both over and under probabilities.
 * An interpretation categorizes the bet quality based on the calculated probability.
 */

import { z } from 'zod';
import { normCdf } from '../utils/calculations.js';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface NHLTeamStats {
  xGF60: number;           // Expected Goals For per 60 minutes
  xGA60: number;           // Expected Goals Against per 60 minutes
  GSAx60: number;          // Goalie Goals Saved Above Expected per 60
  HDCF60: number;          // High Danger Chances For per 60 (Pace indicator)
  PP: number;              // Power Play Percentage (0-100)
  PK: number;              // Penalty Kill Percentage (0-100)
  timesShorthandedPerGame: number;  // Average times shorthanded per game
}

export interface NHLProjectionResult {
  homeScore: number;
  awayScore: number;
  projectedTotal: number;
  paceAdjustment: number;
  specialTeamsAdjustment: number;
  standardDeviation: number;
  zScore: number;
  overProbability: number;
  underProbability: number;
}

// ============================================================================
// NHL PROJECTION CALCULATION
// ============================================================================

/**
 * Calculate NHL game projection and over/under probability
 * Implements the 4-step algorithm for NHL totals
 */
export function calculateNHLProjection(
  home: NHLTeamStats,
  away: NHLTeamStats,
  line: number
): NHLProjectionResult {
  // ========================================================================
  // STEP A: Base Score Calculation
  // ========================================================================
  const homeScore = ((home.xGF60 + away.xGA60) / 2) - away.GSAx60;
  const awayScore = ((away.xGF60 + home.xGA60) / 2) - home.GSAx60;

  // ========================================================================
  // STEP B: Pace Adjustment
  // ========================================================================
  const combinedHDCF = home.HDCF60 + away.HDCF60;
  const paceAdjustment = combinedHDCF > 25 ? 0.25 : 0;

  // ========================================================================
  // STEP C: Special Teams Mismatch
  // ========================================================================
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
  // STEP D: Final Totals and Probability
  // ========================================================================
  const projectedTotal = homeScore + awayScore + paceAdjustment + specialTeamsAdjustment;

  // Poisson-like variance: standard deviation = sqrt(mean)
  const standardDeviation = Math.sqrt(projectedTotal);
  const zScore = (projectedTotal - line) / standardDeviation;

  // 1 - CDF gives probability of OVER
  const overProbability = (1 - normCdf(zScore)) * 100;
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
// INPUT SCHEMAS
// ============================================================================

const nhlTeamStatsSchema = z.object({
  name: z.string().describe('Team name'),
  xGF60: z.number().describe('Expected Goals For per 60 minutes (e.g., 2.85)'),
  xGA60: z.number().describe('Expected Goals Against per 60 minutes (e.g., 2.65)'),
  GSAx60: z.number().describe('Goalie Goals Saved Above Expected per 60 (e.g., 0.15, can be negative)'),
  HDCF60: z.number().describe('High Danger Chances For per 60 - pace indicator (e.g., 12.5)'),
  PP: z.number().min(0).max(100).describe('Power Play Percentage (0-100, e.g., 22.5 for 22.5%)'),
  PK: z.number().min(0).max(100).describe('Penalty Kill Percentage (0-100, e.g., 80.5 for 80.5%)'),
  timesShorthandedPerGame: z.number().describe('Average times shorthanded per game (e.g., 3.2)')
});

export const hockeyProbabilityInputSchema = z.object({
  homeTeam: nhlTeamStatsSchema.describe('Statistics for the home team'),
  awayTeam: nhlTeamStatsSchema.describe('Statistics for the away team'),
  line: z.number().describe('The over/under total goals line (e.g., 6.5)'),
  betType: z.enum(['over', 'under']).describe('Whether betting on over or under the line')
});

export type HockeyProbabilityInput = z.infer<typeof hockeyProbabilityInputSchema>;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const hockeyProbabilityToolDefinition = {
  name: 'estimate_hockey_probability',
  description: `Calculate NHL over/under probability using team stats (xG, GSAx, HDCF, PP%, PK%) and a total goals line. Returns projected total, over/under probabilities, and bet quality interpretation.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      homeTeam: {
        type: 'object',
        description: 'Statistics for the home team (7 metrics)',
        properties: {
          name: { type: 'string', description: 'Team name' },
          xGF60: { type: 'number', description: 'Expected Goals For per 60 minutes' },
          xGA60: { type: 'number', description: 'Expected Goals Against per 60 minutes' },
          GSAx60: { type: 'number', description: 'Goalie Goals Saved Above Expected per 60' },
          HDCF60: { type: 'number', description: 'High Danger Chances For per 60 (pace indicator)' },
          PP: { type: 'number', description: 'Power Play Percentage (0-100)' },
          PK: { type: 'number', description: 'Penalty Kill Percentage (0-100)' },
          timesShorthandedPerGame: { type: 'number', description: 'Average times shorthanded per game' }
        },
        required: ['name', 'xGF60', 'xGA60', 'GSAx60', 'HDCF60', 'PP', 'PK', 'timesShorthandedPerGame']
      },
      awayTeam: {
        type: 'object',
        description: 'Statistics for the away team (7 metrics)',
        properties: {
          name: { type: 'string', description: 'Team name' },
          xGF60: { type: 'number', description: 'Expected Goals For per 60 minutes' },
          xGA60: { type: 'number', description: 'Expected Goals Against per 60 minutes' },
          GSAx60: { type: 'number', description: 'Goalie Goals Saved Above Expected per 60' },
          HDCF60: { type: 'number', description: 'High Danger Chances For per 60 (pace indicator)' },
          PP: { type: 'number', description: 'Power Play Percentage (0-100)' },
          PK: { type: 'number', description: 'Penalty Kill Percentage (0-100)' },
          timesShorthandedPerGame: { type: 'number', description: 'Average times shorthanded per game' }
        },
        required: ['name', 'xGF60', 'xGA60', 'GSAx60', 'HDCF60', 'PP', 'PK', 'timesShorthandedPerGame']
      },
      line: {
        type: 'number',
        description: 'The over/under total goals line (e.g., 6.5)'
      },
      betType: {
        type: 'string',
        enum: ['over', 'under'],
        description: 'Whether betting on over or under the line'
      }
    },
    required: ['homeTeam', 'awayTeam', 'line', 'betType']
  }
};

// ============================================================================
// HANDLER
// ============================================================================

export interface HockeyProbabilityOutput {
  success: boolean;
  sport: 'hockey';
  league: 'NHL';
  matchup: {
    homeTeam: string;
    awayTeam: string;
    line: number;
    betType: 'over' | 'under';
  };
  projection: {
    homeScore: number;
    awayScore: number;
    projectedTotal: number;
    paceAdjustment: number;
    specialTeamsAdjustment: number;
  };
  result: {
    probability: number;
    overProbability: number;
    underProbability: number;
    standardDeviation: number;
    zScore: number;
  };
  interpretation: string;
}

function getHockeyInterpretation(probability: number, betType: 'over' | 'under', line: number, projectedTotal: number): string {
  const direction = betType === 'over' ? 'OVER' : 'UNDER';
  const diff = Math.abs(projectedTotal - line);
  const diffText = diff.toFixed(1);

  if (probability >= 65) {
    return `STRONG ${direction}: ${probability}% probability. Projected total (${projectedTotal}) is ${diffText} goals ${betType === 'over' ? 'above' : 'below'} the line. Good value bet.`;
  } else if (probability >= 55) {
    return `FAVORABLE ${direction}: ${probability}% probability. Projected total suggests a slight edge on the ${direction.toLowerCase()}.`;
  } else if (probability >= 45) {
    return `COIN FLIP: ${probability}% probability. The ${direction.toLowerCase()} ${line} is essentially even odds.`;
  } else if (probability >= 35) {
    return `UNFAVORABLE: ${probability}% probability. The ${direction.toLowerCase()} ${line} is risky.`;
  } else {
    return `POOR VALUE: ${probability}% probability. The ${direction.toLowerCase()} ${line} is not recommended.`;
  }
}

export async function handleHockeyProbability(input: unknown): Promise<HockeyProbabilityOutput> {
  const parsed = hockeyProbabilityInputSchema.parse(input);

  const homeStats: NHLTeamStats = {
    xGF60: parsed.homeTeam.xGF60,
    xGA60: parsed.homeTeam.xGA60,
    GSAx60: parsed.homeTeam.GSAx60,
    HDCF60: parsed.homeTeam.HDCF60,
    PP: parsed.homeTeam.PP,
    PK: parsed.homeTeam.PK,
    timesShorthandedPerGame: parsed.homeTeam.timesShorthandedPerGame
  };

  const awayStats: NHLTeamStats = {
    xGF60: parsed.awayTeam.xGF60,
    xGA60: parsed.awayTeam.xGA60,
    GSAx60: parsed.awayTeam.GSAx60,
    HDCF60: parsed.awayTeam.HDCF60,
    PP: parsed.awayTeam.PP,
    PK: parsed.awayTeam.PK,
    timesShorthandedPerGame: parsed.awayTeam.timesShorthandedPerGame
  };

  const result = calculateNHLProjection(homeStats, awayStats, parsed.line);

  // Return the probability for the selected bet type
  const probability = parsed.betType === 'over' ? result.overProbability : result.underProbability;

  return {
    success: true,
    sport: 'hockey',
    league: 'NHL',
    matchup: {
      homeTeam: parsed.homeTeam.name,
      awayTeam: parsed.awayTeam.name,
      line: parsed.line,
      betType: parsed.betType
    },
    projection: {
      homeScore: result.homeScore,
      awayScore: result.awayScore,
      projectedTotal: result.projectedTotal,
      paceAdjustment: result.paceAdjustment,
      specialTeamsAdjustment: result.specialTeamsAdjustment
    },
    result: {
      probability,
      overProbability: result.overProbability,
      underProbability: result.underProbability,
      standardDeviation: result.standardDeviation,
      zScore: result.zScore
    },
    interpretation: getHockeyInterpretation(probability, parsed.betType, parsed.line, result.projectedTotal)
  };
}
