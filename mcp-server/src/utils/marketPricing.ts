/**
 * Market-aware pricing shared by the daily pick pipeline and the MCP tools.
 *
 * Every side is priced at its own price (the book's when known), with pushes
 * excluded, and the model may only move the market's fair probability by the
 * sport's `marketTrust`. See docs/PREDICTION_MODEL.md for the backtests.
 */
import {
  fairImpliedPct,
  impliedProbabilityPct,
  noPushProbability,
  anchorToMarket,
  standardVigPrice,
} from './decision.js';
import { nhlLeagueBaseline, NHL_CONFIG } from './nhl.js';
import { STANDARD_VIG_ODDS } from '../config/decisionConfig.js';

export interface PricedSide<S extends string> {
  pickedSide: S;
  /** Market-anchored probability (%) for the side, pushes excluded. */
  probability: number;
  /** Model-only probability (%) for the side, pushes excluded. */
  modelProbability: number;
  americanOdds: number;
  otherOdds: number;
  breakEvenPct: number;
  /** True when both prices came from the book. */
  pricesFromBook: boolean;
}

export interface TotalPrices { overOdds?: number; underOdds?: number }
export interface SpreadPrices { homeSpreadOdds?: number; awaySpreadOdds?: number }

/**
 * Anchored over probability for an NHL total. NHL books rarely move to 6.0;
 * they post 5.5 or 6.5 and shade the juice, so a 5.5 over is usually priced
 * near 60% and assuming -110 manufactures fake edges. The fair probability is
 * the book's de-vigged price or, when unknown, a league-average game at that
 * line priced with standard vig.
 */
export function nhlAnchoredOver(
  prices: TotalPrices,
  line: number,
  projection: { overProbability: number; underProbability: number },
  leagueGoalsPerTeam: number = NHL_CONFIG.leagueGoalsPerTeam,
  trust: number = NHL_CONFIG.marketTrust
) {
  const modelOver = noPushProbability(projection.overProbability, projection.underProbability);
  const pricesFromBook = prices.overOdds !== undefined && prices.underOdds !== undefined;
  let fairOver: number, overOdds: number, underOdds: number;
  if (pricesFromBook) {
    overOdds = prices.overOdds!;
    underOdds = prices.underOdds!;
    fairOver = fairImpliedPct(overOdds, underOdds);
  } else {
    const base = nhlLeagueBaseline(line, leagueGoalsPerTeam);
    fairOver = noPushProbability(base.over, base.under);
    overOdds = standardVigPrice(fairOver);
    underOdds = standardVigPrice(100 - fairOver);
  }
  return { modelOver, fairOver, anchoredOver: anchorToMarket(modelOver, fairOver, trust), overOdds, underOdds, pricesFromBook };
}

/** Price both sides of an NHL total and return the side with the larger edge. */
export function priceNHLTotal(
  prices: TotalPrices,
  line: number,
  projection: { overProbability: number; underProbability: number },
  leagueGoalsPerTeam: number = NHL_CONFIG.leagueGoalsPerTeam
): PricedSide<'over' | 'under'> {
  const a = nhlAnchoredOver(prices, line, projection, leagueGoalsPerTeam);
  const overEdge = a.anchoredOver - impliedProbabilityPct(a.overOdds);
  const underEdge = 100 - a.anchoredOver - impliedProbabilityPct(a.underOdds);
  const over = overEdge >= underEdge;
  return {
    pickedSide: over ? 'over' : 'under',
    probability: over ? a.anchoredOver : 100 - a.anchoredOver,
    modelProbability: over ? a.modelOver : 100 - a.modelOver,
    americanOdds: over ? a.overOdds : a.underOdds,
    otherOdds: over ? a.underOdds : a.overOdds,
    breakEvenPct: impliedProbabilityPct(over ? a.overOdds : a.underOdds),
    pricesFromBook: a.pricesFromBook,
  };
}

/**
 * Price a spread from P(home covers) anchored to the line (which assumes a
 * 50/50 line). When the book shades the spread price, its fair split replaces
 * 50/50 and the model's anchored lean is added on top.
 */
export function priceSpread(
  prices: SpreadPrices,
  anchoredHomeCoverPct: number,
  modelHomeCoverPct: number,
  defaultOdds: number = STANDARD_VIG_ODDS
): PricedSide<'home' | 'away'> {
  const pricesFromBook = prices.homeSpreadOdds !== undefined && prices.awaySpreadOdds !== undefined;
  const homeOdds = pricesFromBook ? prices.homeSpreadOdds! : defaultOdds;
  const awayOdds = pricesFromBook ? prices.awaySpreadOdds! : defaultOdds;
  const fairHome = fairImpliedPct(homeOdds, awayOdds);
  const homePct = Math.min(99.9, Math.max(0.1, fairHome + (anchoredHomeCoverPct - 50)));
  const homeEdge = homePct - impliedProbabilityPct(homeOdds);
  const awayEdge = 100 - homePct - impliedProbabilityPct(awayOdds);
  const home = homeEdge >= awayEdge;
  return {
    pickedSide: home ? 'home' : 'away',
    probability: home ? homePct : 100 - homePct,
    modelProbability: home ? modelHomeCoverPct : 100 - modelHomeCoverPct,
    americanOdds: home ? homeOdds : awayOdds,
    otherOdds: home ? awayOdds : homeOdds,
    breakEvenPct: impliedProbabilityPct(home ? homeOdds : awayOdds),
    pricesFromBook,
  };
}
