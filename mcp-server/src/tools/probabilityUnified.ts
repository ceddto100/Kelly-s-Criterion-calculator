/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unified probability estimation tool for MCP
 * Auto-detects sport from team names and handles flexible input formats
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  predictedMarginFootball,
  predictedMarginBasketball,
  coverProbability,
  type FootballStats,
  type BasketballStats
} from '../utils/calculations.js';
import {
  loadNBATeamStats,
  loadNFLTeamStats,
  getAllNBATeamNames,
  getAllNFLTeamNames,
  detectSportFromTeam
} from '../utils/loadStats.js';
import { getCurrentLocale } from '../server.js';

/**
 * Normalize input arguments to handle all possible parameter name variations
 * This is designed to be extremely flexible for LLM usage
 */
function normalizeArgs(rawArgs: any): {
  team1: string;
  team2: string;
  spread: number;
  sport?: string;
} {
  // Extract team 1 from many possible field names
  const team1 =
    rawArgs.team1 ||
    rawArgs.team_1 ||
    rawArgs.teamA ||
    rawArgs.team_a ||
    rawArgs.home_team ||
    rawArgs.home ||
    rawArgs.homeTeam ||
    rawArgs.team_favorite ||
    rawArgs.favorite_team ||
    rawArgs.favorite ||
    rawArgs.fav ||
    rawArgs.first_team ||
    rawArgs.firstTeam ||
    '';

  // Extract team 2 from many possible field names
  const team2 =
    rawArgs.team2 ||
    rawArgs.team_2 ||
    rawArgs.teamB ||
    rawArgs.team_b ||
    rawArgs.away_team ||
    rawArgs.away ||
    rawArgs.awayTeam ||
    rawArgs.team_underdog ||
    rawArgs.underdog_team ||
    rawArgs.underdog ||
    rawArgs.dog ||
    rawArgs.second_team ||
    rawArgs.secondTeam ||
    '';

  // Extract spread from possible field names
  const spreadRaw =
    rawArgs.spread ??
    rawArgs.point_spread ??
    rawArgs.pointSpread ??
    rawArgs.line ??
    rawArgs.points ??
    0;

  // Extract optional sport hint
  const sport =
    rawArgs.sport ||
    rawArgs.league ||
    rawArgs.type ||
    undefined;

  return {
    team1: String(team1).trim(),
    team2: String(team2).trim(),
    spread: Number(spreadRaw),
    sport: sport ? String(sport).toLowerCase().trim() : undefined
  };
}

/**
 * Find closest matching team names for suggestions
 */
function getSuggestedTeams(searchTerm: string, sport: 'nba' | 'nfl' | 'both' = 'both'): string[] {
  const normalized = searchTerm.toLowerCase();
  const suggestions: string[] = [];

  if (sport === 'nba' || sport === 'both') {
    const nbaTeams = getAllNBATeamNames();
    const nbaMatches = nbaTeams.filter(team =>
      team.toLowerCase().includes(normalized) ||
      normalized.includes(team.toLowerCase())
    );
    suggestions.push(...nbaMatches.slice(0, 3).map(t => `${t} (NBA)`));
  }

  if (sport === 'nfl' || sport === 'both') {
    const nflTeams = getAllNFLTeamNames();
    const nflMatches = nflTeams.filter(team =>
      team.toLowerCase().includes(normalized) ||
      normalized.includes(team.toLowerCase())
    );
    suggestions.push(...nflMatches.slice(0, 3).map(t => `${t} (NFL)`));
  }

  return suggestions.slice(0, 5);
}

export function registerUnifiedProbabilityTool(server: McpServer) {
  server.tool(
    'probability-estimate',
    {
      title: 'Estimate Game Probability (Auto-Detect Sport)',
      description: `Estimate the probability of covering a point spread for NBA or NFL games.

**IMPORTANT: This is the PRIMARY tool to use for probability estimation.** It automatically detects whether teams are NBA or NFL based on team names.

**Flexible Input - Use ANY of these parameter names:**
- Teams: team1/team2, home_team/away_team, teamA/teamB, favorite/underdog, fav/dog
- Spread: spread, point_spread, line, points

**Spread Handling:**
- The spread should be negative for the favorite (e.g., -3.5)
- If you provide a positive spread, we'll convert it automatically
- The first team (team1) is treated as the favorite

**Examples:**
- Houston Rockets -3.5 vs Lakers: team1="Houston Rockets", team2="Los Angeles Lakers", spread=-3.5
- Cowboys vs Giants with Cowboys -7: team1="Dallas Cowboys", team2="New York Giants", spread=-7

**Auto Sport Detection:**
- Rockets, Lakers, Celtics → NBA
- Cowboys, Eagles, Chiefs → NFL
- No need to specify sport manually!`,
      inputSchema: {
        // Primary team parameters
        team1: z.string().optional().describe('First team (favorite). Aliases: home_team, favorite, teamA, fav'),
        team2: z.string().optional().describe('Second team (underdog). Aliases: away_team, underdog, teamB, dog'),
        spread: z.number().optional().describe('Point spread (negative for favorite). Aliases: point_spread, line'),

        // All possible aliases for maximum flexibility
        home_team: z.string().optional().describe('Alias for team1'),
        away_team: z.string().optional().describe('Alias for team2'),
        home: z.string().optional().describe('Alias for team1'),
        away: z.string().optional().describe('Alias for team2'),
        homeTeam: z.string().optional().describe('Alias for team1'),
        awayTeam: z.string().optional().describe('Alias for team2'),
        team_favorite: z.string().optional().describe('Alias for team1'),
        team_underdog: z.string().optional().describe('Alias for team2'),
        favorite_team: z.string().optional().describe('Alias for team1'),
        underdog_team: z.string().optional().describe('Alias for team2'),
        favorite: z.string().optional().describe('Alias for team1'),
        underdog: z.string().optional().describe('Alias for team2'),
        fav: z.string().optional().describe('Alias for team1'),
        dog: z.string().optional().describe('Alias for team2'),
        teamA: z.string().optional().describe('Alias for team1'),
        teamB: z.string().optional().describe('Alias for team2'),
        team_a: z.string().optional().describe('Alias for team1'),
        team_b: z.string().optional().describe('Alias for team2'),
        team_1: z.string().optional().describe('Alias for team1'),
        team_2: z.string().optional().describe('Alias for team2'),
        first_team: z.string().optional().describe('Alias for team1'),
        second_team: z.string().optional().describe('Alias for team2'),
        firstTeam: z.string().optional().describe('Alias for team1'),
        secondTeam: z.string().optional().describe('Alias for team2'),
        point_spread: z.number().optional().describe('Alias for spread'),
        pointSpread: z.number().optional().describe('Alias for spread'),
        line: z.number().optional().describe('Alias for spread'),
        points: z.number().optional().describe('Alias for spread'),
        sport: z.string().optional().describe('Optional sport hint: "nba", "nfl", "basketball", "football"'),
        league: z.string().optional().describe('Alias for sport'),
        type: z.string().optional().describe('Alias for sport')
      },
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false
      },
      _meta: {
        'openai/outputTemplate': 'ui://widget/probability-estimator.html',
        'openai/toolInvocation/invoking': 'Estimating game probability...',
        'openai/toolInvocation/invoked': 'Estimated game probability',
        'openai/widgetAccessible': true
      }
    },
    async (rawArgs, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      // Normalize arguments to handle all possible aliases
      const args = normalizeArgs(rawArgs);

      // Validate required fields
      const missingFields: string[] = [];

      if (!args.team1) {
        missingFields.push('team1 (or home_team, favorite, teamA)');
      }

      if (!args.team2) {
        missingFields.push('team2 (or away_team, underdog, teamB)');
      }

      if (typeof args.spread !== 'number' || isNaN(args.spread)) {
        missingFields.push('spread (or point_spread, line)');
      }

      if (missingFields.length > 0) {
        return {
          structuredContent: {
            error: 'invalid_input',
            message: `Missing required field(s): ${missingFields.join(', ')}`,
            missing_fields: missingFields,
            hint: 'Provide two team names and a point spread. Example: team1="Houston Rockets", team2="Los Angeles Lakers", spread=-3.5'
          },
          content: [{
            type: 'text' as const,
            text: `Error: Missing required field(s): ${missingFields.join(', ')}\n\nHint: Provide two team names and a point spread.\nExample: team1="Houston Rockets", team2="Los Angeles Lakers", spread=-3.5`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Auto-detect sport from team names
      let detectedSport: 'nba' | 'nfl' | null = null;

      // Check user hint first
      if (args.sport) {
        const sportLower = args.sport.toLowerCase();
        if (sportLower.includes('nba') || sportLower.includes('basketball')) {
          detectedSport = 'nba';
        } else if (sportLower.includes('nfl') || sportLower.includes('football')) {
          detectedSport = 'nfl';
        }
      }

      // If no hint, detect from team names
      if (!detectedSport) {
        const team1Sport = detectSportFromTeam(args.team1);
        const team2Sport = detectSportFromTeam(args.team2);

        if (team1Sport && team2Sport) {
          if (team1Sport === team2Sport) {
            detectedSport = team1Sport;
          } else {
            // Conflict - teams from different sports
            return {
              structuredContent: {
                error: 'sport_mismatch',
                message: 'Teams appear to be from different sports',
                team1_detected: team1Sport,
                team2_detected: team2Sport,
                hint: 'Please ensure both teams are from the same sport (NBA or NFL)'
              },
              content: [{
                type: 'text' as const,
                text: `Error: "${args.team1}" appears to be ${team1Sport.toUpperCase()} and "${args.team2}" appears to be ${team2Sport.toUpperCase()}. Both teams must be from the same sport.`
              }],
              isError: true,
              _meta: { 'openai/locale': locale }
            };
          }
        } else if (team1Sport) {
          detectedSport = team1Sport;
        } else if (team2Sport) {
          detectedSport = team2Sport;
        }
      }

      // If still no detection, try loading from both databases
      if (!detectedSport) {
        const nbaStats1 = loadNBATeamStats(args.team1);
        const nbaStats2 = loadNBATeamStats(args.team2);
        const nflStats1 = loadNFLTeamStats(args.team1);
        const nflStats2 = loadNFLTeamStats(args.team2);

        const nbaMatches = (nbaStats1 ? 1 : 0) + (nbaStats2 ? 1 : 0);
        const nflMatches = (nflStats1 ? 1 : 0) + (nflStats2 ? 1 : 0);

        if (nbaMatches > nflMatches) {
          detectedSport = 'nba';
        } else if (nflMatches > nbaMatches) {
          detectedSport = 'nfl';
        } else if (nbaMatches > 0) {
          detectedSport = 'nba';
        } else if (nflMatches > 0) {
          detectedSport = 'nfl';
        }
      }

      // If we still can't detect, provide helpful error
      if (!detectedSport) {
        const suggestions1 = getSuggestedTeams(args.team1);
        const suggestions2 = getSuggestedTeams(args.team2);

        return {
          structuredContent: {
            error: 'unknown_teams',
            message: 'Could not identify the teams or detect the sport',
            team1_searched: args.team1,
            team2_searched: args.team2,
            suggestions_team1: suggestions1,
            suggestions_team2: suggestions2,
            hint: 'Use official team names, city names, or abbreviations (e.g., "Houston Rockets", "Lakers", "HOU")'
          },
          content: [{
            type: 'text' as const,
            text: `Error: Could not identify teams or detect sport.\n\nTeam 1 "${args.team1}": ${suggestions1.length > 0 ? `Did you mean: ${suggestions1.join(', ')}?` : 'Not found'}\nTeam 2 "${args.team2}": ${suggestions2.length > 0 ? `Did you mean: ${suggestions2.join(', ')}?` : 'Not found'}`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Handle spread - convert to negative if positive (favorite's perspective)
      let spread = args.spread;
      if (spread > 0) {
        spread = -spread; // Convert to favorite's perspective
      }

      // Validate spread range
      if (spread < -50 || spread > -0.5) {
        if (spread === 0) {
          return {
            structuredContent: {
              error: 'invalid_input',
              message: 'Spread cannot be zero - there must be a point spread',
              hint: 'Provide a non-zero spread (e.g., -3.5 for the favorite)'
            },
            content: [{
              type: 'text' as const,
              text: 'Error: Spread cannot be zero. Please provide a point spread (e.g., -3.5 for the favorite).'
            }],
            isError: true,
            _meta: { 'openai/locale': locale }
          };
        }

        return {
          structuredContent: {
            error: 'invalid_input',
            message: 'Spread out of valid range (should be between 0.5 and 50 points)',
            spread_provided: args.spread,
            spread_converted: spread
          },
          content: [{
            type: 'text' as const,
            text: `Error: Spread ${args.spread} is out of valid range. Spread should be between 0.5 and 50 points.`
          }],
          isError: true,
          _meta: { 'openai/locale': locale }
        };
      }

      // Load team statistics based on detected sport
      if (detectedSport === 'nba') {
        return handleNBAProbability(args.team1, args.team2, spread, locale);
      } else {
        return handleNFLProbability(args.team1, args.team2, spread, locale);
      }
    }
  );
}

/**
 * Handle NBA probability calculation
 */
async function handleNBAProbability(team1: string, team2: string, spread: number, locale: string) {
  const favoriteStats = loadNBATeamStats(team1);
  const underdogStats = loadNBATeamStats(team2);

  // Handle team not found
  if (!favoriteStats) {
    const suggestions = getSuggestedTeams(team1, 'nba');
    return {
      structuredContent: {
        error: 'invalid_input',
        message: `Unknown NBA team: "${team1}"`,
        team_searched: team1,
        suggestions: suggestions.length > 0 ? suggestions : ['Please check team name or use abbreviation (e.g., HOU, LAL, NYK)']
      },
      content: [{
        type: 'text' as const,
        text: `Error: Unknown NBA team "${team1}". ${suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?` : 'Please check the team name and try again.'}`
      }],
      isError: true,
      _meta: { 'openai/locale': locale }
    };
  }

  if (!underdogStats) {
    const suggestions = getSuggestedTeams(team2, 'nba');
    return {
      structuredContent: {
        error: 'invalid_input',
        message: `Unknown NBA team: "${team2}"`,
        team_searched: team2,
        suggestions: suggestions.length > 0 ? suggestions : ['Please check team name or use abbreviation (e.g., HOU, LAL, NYK)']
      },
      content: [{
        type: 'text' as const,
        text: `Error: Unknown NBA team "${team2}". ${suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?` : 'Please check the team name and try again.'}`
      }],
      isError: true,
      _meta: { 'openai/locale': locale }
    };
  }

  // Validate stats availability
  if (favoriteStats.pointsPerGame === null || favoriteStats.pointsAllowed === null ||
      underdogStats.pointsPerGame === null || underdogStats.pointsAllowed === null) {
    return {
      structuredContent: {
        error: 'insufficient_data',
        message: 'Insufficient team statistics available',
        teams: {
          favorite: favoriteStats.team,
          underdog: underdogStats.team
        }
      },
      content: [{
        type: 'text' as const,
        text: `Error: One or both teams (${favoriteStats.team}, ${underdogStats.team}) are missing required statistics. Cannot calculate probability.`
      }],
      isError: true,
      _meta: { 'openai/locale': locale }
    };
  }

  // Build stats object
  const stats: BasketballStats = {
    teamPointsFor: favoriteStats.pointsPerGame,
    teamPointsAgainst: favoriteStats.pointsAllowed,
    opponentPointsFor: underdogStats.pointsPerGame,
    opponentPointsAgainst: underdogStats.pointsAllowed,
    teamFgPct: favoriteStats.fieldGoalPct ?? 0.45,
    opponentFgPct: underdogStats.fieldGoalPct ?? 0.45,
    teamReboundMargin: favoriteStats.reboundMargin ?? 0,
    opponentReboundMargin: underdogStats.reboundMargin ?? 0,
    teamTurnoverMargin: favoriteStats.turnoverMargin ?? 0,
    opponentTurnoverMargin: underdogStats.turnoverMargin ?? 0
  };

  // Calculate
  const predictedMargin = predictedMarginBasketball(stats);
  const sigma = 12.0;

  const favoriteCoverProb = coverProbability(predictedMargin, spread, sigma);
  const underdogCoverProb = 100 - favoriteCoverProb;

  // Normalize probabilities
  const favorite_cover_probability = Number((favoriteCoverProb / 100).toFixed(2));
  const underdog_cover_probability = Number((1.0 - favorite_cover_probability).toFixed(2));

  const result = {
    sport: 'basketball',
    league: 'NBA',
    favorite_cover_probability,
    underdog_cover_probability,
    inputs: {
      team_favorite: team1,
      team_underdog: team2,
      spread
    },
    normalized: {
      team_favorite: favoriteStats.team,
      team_underdog: underdogStats.team
    }
  };

  return {
    structuredContent: result,
    content: [{
      type: 'text' as const,
      text: JSON.stringify(result, null, 2)
    }],
    _meta: {
      'openai/outputTemplate': 'ui://widget/probability-estimator.html',
      'openai/widgetAccessible': true,
      'openai/locale': locale,
      calculation: {
        sport: 'basketball',
        favorite: favoriteStats.team,
        underdog: underdogStats.team,
        spread,
        predictedMargin,
        sigma,
        method: 'statistical_analysis'
      }
    }
  };
}

/**
 * Handle NFL probability calculation
 */
async function handleNFLProbability(team1: string, team2: string, spread: number, locale: string) {
  const favoriteStats = loadNFLTeamStats(team1);
  const underdogStats = loadNFLTeamStats(team2);

  // Handle team not found
  if (!favoriteStats) {
    const suggestions = getSuggestedTeams(team1, 'nfl');
    return {
      structuredContent: {
        error: 'invalid_input',
        message: `Unknown NFL team: "${team1}"`,
        team_searched: team1,
        suggestions: suggestions.length > 0 ? suggestions : ['Please check team name or use abbreviation (e.g., DAL, KC, PHI)']
      },
      content: [{
        type: 'text' as const,
        text: `Error: Unknown NFL team "${team1}". ${suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?` : 'Please check the team name and try again.'}`
      }],
      isError: true,
      _meta: { 'openai/locale': locale }
    };
  }

  if (!underdogStats) {
    const suggestions = getSuggestedTeams(team2, 'nfl');
    return {
      structuredContent: {
        error: 'invalid_input',
        message: `Unknown NFL team: "${team2}"`,
        team_searched: team2,
        suggestions: suggestions.length > 0 ? suggestions : ['Please check team name or use abbreviation (e.g., DAL, KC, PHI)']
      },
      content: [{
        type: 'text' as const,
        text: `Error: Unknown NFL team "${team2}". ${suggestions.length > 0 ? `Did you mean: ${suggestions.join(', ')}?` : 'Please check the team name and try again.'}`
      }],
      isError: true,
      _meta: { 'openai/locale': locale }
    };
  }

  // Validate stats availability
  if (favoriteStats.pointsPerGame === null || favoriteStats.pointsAllowed === null ||
      underdogStats.pointsPerGame === null || underdogStats.pointsAllowed === null) {
    return {
      structuredContent: {
        error: 'insufficient_data',
        message: 'Insufficient team statistics available',
        teams: {
          favorite: favoriteStats.team,
          underdog: underdogStats.team
        }
      },
      content: [{
        type: 'text' as const,
        text: `Error: One or both teams (${favoriteStats.team}, ${underdogStats.team}) are missing required statistics. Cannot calculate probability.`
      }],
      isError: true,
      _meta: { 'openai/locale': locale }
    };
  }

  // Build stats object
  const stats: FootballStats = {
    teamPointsFor: favoriteStats.pointsPerGame,
    teamPointsAgainst: favoriteStats.pointsAllowed,
    opponentPointsFor: underdogStats.pointsPerGame,
    opponentPointsAgainst: underdogStats.pointsAllowed,
    teamOffYards: favoriteStats.offensiveYards ?? 350,
    teamDefYards: favoriteStats.defensiveYards ?? 350,
    opponentOffYards: underdogStats.offensiveYards ?? 350,
    opponentDefYards: underdogStats.defensiveYards ?? 350,
    teamTurnoverDiff: favoriteStats.turnoverDiff ?? 0,
    opponentTurnoverDiff: underdogStats.turnoverDiff ?? 0
  };

  // Calculate
  const predictedMargin = predictedMarginFootball(stats);
  const sigma = 13.5;

  const favoriteCoverProb = coverProbability(predictedMargin, spread, sigma);
  const underdogCoverProb = 100 - favoriteCoverProb;

  // Normalize probabilities
  const favorite_cover_probability = Number((favoriteCoverProb / 100).toFixed(2));
  const underdog_cover_probability = Number((1.0 - favorite_cover_probability).toFixed(2));

  const result = {
    sport: 'football',
    league: 'NFL',
    favorite_cover_probability,
    underdog_cover_probability,
    inputs: {
      team_favorite: team1,
      team_underdog: team2,
      spread
    },
    normalized: {
      team_favorite: favoriteStats.team,
      team_underdog: underdogStats.team
    }
  };

  return {
    structuredContent: result,
    content: [{
      type: 'text' as const,
      text: JSON.stringify(result, null, 2)
    }],
    _meta: {
      'openai/outputTemplate': 'ui://widget/probability-estimator.html',
      'openai/widgetAccessible': true,
      'openai/locale': locale,
      calculation: {
        sport: 'football',
        favorite: favoriteStats.team,
        underdog: underdogStats.team,
        spread,
        predictedMargin,
        sigma,
        method: 'statistical_analysis'
      }
    }
  };
}
