// backend/scrapers/nbaStatsApi.js
const axios = require('axios');

async function fetchNBATeamStats() {
  console.log('📊 Fetching NBA teams from ESPN API...');

  const response = await axios.get(
    'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
    {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    }
  );

  const teams = response.data.sports[0].leagues[0].teams;

  const teamStats = await Promise.all(
    teams.map(async ({ team }) => {
      try {
        const statsResponse = await axios.get(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/statistics`,
          { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }
        );

        const stats = statsResponse.data.stats?.splits?.categories || [];
        const offensive = stats.find(cat => cat.name === 'offensive')?.stats || [];
        const defensive = stats.find(cat => cat.name === 'defensive')?.stats || [];

        return {
          id: team.id,
          name: team.displayName,
          abbreviation: team.abbreviation,
          stats: {
            pointsPerGame: parseFloat(offensive.find(s => s.name === 'avgPointsPerGame')?.value || 0),
            pointsAllowed: parseFloat(defensive.find(s => s.name === 'avgPointsAgainst')?.value || 0),
            fieldGoalPct: parseFloat(offensive.find(s => s.name === 'fieldGoalPct')?.value || 0),
            reboundsPerGame: parseFloat(offensive.find(s => s.name === 'avgReboundsPerGame')?.value || 0),
            turnoversPerGame: parseFloat(offensive.find(s => s.name === 'avgTurnoversPerGame')?.value || 0)
          }
        };
      } catch (error) {
        console.error(`Failed to fetch stats for ${team.displayName}`);
        return null;
      }
    })
  );

  return teamStats.filter(team => team !== null);
}

function findTeamByName(teamStats, searchName) {
  const search = searchName.toLowerCase();
  return teamStats.find(team =>
    team.name.toLowerCase().includes(search) ||
    team.abbreviation.toLowerCase().includes(search)
  );
}

module.exports = { fetchNBATeamStats, findTeamByName };
