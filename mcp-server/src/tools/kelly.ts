/**
 * Kelly Criterion Calculation Tool
 * Calculates optimal bet sizing using the Kelly Criterion formula
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
