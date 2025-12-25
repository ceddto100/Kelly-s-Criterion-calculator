/**
 * AI-Powered Probability Estimation Tool
 * Uses Gemini AI to estimate betting probabilities and analyze matchups
 */

import { z } from 'zod';
import { estimateProbabilityAI, analyzeMatchup, isGeminiConfigured } from '../config/gemini.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const aiProbabilityInputSchema = z.object({
  sport: z
    .enum(['NFL', 'NBA', 'CFB', 'CBB', 'MLB', 'NHL', 'soccer', 'other'])
    .describe('Sport type for the matchup'),

  teamA: z.string().min(1).describe('Name of Team A (the team you are betting on)'),

  teamB: z.string().min(1).describe('Name of Team B (the opponent)'),

  spread: z.number().describe('Point spread from Team A perspective. Negative if favored (-7), positive if underdog (+3.5).'),

  venue: z
    .enum(['home', 'away', 'neutral'])
    .default('neutral')
    .describe('Where Team A is playing'),

  additionalContext: z
    .string()
    .optional()
    .describe('Additional context for the AI (injuries, weather, recent form, etc.)')
});

export const matchupAnalysisInputSchema = z.object({
  sport: z
    .enum(['NFL', 'NBA', 'CFB', 'CBB', 'MLB', 'NHL', 'soccer', 'other'])
    .describe('Sport type for the matchup'),

  teamA: z.object({
    name: z.string().min(1).describe('Team A name'),
    stats: z.record(z.number()).optional().describe('Key statistics as key-value pairs')
  }).describe('Team A information'),

  teamB: z.object({
    name: z.string().min(1).describe('Team B name'),
    stats: z.record(z.number()).optional().describe('Key statistics as key-value pairs')
  }).describe('Team B information'),

  spread: z.number().optional().describe('Point spread from Team A perspective (optional)')
});

export type AIProbabilityInput = z.infer<typeof aiProbabilityInputSchema>;
export type MatchupAnalysisInput = z.infer<typeof matchupAnalysisInputSchema>;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const aiProbabilityToolDefinition = {
  name: 'ai_estimate_probability',
  description: `Get an AI-powered probability estimate for a betting matchup using Google Gemini.

This tool uses advanced AI analysis to estimate the probability of a team covering the spread, considering:
- Historical matchup data
- Current team form
- Injury reports
- Home/away advantages
- Any additional context provided

Best for when you don't have detailed statistics or want a second opinion on your probability estimate.

Requires GEMINI_API_KEY environment variable to be set.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      sport: {
        type: 'string',
        enum: ['NFL', 'NBA', 'CFB', 'CBB', 'MLB', 'NHL', 'soccer', 'other'],
        description: 'Sport type for the matchup'
      },
      teamA: {
        type: 'string',
        description: 'Name of Team A (the team you are betting on)',
        minLength: 1
      },
      teamB: {
        type: 'string',
        description: 'Name of Team B (the opponent)',
        minLength: 1
      },
      spread: {
        type: 'number',
        description: 'Point spread from Team A perspective. Negative if favored (-7), positive if underdog (+3.5).'
      },
      venue: {
        type: 'string',
        enum: ['home', 'away', 'neutral'],
        description: 'Where Team A is playing',
        default: 'neutral'
      },
      additionalContext: {
        type: 'string',
        description: 'Additional context for the AI (injuries, weather, recent form, etc.)'
      }
    },
    required: ['sport', 'teamA', 'teamB', 'spread']
  }
};

export const matchupAnalysisToolDefinition = {
  name: 'ai_analyze_matchup',
  description: `Get a comprehensive AI-powered analysis of a sports matchup using Google Gemini.

Provides detailed breakdown including:
- Predicted winner and margin
- Key matchup advantages
- Team strengths and weaknesses
- Betting insight and recommendation
- Confidence level

Can analyze with or without a specific spread. Provide team statistics for more accurate analysis.

Requires GEMINI_API_KEY environment variable to be set.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      sport: {
        type: 'string',
        enum: ['NFL', 'NBA', 'CFB', 'CBB', 'MLB', 'NHL', 'soccer', 'other'],
        description: 'Sport type for the matchup'
      },
      teamA: {
        type: 'object',
        description: 'Team A information',
        properties: {
          name: { type: 'string', description: 'Team A name' },
          stats: {
            type: 'object',
            description: 'Key statistics as key-value pairs',
            additionalProperties: { type: 'number' }
          }
        },
        required: ['name']
      },
      teamB: {
        type: 'object',
        description: 'Team B information',
        properties: {
          name: { type: 'string', description: 'Team B name' },
          stats: {
            type: 'object',
            description: 'Key statistics as key-value pairs',
            additionalProperties: { type: 'number' }
          }
        },
        required: ['name']
      },
      spread: {
        type: 'number',
        description: 'Point spread from Team A perspective (optional)'
      }
    },
    required: ['sport', 'teamA', 'teamB']
  }
};

// ============================================================================
// HANDLERS
// ============================================================================

export async function handleAIProbability(input: unknown): Promise<AIProbabilityOutput> {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured. AI probability estimation requires a valid Gemini API key.');
  }

  const parsed = aiProbabilityInputSchema.parse(input);

  const result = await estimateProbabilityAI(
    parsed.sport,
    parsed.teamA,
    parsed.teamB,
    parsed.spread,
    parsed.venue,
    parsed.additionalContext
  );

  return {
    success: true,
    input: {
      sport: parsed.sport,
      teamA: parsed.teamA,
      teamB: parsed.teamB,
      spread: parsed.spread,
      venue: parsed.venue
    },
    result: {
      probability: result.probability,
      confidence: result.confidence,
      keyFactors: result.keyFactors,
      analysis: result.analysis
    },
    disclaimer: 'AI-generated probability estimate. Use in conjunction with statistical analysis for best results.'
  };
}

export async function handleMatchupAnalysis(input: unknown): Promise<MatchupAnalysisOutput> {
  if (!isGeminiConfigured()) {
    throw new Error('GEMINI_API_KEY is not configured. Matchup analysis requires a valid Gemini API key.');
  }

  const parsed = matchupAnalysisInputSchema.parse(input);

  const result = await analyzeMatchup(
    parsed.sport,
    { name: parsed.teamA.name, stats: parsed.teamA.stats },
    { name: parsed.teamB.name, stats: parsed.teamB.stats },
    parsed.spread
  );

  return {
    success: true,
    input: {
      sport: parsed.sport,
      teamA: parsed.teamA.name,
      teamB: parsed.teamB.name,
      spread: parsed.spread
    },
    analysis: {
      favoredTeam: result.favoredTeam,
      predictedMargin: result.predictedMargin,
      probability: result.probability,
      confidence: result.confidence,
      keyMatchups: result.keyMatchups,
      teamAStrengths: result.teamAStrengths,
      teamAWeaknesses: result.teamAWeaknesses,
      teamBStrengths: result.teamBStrengths,
      teamBWeaknesses: result.teamBWeaknesses,
      bettingInsight: result.bettingInsight
    },
    disclaimer: 'AI-generated analysis. Consider multiple factors before placing bets.'
  };
}

export interface AIProbabilityOutput {
  success: boolean;
  input: {
    sport: string;
    teamA: string;
    teamB: string;
    spread: number;
    venue: 'home' | 'away' | 'neutral';
  };
  result: {
    probability: number;
    confidence: 'low' | 'medium' | 'high';
    keyFactors: string[];
    analysis: string;
  };
  disclaimer: string;
}

export interface MatchupAnalysisOutput {
  success: boolean;
  input: {
    sport: string;
    teamA: string;
    teamB: string;
    spread?: number;
  };
  analysis: {
    favoredTeam: string;
    predictedMargin: number;
    probability: number;
    confidence: 'low' | 'medium' | 'high';
    keyMatchups: string[];
    teamAStrengths: string[];
    teamAWeaknesses: string[];
    teamBStrengths: string[];
    teamBWeaknesses: string[];
    bettingInsight: string;
  };
  disclaimer: string;
}
