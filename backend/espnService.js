// espnService.js - ESPN API Integration Service
const axios = require('axios');
const { findMockNBATeam, findMockNFLTeam } = require('./mockESPNData');

// Use mock data if ESPN API is unavailable (403/401 errors)
// Set to false to always try real API first
const USE_MOCK_DATA = process.env.USE_MOCK_ESPN_DATA === 'true' || false;

/**
 * ESPN API endpoints for different sports
 */
const ESPN_API_ENDPOINTS = {
  NBA: {
    teams: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
    teamStats: (teamId) => `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/statistics`
  },
  NFL: {
    teams: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
    teamStats: (teamId) => `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/statistics`
  }
};

/**
 * Get default headers for ESPN API requests
 */
function getESPNHeaders() {
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.espn.com/',
    'Origin': 'https://www.espn.com'
  };
}

/**
 * Find team ID by team name (handles partial matches)
 * @param {string} sport - 'NBA' or 'NFL'
 * @param {string} teamName - Team name to search for
 * @returns {Promise<object|null>} Team object with id and full name
 */
async function findTeamId(sport, teamName) {
  try {
    const endpoint = ESPN_API_ENDPOINTS[sport]?.teams;
    if (!endpoint) {
      throw new Error(`Invalid sport: ${sport}. Must be 'NBA' or 'NFL'`);
    }

    const response = await axios.get(endpoint, {
      headers: getESPNHeaders(),
      timeout: 10000
    });
    const teams = response.data?.sports?.[0]?.leagues?.[0]?.teams || [];

    // Normalize search term
    const searchTerm = teamName.toLowerCase().trim();

    // Search for team by display name, location, or nickname
    const team = teams.find(t => {
      const teamData = t.team;
      const displayName = teamData.displayName?.toLowerCase() || '';
      const location = teamData.location?.toLowerCase() || '';
      const nickname = teamData.nickname?.toLowerCase() || '';
      const shortName = teamData.shortDisplayName?.toLowerCase() || '';

      return (
        displayName.includes(searchTerm) ||
        searchTerm.includes(displayName) ||
        location.includes(searchTerm) ||
        nickname.includes(searchTerm) ||
        shortName.includes(searchTerm)
      );
    });

    if (!team) {
      return null;
    }

    return {
      id: team.team.id,
      name: team.team.displayName,
      abbreviation: team.team.abbreviation,
      logo: team.team.logos?.[0]?.href || null
    };
  } catch (error) {
    console.error(`Error finding team ID for ${teamName}:`, error.message);
    throw error;
  }
}

/**
 * Fetch NBA team statistics
 * @param {string} teamId - ESPN team ID
 * @returns {Promise<object>} Parsed statistics
 */
async function fetchNBATeamStats(teamId) {
  try {
    const response = await axios.get(ESPN_API_ENDPOINTS.NBA.teamStats(teamId), {
      headers: getESPNHeaders(),
      timeout: 10000
    });
    const stats = response.data?.team?.record?.items?.[0]?.stats || [];

    // Helper to find stat by name
    const getStat = (name) => {
      const stat = stats.find(s => s.name === name);
      return stat?.value ?? null;
    };

    return {
      points_per_game: parseFloat(getStat('avgPointsFor')) || null,
      points_allowed: parseFloat(getStat('avgPointsAgainst')) || null,
      field_goal_percentage: parseFloat(getStat('fieldGoalPct')) || null,
      rebounds_per_game: parseFloat(getStat('reboundsPerGame')) || null,
      assists_per_game: parseFloat(getStat('assistsPerGame')) || null,
      turnovers_per_game: parseFloat(getStat('turnoversPerGame')) || null,
      three_point_percentage: parseFloat(getStat('threePointPct')) || null,
      free_throw_percentage: parseFloat(getStat('freeThrowPct')) || null
    };
  } catch (error) {
    console.error(`Error fetching NBA stats for team ${teamId}:`, error.message);
    return null;
  }
}

/**
 * Fetch NFL team statistics
 * @param {string} teamId - ESPN team ID
 * @returns {Promise<object>} Parsed statistics
 */
async function fetchNFLTeamStats(teamId) {
  try {
    const response = await axios.get(ESPN_API_ENDPOINTS.NFL.teamStats(teamId), {
      headers: getESPNHeaders(),
      timeout: 10000
    });
    const stats = response.data?.team?.record?.items?.[0]?.stats || [];

    // Helper to find stat by name
    const getStat = (name) => {
      const stat = stats.find(s => s.name === name);
      return stat?.value ?? null;
    };

    return {
      points_per_game: parseFloat(getStat('avgPointsFor')) || null,
      points_allowed: parseFloat(getStat('avgPointsAgainst')) || null,
      total_yards: parseFloat(getStat('totalYards')) || null,
      yards_allowed: parseFloat(getStat('yardsAllowed')) || null,
      passing_yards: parseFloat(getStat('passingYardsPerGame')) || null,
      rushing_yards: parseFloat(getStat('rushingYardsPerGame')) || null,
      turnover_differential: parseFloat(getStat('turnoverDifferential')) || null,
      third_down_conversion: parseFloat(getStat('thirdDownConversionPct')) || null
    };
  } catch (error) {
    console.error(`Error fetching NFL stats for team ${teamId}:`, error.message);
    return null;
  }
}

/**
 * Calculate derived metrics for matchup
 * @param {object} team1Stats - Stats for team 1
 * @param {object} team2Stats - Stats for team 2
 * @param {string} sport - Sport type
 * @returns {object} Formatted metrics
 */
function calculateMatchupMetrics(team1Stats, team2Stats, sport) {
  if (sport === 'NBA') {
    // Calculate rebound margin (rebounds - opponent rebounds)
    const reboundMargin1 = team1Stats.rebounds_per_game && team2Stats.rebounds_per_game
      ? (team1Stats.rebounds_per_game - team2Stats.rebounds_per_game).toFixed(1)
      : null;

    const reboundMargin2 = team2Stats.rebounds_per_game && team1Stats.rebounds_per_game
      ? (team2Stats.rebounds_per_game - team1Stats.rebounds_per_game).toFixed(1)
      : null;

    // Calculate turnover margin
    const turnoverMargin1 = team2Stats.turnovers_per_game && team1Stats.turnovers_per_game
      ? (team2Stats.turnovers_per_game - team1Stats.turnovers_per_game).toFixed(1)
      : null;

    const turnoverMargin2 = team1Stats.turnovers_per_game && team2Stats.turnovers_per_game
      ? (team1Stats.turnovers_per_game - team2Stats.turnovers_per_game).toFixed(1)
      : null;

    return {
      points_per_game: {
        your_team: team1Stats.points_per_game,
        opponent: team2Stats.points_per_game
      },
      points_allowed: {
        your_team: team1Stats.points_allowed,
        opponent: team2Stats.points_allowed
      },
      field_goal_percentage: {
        your_team: team1Stats.field_goal_percentage,
        opponent: team2Stats.field_goal_percentage
      },
      three_point_percentage: {
        your_team: team1Stats.three_point_percentage,
        opponent: team2Stats.three_point_percentage
      },
      rebound_margin: {
        your_team: parseFloat(reboundMargin1),
        opponent: parseFloat(reboundMargin2)
      },
      turnover_margin: {
        your_team: parseFloat(turnoverMargin1),
        opponent: parseFloat(turnoverMargin2)
      }
    };
  } else if (sport === 'NFL') {
    return {
      points_per_game: {
        your_team: team1Stats.points_per_game,
        opponent: team2Stats.points_per_game
      },
      points_allowed: {
        your_team: team1Stats.points_allowed,
        opponent: team2Stats.points_allowed
      },
      offensive_yards: {
        your_team: team1Stats.total_yards,
        opponent: team2Stats.total_yards
      },
      defensive_yards: {
        your_team: team1Stats.yards_allowed,
        opponent: team2Stats.yards_allowed
      },
      passing_yards: {
        your_team: team1Stats.passing_yards,
        opponent: team2Stats.passing_yards
      },
      rushing_yards: {
        your_team: team1Stats.rushing_yards,
        opponent: team2Stats.rushing_yards
      },
      turnover_diff: {
        your_team: team1Stats.turnover_differential,
        opponent: team2Stats.turnover_differential
      }
    };
  }

  return {};
}

/**
 * Main function to get team matchup statistics
 * @param {object} params - Request parameters
 * @param {string} params.sport - 'NBA' or 'NFL'
 * @param {string} params.team_1 - First team name
 * @param {string} params.team_2 - Second team name
 * @param {string} [params.season] - Season (optional, defaults to current)
 * @returns {Promise<object>} Formatted matchup statistics
 */
async function getTeamMatchupStats({ sport, team_1, team_2, season = 'current' }) {
  try {
    // Validate sport
    if (!['NBA', 'NFL'].includes(sport)) {
      throw new Error(`Invalid sport: ${sport}. Must be 'NBA' or 'NFL'`);
    }

    let useMockData = USE_MOCK_DATA;
    let team1, team2, team1Stats, team2Stats;

    // Try real ESPN API first (unless mock mode is forced)
    if (!useMockData) {
      try {
        // Find both teams
        [team1, team2] = await Promise.all([
          findTeamId(sport, team_1),
          findTeamId(sport, team_2)
        ]);

        if (!team1 || !team2) {
          throw new Error('Team not found in ESPN API');
        }

        // Fetch stats for both teams
        const fetchStats = sport === 'NBA' ? fetchNBATeamStats : fetchNFLTeamStats;
        [team1Stats, team2Stats] = await Promise.all([
          fetchStats(team1.id),
          fetchStats(team2.id)
        ]);

        if (!team1Stats || !team2Stats) {
          throw new Error('Failed to fetch team statistics');
        }
      } catch (apiError) {
        // If ESPN API fails (403, network error, etc.), fall back to mock data
        console.log('ESPN API unavailable, using mock data:', apiError.message);
        useMockData = true;
      }
    }

    // Use mock data if API failed or forced
    if (useMockData) {
      const findTeamFunc = sport === 'NBA' ? findMockNBATeam : findMockNFLTeam;

      const mockTeam1 = findTeamFunc(team_1);
      const mockTeam2 = findTeamFunc(team_2);

      if (!mockTeam1) {
        throw new Error(`Team not found: ${team_1}. Available sample teams: ${sport === 'NBA' ? 'Lakers, Celtics, Warriors, Heat, Bucks' : 'Chiefs, 49ers, Cowboys, Eagles, Ravens'}`);
      }

      if (!mockTeam2) {
        throw new Error(`Team not found: ${team_2}. Available sample teams: ${sport === 'NBA' ? 'Lakers, Celtics, Warriors, Heat, Bucks' : 'Chiefs, 49ers, Cowboys, Eagles, Ravens'}`);
      }

      team1 = {
        id: mockTeam1.id,
        name: mockTeam1.name,
        abbreviation: mockTeam1.abbreviation,
        logo: mockTeam1.logo
      };

      team2 = {
        id: mockTeam2.id,
        name: mockTeam2.name,
        abbreviation: mockTeam2.abbreviation,
        logo: mockTeam2.logo
      };

      team1Stats = mockTeam1.stats;
      team2Stats = mockTeam2.stats;
    }

    // Calculate matchup metrics
    const metrics = calculateMatchupMetrics(team1Stats, team2Stats, sport);

    return {
      sport: sport === 'NBA' ? 'Basketball' : 'Football',
      teams: [team1.name, team2.name],
      team_logos: [team1.logo, team2.logo],
      season: season,
      metrics: metrics,
      raw_stats: {
        team_1: team1Stats,
        team_2: team2Stats
      },
      data_source: useMockData ? 'mock' : 'espn_api',
      note: useMockData ? 'Using sample data - ESPN API currently unavailable' : null
    };
  } catch (error) {
    console.error('Error in getTeamMatchupStats:', error.message);
    throw error;
  }
}

module.exports = {
  getTeamMatchupStats,
  findTeamId,
  fetchNBATeamStats,
  fetchNFLTeamStats
};
