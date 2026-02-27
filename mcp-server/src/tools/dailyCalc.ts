/**
 * Daily Calculations Tool
 *
 * Orchestrates the full daily betting analysis pipeline:
 *   1. Fetch today's games from ESPN (NBA + NFL)
 *   2. Look up team stats from CSV files
 *   3. Calculate win probability for each game
 *   4. Calculate Kelly Criterion optimal stake
 *   5. Log positive-edge bets to MongoDB under the admin account
 *   6. Return a daily summary report
 *
 * This runs automatically via a node-cron job at 9:00 AM UTC every day,
 * and can also be triggered manually via the MCP tool or HTTP endpoint.
 *
 * TOOL: run_daily_calculations
 * Triggers the daily game analysis pipeline and returns a summary of results.
 */

import { z } from 'zod';
import { getTodaysGames, DailyGame } from './gamesOfDay.js';
import { handleFootballProbability } from './probability.js';
import { handleBasketballProbability } from './probability.js';
import { handleKellyCalculation } from './kelly.js';
import { handleLogBet } from './betLogging.js';
import { getNBATeamStats, getNFLTeamStats, clearStatsCache } from '../utils/statsLoader.js';
import { isDatabaseConnected, ensureDatabaseConnection } from '../config/database.js';
import { User } from '../models/User.js';

// ============================================================================
// CONFIG
// ============================================================================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'cartercedrick35@gmail.com';
const DEFAULT_BANKROLL = parseFloat(process.env.DEFAULT_CALC_BANKROLL || '1000');
const DEFAULT_KELLY_FRACTION = 0.5;
const DEFAULT_AMERICAN_ODDS = -110;

// Implied probability from -110 odds: 110 / (110 + 100) = 52.38%
const IMPLIED_PROB_AT_MINUS_110 = 52.38;

// ============================================================================
// TYPES
// ============================================================================

export interface GameCalcResult {
  game: string;           // "Home Team vs Away Team (SPORT)"
  sport: 'NBA' | 'NFL' | 'NHL';
  homeTeam: string;
  awayTeam: string;
  probability: number;    // Calculated probability that home team covers
  impliedProbability: number;
  edge: number;           // probability - impliedProbability
  hasValue: boolean;
  kellyFraction: number;
  recommendedStake: number;
  stakePercentage: number;
  betLogged: boolean;
  betId?: string;
  skipped?: string;       // Reason if skipped (no stats, no value, etc.)
  error?: string;
}

export interface DailyCalcSummary {
  success: boolean;
  date: string;
  gamesAnalyzed: number;
  gamesSkipped: number;
  betsLogged: number;
  highValueBets: GameCalcResult[];
  allResults: GameCalcResult[];
  errors: string[];
  userId?: string;
}

export interface DailyCalcOptions {
  bankroll?: number;
  kellyFraction?: number;
  americanOdds?: number;
  logBets?: boolean;
  sport?: 'NBA' | 'NFL' | 'ALL';
}

// ============================================================================
// ADMIN USER LOOKUP
// ============================================================================

async function getAdminUserId(): Promise<string | null> {
  try {
    await ensureDatabaseConnection();
    const user = await User.findOne({ email: ADMIN_EMAIL });
    if (!user) {
      console.warn(`[DailyCalc] Admin user not found for email: ${ADMIN_EMAIL}`);
      return null;
    }
    return user.identifier;
  } catch (err) {
    console.error('[DailyCalc] Failed to find admin user:', err);
    return null;
  }
}

// ============================================================================
// SINGLE GAME CALCULATION
// ============================================================================

async function calcGame(
  game: DailyGame,
  bankroll: number,
  kellyFraction: number,
  americanOdds: number,
  userId: string | null,
  logBets: boolean
): Promise<GameCalcResult> {
  const label = `${game.homeTeam} vs ${game.awayTeam} (${game.sport})`;

  const baseResult: GameCalcResult = {
    game: label,
    sport: game.sport,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    probability: 0,
    impliedProbability: IMPLIED_PROB_AT_MINUS_110,
    edge: 0,
    hasValue: false,
    kellyFraction,
    recommendedStake: 0,
    stakePercentage: 0,
    betLogged: false,
  };

  // Only handle NBA and NFL (NHL needs a different stats loader - future enhancement)
  if (game.sport === 'NHL') {
    return { ...baseResult, skipped: 'NHL automated analysis not yet supported' };
  }

  // 1. Load team stats
  type TeamStats = ReturnType<typeof getNBATeamStats> | ReturnType<typeof getNFLTeamStats> | null;
  let homeStats: TeamStats = null;
  let awayStats: TeamStats = null;

  if (game.sport === 'NBA') {
    homeStats = getNBATeamStats(game.homeTeam) || getNBATeamStats(game.homeAbbr);
    awayStats = getNBATeamStats(game.awayTeam) || getNBATeamStats(game.awayAbbr);
  } else {
    homeStats = getNFLTeamStats(game.homeTeam) || getNFLTeamStats(game.homeAbbr);
    awayStats = getNFLTeamStats(game.awayTeam) || getNFLTeamStats(game.awayAbbr);
  }

  if (!homeStats) {
    return { ...baseResult, skipped: `No stats found for home team: ${game.homeTeam} (${game.homeAbbr})` };
  }
  if (!awayStats) {
    return { ...baseResult, skipped: `No stats found for away team: ${game.awayTeam} (${game.awayAbbr})` };
  }

  // 2. Calculate probability
  let probability = 0;
  let predictedMargin = 0;

  try {
    if (game.sport === 'NBA') {
      const nbaHome = homeStats as ReturnType<typeof getNBATeamStats>;
      const nbaAway = awayStats as ReturnType<typeof getNBATeamStats>;

      const probResult = await handleBasketballProbability({
        teamA: {
          name: game.homeTeam,
          ppg: nbaHome!.ppg,
          pointsAllowed: nbaHome!.pointsAllowed,
          fgPct: nbaHome!.fgPct,
          reboundMargin: nbaHome!.reboundMargin,
          turnoverMargin: nbaHome!.turnoverMargin,
          pace: nbaHome!.pace,
          threePRate: nbaHome!.threeRate,
          threePPct: nbaHome!.threePct,
        },
        teamB: {
          name: game.awayTeam,
          ppg: nbaAway!.ppg,
          pointsAllowed: nbaAway!.pointsAllowed,
          fgPct: nbaAway!.fgPct,
          reboundMargin: nbaAway!.reboundMargin,
          turnoverMargin: nbaAway!.turnoverMargin,
          pace: nbaAway!.pace,
          threePRate: nbaAway!.threeRate,
          threePPct: nbaAway!.threePct,
        },
        spread: 0,        // pick'em — we're calculating overall win probability
        venue: 'home',    // home team has home advantage
        league: 'NBA',
      });

      if (probResult.success) {
        probability = probResult.result.probability;
        predictedMargin = probResult.result.predictedMargin;
      }
    } else {
      // NFL
      const nflHome = homeStats as ReturnType<typeof getNFLTeamStats>;
      const nflAway = awayStats as ReturnType<typeof getNFLTeamStats>;

      const probResult = await handleFootballProbability({
        teamA: {
          name: game.homeTeam,
          ppg: nflHome!.ppg,
          pointsAllowed: nflHome!.pointsAllowed,
          offensiveYards: nflHome!.offensiveYards,
          defensiveYards: nflHome!.defensiveYards,
          turnoverDiff: nflHome!.turnoverDiff,
        },
        teamB: {
          name: game.awayTeam,
          ppg: nflAway!.ppg,
          pointsAllowed: nflAway!.pointsAllowed,
          offensiveYards: nflAway!.offensiveYards,
          defensiveYards: nflAway!.defensiveYards,
          turnoverDiff: nflAway!.turnoverDiff,
        },
        spread: 0,
        venue: 'home',
        league: 'NFL',
      });

      if (probResult.success) {
        probability = probResult.result.probability;
        predictedMargin = probResult.result.predictedMargin;
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ...baseResult, error: `Probability calculation failed: ${errMsg}` };
  }

  if (probability === 0) {
    return { ...baseResult, skipped: 'Probability calculation returned 0' };
  }

  // 3. Calculate Kelly
  const edge = probability - IMPLIED_PROB_AT_MINUS_110;
  const hasValue = edge > 0;

  let recommendedStake = 0;
  let stakePercentage = 0;

  try {
    const kellyResult = await handleKellyCalculation({
      bankroll,
      probability,
      americanOdds,
      fraction: kellyFraction,
    });

    if (kellyResult.success) {
      recommendedStake = kellyResult.result.recommendedStake;
      stakePercentage = kellyResult.result.stakePercentage;
    }
  } catch (err) {
    // Non-fatal: Kelly calc failed but we still have the probability
    console.warn(`[DailyCalc] Kelly calc failed for ${label}:`, err);
  }

  // 4. Log the bet if it has value and logging is enabled
  let betLogged = false;
  let betId: string | undefined;

  if (hasValue && logBets && userId) {
    try {
      const sportLabel = game.sport === 'NBA' ? 'basketball' : 'football';
      const logResult = await handleLogBet({
        userId,
        sport: sportLabel as 'basketball' | 'football',
        teamA: {
          name: game.homeTeam,
          abbreviation: game.homeAbbr,
        },
        teamB: {
          name: game.awayTeam,
          abbreviation: game.awayAbbr,
        },
        venue: 'home' as const,
        pointSpread: 0,
        calculatedProbability: probability,
        expectedMargin: predictedMargin,
        impliedProbability: IMPLIED_PROB_AT_MINUS_110,
        edge,
        bankroll,
        americanOdds,
        kellyFraction: kellyFraction >= 0.75 ? 1 : kellyFraction >= 0.4 ? 0.5 : 0.25,
        recommendedStake,
        stakePercentage,
        notes: `Auto-logged by daily cron job on ${new Date().toISOString().split('T')[0]}`,
        tags: ['auto', 'daily-cron', game.sport.toLowerCase()],
      });

      if (logResult.success) {
        betLogged = true;
        betId = logResult.betId;
      }
    } catch (err) {
      console.warn(`[DailyCalc] Bet logging failed for ${label}:`, err);
    }
  }

  return {
    game: label,
    sport: game.sport,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    probability,
    impliedProbability: IMPLIED_PROB_AT_MINUS_110,
    edge,
    hasValue,
    kellyFraction,
    recommendedStake,
    stakePercentage,
    betLogged,
    betId,
  };
}

// ============================================================================
// MAIN DAILY CALC FUNCTION
// ============================================================================

export async function runDailyCalculations(options: DailyCalcOptions = {}): Promise<DailyCalcSummary> {
  const {
    bankroll = DEFAULT_BANKROLL,
    kellyFraction = DEFAULT_KELLY_FRACTION,
    americanOdds = DEFAULT_AMERICAN_ODDS,
    logBets = true,
    sport = 'ALL',
  } = options;

  const today = new Date().toISOString().split('T')[0];
  console.log(`[DailyCalc] Starting daily calculations for ${today}`);
  console.log(`[DailyCalc] Settings: bankroll=$${bankroll}, kelly=${kellyFraction}, odds=${americanOdds}, logBets=${logBets}`);

  const summary: DailyCalcSummary = {
    success: false,
    date: today,
    gamesAnalyzed: 0,
    gamesSkipped: 0,
    betsLogged: 0,
    highValueBets: [],
    allResults: [],
    errors: [],
  };

  // Get admin user ID for logging
  let userId: string | null = null;
  if (logBets) {
    userId = await getAdminUserId();
    if (userId) {
      summary.userId = userId;
      console.log(`[DailyCalc] Logging bets under admin user`);
    } else {
      console.warn('[DailyCalc] Admin user not found — bets will not be logged');
    }
  }

  // Refresh stats cache before calculations
  clearStatsCache();

  // Fetch today's games
  const fetchSport = sport === 'ALL' ? 'ALL' : sport;
  let games: DailyGame[] = [];

  try {
    games = await getTodaysGames(fetchSport as 'NBA' | 'NFL' | 'ALL');
    // Filter to only scheduled or in_progress games (skip final/postponed)
    games = games.filter((g) => g.status === 'scheduled' || g.status === 'in_progress');
    console.log(`[DailyCalc] Found ${games.length} active games today`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`Failed to fetch games: ${errMsg}`);
    return summary;
  }

  if (games.length === 0) {
    console.log('[DailyCalc] No games scheduled today');
    summary.success = true;
    return summary;
  }

  // Process each game sequentially to avoid rate limits
  for (const game of games) {
    console.log(`[DailyCalc] Processing: ${game.awayTeam} @ ${game.homeTeam} (${game.sport})`);

    const result = await calcGame(game, bankroll, kellyFraction, americanOdds, userId, logBets);
    summary.allResults.push(result);

    if (result.skipped) {
      summary.gamesSkipped++;
      console.log(`[DailyCalc]   Skipped: ${result.skipped}`);
    } else if (result.error) {
      summary.errors.push(`${result.game}: ${result.error}`);
      summary.gamesSkipped++;
    } else {
      summary.gamesAnalyzed++;
      if (result.hasValue) {
        summary.highValueBets.push(result);
        if (result.betLogged) summary.betsLogged++;
        console.log(`[DailyCalc]   Value bet: prob=${result.probability.toFixed(1)}%, edge=${result.edge.toFixed(1)}%, stake=$${result.recommendedStake.toFixed(2)}`);
      } else {
        console.log(`[DailyCalc]   No value: prob=${result.probability.toFixed(1)}% (need >52.4%)`);
      }
    }
  }

  summary.success = true;
  console.log(`[DailyCalc] Done. ${summary.gamesAnalyzed} analyzed, ${summary.highValueBets.length} value bets, ${summary.betsLogged} logged`);

  return summary;
}

// ============================================================================
// MCP TOOL
// ============================================================================

export const runDailyCalcToolDefinition = {
  name: 'run_daily_calculations',
  description: 'Run the daily betting analysis pipeline: fetch today\'s NBA and NFL games, calculate win probabilities using team stats, apply Kelly Criterion for optimal stake sizing, and log positive-edge bets to the database. Returns a summary of all analyzed games and identified value bets.',
};

export const runDailyCalcInputSchema = z.object({
  bankroll: z
    .number()
    .positive()
    .optional()
    .describe(`Bankroll in USD. Defaults to ${DEFAULT_BANKROLL}.`),
  kellyFraction: z
    .number()
    .min(0.1)
    .max(1)
    .optional()
    .describe('Kelly multiplier (0.1–1). Defaults to 0.5 (half Kelly).'),
  americanOdds: z
    .number()
    .optional()
    .describe('Default American odds if not available from ESPN. Defaults to -110.'),
  logBets: z
    .boolean()
    .optional()
    .describe('Whether to log positive-edge bets to MongoDB. Defaults to true.'),
  sport: z
    .enum(['NBA', 'NFL', 'ALL'])
    .optional()
    .describe('Which sport to analyze. Defaults to ALL.'),
});

export async function handleRunDailyCalc(
  params: z.infer<typeof runDailyCalcInputSchema>
): Promise<DailyCalcSummary> {
  return runDailyCalculations({
    bankroll: params.bankroll,
    kellyFraction: params.kellyFraction,
    americanOdds: params.americanOdds,
    logBets: params.logBets !== false,
    sport: (params.sport || 'ALL') as 'NBA' | 'NFL' | 'ALL',
  });
}
