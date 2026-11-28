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
import { getTodaysGames, DailyGame, easternDate } from './gamesOfDay.js';
import { handleKellyCalculation } from './kelly.js';
import { handleLogBet } from './betLogging.js';
import { getNBATeamStats, getNFLTeamStats, getNHLTeamStats, getAllNHLTeams, clearStatsCache } from '../utils/statsLoader.js';
import { isDatabaseConnected, ensureDatabaseConnection } from '../config/database.js';
import { User } from '../models/User.js';
import { BetLog } from '../models/BetLog.js';
import { handleRecordProjection, settlePendingProjections, type SettleSummary } from './projectionLog.js';
import { evaluateDecision, fairImpliedPct } from '../utils/decision.js';
import type { ProjectionTrack } from '../models/Projection.js';
import { priceNHLTotal, priceSpread } from '../utils/marketPricing.js';
import {
  estimateBasketballProbability,
  estimateFootballProbability,
  normCdf,
  type BasketballStats,
  type FootballStats,
} from '../utils/calculations.js';
import { calculateNHLProjection, NHL_CONFIG } from '../utils/nhl.js';
import { projectMLBGame } from '../utils/mlb.js';
import {
  fetchMLBSchedule,
  fetchMLBTotals,
  fetchMLBGameInputs,
  type TeamSeasonOffense,
} from '../utils/mlbDataService.js';

// ============================================================================
// CONFIG
// ============================================================================

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'cartercedrick35@gmail.com';
const DEFAULT_BANKROLL = parseFloat(process.env.DEFAULT_CALC_BANKROLL || '1000');
const DEFAULT_KELLY_FRACTION = 0.5;
const DEFAULT_AMERICAN_ODDS = -110;

// Implied probability from -110 odds: 110 / (110 + 100) = 52.38%
const IMPLIED_PROB_AT_MINUS_110 = 52.38;
const IMPLIED_ODDS_FALLBACK = -110;

// The daily gap pick (the lean with the biggest model-vs-market gap) is staked
// flat at this percent of the bankroll, so every one counts the same in units.
const GAP_PICK_STAKE_PCT = parseFloat(process.env.DAILY_GAP_PICK_STAKE_PCT || '1') || 1;

// Version tag stored with every recorded projection so backtests can compare
// model iterations head-to-head. Bump when the formulas/config change materially.
// v2 (Nov 2026): games-played shrinkage, market-anchored probabilities, real
// prices, NHL overtime/shootout goal and push-free probabilities.
const MODEL_VERSION = 'daily-v2';

// ============================================================================
// TYPES
// ============================================================================

export interface GameCalcResult {
  game: string;           // "Home Team vs Away Team (SPORT)"
  sport: 'NBA' | 'NFL' | 'NHL' | 'MLB';
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
  projectionRecorded?: boolean;  // Whether a backtesting projection was stored
  skipped?: string;       // Reason if skipped (no stats, no value, etc.)
  error?: string;
}

/**
 * A game the model has an opinion on, reduced to "the side we'd bet and how
 * likely we think it is". Collected from every sport during the run so the
 * random-picks mode can choose N games across NBA/NFL/NHL/MLB.
 */
export interface PickCandidate {
  sport: 'NBA' | 'NFL' | 'NHL' | 'MLB';
  sportLabel: 'basketball' | 'football' | 'hockey' | 'baseball';
  homeTeam: string;
  homeAbbr?: string;
  awayTeam: string;
  awayAbbr?: string;
  market: 'moneyline' | 'spread' | 'total';
  /** Human-readable pick, e.g. "Boston Celtics -2.5" or "Over 6.5". */
  pick: string;
  /** Team being backed (moneyline) — used as teamA in the bet log. */
  pickedSide: 'home' | 'away' | 'over' | 'under';
  /**
   * Book line: the total for totals bets, the picked team's spread for spread
   * bets (negative = favored). Only real sportsbook lines are ever used.
   */
  line: number;
  /**
   * Probability (%) that the picked side wins, anchored to the market and
   * excluding pushes. This is what Kelly sizes.
   */
  probability: number;
  /** American price of the picked side (the book's, or a standard-vig estimate). */
  americanOdds?: number;
  /** Break-even probability (%) of that price: bet only above it. */
  breakEvenPct?: number;
  /** Model-only probability (%) before anchoring, for transparency. */
  modelProbability?: number;
  expectedMargin?: number;
  /**
   * Stable provider game id tag (e.g. "gid-espn-nba-401585123", "gid-mlb-745001").
   * Used to make sure a game is only ever logged once, across all days.
   */
  gameIdTag?: string;
}

/**
 * One tracked lean (the side the model alone prefers against the real line),
 * with how far the model is from the market's fair probability. The lean with
 * the biggest gap each day is logged to the admin as the "gap pick".
 */
export interface GapCandidate extends PickCandidate {
  /** Model probability minus market fair probability, in percentage points. */
  gap: number;
  /** Market's no-vig probability (%) of the same side. */
  marketProbability: number;
}

export interface LoggedPick {
  game: string;
  sport: PickCandidate['sport'];
  market: PickCandidate['market'];
  pick: string;
  probability: number;
  edge: number;
  recommendedStake: number;
  stakePercentage: number;
  betLogged: boolean;
  betId?: string;
  error?: string;
}

export interface DailyCalcSummary {
  success: boolean;
  date: string;
  gamesAnalyzed: number;
  gamesSkipped: number;
  betsLogged: number;
  projectionsRecorded: number;
  highValueBets: GameCalcResult[];
  allResults: GameCalcResult[];
  errors: string[];
  userId?: string;
  /** Present when the run used random-picks mode. */
  randomPicks?: LoggedPick[];
  /** Present when the run used all-picks mode. */
  allPicks?: LoggedPick[];
  /** The day's gap pick, when one was logged on this run. */
  gapPick?: LoggedPick & { gap: number; modelProbability: number; marketProbability: number };
  /** Earlier games graded at the start of this run (tracked leans included). */
  settled?: SettleSummary;
}

export interface DailyCalcOptions {
  bankroll?: number;
  kellyFraction?: number;
  americanOdds?: number;
  logBets?: boolean;
  /**
   * Record every analyzed game as a backtesting projection (moneyline market,
   * home perspective) with its stat snapshot. Independent of logBets: bets are
   * only the value plays, projections capture the model's opinion on every game.
   * Defaults to true.
   */
  recordProjections?: boolean;
  sport?: 'NBA' | 'NFL' | 'NHL' | 'MLB' | 'ALL';
  /**
   * Random-picks mode: instead of logging every positive-edge NBA/NFL bet,
   * randomly choose this many games across all sports (NBA, NFL, NHL, MLB),
   * bet the side the model favors, size it with `kellyFraction` (half Kelly by
   * default) and log exactly those bets to the admin account. Games where the
   * model shows a positive edge are drawn first; remaining slots are filled
   * from the other games (their Kelly stake will be $0). Idempotent per day:
   * if random picks were already logged today, nothing new is logged.
   * 0 / undefined disables it.
   */
  randomPicks?: number;
  /**
   * All-picks mode: log a fractional-Kelly bet on the model's side of every
   * positive-edge game in `allPicksSports` (NBA, NFL, NHL by default) to the admin
   * account. Takes precedence over `randomPicks`. Each game is logged at most
   * once per day, so re-runs only add games that were not logged yet (e.g. an
   * NHL total whose line was posted late).
   */
  allPicks?: boolean;
  /** Sports included in all-picks mode. Defaults to NBA, NFL and NHL. */
  allPicksSports?: PickCandidate['sport'][];
  /**
   * Gap pick: log the single lean with the biggest model-vs-market gap as a
   * flat-stake bet to the admin, so it is graded in the Founder's Track Record.
   * Once per day (the first run with a lined game picks it). Defaults to true
   * whenever logBets is on.
   */
  gapPick?: boolean;
}

export const DEFAULT_ALL_PICKS_SPORTS: PickCandidate['sport'][] = ['NBA', 'NFL', 'NHL'];

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
// NHL GAME CALCULATION (totals / over-under market)
// ============================================================================

/**
 * Project an NHL game's total goals using the hockey engine, then record it as a
 * backtesting projection on the totals market. NHL bets are NOT auto-logged as
 * wagers (the daily bet-logging flow is spread/moneyline-shaped); NHL is
 * analysis + backtesting only. Requires an ESPN over/under line to lean — when
 * the line is missing we still record the projected total with a no-bet lean so
 * the model's opinion is captured.
 */
async function calcNHLGame(
  game: DailyGame,
  recordProjections: boolean,
  collector?: PickCandidate[],
  gapCollector?: GapCandidate[]
): Promise<GameCalcResult> {
  const label = `${game.homeTeam} vs ${game.awayTeam} (NHL)`;
  const baseResult: GameCalcResult = {
    game: label,
    sport: 'NHL',
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    probability: 0,
    impliedProbability: IMPLIED_PROB_AT_MINUS_110,
    edge: 0,
    hasValue: false,
    kellyFraction: 0,
    recommendedStake: 0,
    stakePercentage: 0,
    betLogged: false,
  };

  const homeStats = getNHLTeamStats(game.homeTeam) || getNHLTeamStats(game.homeAbbr);
  const awayStats = getNHLTeamStats(game.awayTeam) || getNHLTeamStats(game.awayAbbr);
  if (!homeStats) {
    return { ...baseResult, skipped: `No NHL stats for home team: ${game.homeTeam} (${game.homeAbbr})` };
  }
  if (!awayStats) {
    return { ...baseResult, skipped: `No NHL stats for away team: ${game.awayTeam} (${game.awayAbbr})` };
  }

  // The model needs a line to price; default to a typical NHL total when ESPN
  // has none so we can still produce a projected total to record.
  const line = game.overUnder ?? 6.0;

  let projection: ReturnType<typeof calculateNHLProjection>;
  try {
    projection = calculateNHLProjection(homeStats, awayStats, line);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ...baseResult, error: `NHL projection failed: ${errMsg}` };
  }
  const projectedTotal = projection.projectedTotal;
  if (!(projectedTotal > 0)) {
    return { ...baseResult, skipped: 'NHL projection returned 0' };
  }

  const side = priceNHLTotal(game, line, projection, nhlLeagueGoalsPerTeam());
  const overSide = side.pickedSide === 'over';

  // Only a real sportsbook line makes a bettable total, and only before puck drop.
  if (collector && game.overUnder !== undefined && game.status === 'scheduled') {
    collector.push({
      sport: 'NHL',
      sportLabel: 'hockey',
      homeTeam: game.homeTeam,
      homeAbbr: game.homeAbbr,
      awayTeam: game.awayTeam,
      awayAbbr: game.awayAbbr,
      market: 'total',
      pick: `${overSide ? 'Over' : 'Under'} ${game.overUnder}`,
      pickedSide: side.pickedSide,
      line: game.overUnder,
      probability: side.probability,
      americanOdds: side.americanOdds,
      breakEvenPct: side.breakEvenPct,
      modelProbability: side.modelProbability,
      expectedMargin: projectedTotal - game.overUnder,
      gameIdTag: gameIdTag('espn', game.sport, game.gameId),
    });
  }
  const decision = evaluateDecision({
    modelProbabilityPct: side.probability,
    sideOdds: side.americanOdds,
    otherSideOdds: side.otherOdds,
    dataCompleteness: 1,
  });
  const sideProb = side.probability;
  const overProbability = projection.overProbability;
  // Only lean when ESPN actually gave us a market line; otherwise no-bet.
  const lean =
    game.overUnder !== undefined && decision.recommendation === 'bet'
      ? (overSide ? 'over' : 'under')
      : 'no-bet';

  const nhlTrack = game.overUnder !== undefined && game.status === 'scheduled'
    ? totalTrack(game.overUnder, side, game)
    : undefined;
  if (gapCollector && nhlTrack) gapCollector.push(gapCandidate(game, nhlTrack));

  let projectionRecorded = false;
  if (recordProjections) {
    try {
      await handleRecordProjection({
        gameDate: easternDate(),
        sport: 'hockey',
        league: 'NHL',
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        market: 'total',
        bookLine: game.overUnder ?? null,
        bookOdds: side.americanOdds,
        projectedValue: projectedTotal,
        edge: game.overUnder !== undefined ? decision.edgePct : null,
        lean,
        confidence: lean === 'no-bet' ? Math.min(decision.confidence, 44) : decision.confidence,
        modelVersion: MODEL_VERSION,
        track: nhlTrack,
        statsSnapshot: {
          home: homeStats, away: awayStats, line, overProbability,
          underProbability: projection.underProbability, pushProbability: projection.pushProbability,
          pickedSide: side.pickedSide, sideProbability: side.probability, sideOdds: side.americanOdds,
          pricesFromBook: side.pricesFromBook,
        },
      });
      projectionRecorded = true;
    } catch (err) {
      console.warn(`[DailyCalc] NHL projection recording failed for ${label}:`, err);
    }
  }

  return {
    ...baseResult,
    probability: sideProb,
    impliedProbability: side.breakEvenPct,
    edge: game.overUnder !== undefined ? decision.edgePct : 0,
    hasValue: lean !== 'no-bet',
    projectionRecorded,
  };
}

/**
 * The model's own lean on an NHL total, graded later whether or not it was bet.
 * Recomputes the push-free model and fair over probabilities the pricing used.
 */
function totalTrack(
  line: number,
  side: ReturnType<typeof priceNHLTotal>,
  prices: { overOdds?: number; underOdds?: number }
): ProjectionTrack {
  const over = side.pickedSide === 'over';
  const modelOver = over ? side.modelProbability : 100 - side.modelProbability;
  const fairOver = side.pricesFromBook
    ? fairImpliedPct(prices.overOdds!, prices.underOdds!)
    : fairImpliedPct(over ? side.americanOdds : side.otherOdds, over ? side.otherOdds : side.americanOdds);
  // The lean is the side the model rates higher than the market does (the
  // value side), not the side it gives over 50%.
  const modelSide = modelOver >= fairOver ? 'over' : 'under';
  const overOdds = over ? side.americanOdds : side.otherOdds;
  const underOdds = over ? side.otherOdds : side.americanOdds;
  return {
    market: 'total',
    line,
    side: modelSide,
    odds: modelSide === 'over' ? overOdds : underOdds,
    pricesFromBook: side.pricesFromBook,
    modelProbability: round1(modelSide === 'over' ? modelOver : 100 - modelOver),
    marketProbability: round1(modelSide === 'over' ? fairOver : 100 - fairOver),
    modelOver: round1(modelOver),
    fairOver: round1(fairOver),
    marketTrust: NHL_CONFIG.marketTrust,
  };
}

/** The model's own lean against a posted spread (fairHome in %). */
function spreadTrack(
  homeSpread: number,
  model: ReturnType<typeof spreadModel>,
  priced: ReturnType<typeof priceSpread>
): ProjectionTrack {
  const homeOdds = priced.pickedSide === 'home' ? priced.americanOdds : priced.otherOdds;
  const awayOdds = priced.pickedSide === 'home' ? priced.otherOdds : priced.americanOdds;
  const fairHome = fairImpliedPct(homeOdds, awayOdds);
  // The model's effective view at full trust: the disagreement (games-played
  // shrinkage included) moved off the market's fair split. This is the same
  // quantity the calibration fits, so side and probability always agree.
  const modelHome = Math.min(99.9, Math.max(0.1, fairHome + 100 * (normCdf(model.disagreement! / model.sigma!) - 0.5)));
  const side = model.disagreement! >= 0 ? 'home' : 'away';
  return {
    market: 'spread',
    line: homeSpread,
    side,
    odds: side === 'home' ? homeOdds : awayOdds,
    pricesFromBook: priced.pricesFromBook,
    modelProbability: round1(side === 'home' ? modelHome : 100 - modelHome),
    marketProbability: round1(side === 'home' ? fairHome : 100 - fairHome),
    disagreement: Math.round(model.disagreement! * 100) / 100,
    sigma: model.sigma,
    fairHome: round1(fairHome),
    marketTrust: model.marketTrust ?? 0,
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Break-even probability (%) of an American price. */
function breakEvenFromOdds(odds: number): number {
  return odds < 0 ? (-odds / (-odds + 100)) * 100 : (100 / (odds + 100)) * 100;
}

/** A tracked lean as a loggable candidate (the model's own side and price). */
export function gapCandidate(
  game: Pick<DailyGame, 'sport' | 'homeTeam' | 'homeAbbr' | 'awayTeam' | 'awayAbbr' | 'gameId'>,
  track: ProjectionTrack
): GapCandidate {
  const sport = game.sport as GapCandidate['sport'];
  const sportLabel = sport === 'NBA' ? 'basketball' : sport === 'NFL' ? 'football' : sport === 'NHL' ? 'hockey' : 'baseball';
  const odds = typeof track.odds === 'number' && Math.abs(track.odds) >= 100 ? track.odds : IMPLIED_ODDS_FALLBACK;
  let pick: string;
  let line: number;
  if (track.market === 'total') {
    line = track.line;
    pick = `${track.side === 'over' ? 'Over' : 'Under'} ${track.line}`;
  } else {
    line = track.side === 'home' ? track.line : -track.line;
    pick = `${track.side === 'home' ? game.homeTeam : game.awayTeam} ${formatLine(line)}`;
  }
  return {
    sport,
    sportLabel,
    homeTeam: game.homeTeam,
    homeAbbr: game.homeAbbr,
    awayTeam: game.awayTeam,
    awayAbbr: game.awayAbbr,
    market: track.market === 'total' ? 'total' : 'spread',
    pick,
    pickedSide: track.side as GapCandidate['pickedSide'],
    line,
    // The gap pick backs the model's own number, not the market-anchored one.
    probability: track.modelProbability,
    modelProbability: track.modelProbability,
    marketProbability: track.marketProbability,
    gap: round1(track.modelProbability - track.marketProbability),
    americanOdds: odds,
    breakEvenPct: breakEvenFromOdds(odds),
    gameIdTag: gameIdTag('espn', game.sport, game.gameId),
  };
}

/**
 * The day's gap pick: the lean whose model probability is furthest above the
 * market's fair probability. Games already gap-picked on any day are skipped.
 */
export function selectGapPick(candidates: GapCandidate[], alreadyPicked: Set<string> = new Set()): GapCandidate | null {
  let best: GapCandidate | null = null;
  for (const c of candidates) {
    if (!(c.gap > 0)) continue;
    if (c.gameIdTag && alreadyPicked.has(gapGameTag(c.gameIdTag))) continue;
    if (!best || c.gap > best.gap) best = c;
  }
  return best;
}

export function gapPickTag(date: string): string {
  return `gap-pick-${date}`;
}

/** Per-game gap-pick tag. Kept separate from "gid-" so it never blocks the other pick modes. */
function gapGameTag(idTag: string): string {
  return `gap-${idTag}`;
}

/** League-average NHL regulation goals per team from the loaded CSVs. */
function nhlLeagueGoalsPerTeam(): number {
  const teams = getAllNHLTeams().filter((t) => t.xGF60 > 0 && t.xGA60 > 0);
  if (teams.length < 10) return NHL_CONFIG.leagueGoalsPerTeam;
  return teams.reduce((s, t) => s + (t.xGF60 + t.xGA60) / 2, 0) / teams.length;
}

// ============================================================================
// SINGLE GAME CALCULATION
// ============================================================================

type SpreadTeamStats = ReturnType<typeof getNBATeamStats> | ReturnType<typeof getNFLTeamStats>;

/** The stats loader returns 0 for a missing cell; no real rate here is 0. */
const present = (v: number | undefined): number | undefined => (v !== undefined && Number.isFinite(v) && v !== 0 ? v : undefined);

/**
 * Run the NBA/NFL spread model with the home team as Team A. Returns the
 * straight-up home win probability, the projected home margin and, when a
 * spread is posted, P(home covers) both anchored to the line and model-only.
 */
function spreadModel(
  game: DailyGame,
  homeStats: SpreadTeamStats,
  awayStats: SpreadTeamStats,
  homeSpread: number | undefined
): {
  homeWinProbability: number; predictedMargin: number; anchoredHomeCover?: number; modelHomeCover?: number;
  gamesPlayed: number | null; disagreement?: number; sigma?: number; marketTrust?: number;
} {
  const venue = game.neutralSite ? 'neutral' : 'home';
  const options = { asOf: new Date() };
  let estimate: (spread: number, marketLine: boolean) => ReturnType<typeof estimateBasketballProbability>;
  if (game.sport === 'NBA') {
    const h = homeStats as NonNullable<ReturnType<typeof getNBATeamStats>>;
    const a = awayStats as NonNullable<ReturnType<typeof getNBATeamStats>>;
    const stats: BasketballStats = {
      teamPPG: h.ppg, teamAllowed: h.pointsAllowed, opponentPPG: a.ppg, opponentAllowed: a.pointsAllowed,
      teamPace: present(h.pace), opponentPace: present(a.pace),
      teamOffRtg: present(h.offRtg), teamDefRtg: present(h.defRtg),
      opponentOffRtg: present(a.offRtg), opponentDefRtg: present(a.defRtg),
      teamFGPct: present(h.fgPct), opponentFGPct: present(a.fgPct),
      teamReboundMargin: h.reboundMargin, opponentReboundMargin: a.reboundMargin,
      teamTurnoverMargin: h.turnoverMargin, opponentTurnoverMargin: a.turnoverMargin,
      team3PRate: present(h.threeRate), opponent3PRate: present(a.threeRate),
      team3PPct: present(h.threePct), opponent3PPct: present(a.threePct),
    };
    estimate = (spread, marketLine) => estimateBasketballProbability(stats, spread, venue, true, { ...options, marketLine });
  } else {
    const h = homeStats as NonNullable<ReturnType<typeof getNFLTeamStats>>;
    const a = awayStats as NonNullable<ReturnType<typeof getNFLTeamStats>>;
    const stats: FootballStats = {
      teamPPG: h.ppg, teamAllowed: h.pointsAllowed, opponentPPG: a.ppg, opponentAllowed: a.pointsAllowed,
      teamOffYards: present(h.offensiveYards), teamDefYards: present(h.defensiveYards),
      opponentOffYards: present(a.offensiveYards), opponentDefYards: present(a.defensiveYards),
      teamTurnoverDiff: h.turnoverDiff, opponentTurnoverDiff: a.turnoverDiff,
    };
    estimate = (spread, marketLine) => estimateFootballProbability(stats, spread, venue, true, { ...options, marketLine });
  }
  const straightUp = estimate(0, false);
  const cover = homeSpread === undefined ? undefined : estimate(homeSpread, true);
  return {
    homeWinProbability: straightUp.probability,
    predictedMargin: straightUp.predictedMargin,
    anchoredHomeCover: cover?.probability,
    modelHomeCover: cover?.modelProbability,
    gamesPlayed: straightUp.gamesPlayed,
    disagreement: cover?.disagreement ?? undefined,
    sigma: cover?.sigma,
    marketTrust: cover?.marketTrust ?? undefined,
  };
}

async function calcGame(
  game: DailyGame,
  bankroll: number,
  kellyFraction: number,
  americanOdds: number,
  userId: string | null,
  logBets: boolean,
  recordProjections: boolean,
  collector?: PickCandidate[],
  gapCollector?: GapCandidate[]
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

  // NHL uses a totals (over/under) model, not a spread/moneyline one, so it has
  // its own path. NBA/NFL continue through the shared spread/moneyline flow below.
  if (game.sport === 'NHL') {
    return calcNHLGame(game, recordProjections, collector, gapCollector);
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

  // 2. Project the game. The straight-up win probability feeds the
  //    backtesting projection; the bet itself is priced against the real
  //    sportsbook spread (anchored to it), and only when one is posted.
  const homeSpread = game.homeSpread;
  let model: ReturnType<typeof spreadModel>;
  try {
    model = spreadModel(game, homeStats, awayStats, homeSpread);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return { ...baseResult, error: `Probability calculation failed: ${errMsg}` };
  }
  const probability = model.homeWinProbability;
  const predictedMargin = model.predictedMargin;

  if (!(probability > 0)) {
    return { ...baseResult, skipped: 'Probability calculation returned 0' };
  }

  // Bet the side with the larger edge over its own price. No spread posted →
  // no bet (a later re-run picks the game up once the line is out).
  const side = homeSpread === undefined
    ? undefined
    : priceSpread(game, model.anchoredHomeCover!, model.modelHomeCover!, americanOdds);
  const backHome = side ? side.pickedSide === 'home' : true;
  const pickProbability = side ? side.probability : probability;
  const pickLine = homeSpread === undefined ? 0 : backHome ? homeSpread : -homeSpread;
  const pickOdds = side ? side.americanOdds : americanOdds;
  const breakEven = side ? side.breakEvenPct : IMPLIED_PROB_AT_MINUS_110;
  if (collector && side && game.status === 'scheduled') {
    collector.push({
      sport: game.sport as 'NBA' | 'NFL',
      sportLabel: game.sport === 'NBA' ? 'basketball' : 'football',
      homeTeam: game.homeTeam,
      homeAbbr: game.homeAbbr,
      awayTeam: game.awayTeam,
      awayAbbr: game.awayAbbr,
      market: 'spread',
      pick: `${backHome ? game.homeTeam : game.awayTeam} ${formatLine(pickLine)}`,
      pickedSide: backHome ? 'home' : 'away',
      line: pickLine,
      probability: side.probability,
      americanOdds: side.americanOdds,
      breakEvenPct: side.breakEvenPct,
      modelProbability: side.modelProbability,
      expectedMargin: backHome ? predictedMargin : -predictedMargin,
      gameIdTag: gameIdTag('espn', game.sport, game.gameId),
    });
  }

  // 3. Calculate Kelly on the spread pick at its own price (no spread → no value, no bet)
  const edge = side ? pickProbability - breakEven : 0;
  const hasValue = side !== undefined && edge > 0;

  let recommendedStake = 0;
  let stakePercentage = 0;

  try {
    const kellyResult = await handleKellyCalculation({
      bankroll,
      probability: pickProbability,
      americanOdds: pickOdds,
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

  const idTag = gameIdTag('espn', game.sport, game.gameId);
  if (hasValue && logBets && userId && game.status === 'scheduled') {
    try {
      if (idTag && (await BetLog.exists({ userId, tags: idTag }))) {
        throw new Error('already logged on an earlier run');
      }
      const sportLabel = game.sport === 'NBA' ? 'basketball' : 'football';
      const home = { name: game.homeTeam, abbreviation: game.homeAbbr };
      const away = { name: game.awayTeam, abbreviation: game.awayAbbr };
      const logResult = await handleLogBet({
        userId,
        sport: sportLabel as 'basketball' | 'football',
        teamA: backHome ? home : away,
        teamB: backHome ? away : home,
        venue: backHome ? 'home' : 'away',
        pointSpread: pickLine,
        betType: 'spread',
        calculatedProbability: pickProbability,
        expectedMargin: backHome ? predictedMargin : -predictedMargin,
        impliedProbability: breakEven,
        edge,
        bankroll,
        americanOdds: pickOdds,
        kellyFraction: kellyFraction >= 0.75 ? 1 : kellyFraction >= 0.4 ? 0.5 : 0.25,
        recommendedStake,
        stakePercentage,
        notes: `Auto-logged by daily cron job on ${easternDate()}`,
        tags: ['auto', 'daily-cron', game.sport.toLowerCase(), ...(idTag ? [idTag] : [])],
      });

      if (logResult.success) {
        betLogged = true;
        betId = logResult.betId;
      }
    } catch (err) {
      console.warn(`[DailyCalc] Bet logging failed for ${label}:`, err);
    }
  }

  const spreadLean = side && game.status === 'scheduled' && model.disagreement !== undefined
    ? spreadTrack(homeSpread!, model, side)
    : undefined;
  if (gapCollector && spreadLean) gapCollector.push(gapCandidate(game, spreadLean));

  // 5. Record a backtesting projection for EVERY analyzed game (not just value
  //    bets). The decision layer turns the home win probability into a
  //    home/away/no-bet lean so the stored record matches how the model would
  //    advise. The stat snapshot is exactly what fed the projection.
  let projectionRecorded = false;
  if (recordProjections) {
    try {
      const decision = evaluateDecision({
        modelProbabilityPct: probability,
        sideOdds: americanOdds,
        otherSideOdds: americanOdds,
        dataCompleteness: 1, // daily-calc stats are complete by construction
      });
      const lean = decision.recommendation === 'bet' ? 'home' : 'no-bet';

      await handleRecordProjection({
        gameDate: easternDate(),
        sport: game.sport === 'NBA' ? 'basketball' : 'football',
        league: game.sport,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        market: 'moneyline',
        bookLine: null,
        // No moneyline price is read for this straight-up record, so none is
        // stored (it used to say -110). The real spread prices are in the
        // snapshot and on the tracked lean.
        projectedValue: probability,
        edge: decision.edgePct,
        lean,
        confidence: decision.confidence,
        modelVersion: MODEL_VERSION,
        track: spreadLean,
        statsSnapshot: {
          home: homeStats,
          away: awayStats,
          predictedMargin,
          venue: game.neutralSite ? 'neutral' : 'home',
          gamesPlayed: model.gamesPlayed,
          homeSpread: homeSpread ?? null,
          homeSpreadOdds: game.homeSpreadOdds ?? null,
          awaySpreadOdds: game.awaySpreadOdds ?? null,
          anchoredHomeCover: model.anchoredHomeCover ?? null,
          modelHomeCover: model.modelHomeCover ?? null,
        },
      });
      projectionRecorded = true;
    } catch (err) {
      console.warn(`[DailyCalc] Projection recording failed for ${label}:`, err);
    }
  }

  return {
    game: label,
    sport: game.sport,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    probability: pickProbability,
    impliedProbability: breakEven,
    edge,
    hasValue,
    kellyFraction,
    recommendedStake,
    stakePercentage,
    betLogged,
    betId,
    projectionRecorded,
    ...(homeSpread === undefined ? { skipped: 'No sportsbook spread posted yet — no bet' } : {}),
  };
}

// ============================================================================
// MLB DAILY CALCULATION (totals, via MLB StatsAPI)
// ============================================================================

/**
 * Project today's MLB games from MLB StatsAPI and record them as totals
 * projections for backtesting. Mutates the shared summary in place (counts
 * analyzed games and projections recorded; surfaces per-source errors).
 *
 * Deliberately conservative: with only ERA + team OPS/RPG available, the engine
 * produces low-data-completeness projections that usually settle to no-bet. We
 * record them anyway so the backtest log can later show whether even this thin
 * signal carries any edge.
 */
async function runMLBDailyCalc(
  summary: DailyCalcSummary,
  recordProjections: boolean,
  collector?: PickCandidate[]
): Promise<void> {
  const season = new Date().getUTCFullYear();
  let games;
  let totals;
  try {
    // Schedule + probable starters from StatsAPI; book totals from ESPN.
    [games, totals] = await Promise.all([fetchMLBSchedule(easternDate()), fetchMLBTotals()]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`MLB: failed to fetch schedule: ${msg}`);
    return;
  }

  // Only project games that haven't started yet.
  // Only project today's (Eastern) games that haven't started yet.
  const today = easternDate();
  const upcoming = games.filter(
    (g) => g.abstractState === 'Preview' && (!g.gameDate || easternDate(g.gameDate) === today)
  );
  console.log(
    `[DailyCalc] MLB: ${upcoming.length} upcoming games today, ${totals.size / 2 | 0} with book totals`
  );

  const offenseCache = new Map<number, TeamSeasonOffense>();

  for (const game of upcoming) {
    const label = `${game.away.name} @ ${game.home.name} (MLB)`;
    try {
      const input = await fetchMLBGameInputs(game, season, offenseCache, totals);
      const result = projectMLBGame(input);
      summary.gamesAnalyzed++;

      const bookTotal = result.totals.bookTotal;
      if (collector && bookTotal !== null) {
        const over = result.totals.overProbability >= 50;
        collector.push({
          sport: 'MLB',
          sportLabel: 'baseball',
          homeTeam: game.home.name,
          awayTeam: game.away.name,
          market: 'total',
          pick: `${over ? 'Over' : 'Under'} ${bookTotal}`,
          pickedSide: over ? 'over' : 'under',
          line: bookTotal,
          probability: over ? result.totals.overProbability : result.totals.underProbability,
          expectedMargin: result.totals.projectedTotal - bookTotal,
          gameIdTag: gameIdTag('mlb', 'MLB', game.gamePk),
        });
      }

      if (result.totals.lean !== 'no-bet') {
        summary.highValueBets.push({
          game: label,
          sport: 'MLB',
          homeTeam: game.home.name,
          awayTeam: game.away.name,
          probability:
            result.totals.lean === 'under'
              ? result.totals.underProbability
              : result.totals.overProbability,
          impliedProbability: IMPLIED_PROB_AT_MINUS_110,
          edge: result.totals.edgeRuns ?? 0,
          hasValue: true,
          kellyFraction: 0,
          recommendedStake: 0,
          stakePercentage: 0,
          betLogged: false,
        });
      }

      if (recordProjections) {
        await handleRecordProjection({
          gameDate: easternDate(),
          sport: 'baseball',
          league: 'MLB',
          homeTeam: game.home.name,
          awayTeam: game.away.name,
          market: 'total',
          bookLine: result.totals.bookTotal,
          projectedValue: result.totals.projectedTotal,
          edge: result.totals.edgeRuns,
          lean: result.totals.lean,
          confidence: result.totals.confidence,
          modelVersion: MODEL_VERSION,
          statsSnapshot: {
            input,
            dataCompleteness: result.dataCompleteness,
            riskFactors: result.riskFactors,
          },
        });
        summary.projectionsRecorded++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`MLB ${label}: ${msg}`);
    }
  }
}

// ============================================================================
// RANDOM PICKS (N random games across all sports, fractional Kelly)
// ============================================================================

function formatLine(n: number): string {
  return n === 0 ? 'PK' : `${n > 0 ? '+' : ''}${n}`;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Break-even probability (%) of a candidate's own price (-110 when unknown). */
export function breakEvenOf(c: Pick<PickCandidate, 'breakEvenPct'>): number {
  return c.breakEvenPct !== undefined && Number.isFinite(c.breakEvenPct) ? c.breakEvenPct : IMPLIED_PROB_AT_MINUS_110;
}

/** Edge (percentage points) of a candidate over its own break-even. */
export function edgeOf(c: Pick<PickCandidate, 'probability' | 'breakEvenPct'>): number {
  return c.probability - breakEvenOf(c);
}

/**
 * Choose `count` candidates at random. Positive-edge games (probability above
 * the break-even of their own price) are drawn first so Kelly actually stakes
 * money; leftover slots are filled randomly from the rest.
 */
export function selectRandomPicks(candidates: PickCandidate[], count: number): PickCandidate[] {
  const value = candidates.filter((c) => edgeOf(c) > 0);
  const rest = candidates.filter((c) => edgeOf(c) <= 0);
  return [...shuffle(value), ...shuffle(rest)].slice(0, Math.max(0, count));
}

function randomPicksTag(date: string): string {
  return `random-picks-${date}`;
}

function allPicksTag(date: string): string {
  return `all-picks-${date}`;
}

/**
 * Date-independent tag built from the provider's game id. Unlike gameTag it does
 * not change from one day to the next, so a game logged yesterday is never
 * logged again today.
 */
export function gameIdTag(
  source: 'espn' | 'mlb',
  sport: string,
  id: string | number | undefined | null
): string | undefined {
  if (id === undefined || id === null || id === '') return undefined;
  return `gid-${source}-${sport.toLowerCase()}-${id}`;
}

/** Stable per-game, per-day tag used to avoid logging the same game twice. */
export function gameTag(date: string, c: Pick<PickCandidate, 'sport' | 'awayTeam' | 'homeTeam'>): string {
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `game-${date}-${c.sport.toLowerCase()}-${slug(c.awayTeam)}-at-${slug(c.homeTeam)}`;
}

/**
 * All-picks selection: every positive-edge candidate (probability above the
 * break-even of its own price) from the requested sports, at most one per
 * game, minus games already logged (by game tag). No-edge games are never logged.
 */
export function selectAllPicks(
  candidates: PickCandidate[],
  sports: PickCandidate['sport'][],
  date: string,
  alreadyLogged: Set<string> = new Set()
): PickCandidate[] {
  const seen = new Set<string>();
  const out: PickCandidate[] = [];
  for (const c of candidates) {
    if (!sports.includes(c.sport)) continue;
    if (edgeOf(c) <= 0) continue;
    const tag = gameTag(date, c);
    if (seen.has(tag) || alreadyLogged.has(tag)) continue;
    if (c.gameIdTag && (seen.has(c.gameIdTag) || alreadyLogged.has(c.gameIdTag))) continue;
    seen.add(tag);
    if (c.gameIdTag) seen.add(c.gameIdTag);
    out.push(c);
  }
  return out.sort((a, b) => edgeOf(b) - edgeOf(a));
}

/**
 * Tags of games that must not be logged again: today's per-day game tags plus
 * any provider game id already logged on ANY day (e.g. a game whose bet was
 * logged yesterday when it showed up on yesterday's scoreboard).
 */
async function findAlreadyLogged(
  userId: string,
  dayTag: string,
  candidates: PickCandidate[]
): Promise<Set<string>> {
  const idTags = [...new Set(candidates.map((c) => c.gameIdTag).filter((t): t is string => !!t))];
  const existing = await BetLog.find(
    { userId, $or: [{ tags: dayTag }, ...(idTags.length ? [{ tags: { $in: idTags } }] : [])] },
    { tags: 1 }
  ).lean();
  const out = new Set<string>(
    existing.flatMap((b: { tags?: string[] }) =>
      (b.tags || []).filter((t) => t.startsWith('game-') || t.startsWith('gid-'))
    )
  );

  // Bets logged before game-id tags existed only carry a dated game tag, often
  // with the wrong date (e.g. a Sunday NFL game logged on Thursday). Match them
  // by matchup over the last week so those games aren't logged a second time.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recent = await BetLog.find(
    { userId, createdAt: { $gte: since }, tags: { $regex: '^game-' } },
    { tags: 1 }
  ).lean();
  const recentMatchups = new Set<string>(
    recent
      .filter((b: { tags?: string[] }) => !(b.tags || []).some((t) => t.startsWith('gid-')))
      .flatMap((b: { tags?: string[] }) =>
        (b.tags || []).filter((t) => t.startsWith('game-')).map(undatedGameTag)
      )
  );
  for (const c of candidates) {
    const key = undatedGameTag(gameTag('0000-00-00', c));
    if (!recentMatchups.has(key)) continue;
    if (c.gameIdTag) out.add(c.gameIdTag);
  }
  return out;
}

/** "game-2026-11-05-nba-heat-at-celtics" -> "nba-heat-at-celtics". */
function undatedGameTag(tag: string): string {
  return tag.replace(/^game-\d{4}-\d{2}-\d{2}-/, '');
}

async function logPicks(
  picks: PickCandidate[],
  mode: 'random' | 'all',
  userId: string,
  bankroll: number,
  kellyFraction: number,
  americanOdds: number,
  today: string
): Promise<LoggedPick[]> {
  const logged: LoggedPick[] = [];

  for (const c of picks) {
    const game = `${c.awayTeam} @ ${c.homeTeam} (${c.sport})`;
    const edge = edgeOf(c);
    const odds = c.americanOdds ?? americanOdds;
    const entry: LoggedPick = {
      game,
      sport: c.sport,
      market: c.market,
      pick: c.pick,
      probability: c.probability,
      edge,
      recommendedStake: 0,
      stakePercentage: 0,
      betLogged: false,
    };

    try {
      const kelly = await handleKellyCalculation({
        bankroll,
        probability: Math.min(99, Math.max(1, c.probability)),
        americanOdds: odds,
        fraction: kellyFraction,
      });
      if (kelly.success) {
        entry.recommendedStake = Math.max(0, kelly.result.recommendedStake);
        entry.stakePercentage = Math.max(0, kelly.result.stakePercentage);
      }

      // teamA is always the side being backed; for totals keep home first.
      const backAway = c.pickedSide === 'away';
      const teamA = backAway
        ? { name: c.awayTeam, abbreviation: c.awayAbbr }
        : { name: c.homeTeam, abbreviation: c.homeAbbr };
      const teamB = backAway
        ? { name: c.homeTeam, abbreviation: c.homeAbbr }
        : { name: c.awayTeam, abbreviation: c.awayAbbr };

      const res = await handleLogBet({
        userId,
        sport: c.sportLabel,
        teamA,
        teamB,
        venue: backAway ? 'away' : 'home',
        pointSpread: c.line,
        betType: c.market,
        totalSide: c.market === 'total' ? (c.pickedSide as 'over' | 'under') : undefined,
        calculatedProbability: c.probability,
        expectedMargin: c.expectedMargin,
        impliedProbability: breakEvenOf(c),
        edge,
        bankroll,
        americanOdds: odds,
        kellyFraction: kellyFraction >= 0.75 ? 1 : kellyFraction >= 0.4 ? 0.5 : 0.25,
        recommendedStake: entry.recommendedStake,
        stakePercentage: entry.stakePercentage,
        actualWager: entry.recommendedStake,
        notes: `${mode === 'all' ? 'Daily auto pick' : 'Random daily pick'} (${today}): ${c.pick} [${c.market}] at ${odds > 0 ? '+' : ''}${odds}` +
          (c.modelProbability !== undefined ? ` — model ${c.modelProbability.toFixed(1)}%, market-anchored ${c.probability.toFixed(1)}%` : '') +
          (edge > 0 ? '' : ` — no edge at ${odds > 0 ? '+' : ''}${odds}, Kelly stake is $0`),
        tags: [
          'auto',
          ...(mode === 'all'
            ? ['all-picks', allPicksTag(today)]
            : ['random-picks', randomPicksTag(today)]),
          gameTag(today, c),
          ...(c.gameIdTag ? [c.gameIdTag] : []),
          c.sport.toLowerCase(),
          c.market,
          ...(edge > 0 ? [] : ['no-edge']),
        ],
      });
      if (res.success) {
        entry.betLogged = true;
        entry.betId = res.betId;
      }
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
      console.warn(`[DailyCalc] ${mode === 'all' ? 'All' : 'Random'} pick logging failed for ${game}:`, err);
    }

    logged.push(entry);
  }

  return logged;
}

/**
 * Log today's gap pick: the lean with the biggest model-vs-market gap, at a
 * flat GAP_PICK_STAKE_PCT of the bankroll on the model's own probability.
 */
async function logGapPick(
  candidates: GapCandidate[],
  userId: string,
  bankroll: number,
  today: string,
  summary: DailyCalcSummary
): Promise<void> {
  if (await BetLog.exists({ userId, tags: gapPickTag(today) })) return;
  const idTags = candidates.map((c) => c.gameIdTag).filter((t): t is string => !!t).map(gapGameTag);
  const prior = idTags.length
    ? await BetLog.find({ userId, tags: { $in: idTags } }, { tags: 1 }).lean()
    : [];
  const picked = new Set<string>(prior.flatMap((b: { tags?: string[] }) => b.tags || []));
  const c = selectGapPick(candidates, picked);
  if (!c) {
    summary.errors.push(`Gap pick: no lined game with a positive gap for ${today}`);
    return;
  }
  const odds = c.americanOdds ?? IMPLIED_ODDS_FALLBACK;
  const breakEven = breakEvenOf(c);
  const edge = c.probability - breakEven;
  const stake = Math.round(bankroll * GAP_PICK_STAKE_PCT) / 100;
  const backAway = c.pickedSide === 'away';
  const home = { name: c.homeTeam, abbreviation: c.homeAbbr };
  const away = { name: c.awayTeam, abbreviation: c.awayAbbr };
  const fmt = (o: number) => (o > 0 ? `+${o}` : `${o}`);
  const res = await handleLogBet({
    userId,
    sport: c.sportLabel,
    teamA: backAway ? away : home,
    teamB: backAway ? home : away,
    venue: backAway ? 'away' : 'home',
    pointSpread: c.line,
    betType: c.market,
    totalSide: c.market === 'total' ? (c.pickedSide as 'over' | 'under') : undefined,
    calculatedProbability: c.probability,
    impliedProbability: breakEven,
    edge,
    bankroll,
    americanOdds: odds,
    kellyFraction: 0.25,
    recommendedStake: stake,
    stakePercentage: GAP_PICK_STAKE_PCT,
    actualWager: stake,
    notes: `Daily gap pick (${today}): ${c.pick} [${c.market}] at ${fmt(odds)} — model ${c.modelProbability!.toFixed(1)}% vs market ${c.marketProbability.toFixed(1)}% (gap +${c.gap.toFixed(1)}), needs ${breakEven.toFixed(1)}%. Flat ${GAP_PICK_STAKE_PCT}% stake.`,
    tags: [
      'auto',
      'gap-pick',
      gapPickTag(today),
      ...(c.gameIdTag ? [gapGameTag(c.gameIdTag)] : []),
      c.sport.toLowerCase(),
      c.market,
    ],
  });
  summary.gapPick = {
    game: `${c.awayTeam} @ ${c.homeTeam} (${c.sport})`,
    sport: c.sport,
    market: c.market,
    pick: c.pick,
    probability: c.probability,
    edge,
    recommendedStake: stake,
    stakePercentage: GAP_PICK_STAKE_PCT,
    betLogged: !!res.success,
    betId: res.betId,
    gap: c.gap,
    modelProbability: c.modelProbability!,
    marketProbability: c.marketProbability,
  };
  if (res.success) summary.betsLogged++;
  console.log(`[DailyCalc] Gap pick logged: ${c.pick} (gap +${c.gap.toFixed(1)}) $${stake.toFixed(2)}`);
}

// ============================================================================
// MAIN DAILY CALC FUNCTION
// ============================================================================

export async function runDailyCalculations(options: DailyCalcOptions = {}): Promise<DailyCalcSummary> {
  const {
    kellyFraction = DEFAULT_KELLY_FRACTION,
    americanOdds = DEFAULT_AMERICAN_ODDS,
    logBets = true,
    recordProjections = true,
    sport = 'ALL',
    randomPicks = 0,
    allPicks = false,
    allPicksSports = DEFAULT_ALL_PICKS_SPORTS,
    gapPick = true,
  } = options;
  let { bankroll } = options;
  // In random-/all-picks mode only the chosen picks get logged; the per-game
  // "log every value bet" behaviour is switched off. All-picks wins if both set.
  const allMode = allPicks && logBets;
  const randomMode = !allMode && randomPicks > 0 && logBets;
  const picksMode = allMode || randomMode;
  const perGameLogBets = logBets && !picksMode;
  const collector: PickCandidate[] | undefined = picksMode ? [] : undefined;
  const gapCollector: GapCandidate[] | undefined = gapPick && logBets ? [] : undefined;

  const today = easternDate();
  console.log(`[DailyCalc] Starting daily calculations for ${today}`);
  console.log(`[DailyCalc] Settings: bankroll=${bankroll ?? 'admin/default'}, kelly=${kellyFraction}, odds=${americanOdds}, logBets=${logBets}, randomPicks=${randomPicks}, allPicks=${allMode ? allPicksSports.join('/') : 'off'}`);

  const summary: DailyCalcSummary = {
    success: false,
    date: today,
    gamesAnalyzed: 0,
    gamesSkipped: 0,
    betsLogged: 0,
    projectionsRecorded: 0,
    highValueBets: [],
    allResults: [],
    errors: [],
  };

  // Grade earlier projections first, so every run adds finished games to the
  // tracking record whether or not anything was bet.
  if (recordProjections) {
    try {
      summary.settled = await settlePendingProjections();
      console.log(`[DailyCalc] Settled ${summary.settled.settled} projections (${summary.settled.tracked} tracked leans), ${summary.settled.stillPending} still pending`);
    } catch (err) {
      summary.errors.push(`Settling projections failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

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

  // Random-picks mode sizes off the admin's real bankroll unless overridden.
  if (bankroll === undefined && picksMode && userId) {
    const admin = await User.findOne({ identifier: userId });
    if (admin && admin.currentBankroll > 0) bankroll = admin.currentBankroll;
  }
  if (bankroll === undefined) bankroll = DEFAULT_BANKROLL;

  if (randomMode && userId) {
    const already = await BetLog.exists({ userId, tags: randomPicksTag(today) });
    if (already) {
      summary.errors.push(`Random picks already logged for ${today}; skipping to avoid duplicates`);
      summary.success = true;
      return summary;
    }
  }

  const finalBankroll = bankroll;
  async function finishAllPicks(): Promise<void> {
    if (!collector) return;
    if (!userId) {
      summary.errors.push('All picks: admin user not found, nothing logged');
      return;
    }
    const alreadyLogged = await findAlreadyLogged(userId, allPicksTag(today), collector);
    const picks = selectAllPicks(collector, allPicksSports, today, alreadyLogged);
    summary.allPicks = await logPicks(picks, 'all', userId, finalBankroll, kellyFraction, americanOdds, today);
    summary.betsLogged += summary.allPicks.filter((p) => p.betLogged).length;
    const skipped = selectAllPicks(collector, allPicksSports, today).length - picks.length;
    if (skipped > 0) {
      summary.errors.push(`All picks: ${skipped} games already logged, skipped`);
    }
    if (picks.length === 0) {
      summary.errors.push(`All picks: no new positive-edge ${allPicksSports.join('/')} games for ${today}`);
    }
    console.log(`[DailyCalc] All picks logged (${summary.allPicks.length}): ${summary.allPicks.map((p) => `${p.pick} $${p.recommendedStake.toFixed(2)}`).join(', ')}`);
  }

  async function finishRandomPicks(): Promise<void> {
    if (allMode) return finishAllPicks();
    if (!randomMode || !collector) return;
    if (!userId) {
      summary.errors.push('Random picks: admin user not found, nothing logged');
      return;
    }
    const alreadyLogged = await findAlreadyLogged(userId, randomPicksTag(today), collector);
    const fresh = collector.filter((c) => !c.gameIdTag || !alreadyLogged.has(c.gameIdTag));
    summary.randomPicks = await logPicks(
      selectRandomPicks(fresh, randomPicks), 'random', userId, finalBankroll, kellyFraction, americanOdds, today
    );
    summary.betsLogged += summary.randomPicks.filter((p) => p.betLogged).length;
    if (summary.randomPicks.length < randomPicks) {
      summary.errors.push(
        `Random picks: only ${collector.length} bettable games today, logged ${summary.randomPicks.length} of ${randomPicks}`
      );
    }
    console.log(`[DailyCalc] Random picks logged: ${summary.randomPicks.map((p) => `${p.pick} $${p.recommendedStake.toFixed(2)}`).join(', ')}`);
  }

  // Refresh stats cache before calculations
  clearStatsCache();

  // MLB uses MLB StatsAPI (probable starters + ERA + team OPS/RPG), not ESPN, so
  // it runs through its own pipeline. It is intentionally limited: StatsAPI does
  // not expose FIP/xFIP/SIERA/wRC+/bullpen/park/weather, so MLB projections rely
  // on partial data and the engine's confidence/no-bet logic will (correctly)
  // decline most games. MLB is analysis + backtesting only — never auto-logged
  // as a wager. Runs when sport is MLB or ALL.
  if (sport === 'MLB' || sport === 'ALL') {
    await runMLBDailyCalc(summary, recordProjections, collector);
    // When the caller asked only for MLB, we're done.
    if (sport === 'MLB') {
      await finishRandomPicks();
      summary.success = true;
      return summary;
    }
  }

  // Fetch today's games (NHL is included under ALL; ESPN feeds NBA/NFL/NHL).
  const fetchSport = sport === 'ALL' ? 'ALL' : sport;
  let games: DailyGame[] = [];

  try {
    games = await getTodaysGames(fetchSport as 'NBA' | 'NFL' | 'NHL' | 'ALL', today);
    // Filter to only scheduled or in_progress games (skip final/postponed)
    games = games.filter((g) => g.status === 'scheduled' || g.status === 'in_progress');
    console.log(`[DailyCalc] Found ${games.length} active games on today's (${today} ET) slate`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`Failed to fetch games: ${errMsg}`);
    return summary;
  }

  if (games.length === 0) {
    console.log('[DailyCalc] No games scheduled today');
    await finishRandomPicks();
    summary.success = true;
    return summary;
  }

  // Process each game sequentially to avoid rate limits
  for (const game of games) {
    console.log(`[DailyCalc] Processing: ${game.awayTeam} @ ${game.homeTeam} (${game.sport})`);

    const result = await calcGame(game, bankroll, kellyFraction, americanOdds, userId, perGameLogBets, recordProjections, collector, gapCollector);
    summary.allResults.push(result);
    if (result.projectionRecorded) summary.projectionsRecorded++;

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
        console.log(`[DailyCalc]   No value: prob=${result.probability.toFixed(1)}% (need >${result.impliedProbability.toFixed(1)}%)`);
      }
    }
  }

  await finishRandomPicks();
  if (gapCollector && userId) {
    try {
      await logGapPick(gapCollector, userId, bankroll, today, summary);
    } catch (err) {
      summary.errors.push(`Gap pick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  summary.success = true;
  console.log(`[DailyCalc] Done. ${summary.gamesAnalyzed} analyzed, ${summary.highValueBets.length} value bets, ${summary.betsLogged} logged, ${summary.projectionsRecorded} projections recorded`);

  return summary;
}

// ============================================================================
// MCP TOOL
// ============================================================================

export const runDailyCalcToolDefinition = {
  name: 'run_daily_calculations',
  description: 'Run the daily betting analysis pipeline: fetch today\'s NBA, NFL and NHL games from ESPN plus MLB games from MLB StatsAPI, project each one (NBA/NFL moneyline win probability, NHL & MLB over/under totals), apply Kelly Criterion to NBA/NFL value bets, log positive-edge bets, and record every analyzed game as a backtesting projection. MLB uses partial data (probable starter ERA + team OPS/RPG; no FIP/bullpen/park/weather) so its projections are low-confidence and usually no-bet by design. Returns a summary of analyzed games, value bets, and projections recorded.',
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
  recordProjections: z
    .boolean()
    .optional()
    .describe('Whether to record every analyzed game as a backtesting projection. Defaults to true.'),
  sport: z
    .enum(['NBA', 'NFL', 'NHL', 'MLB', 'ALL'])
    .optional()
    .describe('Which sport to analyze. NBA/NFL produce moneyline projections, NHL produces totals projections; MLB is not yet automated. Defaults to ALL.'),
  randomPicks: z
    .number()
    .int()
    .min(0)
    .max(20)
    .optional()
    .describe('Random-picks mode: randomly choose this many games across all sports and log a fractional-Kelly bet on the model\'s side of each (instead of logging every value bet). 0 disables. Once per day.'),
  allPicks: z
    .boolean()
    .optional()
    .describe('All-picks mode: log a fractional-Kelly bet on the model\'s side of every positive-edge game in allPicksSports (NBA/NFL/NHL by default). Each game is logged at most once per day.'),
  allPicksSports: z
    .array(z.enum(['NBA', 'NFL', 'NHL', 'MLB']))
    .optional()
    .describe('Sports included in all-picks mode. Defaults to NBA, NFL, NHL.'),
  gapPick: z
    .boolean()
    .optional()
    .describe('Log the lean with the biggest model-vs-market gap as a flat-stake bet (once per day). Defaults to true.'),
});

export async function handleRunDailyCalc(
  params: z.infer<typeof runDailyCalcInputSchema>
): Promise<DailyCalcSummary> {
  return runDailyCalculations({
    bankroll: params.bankroll,
    kellyFraction: params.kellyFraction,
    americanOdds: params.americanOdds,
    logBets: params.logBets !== false,
    recordProjections: params.recordProjections !== false,
    sport: (params.sport || 'ALL') as 'NBA' | 'NFL' | 'NHL' | 'MLB' | 'ALL',
    randomPicks: params.randomPicks,
    allPicks: params.allPicks,
    allPicksSports: params.allPicksSports,
    gapPick: params.gapPick,
  });
}
