# Backend API - Kelly's Criterion Calculator

This is the legacy backend API for the Kelly's Criterion betting calculator. It provides token-based calculation limits, user management, and payment integration.

**Note:** The current active implementation uses the MCP server (`mcp-server/`). This backend is preserved for reference and potential standalone deployment.

## Features

- User management with token-based system
- Free daily calculations (10 per day)
- Token purchase system (placeholder for Stripe integration)
- Ad-watch rewards
- Calculation history tracking
- Admin statistics dashboard
- Rate limiting and security middleware

## Prerequisites

- Node.js 18+ or higher
- MongoDB instance (local or cloud)
- Gemini API key (for AI insights)
- OpenAI API key (for AI-powered matchup analysis)
- Anthropic API key (optional - for Claude-based matchup analysis)

## Setup

1. Install dependencies:
```bash
cd backend
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Configure your `.env` file:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/betting-calculator
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ADMIN_KEY=your_secure_admin_key_here
FRONTEND_URL=http://localhost:5173
```

4. Start the server:
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

## API Endpoints

### Public Endpoints

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-29T12:00:00.000Z"
}
```

#### GET /api/user/status
Get user's current token balance and calculation limits.

**Headers:**
- `x-user-id` (optional): User identifier. Falls back to IP address.

**Response:**
```json
{
  "tokens": 5,
  "freeCalculationsRemaining": 8,
  "totalCalculations": 12,
  "isPremium": false,
  "dailyLimit": 10
}
```

#### POST /api/calculate
Perform a calculation (Kelly Criterion, Probability, or Unit betting).

**Headers:**
- `x-user-id` (optional): User identifier
- `Content-Type`: application/json

**Request Body:**
```json
{
  "prompt": "Calculate Kelly stake for...",
  "systemInstruction": "You are a betting analyst...",
  "calculationType": "kelly"
}
```

**Response:**
```json
{
  "text": "{ \"stake\": 50, \"percentage\": 5 }",
  "tokensUsed": 0,
  "isFree": true,
  "remainingTokens": 5,
  "freeRemaining": 9
}
```

#### POST /api/tokens/purchase
Purchase token packages.

**Request Body:**
```json
{
  "package": "starter",
  "paymentIntentId": "pi_xxx"
}
```

**Packages:**
- `starter`: 50 tokens for $4.99
- `premium`: 150 tokens for $12.99
- `pro`: 500 tokens for $39.99

**Response:**
```json
{
  "success": true,
  "newBalance": 55,
  "tokensAdded": 50
}
```

#### POST /api/tokens/watch-ad
Earn tokens by watching ads (max 5 per day).

**Request Body:**
```json
{
  "adId": "ad_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "tokensEarned": 2,
  "newBalance": 7,
  "adsRemaining": 4
}
```

#### GET /api/user/history
Get user's calculation history (last 50).

**Response:**
```json
{
  "calculations": [
    {
      "_id": "xxx",
      "calculationType": "kelly",
      "tokensUsed": 1,
      "isFree": false,
      "timestamp": "2025-10-29T12:00:00.000Z"
    }
  ]
}
```

#### POST /api/matchup
🆕 AI-powered sports matchup analysis using OpenAI or Claude.

**Headers:**
- `x-user-id` (optional): User identifier
- `Content-Type`: application/json

**Request Body:**
```json
{
  "sport": "NBA",
  "team1": "Los Angeles Lakers",
  "team2": "Boston Celtics",
  "season": "2024-2025",
  "provider": "openai"
}
```

**Parameters:**
- `sport` (required): Sport type (e.g., "NBA", "NFL", "NHL")
- `team1` (required): First team name
- `team2` (required): Second team name
- `season` (optional): Season identifier (defaults to "current")
- `provider` (optional): AI provider - "openai" or "claude" (defaults to "openai")

**Response:**
```json
{
  "success": true,
  "provider": "openai",
  "data": {
    "matchup": {
      "team1": "Los Angeles Lakers",
      "team2": "Boston Celtics",
      "sport": "NBA"
    },
    "team_records": {
      "Lakers": { "wins": 35, "losses": 20, "win_percentage": 0.636 },
      "Celtics": { "wins": 42, "losses": 13, "win_percentage": 0.764 }
    },
    "head_to_head": {
      "total_games": 15,
      "Lakers_wins": 6,
      "Celtics_wins": 9,
      "last_5_games": "L-W-L-W-L"
    },
    "recent_form": {
      "Lakers": { "last_10": "7-3", "streak": "W3" },
      "Celtics": { "last_10": "8-2", "streak": "W5" }
    },
    "key_stats": {
      "Lakers": { "ppg": 115.2, "opponent_ppg": 110.4 },
      "Celtics": { "ppg": 118.5, "opponent_ppg": 108.1 }
    },
    "kelly_criterion_insights": {
      "recommended_bet": "Celtics -5.5",
      "confidence": "moderate",
      "reasoning": "Strong recent form and home court advantage"
    }
  },
  "timestamp": "2025-11-02T12:00:00.000Z"
}
```

**Features:**
- Uses OpenAI GPT-4o or Claude 3.5 Sonnet for analysis
- Provides comprehensive team statistics and trends
- Includes head-to-head history
- Generates Kelly Criterion betting recommendations
- Structured JSON responses for easy frontend integration
- Fallback handling for non-JSON responses

**Error Responses:**
```json
{
  "error": "AI service configuration error",
  "message": "The AI service is not properly configured. Please contact support."
}
```

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests to the AI service. Please try again later."
}
```

**Notes:**
- This endpoint does NOT consume user tokens (no token cost)
- Uses direct AI provider APIs (OpenAI or Anthropic)
- Rate limits apply based on AI provider quotas
- Provider can be switched via the `provider` parameter
- Requires valid `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in environment

#### POST /get_team_matchup_stats
ESPN-based team matchup statistics (legacy endpoint).

**Request Body:**
```json
{
  "sport": "NBA",
  "team_1": "Lakers",
  "team_2": "Celtics",
  "season": "2024"
}
```

**Note:** This endpoint uses ESPN's public API for real-time sports data. Use `/api/matchup` for AI-powered analysis.

### Admin Endpoints

#### GET /api/admin/stats
Get platform statistics.

**Headers:**
- `x-admin-key`: Admin authentication key (from .env)

**Response:**
```json
{
  "totalUsers": 1250,
  "totalCalculations": 15420,
  "totalRevenue": 2499.50,
  "activeToday": 142
}
```

## Database Schema

### User
```javascript
{
  identifier: String,        // IP or user ID
  tokens: Number,            // Available tokens
  dailyCalculations: Number, // Free calculations used today
  lastResetDate: Date,       // Last daily reset
  totalCalculations: Number, // Lifetime calculations
  isPremium: Boolean,        // Premium subscriber flag
  createdAt: Date,
  lastActive: Date
}
```

### Calculation
```javascript
{
  userId: ObjectId,
  calculationType: String,   // 'kelly', 'probability', 'unit', 'ad'
  tokensUsed: Number,
  isFree: Boolean,
  timestamp: Date
}
```

### Transaction
```javascript
{
  userId: ObjectId,
  amount: Number,            // USD amount
  tokens: Number,            // Tokens purchased
  paymentId: String,         // Stripe payment ID
  status: String,            // 'pending', 'completed', 'failed'
  createdAt: Date
}
```

## Security Features

- Helmet.js for HTTP headers security
- CORS configuration
- Rate limiting (100 requests per 15 minutes)
- Request body size limits
- Input validation
- Admin endpoint authentication
- Error message sanitization

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3000 | Server port |
| NODE_ENV | No | development | Environment mode |
| MONGODB_URI | Yes | - | MongoDB connection string |
| GEMINI_API_KEY | No | - | Google Gemini API key (for AI insights) |
| OPENAI_API_KEY | Yes | - | OpenAI API key (for /api/matchup endpoint) |
| OPENAI_MODEL | No | gpt-4o | OpenAI model to use |
| ANTHROPIC_API_KEY | No | - | Anthropic API key (for Claude provider) |
| ANTHROPIC_MODEL | No | claude-3-5-sonnet-20241022 | Claude model to use |
| ADMIN_KEY | Yes | - | Admin endpoint authentication |
| FRONTEND_URL | No | * | CORS allowed origin |

## Development

### Run with nodemon
```bash
npm run dev
```

### Run tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Production Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Use strong `ADMIN_KEY`
3. Configure production MongoDB URI
4. Set specific `FRONTEND_URL` (not wildcard)
5. Enable MongoDB replica set for transactions

### Recommended Platforms
- **Render**: Easy deployment with automatic HTTPS
- **Fly.io**: Docker-based deployment
- **Railway**: Git-based deployment
- **Google Cloud Run**: Serverless option

### Health Checks
Configure your platform to use `/health` endpoint for health checks.

## Known Limitations

1. **Payment Integration**: Stripe integration is not implemented (placeholder exists)
2. **Ad System**: Ad watching is simulated, no real ad network integration
3. **User Auth**: Uses IP-based identification, not proper authentication
4. **Email System**: No email notifications or confirmations
5. **Testing**: No test coverage yet

## Future Improvements

- [ ] Implement Stripe payment integration
- [ ] Add proper user authentication (JWT/OAuth)
- [ ] Add email notification system
- [ ] Implement real ad network integration
- [ ] Add comprehensive test coverage
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Implement caching layer (Redis)
- [ ] Add monitoring and observability (Prometheus)

## License

Apache-2.0

## Support

For issues related to this backend, check the main project README or open an issue in the repository.
