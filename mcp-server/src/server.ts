/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main MCP server for Kelly's Criterion Calculator
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import dotenv from 'dotenv';

// Import tool registrations
import { registerKellyTool } from './tools/kelly.js';
import { registerFootballProbabilityTool } from './tools/probabilityFootball.js';
import { registerBasketballProbabilityTool } from './tools/probabilityBasketball.js';
import { registerTeamStatsTool, registerMatchupTool } from './tools/teamStats.js';
import { registerAnalyzeMatchupTool } from './tools/analyzeMatchup.js';
import { registerBetLoggerTool } from './tools/betLogger.js';
import { registerBankrollTools } from './tools/bankroll.js';

// Import component resources
import { registerComponentResources } from './components/resources.js';

// Import localization utilities
import { negotiateLocale } from './utils/translations.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

// Create Express app
const app = express();
app.use(express.json());

// CORS middleware for ChatGPT and Render deployment
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://chatgpt.com'];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
  } else {
    next();
  }
});

// Create MCP server
const mcpServer = new McpServer({
  name: 'kelly-criterion-calculator',
  version: '1.0.0'
});

// Store current locale (default to English)
// This can be updated per-request in each tool
let currentLocale = 'en';

// Export locale accessor for tools
export function getCurrentLocale(): string {
  return currentLocale;
}

// Export locale setter for tools (if they want to update global locale)
export function setCurrentLocale(locale: string): void {
  currentLocale = negotiateLocale(locale);
}

// Register all component resources
registerComponentResources(mcpServer);

// Register all tools
// Core calculation tools
registerKellyTool(mcpServer);
registerFootballProbabilityTool(mcpServer);
registerBasketballProbabilityTool(mcpServer);

// Team stats and matchup tools
registerTeamStatsTool(mcpServer);
registerMatchupTool(mcpServer);
registerAnalyzeMatchupTool(mcpServer);

// Bet logging and bankroll management
registerBetLoggerTool(mcpServer);
registerBankrollTools(mcpServer);

// Root discovery endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Kelly Criterion MCP Server',
    version: '2.0.0',
    description: 'Full-featured MCP server for sports betting calculations, team stats, and bet management.',
    mcp_endpoint: '/mcp',
    capabilities: {
      tools: [
        // Core calculations
        'kelly-calculate',
        'probability-estimate-football',
        'probability-estimate-basketball',
        // Team stats and matchups
        'get-team-stats',
        'get-matchup-stats',
        'analyze-matchup',
        // Bet management
        'log-bet',
        'get-bet-history',
        'update-bet-outcome',
        // Bankroll management
        'get-bankroll',
        'set-bankroll',
        'adjust-bankroll',
        'get-bankroll-history'
      ],
      supports_streaming: true
    }
  });
});

// OpenID configuration endpoint
app.get('/.well-known/openid-configuration', (req, res) => {
  const baseUrl = `https://${req.get('host')}`; // Auto-detects ngrok URL

  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/auth`,
    token_endpoint: `${baseUrl}/token`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256']
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'kelly-criterion-calculator',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// MCP endpoint using SSE transport
app.get('/mcp', async (req, res) => {
  console.log('New MCP connection established');

  const transport = new SSEServerTransport('/mcp', res);
  await mcpServer.connect(transport);

  // Log when connection closes
  req.on('close', () => {
    console.log('MCP connection closed');
  });
});

// POST endpoint for MCP messages (handled via transport)
app.post('/mcp/message', (req, res) => {
  console.log('MCP POST message received');
  res.status(405).json({ error: 'Use GET /mcp with SSE for MCP protocol' });
});

// Start server
app.listen(PORT, () => {
  console.log('========================================');
  console.log('Kelly Criterion MCP Server v2.0.0');
  console.log('========================================');
  console.log(`Port: ${PORT}`);
  console.log(`MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('Registered Tools:');
  console.log('  Core Calculations:');
  console.log('    - kelly-calculate');
  console.log('    - probability-estimate-football');
  console.log('    - probability-estimate-basketball');
  console.log('  Team Stats & Matchups:');
  console.log('    - get-team-stats');
  console.log('    - get-matchup-stats');
  console.log('    - analyze-matchup');
  console.log('  Bet Management:');
  console.log('    - log-bet');
  console.log('    - get-bet-history');
  console.log('    - update-bet-outcome');
  console.log('  Bankroll Management:');
  console.log('    - get-bankroll');
  console.log('    - set-bankroll');
  console.log('    - adjust-bankroll');
  console.log('    - get-bankroll-history');
  console.log('');
  console.log('Registered Resources:');
  console.log('  - kelly-calculator.html');
  console.log('  - probability-estimator.html');
  console.log('========================================');
});
