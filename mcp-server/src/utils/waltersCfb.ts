/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Walters Protocol — college football
 * ===================================
 * One implementation shared by the Walters tab, the Today's Games CFB cards,
 * the stat updater and the calibration script. The Node scripts import this
 * file directly (Node strips the types), so it must keep ZERO imports and use
 * only erasable TypeScript syntax (no enums, namespaces or parameter
 * properties).
 *
 * Power ratings are points versus an average FBS team on a neutral field —
 * the scale SP+ and FPI both publish. For Team A against Team B:
 *
 *   margin = (ratingA − ratingB) + home field
 *          + (situational A − situational B) + (injuries A − injuries B)
 *
 * then pulled toward zero for a rivalry game. The final margin is treated as
 * normal around that projection, with a spread that widens for lopsided games
 * (starters sit, garbage time), and those games can never grade above LEAN.
 *
 * Every constant here is a structural starting value, NOT a fitted
 * coefficient. scripts/calibrateCFBWalters.mjs reports what past seasons
 * support; see docs/PREDICTION_MODEL.md before changing a number.
 */

export const WALTERS_CFB_VERSION = 'walters-cfb-2026.09-v1';

export interface WaltersCfbConfig {
  /** Points for the home team; 0 at a neutral site. */
  homeFieldAdvantage: number;
  /** Margin spread: base, widening by slopePerPoint for every point of line past knee. */
  sigma: { base: number; knee: number; slopePerPoint: number };
  /** Lines this big (either the market's or the model's) cap confidence at LEAN. */
  bigSpread: number;
  /** Rivalry games are pulled this many points toward a pick'em. */
  rivalryPull: number;
  /** Rating updater: new = old + (1 − decayRate) × capped surprise. */
  decayRate: number;
  updateResidualCap: number;
  /** Signed points added to the team that has the factor. */
  factors: {
    bye: number;
    shortWeek: number;
    travel: number;
    altitude: number;
    bounceback: number;
    lookahead: number;
    letdown: number;
    qbOutExperienced: number;
    qbOutInexperienced: number;
  };
  /**
   * Edge (points between the market and the true line) needed per grade.
   * checkNews: an edge this big usually means the market knows something the
   * ratings don't (QB out, suspensions) — shown as a warning, not a grade.
   */
  thresholds: { lean: number; bet: number; strong: number; checkNews: number };
  /** When a game-context number switches an automatic factor on. */
  detection: {
    byeRestDays: number;
    shortWeekRestDays: number;
    travelTimeZones: number;
    earlyBodyClockHour: number;
    bouncebackLossMargin: number;
    altitudeVenueFt: number;
    altitudeHomeBelowFt: number;
    lookaheadRank: number;
  };
}

export const WALTERS_CFB: WaltersCfbConfig = {
  homeFieldAdvantage: 3.0,
  sigma: { base: 16, knee: 14, slopePerPoint: 0.15 },
  bigSpread: 28,
  rivalryPull: 1.0,
  decayRate: 0.85,
  updateResidualCap: 21,
  factors: {
    bye: 1.0,
    shortWeek: -1.0,
    travel: -1.5,
    altitude: -1.0,
    bounceback: 1.5,
    lookahead: -1.0,
    letdown: -1.0,
    qbOutExperienced: -4.0,
    qbOutInexperienced: -9.0,
  },
  thresholds: { lean: 1.25, bet: 2.5, strong: 3.5, checkNews: 7 },
  detection: {
    byeRestDays: 13,
    shortWeekRestDays: 5,
    travelTimeZones: 2,
    earlyBodyClockHour: 10,
    bouncebackLossMargin: 21,
    altitudeVenueFt: 4500,
    altitudeHomeBelowFt: 3000,
    lookaheadRank: 10,
  },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Venue from Team A's point of view. */
export type Venue = 'home' | 'away' | 'neutral';
export type QbStatus = 'none' | 'experienced' | 'inexperienced';
export type Side = 'A' | 'B';
export type Confidence = 'STRONG' | 'BET' | 'LEAN' | 'NO_BET';

export interface TeamFactors {
  bye?: boolean;
  shortWeek?: boolean;
  travel?: boolean;
  altitude?: boolean;
  bounceback?: boolean;
  lookahead?: boolean;
  letdown?: boolean;
  qb?: QbStatus;
}

export interface WaltersInput {
  ratingA: number;
  ratingB: number;
  venue: Venue;
  /** Team A's spread; negative means Team A is favored. Omit when no line is posted. */
  marketSpread?: number | null;
  rivalry?: boolean;
  factorsA?: TeamFactors;
  factorsB?: TeamFactors;
}

export interface WaltersResult {
  /** Projected Team A points minus Team B points. */
  predictedMargin: number;
  /** The spread Team A "should" be, from Team A's side (−predictedMargin). */
  trueLine: number;
  marketSpread: number | null;
  sigma: number;
  /** Points between the market and the true line; null without a market line. */
  edge: number | null;
  /** The side the edge favors; null when there is no line or no difference. */
  pick: Side | null;
  /** The picked side's own spread (Team B's is −marketSpread). */
  pickSpread: number | null;
  /** Percent chance the PICKED side covers (normal approximation, pushes ignored). */
  pickProbability: number | null;
  coverProbabilityA: number | null;
  confidence: Confidence;
  /** True when a lopsided line lowered the grade to LEAN. */
  cappedForBigSpread: boolean;
  breakdown: {
    baseMargin: number;
    homeField: number;
    situationalA: number;
    situationalB: number;
    injuriesA: number;
    injuriesB: number;
    rivalryAdjustment: number;
  };
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-z * z)));
}

/** Pull a margin toward zero by up to `amount` without flipping its sign. */
export function pullTowardZero(value: number, amount: number): number {
  if (Math.abs(value) <= amount) return 0;
  return value - Math.sign(value) * amount;
}

/** Margin spread for a game whose line (market or model) is `line` points. */
export function sigmaForLine(line: number, config: WaltersCfbConfig = WALTERS_CFB): number {
  const { base, knee, slopePerPoint } = config.sigma;
  return base + slopePerPoint * Math.max(0, Math.abs(line) - knee);
}

const finite = (v: number | null | undefined): v is number =>
  typeof v === 'number' && Number.isFinite(v);

/** Avoid displaying "-0". */
const negate = (v: number): number => (v === 0 ? 0 : -v);

// ---------------------------------------------------------------------------
// Factors
// ---------------------------------------------------------------------------

/** S-factors: schedule and situation points for one team. */
export function situationalPoints(f: TeamFactors = {}, config: WaltersCfbConfig = WALTERS_CFB): number {
  const p = config.factors;
  return (
    (f.bye ? p.bye : 0) +
    (f.shortWeek ? p.shortWeek : 0) +
    (f.travel ? p.travel : 0) +
    (f.altitude ? p.altitude : 0) +
    (f.bounceback ? p.bounceback : 0) +
    (f.lookahead ? p.lookahead : 0) +
    (f.letdown ? p.letdown : 0)
  );
}

/** C-factors: the starting QB is the one college injury worth automating a value for. */
export function injuryPoints(f: TeamFactors = {}, config: WaltersCfbConfig = WALTERS_CFB): number {
  if (f.qb === 'experienced') return config.factors.qbOutExperienced;
  if (f.qb === 'inexperienced') return config.factors.qbOutInexperienced;
  return 0;
}

/** What the updater knows about one team's side of a game. Blank = unknown. */
export interface GameContextSide {
  /** Days since this team's previous game. */
  restDays?: number;
  /** This team's margin in its previous game (negative = lost). */
  prevMargin?: number;
  /** Hours between the venue's UTC offset and the team's home stadium's. */
  tzChange?: number;
  /** Kickoff hour (0–23) on the team's home-time-zone clock; blank if the time is TBD. */
  bodyClockHour?: number;
  /** Playing in its own stadium. */
  atHome?: boolean;
  /** Elevation of the team's home stadium, feet. */
  baseElevationFt?: number;
  /** Current poll rank of the team's next opponent after this game. */
  nextOpponentRank?: number;
}

export interface AutoFactors {
  bye: boolean;
  shortWeek: boolean;
  travel: boolean;
  altitude: boolean;
  bounceback: boolean;
  /** Suggested only — the Walters tab shows it but never switches it on by itself. */
  lookahead: boolean;
}

/**
 * Which situational factors the game context switches on for `team`.
 * Unknown inputs never switch a factor on.
 */
export function detectAutoFactors(
  team: GameContextSide,
  opponent: GameContextSide,
  venueElevationFt?: number,
  config: WaltersCfbConfig = WALTERS_CFB,
): AutoFactors {
  const d = config.detection;
  // Off a bye only counts when the opponent is not also rested. An opponent
  // with no previous game (season opener) is rested, so it cancels the bye.
  const bye =
    finite(team.restDays) &&
    team.restDays >= d.byeRestDays &&
    finite(opponent.restDays) &&
    opponent.restDays < d.byeRestDays;
  // A short week only hurts against an opponent that had normal rest; an
  // opener counts as rested.
  const shortWeek =
    finite(team.restDays) &&
    team.restDays <= d.shortWeekRestDays &&
    !(finite(opponent.restDays) && opponent.restDays <= d.shortWeekRestDays);
  const travel =
    (finite(team.tzChange) && team.tzChange >= d.travelTimeZones) ||
    (team.atHome !== true && finite(team.bodyClockHour) && team.bodyClockHour < d.earlyBodyClockHour);
  const altitude =
    team.atHome !== true &&
    finite(venueElevationFt) &&
    venueElevationFt >= d.altitudeVenueFt &&
    finite(team.baseElevationFt) &&
    team.baseElevationFt < d.altitudeHomeBelowFt;
  const bounceback = finite(team.prevMargin) && team.prevMargin <= -d.bouncebackLossMargin;
  const lookahead = finite(team.nextOpponentRank) && team.nextOpponentRank <= d.lookaheadRank;
  return { bye, shortWeek, travel, altitude, bounceback, lookahead };
}

/** The factors the model applies on its own; a lookahead stays a suggestion. */
export function appliedAutoFactors(auto: AutoFactors): TeamFactors {
  return {
    bye: auto.bye,
    shortWeek: auto.shortWeek,
    travel: auto.travel,
    altitude: auto.altitude,
    bounceback: auto.bounceback,
  };
}

/** One scheduled game as the stat updater writes it: home designee first. */
export interface WaltersGame {
  ratingHome: number;
  ratingAway: number;
  neutralSite: boolean;
  spreadHome?: number | null;
  home: GameContextSide;
  away: GameContextSide;
  venueElevationFt?: number;
}

/** Both sides' automatic factors for a slate game (home designee plays at home unless neutral). */
export function autoFactorsForGame(
  game: Pick<WaltersGame, 'neutralSite' | 'home' | 'away' | 'venueElevationFt'>,
  config: WaltersCfbConfig = WALTERS_CFB,
): { home: AutoFactors; away: AutoFactors } {
  return {
    home: detectAutoFactors({ ...game.home, atHome: !game.neutralSite }, game.away, game.venueElevationFt, config),
    away: detectAutoFactors({ ...game.away, atHome: false }, game.home, game.venueElevationFt, config),
  };
}

/**
 * The automatic-only projection for a slate game, with Team A = the home
 * designee. The pick log records exactly this, and the Walters tab starts
 * from the same factors before the user adds what only they know (QB news,
 * rivalry, letdown spots).
 */
export function projectGame(game: WaltersGame, config: WaltersCfbConfig = WALTERS_CFB) {
  const { home, away } = autoFactorsForGame(game, config);
  const input: WaltersInput = {
    ratingA: game.ratingHome,
    ratingB: game.ratingAway,
    venue: game.neutralSite ? 'neutral' : 'home',
    marketSpread: game.spreadHome,
    factorsA: appliedAutoFactors(home),
    factorsB: appliedAutoFactors(away),
  };
  return { auto: { home, away }, input, result: projectWalters(input, config) };
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

export function projectWalters(input: WaltersInput, config: WaltersCfbConfig = WALTERS_CFB): WaltersResult {
  const baseMargin = input.ratingA - input.ratingB;
  const homeField =
    input.venue === 'home'
      ? config.homeFieldAdvantage
      : input.venue === 'away'
        ? -config.homeFieldAdvantage
        : 0;
  const situationalA = situationalPoints(input.factorsA, config);
  const situationalB = situationalPoints(input.factorsB, config);
  const injuriesA = injuryPoints(input.factorsA, config);
  const injuriesB = injuryPoints(input.factorsB, config);

  const raw = baseMargin + homeField + (situationalA - situationalB) + (injuriesA - injuriesB);
  // Symmetric: swapping Team A and Team B only flips the sign of the result.
  const predictedMargin = input.rivalry ? pullTowardZero(raw, config.rivalryPull) : raw;
  const trueLine = negate(predictedMargin);
  const marketSpread = finite(input.marketSpread) ? input.marketSpread : null;
  const sigma = sigmaForLine(Math.max(Math.abs(marketSpread ?? 0), Math.abs(trueLine)), config);

  const breakdown = {
    baseMargin,
    homeField,
    situationalA,
    situationalB,
    injuriesA,
    injuriesB,
    rivalryAdjustment: predictedMargin - raw,
  };

  if (marketSpread === null) {
    return {
      predictedMargin, trueLine, marketSpread, sigma,
      edge: null, pick: null, pickSpread: null, pickProbability: null, coverProbabilityA: null,
      confidence: 'NO_BET', cappedForBigSpread: false, breakdown,
    };
  }

  const edge = Math.abs(marketSpread - trueLine);
  // Team A covers when margin + spread > 0, i.e. when the true line sits
  // below the market line.
  const pick: Side | null = trueLine < marketSpread ? 'A' : trueLine > marketSpread ? 'B' : null;
  const coverProbabilityA = normalCdf((predictedMargin + marketSpread) / sigma) * 100;
  const pickProbability =
    pick === 'A' ? coverProbabilityA : pick === 'B' ? 100 - coverProbabilityA : null;
  const pickSpread = pick === 'A' ? marketSpread : pick === 'B' ? negate(marketSpread) : null;

  const t = config.thresholds;
  let confidence: Confidence =
    pick === null ? 'NO_BET' : edge >= t.strong ? 'STRONG' : edge >= t.bet ? 'BET' : edge >= t.lean ? 'LEAN' : 'NO_BET';
  let cappedForBigSpread = false;
  const lopsided = Math.abs(marketSpread) >= config.bigSpread || Math.abs(trueLine) >= config.bigSpread;
  if (lopsided && (confidence === 'STRONG' || confidence === 'BET')) {
    confidence = 'LEAN';
    cappedForBigSpread = true;
  }

  return {
    predictedMargin, trueLine, marketSpread, sigma,
    edge, pick, pickSpread, pickProbability, coverProbabilityA,
    confidence, cappedForBigSpread, breakdown,
  };
}

// ---------------------------------------------------------------------------
// Rating updater
// ---------------------------------------------------------------------------

export interface RatingUpdateInput {
  oldRating: number;
  opponentRating: number;
  /** Final margin from this team's side (+14 = won by 14). */
  actualMargin: number;
  /** Where this team played. */
  venue: Venue;
  /** Points to credit the performance with, e.g. +3 when the starting QB sat. */
  adjustment?: number;
}

export interface RatingUpdateResult {
  expectedMargin: number;
  /** Actual (plus adjustment) minus expected. */
  surprise: number;
  /** The surprise after the garbage-time cap. */
  cappedSurprise: number;
  newRating: number;
}

/**
 * The Walters recursive update, measured from the SURPRISE rather than the raw
 * score: new = old + (1 − decay) × (actual − expected). Uncapped, this is
 * exactly decay × old + (1 − decay) × (margin + opponent rating − home field).
 * Capping the surprise means a 63–7 win over a team you were supposed to beat
 * by 45 moves the rating a little, not a lot — the uneven-matchup problem.
 */
export function updateRating(input: RatingUpdateInput, config: WaltersCfbConfig = WALTERS_CFB): RatingUpdateResult {
  const homeField =
    input.venue === 'home'
      ? config.homeFieldAdvantage
      : input.venue === 'away'
        ? -config.homeFieldAdvantage
        : 0;
  const expectedMargin = input.oldRating - input.opponentRating + homeField;
  const surprise = input.actualMargin + (input.adjustment ?? 0) - expectedMargin;
  const cap = config.updateResidualCap;
  const cappedSurprise = Math.max(-cap, Math.min(cap, surprise));
  const newRating = input.oldRating + (1 - config.decayRate) * cappedSurprise;
  return { expectedMargin, surprise, cappedSurprise, newRating };
}
