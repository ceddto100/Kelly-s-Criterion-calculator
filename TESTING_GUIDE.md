# Testing the Updated NBA Stats

## Problem
The matchup tab is not showing the updated numbers from the CSV files.

## Solution

### If Testing Locally:

1. **Stop your backend server** (Ctrl+C if it's running)

2. **Restart the backend server:**
   ```bash
   cd backend
   npm start
   # or
   node server.js
   ```

3. **Clear your browser cache:**
   - Chrome/Edge: Ctrl+Shift+Delete → Clear cached images and files
   - Or use incognito/private mode

4. **Test the API directly:**
   ```bash
   # Test with curl (should show updated stats)
   curl "http://localhost:3001/api/matchup?teamA=Lakers&teamB=Warriors"

   # Or open in browser:
   http://localhost:3001/api/matchup?teamA=Lakers&teamB=Warriors
   ```

5. **Expected output for Lakers:**
   ```json
   {
     "team": "Los Angeles Lakers",
     "points_per_game": 117.8,
     "points_allowed": 112.9,
     "field_goal_pct": 48.2,
     "rebound_margin": -0.9,
     "turnover_margin": -1.0
   }
   ```

### If Using Deployed Version (Render/etc):

1. **Push your changes:**
   ```bash
   git push origin your-branch-name
   ```

2. **Merge to main branch** (if needed)

3. **Trigger a redeploy** on your hosting platform

4. **Wait for deployment to complete**

5. **Clear browser cache** and test again

## Debugging Steps

### Check CSV Files Locally:
```bash
# View first few lines of each CSV
head -5 stats/ppg.csv
head -5 stats/allowed.csv
head -5 stats/fieldgoal.csv
```

### Test CSV Loading:
```bash
# Run the test script
node test-csv-load.js
```

### Check Backend Logs:
When you make a request to `/api/analyze?teamA=Lakers&teamB=Warriors`, you should see:
```
📊 Strategy 1: Trying CSV files...
✅ Loaded 30 rows from ppg.csv
✅ Loaded 30 rows from allowed.csv
✅ Loaded 30 rows from fieldgoal.csv
✅ Loaded 30 rows from rebound_margin.csv
✅ Loaded 30 rows from turnover_margin.csv
✅ Successfully loaded data from CSV files
```

## Current Stats (2025-26 Season)

Sample teams with current stats:
- **Lakers**: 117.8 PPG, 112.9 allowed, 48.2% FG
- **Celtics**: 119.7 PPG, 111.9 allowed, 49.0% FG
- **Warriors**: 112.6 PPG, 111.8 allowed, 47.9% FG
- **Heat**: 109.4 PPG, 116.9 allowed, 44.6% FG

These are the values your CSV files should contain.
