/**
 * AI-Powered Probability Estimation Tool
 *
 * This module provides two advanced MCP tools that leverage Google's Gemini AI to analyze sports betting matchups
 * and estimate win probabilities. These tools are particularly valuable when statistical data is limited or when
 * bettors want a second opinion on their probability estimates. The AI analyzes team names, recent performance,
 * injuries, venue advantages, and other contextual factors to generate probability estimates and comprehensive
 * matchup analyses. This complements the statistical Walters Protocol tools by incorporating qualitative factors
 * and real-time information that may not be captured in season-long statistics.
 *
 * TOOL: ai_estimate_probability
 * Uses Google Gemini AI to estimate the probability of a team covering a specific point spread. This tool accepts
 * team names, point spread, venue information (home/away/neutral), and optional additional context (such as injury
 * reports, weather conditions, or recent team form). The AI analyzes historical matchup data, current team performance,
 * home/away advantages, and any provided context to generate a probability estimate expressed as a percentage (0-100).
 * The response includes the probability estimate, a confidence level (low/medium/high), key factors that influenced
 * the estimate, and a detailed textual analysis explaining the reasoning. This tool requires a valid GEMINI_API_KEY
 * environment variable and is best used when you don't have detailed team statistics or want to validate your own
 * probability calculations against AI-powered analysis.
 *
 * TOOL: ai_analyze_matchup
 * Provides a comprehensive AI-powered analysis of a sports matchup, offering deeper insights than just a probability
 * estimate. This tool accepts sport type, team information (including optional team statistics), and an optional point
 * spread. The AI generates a detailed breakdown that includes: the favored team and predicted margin of victory, win
 * probability, confidence level, key matchup advantages, each team's strengths and weaknesses, and specific betting
 * insights with recommendations. The analysis can be performed with or without a specific spread, making it useful
 * for both spread betting and moneyline evaluations. When team statistics are provided, the AI incorporates them into
 * the analysis for more accurate predictions. This tool is ideal for gaining a holistic understanding of a matchup
 * before placing a bet, identifying value opportunities, and understanding the factors that could influence the game outcome.
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

  teamA: z.string().min(1).describe('Team A name (the team you are betting on). Example: "Hawks", "Atlanta", or "ATL"'),

  teamB: z.string().min(1).describe('Team B name (the opponent). Example: "Heat", "Miami", or "MIA"'),

  spread: z.number().optional().describe('Point spread from Team A perspective. Negative if favored (-7), positive if underdog (+3.5). Optional.')
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

SIMPLE INPUTS: Just provide team names as strings (e.g., "Hawks", "Heat", "Cowboys").

Provides detailed breakdown including:
- Predicted winner and margin
- Key matchup advantages
- Team strengths and weaknesses
- Betting insight and recommendation
- Confidence level

Example: { sport: "NBA", teamA: "Hawks", teamB: "Heat", spread: -3.5 }

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
        description: 'Team A name (the team you are betting on)',
        minLength: 1
      },
      teamB: {
        type: 'string',
        description: 'Team B name (the opponent)',
        minLength: 1
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
    { name: parsed.teamA },
    { name: parsed.teamB },
    parsed.spread
  );

  return {
    success: true,
    input: {
      sport: parsed.sport,
      teamA: parsed.teamA,
      teamB: parsed.teamB,
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
