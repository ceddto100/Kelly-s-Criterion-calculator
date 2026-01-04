# Kelly's Criterion Calculator - MCP Server

A Model Context Protocol (MCP) server implementation of Kelly's Criterion betting calculator with ChatGPT integration and embedded components.

## Overview

This project provides a conversational betting calculator that helps users:
- Calculate optimal bet sizing using the Kelly Criterion formula
- Estimate win/cover probabilities for football and basketball games
- Get AI-powered betting insights (optional)

## Architecture

```
User → ChatGPT → MCP Server → Tools & Components
```

The system consists of:
1. **MCP Server** (`mcp-server/`): Backend service exposing betting calculation tools
2. **Component Widgets** (`component/`): React widgets embedded in ChatGPT for displaying results
3. **Original Frontend** (`frontend/`): Legacy standalone web app (preserved for reference)

## Features

### Tools

1. **Kelly Criterion Calculator** (`kelly-calculate`)
   - Calculates optimal bet size based on win probability, odds, and bankroll
   - Supports full Kelly, half Kelly, and quarter Kelly strategies
   - Optional AI-powered analyst insights

2. **Football Probability Estimator** (`probability-estimate-football`)
   - Estimates cover probability for NFL/college football games
   - Uses team statistics (points, yards, turnovers)
   - Outputs probability that can be used with Kelly calculator

3. **Basketball Probability Estimator** (`probability-estimate-basketball`)
   - Estimates cover probability for NBA/college basketball games
   - Uses team statistics (points, FG%, rebounds, turnovers)
   - Outputs probability for Kelly calculator

### Components

Each tool has an associated widget component that renders results in ChatGPT:
- Kelly Calculator Widget
- Probability Estimator Widget

### NBA Games Page

A standalone page displaying today's NBA games with live scores:
- View at `/nba/games` (e.g., `http://localhost:5173/nba/games`)
- Shows all NBA matchups for the current day
- Auto-refreshes every 15 seconds
- Displays scores, game status, and tip-off times

## Quick Start

### Prerequisites

- Node.js 18+ or higher
- npm
- Git

### Installation

```bash
# Install MCP server dependencies
cd mcp-server
npm install

# Install component dependencies
cd ../component
npm install
```

### Building

```bash
# Build components
cd component
npm run build

# Build MCP server
cd ../mcp-server
npm run build
```

### Running Locally

```bash
# Start MCP server (development mode)
cd mcp-server
npm run dev

# The server will start on http://localhost:3000
# MCP endpoint: http://localhost:3000/mcp
# Health check: http://localhost:3000/health
```

### Configuration

Create a `.env` file in `mcp-server/`:

```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here  # Optional, for AI insights
NODE_ENV=development
ALLOWED_ORIGINS=https://chatgpt.com
```

### NBA Games Page Setup

To use the NBA Games page (`/nba/games`), you need an API-Sports Basketball API key:

1. **Get an API Key**:
   - Sign up at [API-Sports](https://www.api-football.com/)
   - Subscribe to the Basketball API
   - Copy your API key

2. **Configure the Backend**:
   Add your API key to the backend `.env` file:
   ```env
   APISPORTS_KEY=your_api_sports_key_here
   ```

3. **Run Both Servers**:
   ```bash
   # Terminal 1: Start the backend
   cd backend
   npm install
   npm run dev  # or: node server.js

   # Terminal 2: Start the frontend
   cd frontend
   npm install
   npm run dev
   ```

4. **View the Page**:
   Open `http://localhost:5173/nba/games` in your browser

## Testing

### Test with MCP Inspector

```bash
# Install MCP Inspector (globally)
npm install -g @modelcontextprotocol/inspector

# Start your MCP server
cd mcp-server
npm run dev

# In another terminal, connect inspector
mcp-inspector http://localhost:3000/mcp
```

### Sample Test Inputs

**Kelly Criterion:**
```json
{
  "bankroll": 1000,
  "odds": -110,
  "probability": 55,
  "fraction": "1"
}
```

**Football Probability:**
```json
{
  "teamPointsFor": 28,
  "teamPointsAgainst": 19,
  "opponentPointsFor": 21,
  "opponentPointsAgainst": 25,
  "teamOffYards": 380,
  "teamDefYards": 320,
  "opponentOffYards": 350,
  "opponentDefYards": 370,
  "teamTurnoverDiff": 3,
  "opponentTurnoverDiff": -2,
  "spread": -6.5
}
```

## ChatGPT Integration

### Using with ChatGPT

1. Go to ChatGPT settings → Developer Mode
2. Add new MCP connector:
   - **Name**: Kelly's Criterion Calculator
   - **URL**: `http://localhost:3000/mcp` (or your deployed URL)
   - **Authentication**: None (or configure as needed)
3. Save and refresh ChatGPT
4. Start using conversational prompts like:
   - "I have a $1000 bankroll and found a bet at -110 odds where I think I have a 55% chance to win. How much should I bet using Kelly Criterion?"
   - "The Chiefs average 28 points and allow 19, while the Broncos score 21 and allow 25. If the Chiefs are -6.5, what's my probability of covering?"

### Sample Prompts

```
Kelly Criterion:
- "Calculate my stake for a +150 underdog bet with $500 bankroll and 40% win probability using half Kelly."
- "I want to bet on a -200 favorite. My bankroll is $2000 and I'm 65% confident. What's the Kelly stake?"

Probability Estimation:
- "Estimate my cover probability for this NBA game: Lakers score 115/allow 108, Clippers score 112/allow 110, Lakers are -3.5"
```

## Project Structure

```
Kelly-s-Criterion-calculator/
├── mcp-server/              # MCP server implementation
│   ├── src/
│   │   ├── server.ts        # Main server entry point
│   │   ├── tools/           # Tool implementations
│   │   │   ├── kelly.ts
│   │   │   ├── probabilityFootball.ts
│   │   │   └── probabilityBasketball.ts
│   │   ├── utils/           # Utility functions
│   │   │   ├── calculations.ts
│   │   │   └── gemini.ts
│   │   └── components/      # Component resource registration
│   │       └── resources.ts
│   ├── package.json
│   └── tsconfig.json
├── component/               # ChatGPT widget components
│   ├── src/
│   │   ├── index.tsx        # Component entry point
│   │   ├── widgets/         # Individual widgets
│   │   │   ├── KellyWidget.tsx
│   │   │   └── ProbabilityWidget.tsx
│   │   └── styles/
│   │       └── widget.css
│   ├── build.js             # Build script
│   ├── dist/                # Built HTML components
│   ├── package.json
│   └── vite.config.ts
├── frontend/                # Original standalone app (reference)
└── backend/                 # Original backend (reference)
```

## Deployment

### Recommended Platforms

- **Fly.io**: Best for quick deployment with Docker
- **Render**: Easy deployment with automatic HTTPS
- **Google Cloud Run**: Serverless, scales to zero
- **Railway**: Simple deployment from Git

### Environment Variables (Production)

```env
PORT=3000
GEMINI_API_KEY=your_production_key
NODE_ENV=production
ALLOWED_ORIGINS=https://chatgpt.com
```

### Health Check

The server provides a health check endpoint:
- `GET /health` - Returns server status

## Development

### Making Changes

```bash
# Component changes
cd component
npm run dev      # Start dev server
npm run build    # Build for production

# MCP server changes
cd mcp-server
npm run dev      # Start with hot reload (tsx)
npm run build    # Compile TypeScript
```

### Adding New Tools

1. Create tool file in `mcp-server/src/tools/`
2. Implement using `server.tool()` API
3. Register in `mcp-server/src/server.ts`
4. Create corresponding widget in `component/src/widgets/`
5. Build components and server

## License

Apache-2.0

## Support

For issues or questions:
- Check the MCP SDK documentation: https://modelcontextprotocol.io/docs/sdk
- Review sample prompts in this README
- Ensure MCP server is running and accessible

## Credits

Built with:
- Model Context Protocol SDK
- React 18
- TypeScript
- Vite
- Express
- Zod for validation
