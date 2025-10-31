// test-espn.js - Test script for ESPN integration
const { getTeamMatchupStats } = require('./espnService');

async function testESPNIntegration() {
  console.log('🏀 Testing ESPN Integration...\n');

  // Test 1: NBA Matchup
  console.log('Test 1: Fetching NBA matchup (Lakers vs Celtics)');
  try {
    const nbaStats = await getTeamMatchupStats({
      sport: 'NBA',
      team_1: 'Lakers',
      team_2: 'Celtics',
      season: 'current'
    });
    console.log('✅ NBA Test Passed!');
    console.log('Teams:', nbaStats.teams);
    console.log('Sample Metrics:', {
      ppg: nbaStats.metrics.points_per_game,
      fg_pct: nbaStats.metrics.field_goal_percentage
    });
    console.log('');
  } catch (error) {
    console.error('❌ NBA Test Failed:', error.message);
    console.log('');
  }

  // Test 2: NFL Matchup
  console.log('Test 2: Fetching NFL matchup (Chiefs vs 49ers)');
  try {
    const nflStats = await getTeamMatchupStats({
      sport: 'NFL',
      team_1: 'Chiefs',
      team_2: '49ers',
      season: 'current'
    });
    console.log('✅ NFL Test Passed!');
    console.log('Teams:', nflStats.teams);
    console.log('Sample Metrics:', {
      ppg: nflStats.metrics.points_per_game,
      offensive_yards: nflStats.metrics.offensive_yards
    });
    console.log('');
  } catch (error) {
    console.error('❌ NFL Test Failed:', error.message);
    console.log('');
  }

  // Test 3: Team not found
  console.log('Test 3: Testing error handling (Invalid team)');
  try {
    await getTeamMatchupStats({
      sport: 'NBA',
      team_1: 'InvalidTeam123',
      team_2: 'Lakers'
    });
    console.log('❌ Error handling test failed (should have thrown error)');
  } catch (error) {
    console.log('✅ Error handling works correctly:', error.message);
  }

  console.log('\n🎉 All tests completed!');
}

// Run tests
testESPNIntegration().catch(console.error);
