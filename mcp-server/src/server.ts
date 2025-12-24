/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Main MCP server for Kelly's Criterion Calculator
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

// Import tool registrations
import { registerKellyTool } from './tools/kelly.js';
import { registerFootballProbabilityTool } from './tools/probabilityFootball.js';
import { registerBasketballProbabilityTool } from './tools/probabilityBasketball.js';
import { registerUnifiedProbabilityTool } from './tools/probabilityUnified.js';
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
const DEBUG_MCP = process.env.DEBUG_MCP === '1' || process.env.DEBUG_MCP === 'true';

// Create Express app
const app = express();

// JSON body parser MUST come before MCP routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS middleware for ChatGPT and Render deployment
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://chatgpt.com'];
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
  } else {
    next();
  }
});

// Debug logging middleware for /mcp routes
app.use('/mcp', (req, res, next) => {
  if (DEBUG_MCP) {
    console.log('[MCP DEBUG] Request received:', {
      method: req.method,
      path: req.path,
      contentType: req.get('content-type'),
      sessionId: req.get('x-session-id'),
      bodyPreview: JSON.stringify(req.body || {}).substring(0, 2048)
    });
  }
  next();
});

// Create MCP server
const mcpServer = new McpServer({
  name: 'kelly-criterion-calculator',
  version: '2.0.0'
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
registerUnifiedProbabilityTool(mcpServer); // Primary probability tool - auto-detects sport
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
        'probability-estimate', // PRIMARY - auto-detects NBA/NFL from team names
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

// OpenAI domain verification endpoint
app.get('/.well-known/openai-apps-challenge', (req, res) => {
  res.type('text/plain');
  res.send('QphJXcnbOxYcoU7_XrjYgVss4BgeQfOUUWtz12ALEcc');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'kelly-criterion-calculator',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  });
});

// ==================== MCP PROTOCOL HANDLERS ====================

/**
 * Unified MCP endpoint using StreamableHTTPServerTransport
 * Handles both GET (SSE) and POST (JSON-RPC) requests
 * This is what OpenAI's scanner expects
 */
app.use('/mcp', async (req, res, next) => {
  try {
    // Create a new transport for each request with stateless mode
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode for OpenAI scanner compatibility
      enableJsonResponse: true // Enable JSON responses for POST requests
    });

    // Connect the transport to the MCP server
    await mcpServer.connect(transport);

    if (DEBUG_MCP) {
      console.log('[MCP DEBUG] Transport connected, handling request');
    }

    // Handle the request (GET, POST, or DELETE)
    await transport.handleRequest(req, res, req.body);

    if (DEBUG_MCP) {
      console.log('[MCP DEBUG] Request handled successfully');
    }
  } catch (error: any) {
    if (DEBUG_MCP) {
      console.error('[MCP DEBUG] Request handler error:', error);
    }

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

// Handle trailing slash for /mcp/
app.use('/mcp/', (req, res, next) => {
  req.url = req.url.replace(/^\/+/, '/');
  req.originalUrl = req.originalUrl.replace('/mcp/', '/mcp');
  next();
});

// Export the MCP server instance for testing
export { mcpServer };

// Export the app for testing
export default app;

// Start server only when not imported (i.e., when run directly)
if (import.meta.url === `file://${process.argv[1]}`) {
  app.listen(PORT, () => {
    console.log('========================================');
    console.log('Kelly Criterion MCP Server v2.0.0');
    console.log('========================================');
    console.log(`Port: ${PORT}`);
    console.log(`MCP Endpoint: http://localhost:${PORT}/mcp`);
    console.log(`Health Check: http://localhost:${PORT}/health`);
    console.log(`Debug Mode: ${DEBUG_MCP ? 'ENABLED' : 'DISABLED'}`);
    console.log('');
    console.log('Supported Methods:');
    console.log('  - GET /mcp  (SSE streaming)');
    console.log('  - POST /mcp (JSON-RPC over HTTP)');
    console.log('');
    console.log('Registered Tools:');
    console.log('  Core Calculations:');
    console.log('    - kelly-calculate');
    console.log('    - probability-estimate (PRIMARY - auto-detects sport)');
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
}
