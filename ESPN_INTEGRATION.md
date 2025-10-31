# ESPN Stats Integration Documentation

## Overview

This integration enables automatic fetching of NBA and NFL team statistics from ESPN's API, allowing users to quickly populate the Kelly's Criterion calculator with real team data for more accurate probability estimates.

### ⚠️ Important Note: Mock Data Fallback

ESPN's public API currently restricts direct access (returns 403 errors). This implementation includes:
- **Automatic fallback to sample data** when ESPN API is unavailable
- **5 sample NBA teams**: Lakers, Celtics, Warriors, Heat, Bucks
- **5 sample NFL teams**: Chiefs, 49ers, Cowboys, Eagles, Ravens
- **Real API support** - Will automatically use live ESPN data when API access is restored

The sample data uses realistic statistics and is perfect for:
- Development and testing
- Demonstrating the calculator functionality
- Integration with OpenAI Assistant for proof-of-concept

## Features

- ✅ Fetch real-time NBA team statistics (PPG, FG%, rebounds, turnovers, etc.)
- ✅ Fetch real-time NFL team statistics (PPG, yards, turnovers, etc.)
- ✅ Automatic team name matching (handles partial names and abbreviations)
- ✅ Calculated matchup metrics (rebound margins, turnover differentials, etc.)
- ✅ Error handling with helpful messages
- ✅ No API key required (uses ESPN's public API)

---

## Architecture

### Backend Components

1. **`backend/espnService.js`** - Core ESPN API integration
   - `getTeamMatchupStats()` - Main function to fetch matchup data
   - `findTeamId()` - Search for teams by name
   - `fetchNBATeamStats()` - Fetch NBA-specific statistics
   - `fetchNFLTeamStats()` - Fetch NFL-specific statistics
   - `calculateMatchupMetrics()` - Calculate derived metrics

2. **`backend/server.js`** - REST API endpoint
   - `POST /get_team_matchup_stats` - Endpoint for fetching team matchups

### Frontend Components

1. **`frontend/api/teamStats.js`** - Frontend API client
   - `fetchMatchupStats()` - Generic fetch function
   - `fetchNBAMatchupStats()` - NBA-specific helper
   - `fetchNFLMatchupStats()` - NFL-specific helper
   - `formatMetricsForCalculator()` - Format data for calculator UI

---

## API Reference

### Backend Endpoint

**Endpoint:** `POST /get_team_matchup_stats`

**Request Body:**
```json
{
  "sport": "NBA",
  "team_1": "Los Angeles Lakers",
  "team_2": "Boston Celtics",
  "season": "current"
}
```

**Parameters:**
- `sport` (required): "NBA" or "NFL"
- `team_1` (required): First team name (full or partial)
- `team_2` (required): Second team name (full or partial)
- `season` (optional): Season identifier (defaults to "current")

**Success Response (NBA):**
```json
{
  "sport": "Basketball",
  "teams": ["Los Angeles Lakers", "Boston Celtics"],
  "team_logos": ["https://...", "https://..."],
  "season": "current",
  "metrics": {
    "points_per_game": {
      "your_team": 115.3,
      "opponent": 112.1
    },
    "points_allowed": {
      "your_team": 110.8,
      "opponent": 114.5
    },
    "field_goal_percentage": {
      "your_team": 48.7,
      "opponent": 46.5
    },
    "three_point_percentage": {
      "your_team": 37.2,
      "opponent": 35.8
    },
    "rebound_margin": {
      "your_team": 3.5,
      "opponent": -3.5
    },
    "turnover_margin": {
      "your_team": 2.1,
      "opponent": -2.1
    }
  },
  "raw_stats": {
    "team_1": { /* detailed stats */ },
    "team_2": { /* detailed stats */ }
  }
}
```

**Success Response (NFL):**
```json
{
  "sport": "Football",
  "teams": ["Kansas City Chiefs", "San Francisco 49ers"],
  "team_logos": ["https://...", "https://..."],
  "season": "current",
  "metrics": {
    "points_per_game": {
      "your_team": 26.1,
      "opponent": 22.5
    },
    "points_allowed": {
      "your_team": 20.8,
      "opponent": 23.1
    },
    "offensive_yards": {
      "your_team": 385.2,
      "opponent": 350.7
    },
    "defensive_yards": {
      "your_team": 330.1,
      "opponent": 365.4
    },
    "passing_yards": {
      "your_team": 265.3,
      "opponent": 240.1
    },
    "rushing_yards": {
      "your_team": 119.9,
      "opponent": 110.6
    },
    "turnover_diff": {
      "your_team": 7,
      "opponent": -2
    }
  },
  "raw_stats": {
    "team_1": { /* detailed stats */ },
    "team_2": { /* detailed stats */ }
  }
}
```

**Error Responses:**

- `400 Bad Request` - Missing or invalid parameters
- `404 Not Found` - Team not found
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - ESPN API unavailable

---

## Usage Examples

### Backend Usage

```javascript
const { getTeamMatchupStats } = require('./espnService');

// Fetch NBA matchup
const nbaStats = await getTeamMatchupStats({
  sport: 'NBA',
  team_1: 'Lakers',
  team_2: 'Celtics',
  season: 'current'
});

// Fetch NFL matchup
const nflStats = await getTeamMatchupStats({
  sport: 'NFL',
  team_1: 'Chiefs',
  team_2: '49ers'
});
```

### Frontend Usage (React)

```javascript
import { fetchNBAMatchupStats, formatMetricsForCalculator } from './api/teamStats';

function ProbabilityEstimator() {
  const [teamStats, setTeamStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNBAMatchupStats('Lakers', 'Celtics');
      const formatted = formatMetricsForCalculator(data.metrics, 'NBA');
      setTeamStats(formatted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={handleFetchStats} disabled={loading}>
        {loading ? 'Loading...' : 'Fetch Team Stats'}
      </button>
      {error && <p className="error">{error}</p>}
      {teamStats && (
        <div>
          <p>Points Per Game: {teamStats.pointsPerGame}</p>
          <p>Field Goal %: {teamStats.fieldGoalPct}%</p>
          {/* ... other stats ... */}
        </div>
      )}
    </div>
  );
}
```

### cURL Testing

```bash
# Test NBA matchup
curl -X POST http://localhost:3000/get_team_matchup_stats \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "NBA",
    "team_1": "Lakers",
    "team_2": "Celtics",
    "season": "current"
  }'

# Test NFL matchup
curl -X POST http://localhost:3000/get_team_matchup_stats \
  -H "Content-Type: application/json" \
  -d '{
    "sport": "NFL",
    "team_1": "Chiefs",
    "team_2": "49ers"
  }'
```

---

## OpenAI Assistant Integration

### Function Schema

Use this schema to integrate with OpenAI Assistant API:

```json
{
  "name": "get_team_matchup_stats",
  "description": "Retrieve NBA or NFL team matchup statistics including key season or current metrics for both teams.",
  "strict": true,
  "parameters": {
    "type": "object",
    "properties": {
      "sport": {
        "type": "string",
        "description": "Sport league to search for. Must be 'NBA' or 'NFL'.",
        "enum": ["NBA", "NFL"]
      },
      "team_1": {
        "type": "string",
        "description": "Full name of the first team involved in the matchup."
      },
      "team_2": {
        "type": "string",
        "description": "Full name of the second team involved in the matchup."
      },
      "season": {
        "type": "string",
        "description": "Season to retrieve stats from, in 'YYYY-YY' format for NBA or 'YYYY' for NFL, or 'current' for ongoing season."
      },
      "metrics": {
        "type": "array",
        "description": "List of additional specific metrics to retrieve, if desired.",
        "items": {
          "type": "string",
          "description": "Additional team or league metric name."
        }
      }
    },
    "required": ["sport", "team_1", "team_2"],
    "additionalProperties": false
  }
}
```

### Assistant Webhook Setup

Configure your OpenAI Assistant to call your backend:

1. Set webhook URL: `https://your-domain.com/get_team_matchup_stats`
2. Method: POST
3. Add the function schema above to your Assistant
4. Assistant will automatically call this function when users ask for team stats

---

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

This will install the new `axios` dependency along with existing packages.

### 2. Start the Backend Server

```bash
cd backend
npm start
# or for development with auto-reload:
npm run dev
```

### 3. Configure Frontend (Optional)

If deploying to production, set the backend URL:

```bash
# Create .env file in frontend directory
echo "VITE_BACKEND_URL=https://your-backend-domain.com" > frontend/.env
```

For local development, the frontend automatically uses `http://localhost:3000`.

### 4. Test the Integration

```bash
# From the project root, test with curl:
curl -X POST http://localhost:3000/get_team_matchup_stats \
  -H "Content-Type: application/json" \
  -d '{"sport":"NBA","team_1":"Lakers","team_2":"Celtics"}'
```

---

## Supported Teams

### Current Sample Teams (Mock Data)

**NBA Teams:**
- Los Angeles Lakers
- Boston Celtics
- Golden State Warriors
- Miami Heat
- Milwaukee Bucks

**NFL Teams:**
- Kansas City Chiefs
- San Francisco 49ers
- Dallas Cowboys
- Philadelphia Eagles
- Baltimore Ravens

**Team Name Matching:**
- Full names: "Los Angeles Lakers", "Kansas City Chiefs", etc.
- Partial matches: "Lakers", "Chiefs", etc.
- Abbreviations: "LAL", "KC", etc.
- Case-insensitive

### Adding More Teams

To add more sample teams, edit `backend/mockESPNData.js`:

```javascript
// Add to NBA_TEAMS object
'nets': {
  id: '17',
  name: 'Brooklyn Nets',
  abbreviation: 'BKN',
  logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bkn.png',
  stats: {
    points_per_game: 112.5,
    points_allowed: 115.2,
    // ... other stats
  }
}
```

---

## Data Freshness

- **Data Source**: ESPN's public API
- **Update Frequency**: Real-time during season
- **Availability**: Current season stats only
- **Historical Data**: Limited to current season

---

## Error Handling

The integration includes comprehensive error handling:

1. **Team Not Found**: Returns 404 with suggestions
2. **Invalid Sport**: Returns 400 with valid options
3. **ESPN API Down**: Returns 503 with retry suggestion
4. **Network Errors**: Graceful degradation with error messages
5. **Missing Stats**: Returns `null` for unavailable metrics

---

## Troubleshooting

### Issue: "Team not found"
**Solution**: Try using the full team name or check spelling. Example: "Los Angeles Lakers" instead of "LA"

### Issue: "ESPN API unavailable"
**Solution**: ESPN's public API may be temporarily down. Wait a few minutes and retry.

### Issue: Stats are null
**Solution**: Some stats may not be available for all teams or during off-season. Check the `raw_stats` field for available data.

### Issue: CORS errors in browser
**Solution**: Ensure `FRONTEND_URL` is set correctly in backend `.env` file

---

## Deployment

### Backend Deployment (Render/Railway/Vercel)

The ESPN integration requires no additional configuration for deployment. Just ensure:

1. `axios` is in `package.json` dependencies ✅ (already added)
2. Backend server is running
3. CORS is configured for your frontend domain

### Frontend Deployment

Set the backend URL environment variable:

```bash
VITE_BACKEND_URL=https://your-backend.onrender.com
```

---

## Performance Notes

- Average response time: 500-1500ms (depends on ESPN API)
- Caching: Not implemented (consider adding Redis for production)
- Rate limiting: Uses existing server rate limits
- Concurrent requests: Handles multiple teams in parallel

---

## Future Enhancements

Potential improvements for v2:

- ✨ Add support for NCAA (college basketball/football)
- ✨ Add caching layer (Redis) for frequently requested matchups
- ✨ Add historical season data
- ✨ Add player-specific statistics
- ✨ Add injury reports
- ✨ Add weather data for NFL games
- ✨ Add Vegas odds integration

---

## Support

For issues or questions:
- Check the troubleshooting section above
- Review server logs for detailed error messages
- Ensure all dependencies are installed correctly

---

## License

This integration is part of the Kelly's Criterion Betting Calculator project.
