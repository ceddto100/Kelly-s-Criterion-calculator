/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Team statistics lookup tool for MCP
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadNBATeamStats, loadNFLTeamStats, getMatchupStats } from '../utils/loadStats.js';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';
import { normalizeMatchupArgs, teamAAliasLabel, teamBAliasLabel } from '../utils/probabilityArgs.js';

export function registerTeamStatsTool(server: McpServer) {
  server.tool(
    'get-team-stats',
    {
      title: 'Get Team Statistics',
      description: 'Use this when the user wants to look up current statistics for NBA or NFL teams. Returns points per game, points allowed, and sport-specific stats like field goal percentage (NBA) or yards (NFL). Use this BEFORE using probability estimation tools if you need to gather team stats. Do not use for calculating probabilities directly (use probability-estimate-football or probability-estimate-basketball after getting stats).',
      inputSchema: {
        teamName: z.string().describe('Name of the team to look up. Can be full name (e.g., "Los Angeles Lakers"), city name (e.g., "Lakers"), or abbreviation (e.g., "LAL"). Examples: "Warriors", "Golden State", "GSW", "Chiefs", "Kansas City Chiefs"'),
        sport: z.enum(['nba', 'nfl']).default('nba').describe('Sport league to search. Use "nba" for basketball teams, "nfl" for football teams. Default is "nba".')
      },
      annotations: {
        readOnlyHint: true, // Only reads from local CSV files
        openWorldHint: false, // Reads from local data files only
        destructiveHint: false // No data modification or deletion
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Looking up team stats...',
        'openai/toolInvocation/invoked': 'Retrieved team statistics'
      }
    },
    async (args, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { teamName } = args;
      // Default to 'nba' if sport not specified
      const sport = args.sport || 'nba';

      if (!teamName || typeof teamName !== 'string') {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Team name is required'
          },
          content: [{
            type: 'text' as const,
            text: 'Please provide a team name to look up.'
          }],
          isError: true
        };
      }

      try {
        const stats = sport === 'nfl'
          ? loadNFLTeamStats(teamName)
          : loadNBATeamStats(teamName);

        if (!stats) {
          return {
            structuredContent: {
              error: 'team_not_found',
              message: `Team "${teamName}" not found in ${sport.toUpperCase()} data`,
              searchedTerm: teamName,
              sport: sport
            },
            content: [{
              type: 'text' as const,
              text: `Could not find team "${teamName}" in ${sport.toUpperCase()} statistics. Please check the team name and try again. You can use full team names (e.g., "Los Angeles Lakers"), city names (e.g., "Lakers"), or abbreviations (e.g., "LAL").`
            }],
            isError: true
          };
        }

        // Format response based on sport
        let statsText: string;
        if (sport === 'nfl') {
          const nflStats = stats as { team: string; pointsPerGame: number | null; pointsAllowed: number | null; offensiveYards: number | null; defensiveYards: number | null; turnoverDiff: number | null };
          statsText = `**${nflStats.team}** (NFL)\n\n` +
            `- Points Per Game: ${nflStats.pointsPerGame?.toFixed(1) ?? 'N/A'}\n` +
            `- Points Allowed: ${nflStats.pointsAllowed?.toFixed(1) ?? 'N/A'}\n` +
            `- Offensive Yards/Game: ${nflStats.offensiveYards?.toFixed(1) ?? 'N/A'}\n` +
            `- Defensive Yards Allowed/Game: ${nflStats.defensiveYards?.toFixed(1) ?? 'N/A'}\n` +
            `- Turnover Differential: ${nflStats.turnoverDiff !== null ? (nflStats.turnoverDiff > 0 ? '+' : '') + nflStats.turnoverDiff.toFixed(1) : 'N/A'}`;
        } else {
          const nbaStats = stats as { team: string; pointsPerGame: number | null; pointsAllowed: number | null; fieldGoalPct: number | null; reboundMargin: number | null; turnoverMargin: number | null };
          statsText = `**${nbaStats.team}** (NBA)\n\n` +
            `- Points Per Game: ${nbaStats.pointsPerGame?.toFixed(1) ?? 'N/A'}\n` +
            `- Points Allowed: ${nbaStats.pointsAllowed?.toFixed(1) ?? 'N/A'}\n` +
            `- Field Goal %: ${nbaStats.fieldGoalPct !== null ? (nbaStats.fieldGoalPct * 100).toFixed(1) + '%' : 'N/A'}\n` +
            `- Rebound Margin: ${nbaStats.reboundMargin !== null ? (nbaStats.reboundMargin > 0 ? '+' : '') + nbaStats.reboundMargin.toFixed(1) : 'N/A'}\n` +
            `- Turnover Margin: ${nbaStats.turnoverMargin !== null ? (nbaStats.turnoverMargin > 0 ? '+' : '') + nbaStats.turnoverMargin.toFixed(1) : 'N/A'}`;
        }

        return {
          structuredContent: {
            sport: sport,
            stats: stats,
            dataSource: 'CSV files (updated regularly)',
            retrievedAt: new Date().toISOString()
          },
          content: [{
            type: 'text' as const,
            text: statsText + '\n\n_Use these stats with probability-estimate tools to calculate win probabilities._'
          }],
          _meta: {
            'openai/locale': locale
          }
        };
      } catch (error) {
        console.error('Error loading team stats:', error);
        return {
          structuredContent: {
            error: 'load_error',
            message: error instanceof Error ? error.message : 'Failed to load team statistics'
          },
          content: [{
            type: 'text' as const,
            text: 'An error occurred while loading team statistics. The stats data may not be available.'
          }],
          isError: true
        };
      }
    }
  );
}

export function registerMatchupTool(server: McpServer) {
  server.tool(
    'get-matchup-stats',
    {
      title: 'Get Matchup Statistics',
      description: `Use this when the user wants to compare two teams head-to-head. Returns statistics for both teams side by side, making it easy to use with probability estimation tools. This is more efficient than calling get-team-stats twice.

**Flexible Input - Use ANY of these parameter names:**
- Team A: teamA, team_a, team1, home_team, favorite, fav
- Team B: teamB, team_b, team2, away_team, underdog, dog
- Sport: sport (nba/nfl/basketball/football), default is nba`,
      inputSchema: {
        teamA: z.string().optional().describe('First team name. Can be full name, city, or abbreviation. Example: "Lakers", "Los Angeles Lakers", "LAL"'),
        teamB: z.string().optional().describe('Second team name. Can be full name, city, or abbreviation. Example: "Warriors", "Golden State", "GSW"'),
        sport: z.enum(['nba', 'nfl', 'basketball', 'football']).optional().default('nba').describe('Sport league. Use "nba"/"basketball" for NBA, "nfl"/"football" for NFL. Default is "nba".'),
        // Team A aliases
        team_a: z.string().optional().describe('Alias for teamA'),
        team1: z.string().optional().describe('Alias for teamA'),
        team_1: z.string().optional().describe('Alias for teamA'),
        home_team: z.string().optional().describe('Alias for teamA'),
        home: z.string().optional().describe('Alias for teamA'),
        homeTeam: z.string().optional().describe('Alias for teamA'),
        favorite: z.string().optional().describe('Alias for teamA'),
        fav: z.string().optional().describe('Alias for teamA'),
        team_favorite: z.string().optional().describe('Alias for teamA'),
        favorite_team: z.string().optional().describe('Alias for teamA'),
        first_team: z.string().optional().describe('Alias for teamA'),
        firstTeam: z.string().optional().describe('Alias for teamA'),
        // Team B aliases
        team_b: z.string().optional().describe('Alias for teamB'),
        team2: z.string().optional().describe('Alias for teamB'),
        team_2: z.string().optional().describe('Alias for teamB'),
        away_team: z.string().optional().describe('Alias for teamB'),
        away: z.string().optional().describe('Alias for teamB'),
        awayTeam: z.string().optional().describe('Alias for teamB'),
        underdog: z.string().optional().describe('Alias for teamB'),
        dog: z.string().optional().describe('Alias for teamB'),
        team_underdog: z.string().optional().describe('Alias for teamB'),
        underdog_team: z.string().optional().describe('Alias for teamB'),
        second_team: z.string().optional().describe('Alias for teamB'),
        secondTeam: z.string().optional().describe('Alias for teamB'),
        // Sport alias
        league: z.string().optional().describe('Alias for sport')
      },
      annotations: {
        readOnlyHint: true, // Only reads from local CSV files
        openWorldHint: false, // Reads from local data files only
        destructiveHint: false // No data modification or deletion
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Loading matchup statistics...',
        'openai/toolInvocation/invoked': 'Retrieved matchup statistics'
      }
    },
    async (rawArgs, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      // Normalize arguments to handle aliases
      const { normalized: args, missingFields } = normalizeMatchupArgs(rawArgs, { defaultSport: 'nba' });
      const { teamA, teamB, sport } = args;

      if (missingFields.length > 0) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: `Missing required field(s): ${missingFields.join(', ')}`,
            missing_fields: missingFields,
            hint: 'Provide two team names. Example: teamA="Lakers", teamB="Warriors"'
          },
          content: [{
            type: 'text' as const,
            text: `Error: Missing required field(s): ${missingFields.join(', ')}\n\nHint: Provide two team names.\nExample: teamA="Lakers", teamB="Warriors"`
          }],
          isError: true
        };
      }

      try {
        const matchup = getMatchupStats(teamA, teamB, sport);

        if (!matchup.teamA) {
          return {
            structuredContent: {
              error: 'team_not_found',
              message: `Team "${teamA}" not found`,
              searchedTerm: teamA
            },
            content: [{
              type: 'text' as const,
              text: `Could not find team "${teamA}" in ${sport.toUpperCase()} statistics.`
            }],
            isError: true
          };
        }

        if (!matchup.teamB) {
          return {
            structuredContent: {
              error: 'team_not_found',
              message: `Team "${teamB}" not found`,
              searchedTerm: teamB
            },
            content: [{
              type: 'text' as const,
              text: `Could not find team "${teamB}" in ${sport.toUpperCase()} statistics.`
            }],
            isError: true
          };
        }

        // Format comparison text
        let comparisonText: string;
        if (sport === 'nfl') {
          const a = matchup.teamA as { team: string; pointsPerGame: number | null; pointsAllowed: number | null; offensiveYards: number | null; defensiveYards: number | null; turnoverDiff: number | null };
          const b = matchup.teamB as { team: string; pointsPerGame: number | null; pointsAllowed: number | null; offensiveYards: number | null; defensiveYards: number | null; turnoverDiff: number | null };

          comparisonText = `**${a.team} vs ${b.team}** (NFL)\n\n` +
            `| Stat | ${a.team} | ${b.team} |\n` +
            `|------|----------|----------|\n` +
            `| Points/Game | ${a.pointsPerGame?.toFixed(1) ?? 'N/A'} | ${b.pointsPerGame?.toFixed(1) ?? 'N/A'} |\n` +
            `| Points Allowed | ${a.pointsAllowed?.toFixed(1) ?? 'N/A'} | ${b.pointsAllowed?.toFixed(1) ?? 'N/A'} |\n` +
            `| Off. Yards | ${a.offensiveYards?.toFixed(0) ?? 'N/A'} | ${b.offensiveYards?.toFixed(0) ?? 'N/A'} |\n` +
            `| Def. Yards | ${a.defensiveYards?.toFixed(0) ?? 'N/A'} | ${b.defensiveYards?.toFixed(0) ?? 'N/A'} |\n` +
            `| Turnover Diff | ${a.turnoverDiff !== null ? (a.turnoverDiff > 0 ? '+' : '') + a.turnoverDiff.toFixed(1) : 'N/A'} | ${b.turnoverDiff !== null ? (b.turnoverDiff > 0 ? '+' : '') + b.turnoverDiff.toFixed(1) : 'N/A'} |`;
        } else {
          const a = matchup.teamA as { team: string; pointsPerGame: number | null; pointsAllowed: number | null; fieldGoalPct: number | null; reboundMargin: number | null; turnoverMargin: number | null };
          const b = matchup.teamB as { team: string; pointsPerGame: number | null; pointsAllowed: number | null; fieldGoalPct: number | null; reboundMargin: number | null; turnoverMargin: number | null };

          comparisonText = `**${a.team} vs ${b.team}** (NBA)\n\n` +
            `| Stat | ${a.team} | ${b.team} |\n` +
            `|------|----------|----------|\n` +
            `| Points/Game | ${a.pointsPerGame?.toFixed(1) ?? 'N/A'} | ${b.pointsPerGame?.toFixed(1) ?? 'N/A'} |\n` +
            `| Points Allowed | ${a.pointsAllowed?.toFixed(1) ?? 'N/A'} | ${b.pointsAllowed?.toFixed(1) ?? 'N/A'} |\n` +
            `| FG% | ${a.fieldGoalPct !== null ? (a.fieldGoalPct * 100).toFixed(1) + '%' : 'N/A'} | ${b.fieldGoalPct !== null ? (b.fieldGoalPct * 100).toFixed(1) + '%' : 'N/A'} |\n` +
            `| Reb. Margin | ${a.reboundMargin !== null ? (a.reboundMargin > 0 ? '+' : '') + a.reboundMargin.toFixed(1) : 'N/A'} | ${b.reboundMargin !== null ? (b.reboundMargin > 0 ? '+' : '') + b.reboundMargin.toFixed(1) : 'N/A'} |\n` +
            `| TO Margin | ${a.turnoverMargin !== null ? (a.turnoverMargin > 0 ? '+' : '') + a.turnoverMargin.toFixed(1) : 'N/A'} | ${b.turnoverMargin !== null ? (b.turnoverMargin > 0 ? '+' : '') + b.turnoverMargin.toFixed(1) : 'N/A'} |`;
        }

        return {
          structuredContent: {
            sport: sport,
            teamA: matchup.teamA,
            teamB: matchup.teamB,
            dataSource: matchup.dataSource,
            retrievedAt: new Date().toISOString()
          },
          content: [{
            type: 'text' as const,
            text: comparisonText + '\n\n_Use these stats with probability-estimate tools to calculate win/cover probabilities._'
          }],
          _meta: {
            'openai/locale': locale
          }
        };
      } catch (error) {
        console.error('Error loading matchup stats:', error);
        return {
          structuredContent: {
            error: 'load_error',
            message: error instanceof Error ? error.message : 'Failed to load matchup statistics'
          },
          content: [{
            type: 'text' as const,
            text: 'An error occurred while loading matchup statistics.'
          }],
          isError: true
        };
      }
    }
  );
}
