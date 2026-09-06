/**
 * Bet Logging Tool
 *
 * This module provides the fundamental MCP tool for recording new bets to the MongoDB database. This is a critical
 * component of the Betgistics platform, as it creates permanent records of betting decisions that can be analyzed for
 * performance tracking, ROI calculation, and strategy refinement. Every time a user calculates a Kelly Criterion bet
 * size and decides to place the bet, this tool should be used to log all relevant details about the matchup, probability
 * assessment, Kelly calculations, and actual wager amount. The logged data forms the foundation for all historical
 * analysis and performance metrics provided by the platform.
 *
 * TOOL: log_bet
 * Creates a new bet record in the MongoDB database with comprehensive information about the betting decision. This tool
 * captures three categories of data: matchup information (sport type, team names and abbreviations, venue, point spread,
 * and optional team statistics used in analysis), probability estimation data (calculated win probability percentage,
 * expected margin of victory, bookmaker's implied probability, and edge over the bookmaker), and Kelly Criterion
 * calculations (current bankroll at time of bet, American odds format, Kelly fraction used for conservative sizing,
 * recommended stake amount, and stake as percentage of bankroll). The tool also accepts the actual wager amount if it
 * differs from the Kelly recommendation, allowing tracking of whether users followed the mathematical guidance. Users can
 * add optional notes to record their reasoning or specific factors influencing the bet, and tags for categorizing bets
 * (such as "primetime", "rivalry", "weather-dependent", etc.) for later filtering and analysis. When a bet is logged,
 * it's created with a "pending" outcome status, meaning the game hasn't been played yet. After the game concludes, the
 * update_bet_outcome tool should be used to record the actual result. The tool returns a unique bet ID that can be used
 * for future updates and queries, along with a summary of the logged bet details. This tool requires an active MongoDB
 * connection configured via the MONGODB_URI environment variable and validates all inputs to ensure data quality and
 * consistency across the betting history database.
 */

import { z } from 'zod';
import { BetLog, IBetLog } from '../models/BetLog.js';
import { ensureDatabaseConnection, isDatabaseConnected } from '../config/database.js';
import { User } from '../models/User.js';

// ============================================================================
// INPUT SCHEMA
// ============================================================================

export const logBetInputSchema = z.object({
  userId: z
    .string()
    .min(1)
    .describe('User identifier (Google ID or unique user ID)'),

  sport: z
    .enum(['football', 'basketball'])
    .describe('Sport type: football (NFL/CFB) or basketball (NBA/CBB)'),

  teamA: z.object({
    name: z.string().min(1).describe('Team A name (team being bet on)'),
    abbreviation: z.string().optional().describe('Team abbreviation (e.g., KC, LAL)'),
    stats: z.record(z.number()).optional().describe('Team statistics used for analysis')
  }).describe('Team A (the team being bet on)'),

  teamB: z.object({
    name: z.string().min(1).describe('Team B name (opponent)'),
    abbreviation: z.string().optional().describe('Team abbreviation'),
    stats: z.record(z.number()).optional().describe('Team statistics')
  }).describe('Team B (the opponent)'),

  venue: z
    .enum(['home', 'away', 'neutral'])
    .describe('Where Team A is playing'),

  pointSpread: z
    .number()
    .describe('Point spread from Team A perspective'),

  calculatedProbability: z
    .number()
    .min(0)
    .max(100)
    .describe('Calculated probability (0-100%)'),

  expectedMargin: z
    .number()
    .optional()
    .describe('Expected margin of victory'),

  impliedProbability: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe('Bookmaker implied probability'),

  edge: z
    .number()
    .optional()
    .describe('Edge over bookmaker (your probability - implied probability)'),

  bankroll: z
    .number()
    .positive()
    .describe('Total bankroll at time of bet'),

  americanOdds: z
    .number()
    .describe('American format odds'),

  kellyFraction: z
    .number()
    .refine((val) => [0.25, 0.5, 1].includes(val), {
      message: 'Kelly fraction must be 0.25, 0.5, or 1'
    })
    .describe('Kelly fraction used: 0.25 (quarter), 0.5 (half), or 1 (full)'),

  recommendedStake: z
    .number()
    .min(0)
    .describe('Kelly-recommended stake amount'),

  stakePercentage: z
    .number()
    .min(0)
    .max(100)
    .describe('Stake as percentage of bankroll'),

  actualWager: z
    .number()
    .min(0)
    .optional()
    .describe('Actual amount wagered (if different from recommended)'),

  notes: z
    .string()
    .optional()
    .describe('Additional notes about the bet'),

  tags: z
    .array(z.string())
    .optional()
    .describe('Tags for categorizing the bet (e.g., "primetime", "rivalry")')
});

export type LogBetInput = z.infer<typeof logBetInputSchema>;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const logBetToolDefinition = {
  name: 'log_bet',
  description: `Create a pending bet record with matchup info, probabilities, Kelly stake, wager, notes, and tags. Requires MONGODB_URI.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userId: {
        type: 'string',
        description: 'User identifier (Google ID or unique user ID)',
        minLength: 1
      },
      sport: {
        type: 'string',
        enum: ['football', 'basketball'],
        description: 'Sport type'
      },
      teamA: {
        type: 'object',
        description: 'Team A (the team being bet on)',
        properties: {
          name: { type: 'string', description: 'Team name' },
          abbreviation: { type: 'string', description: 'Team abbreviation' },
          stats: {
            type: 'object',
            description: 'Team statistics',
            additionalProperties: { type: 'number' }
          }
        },
        required: ['name']
      },
      teamB: {
        type: 'object',
        description: 'Team B (the opponent)',
        properties: {
          name: { type: 'string', description: 'Team name' },
          abbreviation: { type: 'string', description: 'Team abbreviation' },
          stats: {
            type: 'object',
            description: 'Team statistics',
            additionalProperties: { type: 'number' }
          }
        },
        required: ['name']
      },
      venue: {
        type: 'string',
        enum: ['home', 'away', 'neutral'],
        description: 'Where Team A is playing'
      },
      pointSpread: {
        type: 'number',
        description: 'Point spread from Team A perspective'
      },
      calculatedProbability: {
        type: 'number',
        description: 'Calculated probability (0-100%)',
        minimum: 0,
        maximum: 100
      },
      expectedMargin: {
        type: 'number',
        description: 'Expected margin of victory'
      },
      impliedProbability: {
        type: 'number',
        description: 'Bookmaker implied probability',
        minimum: 0,
        maximum: 100
      },
      edge: {
        type: 'number',
        description: 'Edge over bookmaker'
      },
      bankroll: {
        type: 'number',
        description: 'Total bankroll at time of bet',
        minimum: 0.01
      },
      americanOdds: {
        type: 'number',
        description: 'American format odds'
      },
      kellyFraction: {
        type: 'number',
        enum: [0.25, 0.5, 1],
        description: 'Kelly fraction: 0.25 (quarter), 0.5 (half), or 1 (full)'
      },
      recommendedStake: {
        type: 'number',
        description: 'Kelly-recommended stake',
        minimum: 0
      },
      stakePercentage: {
        type: 'number',
        description: 'Stake as percentage of bankroll',
        minimum: 0,
        maximum: 100
      },
      actualWager: {
        type: 'number',
        description: 'Actual amount wagered',
        minimum: 0
      },
      notes: {
        type: 'string',
        description: 'Additional notes about the bet'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorizing the bet'
      }
    },
    required: [
      'userId',
      'sport',
      'teamA',
      'teamB',
      'venue',
      'pointSpread',
      'calculatedProbability',
      'bankroll',
      'americanOdds',
      'kellyFraction',
      'recommendedStake',
      'stakePercentage'
    ]
  }
};

// ============================================================================
// HANDLER
// ============================================================================

export async function handleLogBet(input: unknown): Promise<LogBetOutput> {
  await ensureDatabaseConnection();

  if (!isDatabaseConnected()) {
    throw new Error('Database is not connected. Please ensure MONGODB_URI is configured and connection is established.');
  }

  const parsed = logBetInputSchema.parse(input);

  const user = await User.findOne({ identifier: parsed.userId });

  if (!user) {
    throw new Error('User not found. Please sign in before logging bets.');
  }

  user.lastActive = new Date();
  await user.save();

  const betLog = new BetLog({
    userId: parsed.userId,
    matchup: {
      sport: parsed.sport,
      teamA: {
        name: parsed.teamA.name,
        abbreviation: parsed.teamA.abbreviation,
        stats: parsed.teamA.stats
      },
      teamB: {
        name: parsed.teamB.name,
        abbreviation: parsed.teamB.abbreviation,
        stats: parsed.teamB.stats
      },
      venue: parsed.venue
    },
    estimation: {
      pointSpread: parsed.pointSpread,
      calculatedProbability: parsed.calculatedProbability,
      expectedMargin: parsed.expectedMargin,
      impliedProbability: parsed.impliedProbability,
      edge: parsed.edge
    },
    kelly: {
      bankroll: parsed.bankroll,
      americanOdds: parsed.americanOdds,
      kellyFraction: parsed.kellyFraction as 0.25 | 0.5 | 1,
      recommendedStake: parsed.recommendedStake,
      stakePercentage: parsed.stakePercentage
    },
    actualWager: parsed.actualWager,
    outcome: {
      result: 'pending'
    },
    notes: parsed.notes,
    tags: parsed.tags
  });

  const saved = await betLog.save();

  return {
    success: true,
    betId: saved._id.toString(),
    message: `Bet logged successfully: ${parsed.teamA.name} vs ${parsed.teamB.name}`,
    bet: {
      id: saved._id.toString(),
      matchup: `${parsed.teamA.name} vs ${parsed.teamB.name}`,
      sport: parsed.sport,
      spread: parsed.pointSpread,
      probability: parsed.calculatedProbability,
      edge: parsed.edge,
      recommendedStake: parsed.recommendedStake,
      actualWager: parsed.actualWager,
      status: 'pending',
      createdAt: saved.createdAt.toISOString()
    }
  };
}

export interface LogBetOutput {
  success: boolean;
  betId: string;
  message: string;
  bet: {
    id: string;
    matchup: string;
    sport: string;
    spread: number;
    probability: number;
    edge?: number;
    recommendedStake: number;
    actualWager?: number;
    status: string;
    createdAt: string;
  };
}
