/**
 * Team Stats Fetching Tool
 *
 * This module provides MCP tools for fetching team statistics from local CSV files.
 * Stats are loaded from frontend/public/stats/ and include all metrics needed for
 * probability estimation using the Walters Protocol.
 *
 * TOOL: get_team_stats
 * Fetches comprehensive team statistics for a single team, including all metrics
 * needed for probability estimation. Supports both NBA and NFL teams.
 *
 * TOOL: get_matchup_stats
 * Fetches statistics for both teams in a matchup, formatted and ready for use
 * with the probability estimator tools.
 */

import { z } from 'zod';
import {
  getNBATeamStats,
  getNFLTeamStats,
  getTeamStats,
  areStatsAvailable,
  NBATeamStats,
  NFLTeamStats
} from '../utils/statsLoader.js';

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const getTeamStatsInputSchema = z.object({
  team: z
    .string()
    .min(1)
    .describe('Team name, city, or abbreviation (e.g., "Hawks", "Atlanta", "ATL")'),

  sport: z
    .enum(['NBA', 'NFL', 'CBB', 'CFB'])
    .describe('Sport league: NBA, NFL, CBB (college basketball), or CFB (college football)')
});

export const getMatchupStatsInputSchema = z.object({
  teamA: z
    .string()
    .min(1)
    .describe('Team A name, city, or abbreviation'),

  teamB: z
    .string()
    .min(1)
    .describe('Team B name, city, or abbreviation'),

  sport: z
    .enum(['NBA', 'NFL', 'CBB', 'CFB'])
    .describe('Sport league')
});

export type GetTeamStatsInput = z.infer<typeof getTeamStatsInputSchema>;
export type GetMatchupStatsInput = z.infer<typeof getMatchupStatsInputSchema>;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const getTeamStatsToolDefinition = {
  name: 'get_team_stats',
  description: `🏀🏈 FETCH TEAM STATS - Get real statistics for any NBA or NFL team.

SIMPLE INPUTS: Just provide a team name as a string!

Examples:
- { team: "Hawks", sport: "NBA" }
- { team: "Atlanta", sport: "NBA" }
- { team: "ATL", sport: "NBA" }
- { team: "Cowboys", sport: "NFL" }
- { team: "DAL", sport: "NFL" }

Returns all stats needed for probability estimation:
- Points per game (ppg)
- Points allowed per game
- Offensive/defensive metrics
- Turnover margins

Use this to get real team data before making betting calculations.`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      team: {
        type: 'string',
        description: 'Team name, city, or abbreviation (e.g., "Hawks", "Atlanta", "ATL")',
        minLength: 1
      },
      sport: {
        type: 'string',
        enum: ['NBA', 'NFL', 'CBB', 'CFB'],
        description: 'Sport league (NBA, NFL, CBB, CFB)'
      }
    },
    required: ['team', 'sport']
  }
};

export const getMatchupStatsToolDefinition = {
  name: 'get_matchup_stats',
  description: `🏀🏈 FETCH MATCHUP STATS - Get statistics for BOTH teams in a matchup at once.

SIMPLE INPUTS: Just provide team names as strings!

Examples:
- { teamA: "Hawks", teamB: "Heat", sport: "NBA" }
- { teamA: "Cowboys", teamB: "Eagles", sport: "NFL" }
- { teamA: "ATL", teamB: "MIA", sport: "NBA" }

Returns complete stats for both teams:
- All offensive and defensive metrics
- Ready to use for probability estimation
- Formatted for direct use in betting calculations

Use this when you need stats for a specific matchup!`,

  inputSchema: {
    type: 'object' as const,
    properties: {
      teamA: {
        type: 'string',
        description: 'Team A name, city, or abbreviation (e.g., "Hawks", "Atlanta", "ATL")',
        minLength: 1
      },
      teamB: {
        type: 'string',
        description: 'Team B name, city, or abbreviation (e.g., "Heat", "Miami", "MIA")',
        minLength: 1
      },
      sport: {
        type: 'string',
        enum: ['NBA', 'NFL', 'CBB', 'CFB'],
        description: 'Sport league (NBA, NFL, CBB, CFB)'
      }
    },
    required: ['teamA', 'teamB', 'sport']
  }
};

// ============================================================================
// HANDLERS
// ============================================================================

export interface FormattedStats {
  name: string;
  ppg: number;
  pointsAllowed: number;
  [key: string]: string | number;
}

export interface TeamStatsOutput {
  success: boolean;
  team: string;
  abbreviation: string;
  sport: string;
  stats: NBATeamStats | NFLTeamStats;
  formattedForEstimator: FormattedStats;
}

export interface MatchupStatsOutput {
  success: boolean;
  sport: string;
  teamA: {
    team: string;
    abbreviation: string;
    stats: NBATeamStats | NFLTeamStats;
    formattedForEstimator: FormattedStats;
  };
  teamB: {
    team: string;
    abbreviation: string;
    stats: NBATeamStats | NFLTeamStats;
    formattedForEstimator: FormattedStats;
  };
  statsAvailability: {
    nba: boolean;
    nfl: boolean;
  };
}

export async function handleGetTeamStats(input: unknown): Promise<TeamStatsOutput> {
  const parsed = getTeamStatsInputSchema.parse(input);

  const stats = getTeamStats(parsed.team, parsed.sport);

  if (!stats) {
    throw new Error(
      `Could not find stats for team "${parsed.team}" in ${parsed.sport}. ` +
      `Try using the team name (e.g., "Hawks"), city (e.g., "Atlanta"), or abbreviation (e.g., "ATL").`
    );
  }

  // Format for estimator based on sport
  const isBasketball = parsed.sport === 'NBA' || parsed.sport === 'CBB';
  const formattedForEstimator = isBasketball
    ? formatNBAStatsForEstimator(stats as NBATeamStats)
    : formatNFLStatsForEstimator(stats as NFLTeamStats);

  return {
    success: true,
    team: stats.team,
    abbreviation: stats.abbreviation,
    sport: parsed.sport,
    stats,
    formattedForEstimator
  };
}

export async function handleGetMatchupStats(input: unknown): Promise<MatchupStatsOutput> {
  const parsed = getMatchupStatsInputSchema.parse(input);

  const statsA = getTeamStats(parsed.teamA, parsed.sport);
  const statsB = getTeamStats(parsed.teamB, parsed.sport);

  if (!statsA) {
    throw new Error(
      `Could not find stats for team "${parsed.teamA}" in ${parsed.sport}.`
    );
  }

  if (!statsB) {
    throw new Error(
      `Could not find stats for team "${parsed.teamB}" in ${parsed.sport}.`
    );
  }

  const isBasketball = parsed.sport === 'NBA' || parsed.sport === 'CBB';
  const availability = areStatsAvailable();

  return {
    success: true,
    sport: parsed.sport,
    teamA: {
      team: statsA.team,
      abbreviation: statsA.abbreviation,
      stats: statsA,
      formattedForEstimator: isBasketball
        ? formatNBAStatsForEstimator(statsA as NBATeamStats)
        : formatNFLStatsForEstimator(statsA as NFLTeamStats)
    },
    teamB: {
      team: statsB.team,
      abbreviation: statsB.abbreviation,
      stats: statsB,
      formattedForEstimator: isBasketball
        ? formatNBAStatsForEstimator(statsB as NBATeamStats)
        : formatNFLStatsForEstimator(statsB as NFLTeamStats)
    },
    statsAvailability: availability
  };
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatNBAStatsForEstimator(stats: NBATeamStats): FormattedStats {
  return {
    name: stats.team,
    ppg: stats.ppg,
    pointsAllowed: stats.pointsAllowed,
    fgPct: stats.fgPct,
    reboundMargin: stats.reboundMargin,
    turnoverMargin: stats.turnoverMargin
  };
}

function formatNFLStatsForEstimator(stats: NFLTeamStats): FormattedStats {
  return {
    name: stats.team,
    ppg: stats.ppg,
    pointsAllowed: stats.pointsAllowed,
    offensiveYards: stats.offensiveYards,
    defensiveYards: stats.defensiveYards,
    turnoverDiff: stats.turnoverDiff
  };
}
