// mockESPNData.js - Mock ESPN data for demonstration and fallback
// This provides sample team statistics when ESPN API is unavailable

/**
 * Mock NBA team data
 */
const NBA_TEAMS = {
  'lakers': {
    id: '13',
    name: 'Los Angeles Lakers',
    abbreviation: 'LAL',
    logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
    stats: {
      points_per_game: 115.3,
      points_allowed: 112.8,
      field_goal_percentage: 48.2,
      rebounds_per_game: 45.6,
      assists_per_game: 26.3,
      turnovers_per_game: 14.2,
      three_point_percentage: 37.1,
      free_throw_percentage: 77.8
    }
  },
  'celtics': {
    id: '2',
    name: 'Boston Celtics',
    abbreviation: 'BOS',
    logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
    stats: {
      points_per_game: 118.5,
      points_allowed: 110.2,
      field_goal_percentage: 47.8,
      rebounds_per_game: 44.2,
      assists_per_game: 27.1,
      turnovers_per_game: 13.5,
      three_point_percentage: 38.4,
      free_throw_percentage: 81.2
    }
  },
  'warriors': {
    id: '9',
    name: 'Golden State Warriors',
    abbreviation: 'GSW',
    logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gs.png',
    stats: {
      points_per_game: 116.8,
      points_allowed: 113.5,
      field_goal_percentage: 46.9,
      rebounds_per_game: 43.8,
      assists_per_game: 28.2,
      turnovers_per_game: 14.8,
      three_point_percentage: 39.2,
      free_throw_percentage: 79.5
    }
  },
  'heat': {
    id: '14',
    name: 'Miami Heat',
    abbreviation: 'MIA',
    logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mia.png',
    stats: {
      points_per_game: 112.4,
      points_allowed: 109.8,
      field_goal_percentage: 46.2,
      rebounds_per_game: 44.5,
      assists_per_game: 25.7,
      turnovers_per_game: 13.2,
      three_point_percentage: 36.8,
      free_throw_percentage: 80.3
    }
  },
  'bucks': {
    id: '15',
    name: 'Milwaukee Bucks',
    abbreviation: 'MIL',
    logo: 'https://a.espncdn.com/i/teamlogos/nba/500/mil.png',
    stats: {
      points_per_game: 117.2,
      points_allowed: 111.5,
      field_goal_percentage: 48.5,
      rebounds_per_game: 46.3,
      assists_per_game: 26.8,
      turnovers_per_game: 13.9,
      three_point_percentage: 37.5,
      free_throw_percentage: 78.9
    }
  }
};

/**
 * Mock NFL team data
 */
const NFL_TEAMS = {
  'chiefs': {
    id: '12',
    name: 'Kansas City Chiefs',
    abbreviation: 'KC',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
    stats: {
      points_per_game: 27.8,
      points_allowed: 20.4,
      total_yards: 385.6,
      yards_allowed: 325.2,
      passing_yards: 268.4,
      rushing_yards: 117.2,
      turnover_differential: 8,
      third_down_conversion: 42.5
    }
  },
  '49ers': {
    id: '25',
    name: 'San Francisco 49ers',
    abbreviation: 'SF',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
    stats: {
      points_per_game: 25.3,
      points_allowed: 19.8,
      total_yards: 372.5,
      yards_allowed: 310.6,
      passing_yards: 245.8,
      rushing_yards: 126.7,
      turnover_differential: 6,
      third_down_conversion: 43.2
    }
  },
  'cowboys': {
    id: '6',
    name: 'Dallas Cowboys',
    abbreviation: 'DAL',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
    stats: {
      points_per_game: 26.5,
      points_allowed: 21.3,
      total_yards: 368.9,
      yards_allowed: 330.4,
      passing_yards: 255.2,
      rushing_yards: 113.7,
      turnover_differential: 4,
      third_down_conversion: 41.8
    }
  },
  'eagles': {
    id: '21',
    name: 'Philadelphia Eagles',
    abbreviation: 'PHI',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
    stats: {
      points_per_game: 24.8,
      points_allowed: 22.1,
      total_yards: 355.3,
      yards_allowed: 340.2,
      passing_yards: 235.6,
      rushing_yards: 119.7,
      turnover_differential: 2,
      third_down_conversion: 40.5
    }
  },
  'ravens': {
    id: '33',
    name: 'Baltimore Ravens',
    abbreviation: 'BAL',
    logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
    stats: {
      points_per_game: 28.2,
      points_allowed: 21.7,
      total_yards: 392.4,
      yards_allowed: 315.8,
      passing_yards: 258.6,
      rushing_yards: 133.8,
      turnover_differential: 7,
      third_down_conversion: 44.1
    }
  }
};

/**
 * Find mock NBA team by name
 */
function findMockNBATeam(teamName) {
  const search = teamName.toLowerCase().trim();

  for (const [key, team] of Object.entries(NBA_TEAMS)) {
    const name = team.name.toLowerCase();
    const abbr = team.abbreviation.toLowerCase();

    if (name.includes(search) || search.includes(name) ||
        abbr === search || key === search) {
      return team;
    }
  }

  return null;
}

/**
 * Find mock NFL team by name
 */
function findMockNFLTeam(teamName) {
  const search = teamName.toLowerCase().trim();

  for (const [key, team] of Object.entries(NFL_TEAMS)) {
    const name = team.name.toLowerCase();
    const abbr = team.abbreviation.toLowerCase();

    if (name.includes(search) || search.includes(name) ||
        abbr === search || key === search) {
      return team;
    }
  }

  return null;
}

module.exports = {
  NBA_TEAMS,
  NFL_TEAMS,
  findMockNBATeam,
  findMockNFLTeam
};
