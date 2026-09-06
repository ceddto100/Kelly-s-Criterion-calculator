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
} from '../models/Projection.js';
import { ensureDatabaseConnection, isDatabaseConnected } from '../config/database.js';

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
