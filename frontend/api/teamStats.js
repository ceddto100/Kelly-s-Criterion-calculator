/**
 * teamStats.js - Frontend API module for ESPN team matchup statistics
 *
 * This module provides functions to fetch NBA and NFL team matchup data
 * from the backend ESPN integration service.
 */

/**
 * Fetch team matchup statistics from the backend
 * @param {string} sport - Sport league ('NBA' or 'NFL')
 * @param {string} team1 - First team name
 * @param {string} team2 - Second team name
 * @param {string} [season='current'] - Season to fetch stats from
 * @returns {Promise<object>} Matchup statistics
 */
export async function fetchMatchupStats(sport, team1, team2, season = 'current') {
  try {
    // Determine the backend URL (handles both local dev and production)
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

    const response = await fetch(`${backendUrl}/get_team_matchup_stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sport: sport.toUpperCase(),
        team_1: team1,
        team_2: team2,
        season: season
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Failed to fetch matchup stats: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching matchup stats:', error);
    throw error;
  }
}

/**
 * Fetch NBA team matchup statistics
 * @param {string} team1 - First NBA team name
 * @param {string} team2 - Second NBA team name
 * @returns {Promise<object>} NBA matchup statistics
 */
export async function fetchNBAMatchupStats(team1, team2) {
  return fetchMatchupStats('NBA', team1, team2);
}

/**
 * Fetch NFL team matchup statistics
 * @param {string} team1 - First NFL team name
 * @param {string} team2 - Second NFL team name
 * @returns {Promise<object>} NFL matchup statistics
 */
export async function fetchNFLMatchupStats(team1, team2) {
  return fetchMatchupStats('NFL', team1, team2);
}

/**
 * Search for a team by partial name
 * @param {string} sport - Sport league ('NBA' or 'NFL')
 * @param {string} teamName - Partial or full team name
 * @returns {Promise<object>} Team information
 */
export async function searchTeam(sport, teamName) {
  try {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

    const response = await fetch(`${backendUrl}/api/teams/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sport: sport.toUpperCase(),
        query: teamName
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to search team: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching team:', error);
    throw error;
  }
}

/**
 * Format metrics for display in the calculator
 * @param {object} metrics - Raw metrics from API
 * @param {string} sport - Sport type
 * @returns {object} Formatted metrics for calculator
 */
export function formatMetricsForCalculator(metrics, sport) {
  if (sport === 'NBA' || sport === 'Basketball') {
    return {
      pointsPerGame: metrics.points_per_game?.your_team || 0,
      pointsAllowed: metrics.points_allowed?.your_team || 0,
      fieldGoalPct: metrics.field_goal_percentage?.your_team || 0,
      reboundMargin: metrics.rebound_margin?.your_team || 0,
      turnoverMargin: metrics.turnover_margin?.your_team || 0,
      opponentPointsPerGame: metrics.points_per_game?.opponent || 0,
      opponentPointsAllowed: metrics.points_allowed?.opponent || 0,
      opponentFieldGoalPct: metrics.field_goal_percentage?.opponent || 0
    };
  } else if (sport === 'NFL' || sport === 'Football') {
    return {
      pointsPerGame: metrics.points_per_game?.your_team || 0,
      pointsAllowed: metrics.points_allowed?.your_team || 0,
      offensiveYards: metrics.offensive_yards?.your_team || 0,
      defensiveYards: metrics.defensive_yards?.your_team || 0,
      turnoverDiff: metrics.turnover_diff?.your_team || 0,
      opponentPointsPerGame: metrics.points_per_game?.opponent || 0,
      opponentPointsAllowed: metrics.points_allowed?.opponent || 0,
      opponentOffensiveYards: metrics.offensive_yards?.opponent || 0
    };
  }
  return {};
}

/**
 * Example usage in a React component:
 *
 * import { fetchNBAMatchupStats, formatMetricsForCalculator } from './api/teamStats';
 *
 * const handleSearch = async () => {
 *   try {
 *     const data = await fetchNBAMatchupStats('Lakers', 'Celtics');
 *     const formattedMetrics = formatMetricsForCalculator(data.metrics, 'NBA');
 *     setFormValues(formattedMetrics);
 *   } catch (error) {
 *     console.error('Failed to fetch stats:', error);
 *   }
 * };
 */
