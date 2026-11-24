/**
 * Projection backtesting tools.
 * Three MCP tools:
 *   - record_projection:  store a projection (with stat snapshot) for backtesting
 *   - settle_projection:  fill in the final score and grade win/loss/push
 *   - get_backtest_summary: aggregate hit-rate / calibration metrics
 *
 * These persist to MongoDB via the Projection model. The settle logic is the
 * single source of truth for grading a stored projection against reality, so
 * scoring stays consistent across sports and markets.
 */

import { z } from 'zod';
import {
  Projection,
  type ProjectionMarket,
  type ProjectionResult,
  type ProjectionTrack,
} from '../models/Projection.js';
import { ensureDatabaseConnection, isDatabaseConnected } from '../config/database.js';
import { getTodaysGames, type DailyGame } from './gamesOfDay.js';
import { fitTrust, spreadObs, totalObs, type TrustObs } from '../utils/trustFit.js';

// ============================================================================
// record_projection
// ============================================================================

export const recordProjectionInputSchema = z.object({
  gameDate: z.string().describe('Game date (ISO string, e.g. 2026-06-01)'),
  sport: z.enum(['baseball', 'football', 'basketball', 'hockey']),
  league: z.string().describe('League code: MLB, NFL, NBA, NHL, CFB, CBB'),
  homeTeam: z.string(),
  awayTeam: z.string(),
  market: z.enum(['total', 'spread', 'moneyline']),
  bookLine: z.number().nullable().optional().describe('Total or spread; null for pure moneyline'),
  bookOdds: z.number().optional().describe('American odds for the leaned side'),
  projectedValue: z.number().describe('Projected total / margin / win probability'),
  edge: z.number().nullable().optional(),
  lean: z.enum(['over', 'under', 'home', 'away', 'bet', 'pass', 'no-bet']),
  confidence: z.number().min(0).max(100),
  modelVersion: z.string().default('v1'),
  statsSnapshot: z.record(z.any()).describe('Exact inputs used (for honest replay)'),
  track: z.record(z.any()).optional().describe('Model lean on a lined game, graded even when not bet'),
});

export const recordProjectionToolDefinition = {
  name: 'record_projection',
  description:
    'Store a model projection (with the exact stat snapshot used) for later backtesting. ' +
    'Records the book line, lean, edge and confidence at projection time. Idempotent per ' +
    'game+market+model — re-recording the same game updates it.',
};

export async function handleRecordProjection(input: unknown) {
  const p = recordProjectionInputSchema.parse(input);
  if (!isDatabaseConnected()) await ensureDatabaseConnection();

  const filter = {
    gameDate: new Date(p.gameDate),
    homeTeam: p.homeTeam,
    awayTeam: p.awayTeam,
    market: p.market as ProjectionMarket,
    modelVersion: p.modelVersion,
  };

  const doc = await Projection.findOneAndUpdate(
    filter,
    {
      $set: {
        ...filter,
        sport: p.sport,
        league: p.league,
        bookLine: p.bookLine ?? null,
        bookOdds: p.bookOdds,
        projectedValue: p.projectedValue,
        edge: p.edge ?? null,
        lean: p.lean,
        confidence: p.confidence,
        statsSnapshot: p.statsSnapshot,
        // Only a pre-game record carries a track; a later run (game started,
        // line pulled) must not erase it.
        ...(p.track ? { track: p.track, trackResult: 'pending' } : {}),
      },
      $setOnInsert: { result: 'pending' },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    success: true,
    projectionId: String(doc._id),
    message: `Recorded ${p.league} ${p.market} projection: ${p.awayTeam} @ ${p.homeTeam} (${p.lean}).`,
  };
}

// ============================================================================
// settle_projection
// ============================================================================

export const settleProjectionInputSchema = z.object({
  projectionId: z.string().describe('The projection _id returned by record_projection'),
  finalHomeScore: z.number(),
  finalAwayScore: z.number(),
  closingLine: z.number().optional().describe('Closing book line, for CLV analysis'),
});

export const settleProjectionToolDefinition = {
  name: 'settle_projection',
  description:
    'Grade a stored projection against the final score (win/loss/push). Determines the ' +
    'outcome from the recorded market, lean and book line. no-bet/pass projections settle ' +
    'as push (no action). Use after a game finishes.',
};

/**
 * Grade a projection against the final score. Pure function so it is unit
 * testable independent of the database.
 */
export function gradeProjection(
  market: ProjectionMarket,
  lean: string,
  bookLine: number | null,
  finalHomeScore: number,
  finalAwayScore: number
): ProjectionResult {
  // No action positions never win or lose.
  if (lean === 'no-bet' || lean === 'pass') return 'push';

  if (market === 'total') {
    if (bookLine === null) return 'push';
    const total = finalHomeScore + finalAwayScore;
    if (total === bookLine) return 'push';
    const wentOver = total > bookLine;
    if (lean === 'over') return wentOver ? 'win' : 'loss';
    if (lean === 'under') return wentOver ? 'loss' : 'win';
    return 'push';
  }

  if (market === 'moneyline') {
    if (finalHomeScore === finalAwayScore) return 'push';
    const homeWon = finalHomeScore > finalAwayScore;
    if (lean === 'home') return homeWon ? 'win' : 'loss';
    if (lean === 'away') return homeWon ? 'loss' : 'win';
    return 'push';
  }

  if (market === 'spread') {
    if (bookLine === null) return 'push';
    // Spread is stored from the home team's perspective; lean 'home' means we
    // backed the home side to cover bookLine, 'away' the away side.
    const homeMargin = finalHomeScore - finalAwayScore;
    const homeCover = homeMargin + bookLine; // >0 home covers, <0 away covers
    if (homeCover === 0) return 'push';
    const homeCovered = homeCover > 0;
    if (lean === 'home') return homeCovered ? 'win' : 'loss';
    if (lean === 'away') return homeCovered ? 'loss' : 'win';
    return 'push';
  }

  return 'push';
}

export async function handleSettleProjection(input: unknown) {
  const p = settleProjectionInputSchema.parse(input);
  if (!isDatabaseConnected()) await ensureDatabaseConnection();

  const doc = await Projection.findById(p.projectionId);
  if (!doc) {
    return { success: false, error: `Projection ${p.projectionId} not found` };
  }

  const result = gradeProjection(
    doc.market,
    doc.lean,
    doc.bookLine,
    p.finalHomeScore,
    p.finalAwayScore
  );

  doc.result = result;
  doc.finalHomeScore = p.finalHomeScore;
  doc.finalAwayScore = p.finalAwayScore;
  if (p.closingLine !== undefined) doc.closingLine = p.closingLine;
  doc.settledAt = new Date();
  await doc.save();

  return {
    success: true,
    projectionId: String(doc._id),
    result,
    message: `Settled ${doc.awayTeam} @ ${doc.homeTeam}: ${result.toUpperCase()} (final ${p.finalAwayScore}-${p.finalHomeScore}).`,
  };
}

// ============================================================================
// get_backtest_summary
// ============================================================================

export const backtestSummaryInputSchema = z.object({
  sport: z.enum(['baseball', 'football', 'basketball', 'hockey']).optional(),
  league: z.string().optional(),
  market: z.enum(['total', 'spread', 'moneyline']).optional(),
  modelVersion: z.string().optional(),
});

export const backtestSummaryToolDefinition = {
  name: 'get_backtest_summary',
  description:
    'Aggregate backtesting metrics over stored, settled projections: hit rate, average edge, ' +
    'average confidence, and hit rate bucketed by confidence band (to check whether the ' +
    "model's confidence actually tracks accuracy). Optionally filter by sport/league/market/model.",
};

export async function handleBacktestSummary(input: unknown) {
  const p = backtestSummaryInputSchema.parse(input);
  if (!isDatabaseConnected()) await ensureDatabaseConnection();
  const summary = await Projection.getBacktestSummary(p);
  return { success: true, filter: p, summary };
}

// ============================================================================
// Tracking: grade the model's lean on every lined game
// ============================================================================

/** Grade a tracked lean against the final score. */
export function gradeTrack(
  track: Pick<ProjectionTrack, 'market' | 'line' | 'side'>,
  finalHomeScore: number,
  finalAwayScore: number
): ProjectionResult {
  if (track.market === 'total') {
    const total = finalHomeScore + finalAwayScore;
    if (total === track.line) return 'push';
    return (total > track.line) === (track.side === 'over') ? 'win' : 'loss';
  }
  const homeCover = finalHomeScore - finalAwayScore + track.line;
  if (homeCover === 0) return 'push';
  return (homeCover > 0) === (track.side === 'home') ? 'win' : 'loss';
}

const SETTLE_LEAGUES = new Set(['NBA', 'NFL', 'NHL']);
const SETTLE_WINDOW_DAYS = 21;

export interface SettleSummary {
  checked: number;
  settled: number;
  tracked: number;
  stillPending: number;
  errors: string[];
}

/**
 * Settle every pending NBA/NFL/NHL projection from the last three weeks whose
 * game ESPN reports as final: store the score, grade the recorded lean
 * (`result`) and the tracked model lean (`trackResult`).
 */
export async function settlePendingProjections(
  { fetchGames = getTodaysGames, now = new Date() }: {
    fetchGames?: (sport: 'NBA' | 'NFL' | 'NHL', date: string) => Promise<DailyGame[]>;
    now?: Date;
  } = {}
): Promise<SettleSummary> {
  if (!isDatabaseConnected()) await ensureDatabaseConnection();
  const since = new Date(now.getTime() - SETTLE_WINDOW_DAYS * 86400000);
  const pending = await Projection.find({
    result: 'pending',
    league: { $in: [...SETTLE_LEAGUES] },
    gameDate: { $gte: since, $lt: now },
  });
  const summary: SettleSummary = { checked: pending.length, settled: 0, tracked: 0, stillPending: 0, errors: [] };
  const boards = new Map<string, Promise<DailyGame[]>>();
  for (const doc of pending) {
    const date = doc.gameDate.toISOString().slice(0, 10);
    const league = doc.league as 'NBA' | 'NFL' | 'NHL';
    const key = `${league}:${date}`;
    if (!boards.has(key)) boards.set(key, fetchGames(league, date).catch(() => []));
    const game = (await boards.get(key)!).find(
      (g) => g.homeTeam === doc.homeTeam && g.awayTeam === doc.awayTeam
    );
    if (!game || game.status !== 'final' || game.homeScore === undefined || game.awayScore === undefined) {
      summary.stillPending++;
      continue;
    }
    try {
      doc.finalHomeScore = game.homeScore;
      doc.finalAwayScore = game.awayScore;
      doc.result = gradeProjection(doc.market, doc.lean, doc.bookLine, game.homeScore, game.awayScore);
      if (doc.track) {
        doc.trackResult = gradeTrack(doc.track, game.homeScore, game.awayScore);
        summary.tracked++;
      }
      doc.settledAt = new Date();
      await doc.save();
      summary.settled++;
    } catch (err) {
      summary.errors.push(`${doc.awayTeam} @ ${doc.homeTeam} ${date}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return summary;
}

export interface TrackingEvidence {
  weight: number;
  se: number;
  games: number;
  wins: number;
  losses: number;
  pushes: number;
  /** Mean model-only probability (%) of the leaned side. */
  statedMean: number;
  first: string | null;
  last: string | null;
}

/** Trust-fit observation for one graded tracked game (null if ungradeable). */
export function trackObs(track: ProjectionTrack, finalHomeScore: number, finalAwayScore: number): TrustObs | null {
  if (track.market === 'total') {
    const total = finalHomeScore + finalAwayScore;
    if (total === track.line || track.modelOver === undefined || track.fairOver === undefined) return null;
    return totalObs(track.modelOver / 100, track.fairOver / 100, total > track.line);
  }
  const homeCover = finalHomeScore - finalAwayScore + track.line;
  if (homeCover === 0 || track.disagreement === undefined || !track.sigma) return null;
  return spreadObs(track.disagreement / track.sigma, homeCover > 0, (track.fairHome ?? 50) / 100);
}

/**
 * Per-league summary of every graded tracked lean: record, mean stated
 * probability and the fitted market trust. Summary numbers only.
 */
export async function getTrackingEvidence(): Promise<Record<string, TrackingEvidence>> {
  if (!isDatabaseConnected()) await ensureDatabaseConnection();
  const docs = await Projection.find({ trackResult: { $in: ['win', 'loss', 'push'] } })
    .select('league gameDate track trackResult finalHomeScore finalAwayScore')
    .lean();
  const by = new Map<string, typeof docs>();
  for (const d of docs) by.set(d.league, [...(by.get(d.league) ?? []), d]);
  const out: Record<string, TrackingEvidence> = {};
  for (const [league, rows] of by) {
    const obs = rows
      .map((d) => trackObs(d.track as ProjectionTrack, d.finalHomeScore!, d.finalAwayScore!))
      .filter((o): o is TrustObs => o !== null);
    const fit = fitTrust(obs);
    const decided = rows.filter((d) => d.trackResult !== 'push');
    const dates = rows.map((d) => d.gameDate.toISOString().slice(0, 10)).sort();
    out[league] = {
      weight: fit.weight,
      se: fit.se,
      games: fit.games,
      wins: rows.filter((d) => d.trackResult === 'win').length,
      losses: rows.filter((d) => d.trackResult === 'loss').length,
      pushes: rows.length - decided.length,
      statedMean: decided.length
        ? Math.round((10 * decided.reduce((s, d) => s + (d.track as ProjectionTrack).modelProbability, 0)) / decided.length) / 10
        : 0,
      first: dates[0] ?? null,
      last: dates[dates.length - 1] ?? null,
    };
  }
  return out;
}
