/**
 * Statistical Probability Estimation Tools (Walters Protocol)
 *
 * This module implements the Walters Protocol, a sophisticated statistical methodology for estimating the probability
 * that a team will cover a given point spread based on team performance statistics. Named after legendary sports bettor
 * Billy Walters, this approach uses weighted analysis of multiple statistical factors combined with normal distribution
 * modeling to generate objective probability estimates. Unlike subjective handicapping or gut-feel betting, the Walters
 * Protocol provides data-driven probability calculations that can be fed into the Kelly Criterion for optimal bet sizing.
 * The module provides separate tools for football and basketball, each calibrated with sport-specific weights, home
 * field/court advantages, and standard deviation values that reflect the statistical realities of each sport.
 *
 * TOOL: estimate_football_probability
 * Calculates the probability that a football team will cover the spread using a weighted statistical model that analyzes
 * points differential (40% weight), yards differential (25% weight), and turnover differential (20% weight). The tool
 * requires team statistics for both teams including points per game scored, points per game allowed, and optionally
 * offensive yards per game, defensive yards allowed per game, and turnover differential (positive indicates more takeaways).
 * The tool supports both NFL and college football (CFB) with different calibration constants - NFL uses a 2.5-point home
 * field advantage and 13.5-point standard deviation, while CFB uses a 3.0-point advantage and 16.0-point standard deviation
 * to account for greater variance in college games. The venue parameter (home/away/neutral) automatically applies the
 * appropriate home field advantage adjustment when Team A is playing at home or penalizes them when playing away. The
 * calculation first estimates the expected margin of victory by comparing offensive and defensive efficiency metrics,
 * applies home field adjustment, then uses normal distribution (z-score) to determine the probability of covering the
 * given spread. For example, if Team A is expected to win by 7 points and the spread is -3.5, the model calculates the
 * probability they'll win by more than 3.5 points. The response includes the cover probability percentage, predicted
 * margin of victory, the sigma (standard deviation) used, applied home field advantage, and a human-readable interpretation
 * categorizing the bet quality (strong cover, favorable, coin flip, unfavorable, or poor value).
 *
 * TOOL: estimate_basketball_probability
 * Calculates the probability that a basketball team will cover the spread using a weighted statistical model optimized
 * for basketball's unique characteristics. The model analyzes points differential (35% weight), field goal percentage
 * differential (30% weight), rebound margin (20% weight), and turnover margin (15% weight). The tool requires team
 * statistics for both teams including points per game scored, points allowed, and optionally field goal percentage (e.g.,
 * 45.5 for 45.5%), rebound margin per game, and turnover margin per game (positive means fewer turnovers than opponent).
 * Like the football tool, it supports both professional (NBA) and college (CBB) basketball with different calibrations -
 * NBA uses a 3.0-point home court advantage and 11.5-point standard deviation, while CBB uses a 3.5-point advantage and
 * 10.5-point standard deviation, reflecting the slightly lower variance in college basketball due to shorter shot clocks
 * and different game dynamics. The venue parameter (home/away/neutral) applies the appropriate home court advantage or
 * disadvantage. The calculation methodology mirrors the football tool: calculate expected margin using weighted statistical
 * differentials, apply venue adjustment, then use normal distribution to determine cover probability. The response format
 * is identical to the football tool, providing probability, predicted margin, sigma, home court advantage applied, and an
 * interpretation of bet quality. Both probability tools form the statistical foundation for value betting, allowing users
 * to compare their calculated probabilities against bookmaker implied probabilities to identify positive expected value
 * opportunities that warrant Kelly Criterion bet sizing.
 */

import { z } from 'zod';
import {
  estimateFootballProbability,
  estimateBasketballProbability,
  NFL_CONSTANTS,
  NBA_CONSTANTS,
  CFB_CONSTANTS,
  CBB_CONSTANTS,
  FootballStats,
  BasketballStats,
  ProbabilityResult
} from '../utils/calculations.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

const venueSchema = z.enum(['home', 'away', 'neutral']).default('neutral');

export const footballProbabilityInputSchema = z.object({
  teamA: z.object({
    name: z.string().describe('Team A name (the team you are betting on)'),
    ppg: z.number().describe('Points per game scored'),
    pointsAllowed: z.number().describe('Points per game allowed'),
    offensiveYards: z.number().optional().describe('Offensive yards per game'),
    defensiveYards: z.number().optional().describe('Defensive yards allowed per game'),
    turnoverDiff: z.number().optional().describe('Turnover differential (positive = more takeaways)')
  }).describe('Statistics for Team A (the team being bet on)'),

  teamB: z.object({
    name: z.string().describe('Team B name (the opponent)'),
    ppg: z.number().describe('Points per game scored'),
    pointsAllowed: z.number().describe('Points per game allowed'),
    offensiveYards: z.number().optional().describe('Offensive yards per game'),
    defensiveYards: z.number().optional().describe('Defensive yards allowed per game'),
    turnoverDiff: z.number().optional().describe('Turnover differential')
  }).describe('Statistics for Team B (the opponent)'),

  spread: z.number().describe('Point spread from Team A perspective. Negative if Team A is favored (e.g., -7 means Team A favored by 7). Positive if Team A is underdog (e.g., +3.5).'),

  venue: venueSchema.describe('Where Team A is playing: home, away, or neutral site'),

  league: z.enum(['NFL', 'CFB']).default('NFL').describe('League: NFL (professional) or CFB (college football)')
});

export const basketballProbabilityInputSchema = z.object({
  teamA: z.object({
    name: z.string().describe('Team A name (the team you are betting on)'),
    ppg: z.number().describe('Points per game scored'),
    pointsAllowed: z.number().describe('Points per game allowed'),
    fgPct: z.number().optional().describe('Field goal percentage (e.g., 45.5 for 45.5%)'),
    reboundMargin: z.number().optional().describe('Rebound margin per game'),
    turnoverMargin: z.number().optional().describe('Turnover margin per game (positive = fewer turnovers)')
  }).describe('Statistics for Team A (the team being bet on)'),

  teamB: z.object({
    name: z.string().describe('Team B name (the opponent)'),
    ppg: z.number().describe('Points per game scored'),
    pointsAllowed: z.number().describe('Points per game allowed'),
    fgPct: z.number().optional().describe('Field goal percentage'),
    reboundMargin: z.number().optional().describe('Rebound margin per game'),
    turnoverMargin: z.number().optional().describe('Turnover margin per game')
  }).describe('Statistics for Team B (the opponent)'),

  spread: z.number().describe('Point spread from Team A perspective. Negative if Team A is favored, positive if underdog.'),

  venue: venueSchema.describe('Where Team A is playing: home, away, or neutral site'),

  league: z.enum(['NBA', 'CBB']).default('NBA').describe('League: NBA (professional) or CBB (college basketball)')
});

export type FootballProbabilityInput = z.infer<typeof footballProbabilityInputSchema>;
export type BasketballProbabilityInput = z.infer<typeof basketballProbabilityInputSchema>;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const footballProbabilityToolDefinition = {
  name: 'estimate_football_probability',
  description: `🏈 Calculate football spread cover probability using Walters Protocol.

⚠️ REQUIRES TEAM STATS - Use one of these approaches:
1. EASIEST: Use "analyze_matchup_and_log_bet" tool instead - it handles everything!
2. Call "get_matchup_stats" first to get the required statistics, then pass them here

This tool needs teamA and teamB objects with: name, ppg, pointsAllowed (and optionally offensiveYards, defensiveYards, turnoverDiff)

Uses weighted analysis:
- Points differential (40%), Yards differential (25%), Turnover differential (20%)
- Home field: NFL 2.5 pts, CFB 3.0 pts`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      teamA: {
        type: 'object',
        description: 'Statistics for Team A (the team being bet on)',
        properties: {
          name: { type: 'string', description: 'Team A name' },
          ppg: { type: 'number', description: 'Points per game scored' },
          pointsAllowed: { type: 'number', description: 'Points per game allowed' },
          offensiveYards: { type: 'number', description: 'Offensive yards per game' },
          defensiveYards: { type: 'number', description: 'Defensive yards allowed per game' },
          turnoverDiff: { type: 'number', description: 'Turnover differential' }
        },
        required: ['name', 'ppg', 'pointsAllowed']
      },
      teamB: {
        type: 'object',
        description: 'Statistics for Team B (the opponent)',
        properties: {
          name: { type: 'string', description: 'Team B name' },
          ppg: { type: 'number', description: 'Points per game scored' },
          pointsAllowed: { type: 'number', description: 'Points per game allowed' },
          offensiveYards: { type: 'number', description: 'Offensive yards per game' },
          defensiveYards: { type: 'number', description: 'Defensive yards allowed per game' },
          turnoverDiff: { type: 'number', description: 'Turnover differential' }
        },
        required: ['name', 'ppg', 'pointsAllowed']
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
      league: {
        type: 'string',
        enum: ['NFL', 'CFB'],
        description: 'League: NFL or CFB (college)',
        default: 'NFL'
      }
    },
    required: ['teamA', 'teamB', 'spread']
  }
};

export const basketballProbabilityToolDefinition = {
  name: 'estimate_basketball_probability',
  description: `🏀 Calculate basketball spread cover probability using Walters Protocol.

⚠️ REQUIRES TEAM STATS - Use one of these approaches:
1. EASIEST: Use "analyze_matchup_and_log_bet" tool instead - it handles everything!
2. Call "get_matchup_stats" first to get the required statistics, then pass them here

This tool needs teamA and teamB objects with: name, ppg, pointsAllowed (and optionally fgPct, reboundMargin, turnoverMargin)

Uses weighted analysis:
- Points differential (35%), FG% differential (30%), Rebound margin (20%), Turnover margin (15%)
- Home court: NBA 3.0 pts, CBB 3.5 pts`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      teamA: {
        type: 'object',
        description: 'Statistics for Team A (the team being bet on)',
        properties: {
          name: { type: 'string', description: 'Team A name' },
          ppg: { type: 'number', description: 'Points per game scored' },
          pointsAllowed: { type: 'number', description: 'Points per game allowed' },
          fgPct: { type: 'number', description: 'Field goal percentage' },
          reboundMargin: { type: 'number', description: 'Rebound margin per game' },
          turnoverMargin: { type: 'number', description: 'Turnover margin per game' }
        },
        required: ['name', 'ppg', 'pointsAllowed']
      },
      teamB: {
        type: 'object',
        description: 'Statistics for Team B (the opponent)',
        properties: {
          name: { type: 'string', description: 'Team B name' },
          ppg: { type: 'number', description: 'Points per game scored' },
          pointsAllowed: { type: 'number', description: 'Points per game allowed' },
          fgPct: { type: 'number', description: 'Field goal percentage' },
          reboundMargin: { type: 'number', description: 'Rebound margin per game' },
          turnoverMargin: { type: 'number', description: 'Turnover margin per game' }
        },
        required: ['name', 'ppg', 'pointsAllowed']
      },
      spread: {
        type: 'number',
        description: 'Point spread from Team A perspective. Negative if favored, positive if underdog.'
      },
      venue: {
        type: 'string',
        enum: ['home', 'away', 'neutral'],
        description: 'Where Team A is playing',
        default: 'neutral'
      },
      league: {
        type: 'string',
        enum: ['NBA', 'CBB'],
        description: 'League: NBA or CBB (college)',
        default: 'NBA'
      }
    },
    required: ['teamA', 'teamB', 'spread']
  }
};

// ============================================================================
// HANDLERS
// ============================================================================

export async function handleFootballProbability(input: unknown): Promise<ProbabilityOutput> {
  const parsed = footballProbabilityInputSchema.parse(input);

  const stats: FootballStats = {
    teamPPG: parsed.teamA.ppg,
    teamAllowed: parsed.teamA.pointsAllowed,
    opponentPPG: parsed.teamB.ppg,
    opponentAllowed: parsed.teamB.pointsAllowed,
    teamOffYards: parsed.teamA.offensiveYards,
    teamDefYards: parsed.teamA.defensiveYards,
    opponentOffYards: parsed.teamB.offensiveYards,
    opponentDefYards: parsed.teamB.defensiveYards,
    teamTurnoverDiff: parsed.teamA.turnoverDiff,
    opponentTurnoverDiff: parsed.teamB.turnoverDiff
  };

  const result = estimateFootballProbability(
    stats,
    parsed.spread,
    parsed.venue,
    parsed.league === 'NFL'
  );

  const constants = parsed.league === 'NFL' ? NFL_CONSTANTS : CFB_CONSTANTS;

  return {
    success: true,
    sport: 'football',
    league: parsed.league,
    matchup: {
      teamA: parsed.teamA.name,
      teamB: parsed.teamB.name,
      spread: parsed.spread,
      venue: parsed.venue
    },
    result: {
      probability: result.probability,
      predictedMargin: result.predictedMargin,
      sigma: result.sigma,
      homeFieldAdvantage: parsed.venue !== 'neutral' ? constants.homeFieldAdvantage : 0
    },
    interpretation: getInterpretation(result.probability, parsed.teamA.name, parsed.spread)
  };
}

export async function handleBasketballProbability(input: unknown): Promise<ProbabilityOutput> {
  const parsed = basketballProbabilityInputSchema.parse(input);

  const stats: BasketballStats = {
    teamPPG: parsed.teamA.ppg,
    teamAllowed: parsed.teamA.pointsAllowed,
    opponentPPG: parsed.teamB.ppg,
    opponentAllowed: parsed.teamB.pointsAllowed,
    teamFGPct: parsed.teamA.fgPct,
    opponentFGPct: parsed.teamB.fgPct,
    teamReboundMargin: parsed.teamA.reboundMargin,
    opponentReboundMargin: parsed.teamB.reboundMargin,
    teamTurnoverMargin: parsed.teamA.turnoverMargin,
    opponentTurnoverMargin: parsed.teamB.turnoverMargin
  };

  const result = estimateBasketballProbability(
    stats,
    parsed.spread,
    parsed.venue,
    parsed.league === 'NBA'
  );

  const constants = parsed.league === 'NBA' ? NBA_CONSTANTS : CBB_CONSTANTS;

  return {
    success: true,
    sport: 'basketball',
    league: parsed.league,
    matchup: {
      teamA: parsed.teamA.name,
      teamB: parsed.teamB.name,
      spread: parsed.spread,
      venue: parsed.venue
    },
    result: {
      probability: result.probability,
      predictedMargin: result.predictedMargin,
      sigma: result.sigma,
      homeFieldAdvantage: parsed.venue !== 'neutral' ? constants.homeCourtAdvantage : 0
    },
    interpretation: getInterpretation(result.probability, parsed.teamA.name, parsed.spread)
  };
}

function getInterpretation(probability: number, teamName: string, spread: number): string {
  const spreadText = spread < 0
    ? `${teamName} as ${Math.abs(spread)}-point favorites`
    : `${teamName} as ${spread}-point underdogs`;

  if (probability >= 65) {
    return `STRONG COVER: ${probability}% probability. ${spreadText} looks like good value.`;
  } else if (probability >= 55) {
    return `FAVORABLE: ${probability}% probability. ${spreadText} has a slight edge.`;
  } else if (probability >= 45) {
    return `COIN FLIP: ${probability}% probability. ${spreadText} is essentially even odds.`;
  } else if (probability >= 35) {
    return `UNFAVORABLE: ${probability}% probability. ${spreadText} is risky.`;
  } else {
    return `POOR VALUE: ${probability}% probability. ${spreadText} is not recommended.`;
  }
}

export interface ProbabilityOutput {
  success: boolean;
  sport: 'football' | 'basketball';
  league: string;
  matchup: {
    teamA: string;
    teamB: string;
    spread: number;
    venue: 'home' | 'away' | 'neutral';
  };
  result: {
    probability: number;
    predictedMargin: number;
    sigma: number;
    homeFieldAdvantage: number;
  };
  interpretation: string;
}
