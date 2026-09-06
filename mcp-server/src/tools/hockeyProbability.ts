/** NHL projection tool. Shared model and rationale: docs/PREDICTION_MODEL.md. */
import { z } from 'zod';
import { normCdf } from '../utils/calculations.js';
import { evaluateDecision, type DecisionResult } from '../utils/decision.js';

export { calculateNHLProjection } from '../utils/nhl.js';
import { calculateNHLProjection } from '../utils/nhl.js';
import type { NHLTeamStats, NHLProjectionResult } from '../utils/nhl.js';
export type { NHLTeamStats, NHLProjectionResult } from '../utils/nhl.js';

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
  line: z.number().finite().min(0).max(100).describe('The over/under total goals line (e.g., 6.5)'),
  betType: z.enum(['over', 'under']).describe('Whether betting on over or under the line'),
  betOdds: z.number().optional().describe('American odds for the chosen over/under side (default -110). Used to compute edge vs the fair line.'),
  oppOdds: z.number().optional().describe('American odds for the opposite over/under side (default -110). Used to de-vig.')
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
    pushProbability: number;
    standardDeviation: number;
    zScore: number;
  };
  decision: DecisionResult;
  dataCompleteness: number;
  riskFactors: string[];
  interpretation: string;
  disclaimer: string;
}

const HOCKEY_DISCLAIMER =
  'Model projection only — a possible edge based on formula output, not a guaranteed result. ' +
  'No bet is risk-free. Use bankroll discipline.';

/** Risk factors for an NHL totals projection. */
function buildHockeyRiskFactors(projectedTotal: number, line: number, probability: number): string[] {
  const risks: string[] = [];
  if (Math.abs(probability - 50) < 5) {
    risks.push('Projection is near a coin flip — small input changes can flip the lean.');
  }
  if (Math.abs(projectedTotal - line) < 0.25) {
    risks.push('Projected total sits almost exactly on the line — little margin for an edge.');
  }
  risks.push('Goalie confirmation matters: a backup/rookie start or a hot/cold goalie can swing the total.');
  risks.push('Model uses season-long rates; it does not see late scratches, back-to-backs, or empty-net variance.');
  return risks;
}

function getHockeyInterpretation(probability: number, betType: 'over' | 'under', line: number, projectedTotal: number): string {
  return 'Estimated ' + betType + ' ' + line + ' probability: ' + probability.toFixed(1) + '%. Projected total: ' + projectedTotal.toFixed(2) + '. This is an uncalibrated model estimate, not a value guarantee.';
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

  // The hockey tool requires all 7 stats per team, so inputs are always complete.
  const dataCompleteness = 1;

  const decision = evaluateDecision({
    modelProbabilityPct: probability,
    sideOdds: parsed.betOdds,
    otherSideOdds: parsed.oppOdds,
    dataCompleteness
  });

  const riskFactors = buildHockeyRiskFactors(result.projectedTotal, parsed.line, probability);

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
      pushProbability: result.pushProbability,
      standardDeviation: result.standardDeviation,
      zScore: result.zScore
    },
    decision,
    dataCompleteness,
    riskFactors,
    interpretation: getHockeyInterpretation(probability, parsed.betType, parsed.line, result.projectedTotal),
    disclaimer: HOCKEY_DISCLAIMER
  };
}
