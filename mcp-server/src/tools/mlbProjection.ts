/**
 * MLB Projection Tool
 * Exposes the explainable MLB run-projection engine (totals + moneyline) over
 * MCP. All weather/park/lineup inputs are optional; the engine falls back to
 * neutral defaults and lowers confidence when data is missing.
 *
 * Follows the codebase tool convention: exports a `toolDefinition`, an
 * `inputSchema` (whose `.shape` is registered with server.tool) and a
 * `handle*` function.
 */

import { z } from 'zod';
import { projectMLBGame, type MLBProjectionInput } from '../utils/mlb.js';

// ============================================================================
// INPUT SCHEMA
// ============================================================================

const offenseSchema = z
  .object({
    wrcPlus: z.number().optional().describe('wRC+ (100 = league average)'),
    woba: z.number().optional().describe('wOBA (league avg ~0.318)'),
    ops: z.number().optional().describe('OPS (league avg ~0.720)'),
    runsPerGame: z.number().optional().describe('Runs scored per game'),
    recentRunsPerGame: z.number().optional().describe('Runs/game over last ~15 games'),
  })
  .describe('Team offensive profile (provide at least one stat)');

const starterSchema = z
  .object({
    confirmed: z.boolean().optional().describe('Is the probable starter confirmed?'),
    era: z.number().optional(),
    fip: z.number().optional(),
    xfip: z.number().optional(),
    siera: z.number().optional(),
  })
  .describe('Starting pitcher (FIP/xFIP/SIERA preferred over ERA)');

const bullpenSchema = z
  .object({
    era: z.number().optional(),
    fip: z.number().optional(),
    whip: z.number().optional(),
    inningsLast1d: z.number().optional().describe('Relief innings thrown in last 1 day'),
    inningsLast3d: z.number().optional().describe('Relief innings thrown in last 3 days'),
    closerAvailable: z.boolean().optional(),
  })
  .describe('Bullpen unit profile + recent usage');

const lineupSchema = z
  .object({
    confirmed: z.boolean().optional(),
    starsOut: z.number().optional().describe('Number of star hitters resting/absent'),
    platoonAdvantage: z.boolean().optional().describe('Batters have handedness edge vs opp SP'),
  })
  .optional();

export const mlbProjectionInputSchema = z.object({
  homeTeam: z.string().describe('Home team name'),
  awayTeam: z.string().describe('Away team name'),
  homeOffense: offenseSchema,
  awayOffense: offenseSchema,
  homeStarter: starterSchema,
  awayStarter: starterSchema,
  homeBullpen: bullpenSchema,
  awayBullpen: bullpenSchema,
  homeLineup: lineupSchema,
  awayLineup: lineupSchema,
  parkFactor: z.number().optional().describe('Run park factor (100 = neutral)'),
  temperatureF: z.number().optional(),
  windSpeedMph: z.number().optional(),
  windDirection: z.enum(['out', 'in', 'crosswind', 'none']).optional(),
  roofClosed: z.boolean().optional(),
  weatherReliable: z.boolean().optional(),
  bookTotal: z.number().optional().describe('Sportsbook over/under total'),
  homeMoneyline: z.number().optional().describe('Home moneyline (American odds)'),
  awayMoneyline: z.number().optional().describe('Away moneyline (American odds)'),
  totalMovedSharply: z.boolean().optional(),
});

export type MLBProjectionToolInput = z.infer<typeof mlbProjectionInputSchema>;

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const mlbProjectionToolDefinition = {
  name: 'estimate_mlb_projection',
  description:
    'Project an MLB game (run total + moneyline) from a stat-based, explainable formula engine. ' +
    'Uses team offense, starting pitching (FIP/xFIP/SIERA), bullpen quality & fatigue, ballpark, ' +
    'weather, and lineup info. Returns projected runs per team, projected total, over/under lean, ' +
    'moneyline lean, edge vs the book line, a confidence score, main stat drivers, and risk factors. ' +
    'Emits "no-bet" when the edge is too small or data is too thin. Not a guaranteed pick.',
};

// ============================================================================
// HANDLER
// ============================================================================

export async function handleMLBProjection(input: unknown) {
  const params = mlbProjectionInputSchema.parse(input);

  const projectionInput: MLBProjectionInput = {
    home: {
      name: params.homeTeam,
      offense: params.homeOffense,
      starter: params.homeStarter,
      bullpen: params.homeBullpen,
      lineup: params.homeLineup,
    },
    away: {
      name: params.awayTeam,
      offense: params.awayOffense,
      starter: params.awayStarter,
      bullpen: params.awayBullpen,
      lineup: params.awayLineup,
    },
    environment: {
      parkFactor: params.parkFactor,
      temperatureF: params.temperatureF,
      windSpeedMph: params.windSpeedMph,
      windDirection: params.windDirection,
      roofClosed: params.roofClosed,
      weatherReliable: params.weatherReliable,
    },
    line: {
      total: params.bookTotal,
      homeMoneyline: params.homeMoneyline,
      awayMoneyline: params.awayMoneyline,
      totalMovedSharply: params.totalMovedSharply,
    },
  };

  return { success: true, sport: 'baseball', league: 'MLB', ...projectMLBGame(projectionInput) };
}
