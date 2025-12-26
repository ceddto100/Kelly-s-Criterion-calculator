/**
 * Kelly Criterion Calculation Tool
 *
 * This module provides the core MCP tool that implements the Kelly Criterion formula, a mathematical approach to
 * determining the optimal bet size for maximizing long-term bankroll growth while minimizing the risk of ruin. Developed
 * by John L. Kelly Jr. in 1956, the Kelly Criterion has become the gold standard for bet sizing among professional
 * gamblers and investors. The formula balances the desire to capitalize on positive expected value opportunities against
 * the need to preserve capital during inevitable losing streaks. By betting the mathematically optimal fraction of your
 * bankroll, you maximize the geometric growth rate of your capital over time.
 *
 * TOOL: kelly_calculate
 * Calculates the optimal bet size using the Kelly Criterion formula: f* = (bp - q) / b, where f* is the optimal fraction
 * of bankroll to wager, b is the decimal odds minus one (net odds), p is your estimated probability of winning, and q is
 * the probability of losing (1 - p). The tool requires four inputs: your total bankroll in USD (the capital you have
 * available for betting), your estimated win probability as a percentage (1-99%, representing your edge assessment based
 * on statistical analysis or other methods), American odds format from the sportsbook (positive for underdogs like +150,
 * negative for favorites like -110), and an optional Kelly fraction multiplier (0.1-1, default 1) for conservative bet
 * sizing. The fraction parameter is particularly important because full Kelly betting can lead to significant bankroll
 * volatility - many professional bettors use half Kelly (0.5) or quarter Kelly (0.25) to reduce variance while still
 * achieving good long-term growth. The tool returns comprehensive output including: the recommended stake amount in
 * dollars, stake as a percentage of bankroll, the full Kelly percentage and the adjusted percentage after applying the
 * fraction, a boolean indicating whether the bet has positive expected value, your edge over the bookmaker (the difference
 * between your probability and the implied probability), the bookmaker's implied probability derived from the odds,
 * decimal odds format, potential win amount and total payout. The tool also provides a human-readable recommendation that
 * interprets your edge level and suggests appropriate action - strong value bets (>10% edge) are highlighted for
 * verification, while negative expected value bets are flagged with a recommendation not to bet. The Kelly Criterion is
 * most effective when your probability estimates are accurate, so this tool should be used in conjunction with the
 * statistical probability estimation tools and careful analysis of matchups.
 */

import { z } from 'zod';
import { calculateKellyStake, americanToDecimal, impliedProbability } from '../utils/calculations.js';

// ============================================================================
// INPUT SCHEMA
// ============================================================================

export const kellyInputSchema = z.object({
  bankroll: z
    .number()
    .positive()
    .describe('Total bankroll in USD. Must be a positive number representing your betting capital.'),

  probability: z
    .number()
    .min(1)
    .max(99)
    .describe('Estimated win probability as a percentage (1-99). This is your edge assessment, not the implied probability from odds.'),

  americanOdds: z
    .number()
    .refine((val) => val !== 0 && (val >= 100 || val <= -100), {
      message: 'American odds must be +100 or higher, or -100 or lower (never 0 or between -100 and +100)'
    })
    .describe('American format odds. Positive for underdogs (+150 means win $150 on $100 bet), negative for favorites (-110 means bet $110 to win $100).'),

  fraction: z
    .number()
    .min(0.1)
    .max(1)
    .default(1)
    .describe('Kelly fraction multiplier (0.1-1). Use 1 for full Kelly, 0.5 for half Kelly (recommended for risk reduction), 0.25 for quarter Kelly.')
});

export type KellyInput = z.infer<typeof kellyInputSchema>;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const kellyToolDefinition = {
  name: 'kelly_calculate',
  description: `Calculate optimal bet size using the Kelly Criterion formula.

The Kelly Criterion determines the mathematically optimal stake size to maximize long-term bankroll growth while minimizing risk of ruin.

Formula: f* = (bp - q) / b
Where:
- f* = optimal fraction of bankroll to bet
- b = decimal odds - 1 (net odds)
- p = probability of winning
- q = probability of losing (1 - p)

Returns recommended stake, edge over bookmaker, and potential payouts.
A positive edge indicates a value bet; negative edge means the bet has negative expected value.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      bankroll: {
        type: 'number',
        description: 'Total bankroll in USD. Must be a positive number representing your betting capital.',
        minimum: 0.01
      },
      probability: {
        type: 'number',
        description: 'Estimated win probability as a percentage (1-99). This is your edge assessment, not the implied probability from odds.',
        minimum: 1,
        maximum: 99
      },
      americanOdds: {
        type: 'number',
        description: 'American format odds. Positive for underdogs (+150), negative for favorites (-110). Cannot be 0 or between -100 and +100.'
      },
      fraction: {
        type: 'number',
        description: 'Kelly fraction multiplier (0.1-1). Default is 1 (full Kelly). Use 0.5 for half Kelly (recommended), 0.25 for quarter Kelly.',
        minimum: 0.1,
        maximum: 1,
        default: 1
      }
    },
    required: ['bankroll', 'probability', 'americanOdds']
  }
};

// ============================================================================
// HANDLER
// ============================================================================

export async function handleKellyCalculation(input: unknown): Promise<KellyOutput> {
  const parsed = kellyInputSchema.parse(input);

  const result = calculateKellyStake(
    parsed.bankroll,
    parsed.probability,
    parsed.americanOdds,
    parsed.fraction
  );

  return {
    success: true,
    input: {
      bankroll: parsed.bankroll,
      probability: parsed.probability,
      americanOdds: parsed.americanOdds,
      fraction: parsed.fraction
    },
    result: {
      recommendedStake: result.recommendedStake,
      stakePercentage: result.stakePercentage,
      kellyFraction: result.kellyFraction,
      adjustedKellyFraction: result.adjustedKellyFraction,
      hasValue: result.hasValue,
      edge: result.edge,
      impliedProbability: result.impliedProbability,
      decimalOdds: result.decimalOdds,
      potentialWin: result.potentialWin,
      potentialPayout: result.potentialPayout
    },
    recommendation: getRecommendation(result.edge, result.hasValue, result.stakePercentage)
  };
}

function getRecommendation(edge: number, hasValue: boolean, stakePercentage: number): string {
  if (!hasValue) {
    return 'NO BET RECOMMENDED: Negative expected value. Your probability estimate is lower than the implied probability from the odds.';
  }

  if (edge > 10) {
    return `STRONG VALUE: ${edge.toFixed(1)}% edge. Consider betting ${stakePercentage.toFixed(1)}% of bankroll. Verify your probability estimate is accurate.`;
  } else if (edge > 5) {
    return `GOOD VALUE: ${edge.toFixed(1)}% edge. Recommended stake: ${stakePercentage.toFixed(1)}% of bankroll.`;
  } else if (edge > 2) {
    return `MODERATE VALUE: ${edge.toFixed(1)}% edge. Consider half Kelly to reduce variance.`;
  } else {
    return `SLIGHT VALUE: ${edge.toFixed(1)}% edge. Small edge - consider quarter Kelly or passing on this bet.`;
  }
}

export interface KellyOutput {
  success: boolean;
  input: {
    bankroll: number;
    probability: number;
    americanOdds: number;
    fraction: number;
  };
  result: {
    recommendedStake: number;
    stakePercentage: number;
    kellyFraction: number;
    adjustedKellyFraction: number;
    hasValue: boolean;
    edge: number;
    impliedProbability: number;
    decimalOdds: number;
    potentialWin: number;
    potentialPayout: number;
  };
  recommendation: string;
}
