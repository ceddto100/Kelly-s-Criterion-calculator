/**
 * Odds Conversion Tools
 * Convert between American, Decimal, and Fractional odds formats
 */

import { z } from 'zod';
import {
  americanToDecimal,
  decimalToAmerican,
  fractionalToDecimal,
  decimalToFractional,
  impliedProbability,
  calculateVig
} from '../utils/calculations.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const convertOddsInputSchema = z.object({
  odds: z
    .number()
    .describe('The odds value to convert'),

  fromFormat: z
    .enum(['american', 'decimal', 'fractional'])
    .describe('Source odds format'),

  toFormat: z
    .enum(['american', 'decimal', 'fractional', 'all'])
    .default('all')
    .describe('Target odds format (or "all" for all formats)'),

  // For fractional input
  denominator: z
    .number()
    .positive()
    .optional()
    .describe('Denominator for fractional odds (e.g., 2 for 5/2 odds)')
});

export const calculateVigInputSchema = z.object({
  odds1: z
    .number()
    .describe('American odds for option 1 (e.g., -110)'),

  odds2: z
    .number()
    .describe('American odds for option 2 (e.g., -110)')
});

export const impliedProbabilityInputSchema = z.object({
  americanOdds: z
    .number()
    .describe('American format odds to calculate implied probability for')
});

export type ConvertOddsInput = z.infer<typeof convertOddsInputSchema>;
export type CalculateVigInput = z.infer<typeof calculateVigInputSchema>;
export type ImpliedProbabilityInput = z.infer<typeof impliedProbabilityInputSchema>;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const convertOddsToolDefinition = {
  name: 'convert_odds',
  description: `Convert betting odds between different formats.

Supported formats:
- American: +150, -110 (positive = underdog, negative = favorite)
- Decimal: 2.50, 1.91 (payout per unit bet, including stake)
- Fractional: 3/2, 10/11 (profit per unit bet)

Can convert to a specific format or get all formats at once.

Examples:
- American +150 = Decimal 2.50 = Fractional 3/2
- American -110 = Decimal 1.91 = Fractional 10/11`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      odds: {
        type: 'number',
        description: 'The odds value to convert'
      },
      fromFormat: {
        type: 'string',
        enum: ['american', 'decimal', 'fractional'],
        description: 'Source odds format'
      },
      toFormat: {
        type: 'string',
        enum: ['american', 'decimal', 'fractional', 'all'],
        description: 'Target format or "all" for all formats',
        default: 'all'
      },
      denominator: {
        type: 'number',
        description: 'Denominator for fractional odds input (e.g., 2 for 5/2)',
        minimum: 1
      }
    },
    required: ['odds', 'fromFormat']
  }
};

export const calculateVigToolDefinition = {
  name: 'calculate_vig',
  description: `Calculate the vigorish (vig/juice) on a two-way betting market.

The vig is the bookmaker's profit margin built into the odds.
Standard vig is around 4.5% (e.g., -110/-110).

Input both sides' American odds to calculate the total vig percentage.

Example: -110/-110 = 4.55% vig`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      odds1: {
        type: 'number',
        description: 'American odds for option 1 (e.g., -110)'
      },
      odds2: {
        type: 'number',
        description: 'American odds for option 2 (e.g., -110)'
      }
    },
    required: ['odds1', 'odds2']
  }
};

export const impliedProbabilityToolDefinition = {
  name: 'calculate_implied_probability',
  description: `Calculate the implied probability from American odds.

The implied probability is the bookmaker's estimated chance of an outcome, including their margin.

Compare your estimated probability to the implied probability to find value bets.

Examples:
- -110 odds = 52.4% implied probability
- +150 odds = 40% implied probability`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      americanOdds: {
        type: 'number',
        description: 'American format odds'
      }
    },
    required: ['americanOdds']
  }
};

// ============================================================================
// HANDLERS
// ============================================================================

export async function handleConvertOdds(input: unknown): Promise<ConvertOddsOutput> {
  const parsed = convertOddsInputSchema.parse(input);

  let decimalOdds: number;

  // Convert input to decimal first
  switch (parsed.fromFormat) {
    case 'american':
      decimalOdds = americanToDecimal(parsed.odds);
      break;
    case 'decimal':
      decimalOdds = parsed.odds;
      break;
    case 'fractional':
      if (!parsed.denominator) {
        throw new Error('Denominator is required for fractional odds');
      }
      decimalOdds = fractionalToDecimal(parsed.odds, parsed.denominator);
      break;
    default:
      throw new Error(`Unknown format: ${parsed.fromFormat}`);
  }

  // Validate decimal odds
  if (decimalOdds <= 1) {
    throw new Error('Invalid odds: decimal odds must be greater than 1');
  }

  // Convert to all formats
  const american = decimalToAmerican(decimalOdds);
  const fractional = decimalToFractional(decimalOdds);
  const implied = impliedProbability(american);

  const result: ConvertOddsOutput = {
    success: true,
    input: {
      odds: parsed.odds,
      format: parsed.fromFormat,
      denominator: parsed.denominator
    },
    conversions: {
      american,
      decimal: Math.round(decimalOdds * 1000) / 1000,
      fractional: `${fractional.numerator}/${fractional.denominator}`,
      impliedProbability: Math.round(implied * 100) / 100
    }
  };

  // Add specific conversion if requested
  if (parsed.toFormat !== 'all') {
    switch (parsed.toFormat) {
      case 'american':
        result.converted = american;
        break;
      case 'decimal':
        result.converted = Math.round(decimalOdds * 1000) / 1000;
        break;
      case 'fractional':
        result.converted = `${fractional.numerator}/${fractional.denominator}`;
        break;
    }
  }

  return result;
}

export async function handleCalculateVig(input: unknown): Promise<VigOutput> {
  const parsed = calculateVigInputSchema.parse(input);

  const vig = calculateVig(parsed.odds1, parsed.odds2);
  const prob1 = impliedProbability(parsed.odds1);
  const prob2 = impliedProbability(parsed.odds2);

  // Calculate no-vig fair odds
  const fairProb1 = (prob1 / (prob1 + prob2)) * 100;
  const fairProb2 = (prob2 / (prob1 + prob2)) * 100;

  return {
    success: true,
    odds: {
      side1: parsed.odds1,
      side2: parsed.odds2
    },
    vig: {
      percentage: Math.round(vig * 100) / 100,
      description: getVigDescription(vig)
    },
    impliedProbabilities: {
      side1: Math.round(prob1 * 100) / 100,
      side2: Math.round(prob2 * 100) / 100,
      total: Math.round((prob1 + prob2) * 100) / 100
    },
    fairProbabilities: {
      side1: Math.round(fairProb1 * 100) / 100,
      side2: Math.round(fairProb2 * 100) / 100
    }
  };
}

export async function handleImpliedProbability(input: unknown): Promise<ImpliedProbOutput> {
  const parsed = impliedProbabilityInputSchema.parse(input);

  const probability = impliedProbability(parsed.americanOdds);
  const decimal = americanToDecimal(parsed.americanOdds);

  return {
    success: true,
    americanOdds: parsed.americanOdds,
    impliedProbability: Math.round(probability * 100) / 100,
    decimalOdds: Math.round(decimal * 1000) / 1000,
    breakEvenWinRate: Math.round(probability * 100) / 100,
    interpretation: getOddsInterpretation(parsed.americanOdds, probability)
  };
}

function getVigDescription(vig: number): string {
  if (vig <= 2) {
    return 'Very low vig - excellent value';
  } else if (vig <= 4) {
    return 'Low vig - good for bettors';
  } else if (vig <= 5) {
    return 'Standard vig - typical sportsbook margin';
  } else if (vig <= 7) {
    return 'Above average vig - shop for better lines';
  } else {
    return 'High vig - consider finding better odds elsewhere';
  }
}

function getOddsInterpretation(odds: number, probability: number): string {
  if (odds > 0) {
    return `These are underdog odds. A $100 bet would win $${odds}. The market implies a ${probability.toFixed(1)}% chance of winning.`;
  } else {
    return `These are favorite odds. You need to bet $${Math.abs(odds)} to win $100. The market implies a ${probability.toFixed(1)}% chance of winning.`;
  }
}

export interface ConvertOddsOutput {
  success: boolean;
  input: {
    odds: number;
    format: string;
    denominator?: number;
  };
  conversions: {
    american: number;
    decimal: number;
    fractional: string;
    impliedProbability: number;
  };
  converted?: number | string;
}

export interface VigOutput {
  success: boolean;
  odds: {
    side1: number;
    side2: number;
  };
  vig: {
    percentage: number;
    description: string;
  };
  impliedProbabilities: {
    side1: number;
    side2: number;
    total: number;
  };
  fairProbabilities: {
    side1: number;
    side2: number;
  };
}

export interface ImpliedProbOutput {
  success: boolean;
  americanOdds: number;
  impliedProbability: number;
  decimalOdds: number;
  breakEvenWinRate: number;
  interpretation: string;
}
