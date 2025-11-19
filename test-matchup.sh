#!/bin/bash
# Test script for NBA matchup functionality

echo "🏀 Testing NBA Matchup Functionality"
echo "===================================="
echo ""

# Test 1: CSV Loading
echo "Test 1: Checking CSV files..."
if [ -d "stats" ]; then
    echo "✅ stats/ folder exists"
    ls -la stats/*.csv 2>/dev/null || echo "❌ No CSV files found"
else
    echo "❌ stats/ folder not found"
fi
echo ""

# Test 2: Backend dependencies
echo "Test 2: Checking backend dependencies..."
cd backend
if [ -d "node_modules" ]; then
    echo "✅ node_modules exists"
else
    echo "⚠️  Running npm install..."
    npm install
fi
echo ""

# Test 3: Check if CSV files can be loaded
echo "Test 3: Testing CSV loading..."
node -e "
const { loadCSV, findTeam } = require('./utils/loadCSV');

(async () => {
  try {
    const ppgData = await loadCSV('ppg.csv');
    console.log('✅ Loaded', ppgData.length, 'teams from CSV');

    const lakers = findTeam(ppgData, 'Lakers');
    const celtics = findTeam(ppgData, 'Celtics');

    if (lakers) console.log('✅ Found Lakers:', lakers.team);
    else console.log('❌ Lakers not found');

    if (celtics) console.log('✅ Found Celtics:', celtics.team);
    else console.log('❌ Celtics not found');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
"
echo ""

echo "===================================="
echo "✅ Test complete!"
echo ""
echo "If all tests passed, your matchup feature should work."
echo "To deploy to Render:"
echo "  1. Merge this branch to main (or configure Render to deploy from this branch)"
echo "  2. Make sure Render 'Root Directory' is set to 'backend'"
echo "  3. Redeploy on Render"
