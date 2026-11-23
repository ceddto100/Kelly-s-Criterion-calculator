/**
 * Statistical Probability Estimation Tools
 *
 * TOOL: estimate_football_probability / estimate_basketball_probability
 * Estimate the probability that Team A covers a posted spread from season-to-
 * date team statistics.
 *
 *   projected margin = home edge + k(n) × raw season gap
 *     NFL raw gap: 0.8 × net points + 0.2 × net yards / 15 (per game)
 *     NBA raw gap: full net-efficiency difference at the shared pace
 *     k(n) = n / (n + priorGames)  (NFL 6, NBA 10) regresses small samples
 *
 * The cover probability is anchored to the posted line: the line is the
 * market's estimate and the model may move it only by `marketTrust` of its
 * disagreement, measured after putting both on the same footing. Backtests on
 * 4,063 NFL and 1,203 NBA games found no edge for these stats against closing
 * lines, so unanchored probabilities (the old output) overstated value and
 * oversized Kelly stakes. `result.modelProbability` keeps the model-only
 * figure for reference. Constants: config/sportsConfig.ts; evidence:
 * docs/PREDICTION_MODEL.md.
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
import {
  evaluateDecision,
  dataCompletenessFrom,
  type DecisionResult
} from '../utils/decision.js';

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

  spreadOdds: z.number().optional().describe('American odds for Team A to cover this spread (default -110). Used to compute edge vs the fair line.'),
  oppSpreadOdds: z.number().optional().describe('American odds for the opposite side of the spread (default -110). Used to de-vig.'),

  venue: venueSchema.describe('Where Team A is playing: home, away, or neutral site'),

  league: z.enum(['NFL', 'CFB']).default('NFL').describe('League: NFL (professional) or CFB (college football)'),

  gamesPlayed: z.number().min(0).max(20).optional().describe('Games behind the season stats (estimated from the date when omitted)')
});

export const basketballProbabilityInputSchema = z.object({
  teamA: z.object({
    name: z.string().describe('Team A name (the team you are betting on)'),
    ppg: z.number().describe('Points per game scored'),
    pointsAllowed: z.number().describe('Points per game allowed'),
    fgPct: z.number().optional().describe('Field goal percentage (e.g., 45.5 for 45.5%)'),
    reboundMargin: z.number().optional().describe('Rebound margin per game'),
    turnoverMargin: z.number().optional().describe('Turnover margin per game (positive = team forces more TOs than it commits)'),
    offRtg: z.number().positive().optional(),
    defRtg: z.number().positive().optional(),
    pace: z.number().positive().optional().describe('Possessions per game (league average ~100)'),
    threePRate: z.number().optional().describe('3-point attempt rate as decimal (3PA / FGA, e.g., 0.40 for 40%)'),
    threePPct: z.number().optional().describe('3-point percentage (e.g., 36.5 for 36.5%)')
  }).describe('Statistics for Team A (the team being bet on)'),

  teamB: z.object({
    name: z.string().describe('Team B name (the opponent)'),
    ppg: z.number().describe('Points per game scored'),
    pointsAllowed: z.number().describe('Points per game allowed'),
    fgPct: z.number().optional().describe('Field goal percentage'),
    reboundMargin: z.number().optional().describe('Rebound margin per game'),
    turnoverMargin: z.number().optional().describe('Turnover margin per game (positive = team forces more TOs than it commits)'),
    offRtg: z.number().positive().optional(),
    defRtg: z.number().positive().optional(),
    pace: z.number().positive().optional().describe('Possessions per game (league average ~100)'),
    threePRate: z.number().optional().describe('3-point attempt rate as decimal (3PA / FGA, e.g., 0.40 for 40%)'),
    threePPct: z.number().optional().describe('3-point percentage (e.g., 36.5 for 36.5%)')
  }).describe('Statistics for Team B (the opponent)'),

  spread: z.number().describe('Point spread from Team A perspective. Negative if Team A is favored, positive if underdog.'),

  spreadOdds: z.number().optional().describe('American odds for Team A to cover this spread (default -110). Used to compute edge vs the fair line.'),
  oppSpreadOdds: z.number().optional().describe('American odds for the opposite side of the spread (default -110). Used to de-vig.'),

  venue: venueSchema.describe('Where Team A is playing: home, away, or neutral site'),

  league: z.enum(['NBA', 'CBB']).default('NBA').describe('League: NBA (professional) or CBB (college basketball)'),

  gamesPlayed: z.number().min(0).max(90).optional().describe('Games behind the season stats (estimated from the date when omitted)')
});

export type FootballProbabilityInput = z.infer<typeof footballProbabilityInputSchema>;
export type BasketballProbabilityInput = z.infer<typeof basketballProbabilityInputSchema>;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const footballProbabilityToolDefinition = {
  name: 'estimate_football_probability',
  description: `Calculate football cover probability using team stats, spread, venue, and league to return win chance and predicted margin.`,

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
  description: `Calculate basketball cover probability using team stats (PPG, FG%, rebounds, turnovers, pace, 3PT shooting), spread, venue, and league. Returns win chance, predicted margin, and bet quality interpretation.`,

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
          fgPct: { type: 'number', description: 'Field goal percentage (e.g., 47.5)' },
          reboundMargin: { type: 'number', description: 'Rebound margin per game' },
          turnoverMargin: { type: 'number', description: 'Turnover margin per game (positive = forces more TOs than commits)' },
          pace: { type: 'number', description: 'Possessions per game (league avg ~100)' },
          threePRate: { type: 'number', description: '3-point attempt rate as decimal (3PA/FGA, e.g., 0.40)' },
          threePPct: { type: 'number', description: '3-point percentage (e.g., 36.5)' }
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
          turnoverMargin: { type: 'number', description: 'Turnover margin per game (positive = forces more TOs than commits)' },
          pace: { type: 'number', description: 'Possessions per game (league avg ~100)' },
          threePRate: { type: 'number', description: '3-point attempt rate as decimal (3PA/FGA, e.g., 0.40)' },
          threePPct: { type: 'number', description: '3-point percentage (e.g., 36.5)' }
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
    parsed.league === 'NFL',
    { gamesPlayed: parsed.gamesPlayed }
  );

  const constants = parsed.league === 'NFL' ? NFL_CONSTANTS : CFB_CONSTANTS;

  // Data completeness from the optional inputs the football model can use
  // (yards + turnovers for each team = 4 optional signals).
  const optionalPresent = [
    parsed.teamA.offensiveYards,
    parsed.teamA.turnoverDiff,
    parsed.teamB.offensiveYards,
    parsed.teamB.turnoverDiff
  ].filter((v) => v !== undefined).length;
  const dataCompleteness = dataCompletenessFrom(optionalPresent, 4);

  const decision = evaluateDecision({
    modelProbabilityPct: result.probability,
    sideOdds: parsed.spreadOdds,
    otherSideOdds: parsed.oppSpreadOdds,
    dataCompleteness
  });

  const riskFactors = buildSpreadRiskFactors(dataCompleteness, parsed.venue, result.probability);

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
      modelProbability: result.modelProbability,
      predictedMargin: result.predictedMargin,
      sigma: result.sigma,
      homeFieldAdvantage: parsed.venue !== 'neutral' ? constants.homeFieldAdvantage : 0,
      gamesPlayed: result.gamesPlayed,
      evidenceWeight: result.evidenceWeight,
      marketTrust: result.marketTrust
    },
    decision,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    riskFactors,
    interpretation: getInterpretation(result.probability, parsed.teamA.name, parsed.spread),
    disclaimer: PROJECTION_DISCLAIMER
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
    opponentTurnoverMargin: parsed.teamB.turnoverMargin,
    teamOffRtg: parsed.teamA.offRtg,
    teamDefRtg: parsed.teamA.defRtg,
    opponentOffRtg: parsed.teamB.offRtg,
    opponentDefRtg: parsed.teamB.defRtg,
    teamPace: parsed.teamA.pace,
    opponentPace: parsed.teamB.pace,
    team3PRate: parsed.teamA.threePRate,
    opponent3PRate: parsed.teamB.threePRate,
    team3PPct: parsed.teamA.threePPct,
    opponent3PPct: parsed.teamB.threePPct
  };

  const result = estimateBasketballProbability(
    stats,
    parsed.spread,
    parsed.venue,
    parsed.league === 'NBA',
    { gamesPlayed: parsed.gamesPlayed }
  );

  const constants = parsed.league === 'NBA' ? NBA_CONSTANTS : CBB_CONSTANTS;

  // Data completeness from the optional basketball inputs (FG%, rebound margin,
  // turnover margin, pace, 3PT%, 3PT rate for each team = 12 optional signals).
  const optionalPresent = [
    parsed.teamA.fgPct, parsed.teamA.reboundMargin, parsed.teamA.turnoverMargin,
    parsed.teamA.pace, parsed.teamA.threePPct, parsed.teamA.threePRate,
    parsed.teamB.fgPct, parsed.teamB.reboundMargin, parsed.teamB.turnoverMargin,
    parsed.teamB.pace, parsed.teamB.threePPct, parsed.teamB.threePRate
  ].filter((v) => v !== undefined).length;
  const dataCompleteness = dataCompletenessFrom(optionalPresent, 12);

  const decision = evaluateDecision({
    modelProbabilityPct: result.probability,
    sideOdds: parsed.spreadOdds,
    otherSideOdds: parsed.oppSpreadOdds,
    dataCompleteness
  });

  const riskFactors = buildSpreadRiskFactors(dataCompleteness, parsed.venue, result.probability);

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
      modelProbability: result.modelProbability,
      predictedMargin: result.predictedMargin,
      sigma: result.sigma,
      homeFieldAdvantage: parsed.venue !== 'neutral' ? constants.homeCourtAdvantage : 0,
      gamesPlayed: result.gamesPlayed,
      evidenceWeight: result.evidenceWeight,
      marketTrust: result.marketTrust
    },
    decision,
    dataCompleteness: Math.round(dataCompleteness * 100) / 100,
    riskFactors,
    interpretation: getInterpretation(result.probability, parsed.teamA.name, parsed.spread),
    disclaimer: PROJECTION_DISCLAIMER
  };
}

export const PROJECTION_DISCLAIMER =
  'Model projection only — a possible edge based on formula output, not a guaranteed result. ' +
  'No bet is risk-free. Use bankroll discipline.';

/**
 * Surface risk factors that should lower trust in a spread/total projection.
 * Spread models rely on season-long team rates and don't see injuries, rest, or
 * line moves, so we flag the structural uncertainties.
 */
function buildSpreadRiskFactors(
  dataCompleteness: number,
  venue: 'home' | 'away' | 'neutral',
  probability: number
): string[] {
  const risks: string[] = [];
  if (dataCompleteness < 0.8) {
    risks.push('Incomplete optional stats — projection uses fewer inputs, confidence reduced.');
  }
  if (venue === 'neutral') {
    risks.push('Neutral-site assumption — no home-field/court adjustment applied.');
  }
  if (Math.abs(probability - 50) < 5) {
    risks.push('Projection is near a coin flip — small input changes can flip the lean.');
  }
  risks.push('Model uses season-long team rates; it does not account for injuries, rest, weather, or late line moves.');
  return risks;
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
    /** Cover probability (%) anchored to the posted spread. */
    probability: number;
    /** Model-only cover probability (%), before anchoring. */
    modelProbability: number;
    predictedMargin: number;
    sigma: number;
    homeFieldAdvantage: number;
    gamesPlayed: number | null;
    evidenceWeight: number;
    marketTrust: number | null;
  };
  decision: DecisionResult;
  dataCompleteness: number;
  riskFactors: string[];
  interpretation: string;
  disclaimer: string;
}
