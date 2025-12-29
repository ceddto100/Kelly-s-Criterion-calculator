/**
 * Betting Workflow Orchestration Tool
 *
 * This module provides a single entry-point MCP tool that orchestrates the complete
 * end-to-end betting workflow. Given a natural language betting request, it:
 *
 * 1. Parses the input to extract sport, teams, spread, pick, venue, and odds
 * 2. Estimates the probability of covering the spread
 * 3. Calculates optimal bet sizing using Kelly Criterion
 * 4. Logs the bet to the database
 * 5. Returns a comprehensive summary
 *
 * TOOL: analyze_matchup_and_log_bet
 * The main orchestration tool that takes a natural language betting request like
 * "NBA: Heat vs Hawks, Hawks -3.5, I'm taking Hawks. Game is in Atlanta."
 * and automatically handles the complete workflow.
 */

import { z } from 'zod';
import { parseMatchupRequest, validateParsedMatchup, ParsedMatchup } from '../utils/matchupParser.js';
import { getSportCategory, Sport } from '../utils/teamData.js';
import { handleFootballProbability, handleBasketballProbability } from './probability.js';
import { handleKellyCalculation } from './kelly.js';
import { handleLogBet } from './betLogging.js';
import { handleImpliedProbability } from './oddsConversion.js';
import { isDatabaseConnected } from '../config/database.js';
import { calculateKellyStake, impliedProbability, americanToDecimal } from '../utils/calculations.js';
import {
  getTeamStats,
  areStatsAvailable,
  NBATeamStats,
  NFLTeamStats
} from '../utils/statsLoader.js';

// ============================================================================
// INPUT SCHEMA
// ============================================================================

export const orchestrationInputSchema = z.object({
  userText: z
    .string()
    .min(10)
    .describe('Natural language betting request. Example: "NBA: Heat vs Hawks, Hawks -3.5, I\'m taking Hawks. Game is in Atlanta."'),

  bankroll: z
    .number()
    .positive()
    .optional()
    .describe('Total bankroll in USD. If not provided, defaults to 1000.'),

  americanOdds: z
    .number()
    .optional()
    .describe('American odds for the bet. If not provided, defaults to -110.'),

  kellyFraction: z
    .number()
    .min(0.1)
    .max(1)
    .optional()
    .default(0.5)
    .describe('Kelly fraction multiplier (0.1-1). Defaults to 0.5 (half Kelly) for conservative sizing.'),

  userId: z
    .string()
    .optional()
    .describe('User ID for bet logging. If not provided, uses "anonymous".'),

  logBet: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to log the bet to the database. Defaults to true.'),

  // Optional team stats overrides (if user has better data)
  teamAStats: z
    .object({
      ppg: z.number().optional().describe('Points per game'),
      pointsAllowed: z.number().optional().describe('Points allowed per game'),
      fgPct: z.number().optional().describe('Field goal percentage (basketball)'),
      reboundMargin: z.number().optional().describe('Rebound margin (basketball)'),
      turnoverMargin: z.number().optional().describe('Turnover margin'),
      offensiveYards: z.number().optional().describe('Offensive yards per game (football)'),
      defensiveYards: z.number().optional().describe('Defensive yards allowed (football)')
    })
    .optional()
    .describe('Custom stats for picked team (overrides defaults)'),

  teamBStats: z
    .object({
      ppg: z.number().optional().describe('Points per game'),
      pointsAllowed: z.number().optional().describe('Points allowed per game'),
      fgPct: z.number().optional().describe('Field goal percentage (basketball)'),
      reboundMargin: z.number().optional().describe('Rebound margin (basketball)'),
      turnoverMargin: z.number().optional().describe('Turnover margin'),
      offensiveYards: z.number().optional().describe('Offensive yards per game (football)'),
      defensiveYards: z.number().optional().describe('Defensive yards allowed (football)')
    })
    .optional()
    .describe('Custom stats for opponent team (overrides defaults)')
});

export type OrchestrationInput = z.infer<typeof orchestrationInputSchema>;

// ============================================================================
// DEFAULT TEAM STATS
// ============================================================================

// League average stats for when specific stats aren't provided
const DEFAULT_STATS = {
  NFL: {
    ppg: 22.5,
    pointsAllowed: 22.5,
    offensiveYards: 340,
    defensiveYards: 340,
    turnoverDiff: 0
  },
  CFB: {
    ppg: 28,
    pointsAllowed: 28,
    offensiveYards: 380,
    defensiveYards: 380,
    turnoverDiff: 0
  },
  NBA: {
    ppg: 114,
    pointsAllowed: 114,
    fgPct: 47,
    reboundMargin: 0,
    turnoverMargin: 0
  },
  CBB: {
    ppg: 72,
    pointsAllowed: 72,
    fgPct: 45,
    reboundMargin: 0,
    turnoverMargin: 0
  }
};

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const orchestrationToolDefinition = {
  name: 'analyze_matchup_and_log_bet',
  description: `Parse a natural-language bet, fetch team stats, estimate probability, compute Kelly stake, and optionally log the bet.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      userText: {
        type: 'string',
        description: 'Natural language betting request',
        minLength: 10
      },
      bankroll: {
        type: 'number',
        description: 'Total bankroll in USD (default: 1000)',
        minimum: 1
      },
      americanOdds: {
        type: 'number',
        description: 'American odds (default: -110)'
      },
      kellyFraction: {
        type: 'number',
        description: 'Kelly fraction 0.1-1 (default: 0.5 for half Kelly)',
        minimum: 0.1,
        maximum: 1,
        default: 0.5
      },
      userId: {
        type: 'string',
        description: 'User ID for bet logging (default: "anonymous")'
      },
      logBet: {
        type: 'boolean',
        description: 'Whether to log bet to database (default: true)',
        default: true
      },
      teamAStats: {
        type: 'object',
        description: 'Custom stats for picked team',
        properties: {
          ppg: { type: 'number', description: 'Points per game' },
          pointsAllowed: { type: 'number', description: 'Points allowed per game' },
          fgPct: { type: 'number', description: 'Field goal percentage' },
          reboundMargin: { type: 'number', description: 'Rebound margin' },
          turnoverMargin: { type: 'number', description: 'Turnover margin' },
          offensiveYards: { type: 'number', description: 'Offensive yards' },
          defensiveYards: { type: 'number', description: 'Defensive yards' }
        }
      },
      teamBStats: {
        type: 'object',
        description: 'Custom stats for opponent team',
        properties: {
          ppg: { type: 'number', description: 'Points per game' },
          pointsAllowed: { type: 'number', description: 'Points allowed per game' },
          fgPct: { type: 'number', description: 'Field goal percentage' },
          reboundMargin: { type: 'number', description: 'Rebound margin' },
          turnoverMargin: { type: 'number', description: 'Turnover margin' },
          offensiveYards: { type: 'number', description: 'Offensive yards' },
          defensiveYards: { type: 'number', description: 'Defensive yards' }
        }
      }
    },
    required: ['userText']
  }
};

// ============================================================================
// HANDLER
// ============================================================================

export interface OrchestrationOutput {
  success: boolean;
  workflow: {
    step1_parsing: {
      success: boolean;
      sport: Sport;
      matchup: string;
      pick: string;
      spread: number;
      venue: 'home' | 'away' | 'neutral';
      venueAssumed: boolean;
      parsingNotes: string[];
    };
    step2_probability: {
      success: boolean;
      coverProbability: number;
      predictedMargin: number;
      interpretation: string;
    };
    step3_odds: {
      americanOdds: number;
      decimalOdds: number;
      impliedProbability: number;
      oddsAssumed: boolean;
    };
    step4_kelly: {
      success: boolean;
      edge: number;
      hasValue: boolean;
      kellyFraction: number;
      adjustedKellyFraction: number;
      recommendedStake: number;
      stakePercentage: number;
      potentialWin: number;
      recommendation: string;
    };
    step5_logging?: {
      success: boolean;
      betId?: string;
      message: string;
    };
  };
  summary: {
    human: string;
    data: {
      sport: Sport;
      matchup: string;
      pick: string;
      spread: number;
      venue: string;
      coverProbability: number;
      americanOdds: number;
      impliedProbability: number;
      edge: number;
      hasValue: boolean;
      bankroll: number;
      kellyFraction: number;
      recommendedStake: number;
      stakePercentage: number;
      potentialWin: number;
      potentialPayout: number;
      betId?: string;
    };
  };
  assumptions: string[];
  rawInput: string;
}

export async function handleOrchestration(input: unknown): Promise<OrchestrationOutput> {
  const parsed = orchestrationInputSchema.parse(input);
  const assumptions: string[] = [];

  // =========================================================================
  // STEP 1: Parse Natural Language
  // =========================================================================

  const parsingResult = parseMatchupRequest(parsed.userText);

  if (!parsingResult.success || !parsingResult.parsed) {
    throw new Error(parsingResult.error || 'Failed to parse betting request');
  }

  const matchup = parsingResult.parsed;
  assumptions.push(...matchup.parsingNotes);

  // Validate parsing
  const validation = validateParsedMatchup(matchup);
  if (!validation.valid) {
    throw new Error(`Parsing validation failed: ${validation.errors.join(', ')}`);
  }

  // =========================================================================
  // STEP 2: Fetch Team Stats and Estimate Probability
  // =========================================================================

  // Try to fetch real stats from CSV files
  const sportDefaults = DEFAULT_STATS[matchup.sport];
  let teamAFetchedStats: NBATeamStats | NFLTeamStats | null = null;
  let teamBFetchedStats: NBATeamStats | NFLTeamStats | null = null;
  let statsSource = 'defaults';

  try {
    // Fetch stats for Team A (user's pick)
    teamAFetchedStats = getTeamStats(
      matchup.teamA.abbreviation || matchup.teamA.name,
      matchup.sport
    );

    // Fetch stats for Team B (opponent)
    teamBFetchedStats = getTeamStats(
      matchup.teamB.abbreviation || matchup.teamB.name,
      matchup.sport
    );

    if (teamAFetchedStats && teamBFetchedStats) {
      statsSource = 'fetched';
      assumptions.push(`Using real stats from database for ${matchup.teamA.name} and ${matchup.teamB.name}`);
    } else if (teamAFetchedStats) {
      assumptions.push(`Using real stats for ${matchup.teamA.name}, defaults for ${matchup.teamB.name}`);
    } else if (teamBFetchedStats) {
      assumptions.push(`Using real stats for ${matchup.teamB.name}, defaults for ${matchup.teamA.name}`);
    }
  } catch (error) {
    assumptions.push(`Stats fetch failed, using league averages: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  let probabilityResult: {
    success: boolean;
    result: {
      probability: number;
      predictedMargin: number;
    };
    interpretation: string;
  };

  if (matchup.sportCategory === 'football') {
    // Build Team A stats: user override > fetched > defaults
    const teamANFL = teamAFetchedStats as NFLTeamStats | null;
    const teamBNFL = teamBFetchedStats as NFLTeamStats | null;

    const footballInput = {
      teamA: {
        name: matchup.teamA.name,
        ppg: parsed.teamAStats?.ppg ?? teamANFL?.ppg ?? sportDefaults.ppg,
        pointsAllowed: parsed.teamAStats?.pointsAllowed ?? teamANFL?.pointsAllowed ?? sportDefaults.pointsAllowed,
        offensiveYards: parsed.teamAStats?.offensiveYards ?? teamANFL?.offensiveYards ?? (sportDefaults as any).offensiveYards,
        defensiveYards: parsed.teamAStats?.defensiveYards ?? teamANFL?.defensiveYards ?? (sportDefaults as any).defensiveYards,
        turnoverDiff: parsed.teamAStats?.turnoverMargin ?? teamANFL?.turnoverDiff ?? (sportDefaults as any).turnoverDiff
      },
      teamB: {
        name: matchup.teamB.name,
        ppg: parsed.teamBStats?.ppg ?? teamBNFL?.ppg ?? sportDefaults.ppg,
        pointsAllowed: parsed.teamBStats?.pointsAllowed ?? teamBNFL?.pointsAllowed ?? sportDefaults.pointsAllowed,
        offensiveYards: parsed.teamBStats?.offensiveYards ?? teamBNFL?.offensiveYards ?? (sportDefaults as any).offensiveYards,
        defensiveYards: parsed.teamBStats?.defensiveYards ?? teamBNFL?.defensiveYards ?? (sportDefaults as any).defensiveYards,
        turnoverDiff: parsed.teamBStats?.turnoverMargin ?? teamBNFL?.turnoverDiff ?? (sportDefaults as any).turnoverDiff
      },
      spread: matchup.spread,
      venue: matchup.venue,
      league: matchup.sport as 'NFL' | 'CFB'
    };

    probabilityResult = await handleFootballProbability(footballInput);

    if (!teamAFetchedStats && !teamBFetchedStats && !parsed.teamAStats && !parsed.teamBStats) {
      assumptions.push(`Using league average stats for ${matchup.sport} (no specific stats available)`);
    }
  } else {
    // Build Team A stats: user override > fetched > defaults
    const teamANBA = teamAFetchedStats as NBATeamStats | null;
    const teamBNBA = teamBFetchedStats as NBATeamStats | null;

    const basketballInput = {
      teamA: {
        name: matchup.teamA.name,
        ppg: parsed.teamAStats?.ppg ?? teamANBA?.ppg ?? sportDefaults.ppg,
        pointsAllowed: parsed.teamAStats?.pointsAllowed ?? teamANBA?.pointsAllowed ?? sportDefaults.pointsAllowed,
        fgPct: parsed.teamAStats?.fgPct ?? teamANBA?.fgPct ?? (sportDefaults as any).fgPct,
        reboundMargin: parsed.teamAStats?.reboundMargin ?? teamANBA?.reboundMargin ?? (sportDefaults as any).reboundMargin,
        turnoverMargin: parsed.teamAStats?.turnoverMargin ?? teamANBA?.turnoverMargin ?? (sportDefaults as any).turnoverMargin
      },
      teamB: {
        name: matchup.teamB.name,
        ppg: parsed.teamBStats?.ppg ?? teamBNBA?.ppg ?? sportDefaults.ppg,
        pointsAllowed: parsed.teamBStats?.pointsAllowed ?? teamBNBA?.pointsAllowed ?? sportDefaults.pointsAllowed,
        fgPct: parsed.teamBStats?.fgPct ?? teamBNBA?.fgPct ?? (sportDefaults as any).fgPct,
        reboundMargin: parsed.teamBStats?.reboundMargin ?? teamBNBA?.reboundMargin ?? (sportDefaults as any).reboundMargin,
        turnoverMargin: parsed.teamBStats?.turnoverMargin ?? teamBNBA?.turnoverMargin ?? (sportDefaults as any).turnoverMargin
      },
      spread: matchup.spread,
      venue: matchup.venue,
      league: matchup.sport as 'NBA' | 'CBB'
    };

    probabilityResult = await handleBasketballProbability(basketballInput);

    if (!teamAFetchedStats && !teamBFetchedStats && !parsed.teamAStats && !parsed.teamBStats) {
      assumptions.push(`Using league average stats for ${matchup.sport} (no specific stats available)`);
    }
  }

  // =========================================================================
  // STEP 3: Handle Odds
  // =========================================================================

  const americanOdds = parsed.americanOdds ?? matchup.americanOdds ?? -110;
  const oddsAssumed = !parsed.americanOdds && !matchup.americanOdds;

  if (oddsAssumed) {
    assumptions.push('Odds assumed as -110 (standard juice)');
  }

  const decimalOdds = americanToDecimal(americanOdds);
  const impliedProb = impliedProbability(americanOdds);

  // =========================================================================
  // STEP 4: Kelly Criterion Calculation
  // =========================================================================

  const bankroll = parsed.bankroll ?? 1000;
  const kellyFrac = parsed.kellyFraction ?? 0.5;

  if (!parsed.bankroll) {
    assumptions.push('Bankroll assumed as $1000 (not provided)');
  }

  const kellyResult = calculateKellyStake(
    bankroll,
    probabilityResult.result.probability,
    americanOdds,
    kellyFrac
  );

  // Build recommendation
  let recommendation: string;
  if (!kellyResult.hasValue) {
    recommendation = 'NO BET: Negative expected value. Estimated probability is below implied odds probability.';
  } else if (kellyResult.edge > 10) {
    recommendation = `STRONG VALUE: ${kellyResult.edge.toFixed(1)}% edge. Verify probability estimate before betting.`;
  } else if (kellyResult.edge > 5) {
    recommendation = `GOOD VALUE: ${kellyResult.edge.toFixed(1)}% edge. Recommended stake: $${kellyResult.recommendedStake.toFixed(2)}`;
  } else if (kellyResult.edge > 2) {
    recommendation = `MODERATE VALUE: ${kellyResult.edge.toFixed(1)}% edge. Consider ${kellyFrac < 0.5 ? 'quarter' : 'half'} Kelly.`;
  } else {
    recommendation = `SLIGHT VALUE: ${kellyResult.edge.toFixed(1)}% edge. Small edge - proceed with caution.`;
  }

  // =========================================================================
  // STEP 5: Log Bet (Optional)
  // =========================================================================

  let loggingResult: { success: boolean; betId?: string; message: string } | undefined;

  if (parsed.logBet && isDatabaseConnected()) {
    try {
      const logInput = {
        userId: parsed.userId ?? 'anonymous',
        sport: matchup.sportCategory,
        teamA: {
          name: matchup.teamA.name,
          abbreviation: matchup.teamA.abbreviation
        },
        teamB: {
          name: matchup.teamB.name,
          abbreviation: matchup.teamB.abbreviation
        },
        venue: matchup.venue,
        pointSpread: matchup.spread,
        calculatedProbability: probabilityResult.result.probability,
        expectedMargin: probabilityResult.result.predictedMargin,
        impliedProbability: impliedProb,
        edge: kellyResult.edge,
        bankroll,
        americanOdds,
        kellyFraction: kellyFrac as 0.25 | 0.5 | 1,
        recommendedStake: kellyResult.recommendedStake,
        stakePercentage: kellyResult.stakePercentage,
        notes: `Auto-logged via orchestration. Raw input: "${parsed.userText.substring(0, 100)}"`,
        tags: ['orchestration', matchup.sport.toLowerCase()]
      };

      const logResult = await handleLogBet(logInput);
      loggingResult = {
        success: true,
        betId: logResult.betId,
        message: logResult.message
      };
    } catch (error) {
      loggingResult = {
        success: false,
        message: `Failed to log bet: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  } else if (parsed.logBet && !isDatabaseConnected()) {
    loggingResult = {
      success: false,
      message: 'Database not connected - bet not logged'
    };
    assumptions.push('Bet not logged (database unavailable)');
  }

  // =========================================================================
  // BUILD RESPONSE
  // =========================================================================

  const matchupString = `${matchup.teamA.name} vs ${matchup.teamB.name}`;
  const venueString = matchup.venueAssumed
    ? `${matchup.venue} (assumed)`
    : matchup.venue;

  // Human-readable summary
  const humanSummary = `
## Betting Analysis Summary

**Matchup:** ${matchupString}
**Sport:** ${matchup.sport}
**Pick:** ${matchup.teamA.name} ${matchup.spread > 0 ? '+' : ''}${matchup.spread}
**Venue:** ${venueString}

### Probability Analysis
- **Cover Probability:** ${probabilityResult.result.probability.toFixed(1)}%
- **Predicted Margin:** ${probabilityResult.result.predictedMargin > 0 ? '+' : ''}${probabilityResult.result.predictedMargin.toFixed(1)} points
- ${probabilityResult.interpretation}

### Odds & Value
- **Odds:** ${americanOdds > 0 ? '+' : ''}${americanOdds} (${decimalOdds.toFixed(3)} decimal)
- **Implied Probability:** ${impliedProb.toFixed(1)}%
- **Your Edge:** ${kellyResult.edge > 0 ? '+' : ''}${kellyResult.edge.toFixed(1)}%
- **Has Value:** ${kellyResult.hasValue ? 'YES' : 'NO'}

### Kelly Criterion (${kellyFrac === 1 ? 'Full' : kellyFrac === 0.5 ? 'Half' : 'Quarter'} Kelly)
- **Bankroll:** $${bankroll.toLocaleString()}
- **Kelly Fraction:** ${(kellyResult.adjustedKellyFraction * 100).toFixed(2)}%
- **Recommended Stake:** $${kellyResult.recommendedStake.toFixed(2)} (${kellyResult.stakePercentage.toFixed(2)}%)
- **Potential Win:** $${kellyResult.potentialWin.toFixed(2)}
- **Potential Payout:** $${kellyResult.potentialPayout.toFixed(2)}

### Recommendation
${recommendation}

${loggingResult?.success ? `**Bet Logged:** ${loggingResult.betId}` : ''}
${assumptions.length > 0 ? `\n### Assumptions Made\n${assumptions.map(a => `- ${a}`).join('\n')}` : ''}
`.trim();

  return {
    success: true,
    workflow: {
      step1_parsing: {
        success: true,
        sport: matchup.sport,
        matchup: matchupString,
        pick: matchup.teamA.name,
        spread: matchup.spread,
        venue: matchup.venue,
        venueAssumed: matchup.venueAssumed,
        parsingNotes: matchup.parsingNotes
      },
      step2_probability: {
        success: true,
        coverProbability: probabilityResult.result.probability,
        predictedMargin: probabilityResult.result.predictedMargin,
        interpretation: probabilityResult.interpretation
      },
      step3_odds: {
        americanOdds,
        decimalOdds,
        impliedProbability: impliedProb,
        oddsAssumed
      },
      step4_kelly: {
        success: true,
        edge: kellyResult.edge,
        hasValue: kellyResult.hasValue,
        kellyFraction: kellyResult.kellyFraction,
        adjustedKellyFraction: kellyResult.adjustedKellyFraction,
        recommendedStake: kellyResult.recommendedStake,
        stakePercentage: kellyResult.stakePercentage,
        potentialWin: kellyResult.potentialWin,
        recommendation
      },
      step5_logging: loggingResult
    },
    summary: {
      human: humanSummary,
      data: {
        sport: matchup.sport,
        matchup: matchupString,
        pick: matchup.teamA.name,
        spread: matchup.spread,
        venue: venueString,
        coverProbability: probabilityResult.result.probability,
        americanOdds,
        impliedProbability: impliedProb,
        edge: kellyResult.edge,
        hasValue: kellyResult.hasValue,
        bankroll,
        kellyFraction: kellyFrac,
        recommendedStake: kellyResult.recommendedStake,
        stakePercentage: kellyResult.stakePercentage,
        potentialWin: kellyResult.potentialWin,
        potentialPayout: kellyResult.potentialPayout,
        betId: loggingResult?.betId
      }
    },
    assumptions,
    rawInput: parsed.userText
  };
}
