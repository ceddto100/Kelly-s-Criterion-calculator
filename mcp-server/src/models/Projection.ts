/**
 * Projection model — the backtesting record.
 * ==========================================
 * Stores a model projection AT THE TIME IT WAS MADE, including the exact stat
 * snapshot used, the book line, the lean/edge/confidence, and (after the game)
 * the actual result. This is what makes backtesting honest: we can replay the
 * stored inputs, recompute under new weights, and score against real outcomes
 * without leaking future information.
 *
 * Deliberately separate from BetLog: BetLog is "a bet a user placed"; a
 * Projection is "the model's opinion on a game", logged whether or not anyone
 * bet it. Every projection the engine produces can be recorded here.
 */

import mongoose, { Document, Model, Schema } from 'mongoose';

// ============================================================================
// INTERFACES
// ============================================================================

export type ProjectionSport = 'baseball' | 'football' | 'basketball' | 'hockey';
export type ProjectionMarket = 'total' | 'spread' | 'moneyline';
export type ProjectionLean =
  | 'over'
  | 'under'
  | 'home'
  | 'away'
  | 'bet'
  | 'pass'
  | 'no-bet';
export type ProjectionResult = 'pending' | 'win' | 'loss' | 'push';

export interface IProjection extends Document {
  // --- identity ---
  gameDate: Date;
  sport: ProjectionSport;
  league: string; // MLB, NFL, NBA, NHL, CFB, CBB
  homeTeam: string;
  awayTeam: string;
  market: ProjectionMarket;

  // --- the model's output at projection time ---
  bookLine: number | null; // total / spread (null for pure moneyline)
  bookOdds?: number; // American odds for the leaned side, if known
  projectedValue: number; // projected total / margin / win prob
  edge: number | null; // model edge vs the fair line
  lean: ProjectionLean;
  confidence: number; // 0-100
  modelVersion: string; // which engine/config produced this

  /**
   * Exact inputs used to produce the projection. Stored as a free-form object so
   * any sport's stat shape fits. THIS is what enables honest replay/backtests.
   */
  statsSnapshot: Record<string, unknown>;

  // --- filled in after the game ---
  result: ProjectionResult;
  finalHomeScore?: number;
  finalAwayScore?: number;
  closingLine?: number; // for closing-line-value analysis
  settledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface BacktestSummary {
  total: number;
  settled: number;
  pending: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number; // wins / (wins + losses)
  avgEdge: number;
  avgConfidence: number;
  /** Hit rate bucketed by confidence band — does confidence track accuracy? */
  byConfidence: Array<{ band: string; n: number; hitRate: number }>;
}

export interface IProjectionModel extends Model<IProjection> {
  getBacktestSummary(filter?: {
    sport?: ProjectionSport;
    league?: string;
    market?: ProjectionMarket;
    modelVersion?: string;
  }): Promise<BacktestSummary>;
}

// ============================================================================
// SCHEMA
// ============================================================================

const projectionSchema = new Schema<IProjection>(
  {
    gameDate: { type: Date, required: true, index: true },
    sport: {
      type: String,
      required: true,
      enum: ['baseball', 'football', 'basketball', 'hockey'],
      index: true,
    },
    league: { type: String, required: true, index: true },
    homeTeam: { type: String, required: true },
    awayTeam: { type: String, required: true },
    market: {
      type: String,
      required: true,
      enum: ['total', 'spread', 'moneyline'],
    },

    bookLine: { type: Number, default: null },
    bookOdds: { type: Number },
    projectedValue: { type: Number, required: true },
    edge: { type: Number, default: null },
    lean: {
      type: String,
      required: true,
      enum: ['over', 'under', 'home', 'away', 'bet', 'pass', 'no-bet'],
    },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    modelVersion: { type: String, required: true, default: 'v1', index: true },

    statsSnapshot: { type: Schema.Types.Mixed, required: true },

    result: {
      type: String,
      required: true,
      enum: ['pending', 'win', 'loss', 'push'],
      default: 'pending',
      index: true,
    },
    finalHomeScore: { type: Number },
    finalAwayScore: { type: Number },
    closingLine: { type: Number },
    settledAt: { type: Date },
  },
  { timestamps: true }
);

// Prevent duplicate projections for the same game+market+model.
projectionSchema.index(
  { gameDate: 1, homeTeam: 1, awayTeam: 1, market: 1, modelVersion: 1 },
  { unique: true }
);

// ============================================================================
// STATICS
// ============================================================================

projectionSchema.statics.getBacktestSummary = async function (
  filter: Record<string, unknown> = {}
): Promise<BacktestSummary> {
  const query: Record<string, unknown> = {};
  for (const key of ['sport', 'league', 'market', 'modelVersion']) {
    if (filter[key] !== undefined) query[key] = filter[key];
  }

  const docs: IProjection[] = await this.find(query).lean();

  const settledDocs = docs.filter((d) => d.result !== 'pending');
  const wins = settledDocs.filter((d) => d.result === 'win').length;
  const losses = settledDocs.filter((d) => d.result === 'loss').length;
  const pushes = settledDocs.filter((d) => d.result === 'push').length;
  const decided = wins + losses;

  const mean = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  // Confidence bands: do higher-confidence projections actually hit more?
  const bands = [
    { band: 'low (<45)', min: 0, max: 45 },
    { band: 'medium (45-65)', min: 45, max: 65 },
    { band: 'high (>=65)', min: 65, max: 101 },
  ];
  const byConfidence = bands.map(({ band, min, max }) => {
    const inBand = settledDocs.filter(
      (d) => d.confidence >= min && d.confidence < max && d.result !== 'push'
    );
    const w = inBand.filter((d) => d.result === 'win').length;
    return {
      band,
      n: inBand.length,
      hitRate: inBand.length ? Math.round((w / inBand.length) * 1000) / 10 : 0,
    };
  });

  return {
    total: docs.length,
    settled: settledDocs.length,
    pending: docs.length - settledDocs.length,
    wins,
    losses,
    pushes,
    hitRate: decided ? Math.round((wins / decided) * 1000) / 10 : 0,
    avgEdge: Math.round(mean(docs.map((d) => d.edge ?? 0)) * 100) / 100,
    avgConfidence: Math.round(mean(docs.map((d) => d.confidence)) * 10) / 10,
    byConfidence,
  };
};

// ============================================================================
// MODEL
// ============================================================================

export const Projection: IProjectionModel =
  (mongoose.models.Projection as IProjectionModel) ||
  mongoose.model<IProjection, IProjectionModel>('Projection', projectionSchema);
