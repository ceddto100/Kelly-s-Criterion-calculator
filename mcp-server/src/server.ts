/**
 * Betgistics MCP Server
 * Complete MCP server for sports betting calculations and management
 *
 * This server provides MCP tools that mirror all frontend functionality:
 * - Kelly Criterion bet sizing
 * - AI-powered probability estimation (Gemini)
 * - Statistical probability calculations (Walters Protocol)
 * - Bet logging and history
 * - User authentication and bankroll management
 * - Odds format conversions
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

// Database connection
import { connectToDatabase, isDatabaseConnected } from './config/database.js';

// Initialize Gemini (if configured)
import { isGeminiConfigured, initializeGemini } from './config/gemini.js';

// Tool handlers
import { kellyToolDefinition, handleKellyCalculation } from './tools/kelly.js';
import {
  footballProbabilityToolDefinition,
  basketballProbabilityToolDefinition,
  handleFootballProbability,
  handleBasketballProbability
} from './tools/probability.js';
import {
  aiProbabilityToolDefinition,
  matchupAnalysisToolDefinition,
  handleAIProbability,
  handleMatchupAnalysis
} from './tools/aiProbability.js';
import { logBetToolDefinition, handleLogBet } from './tools/betLogging.js';
import {
  getBetHistoryToolDefinition,
  getBetByIdToolDefinition,
  getPendingBetsToolDefinition,
  handleGetBetHistory,
  handleGetBetById,
  handleGetPendingBets
} from './tools/betHistory.js';
import { updateBetOutcomeToolDefinition, handleUpdateBetOutcome } from './tools/betOutcome.js';
import {
  checkAuthToolDefinition,
  getUserProfileToolDefinition,
  registerUserToolDefinition,
  handleCheckAuth,
  handleGetUserProfile,
  handleRegisterUser
} from './tools/auth.js';
import { getUserStatsToolDefinition, handleGetUserStats } from './tools/userStats.js';
import {
  convertOddsToolDefinition,
  calculateVigToolDefinition,
  impliedProbabilityToolDefinition,
  handleConvertOdds,
  handleCalculateVig,
  handleImpliedProbability
} from './tools/oddsConversion.js';
import {
  getBankrollToolDefinition,
  setBankrollToolDefinition,
  adjustBankrollToolDefinition,
  handleGetBankroll,
  handleSetBankroll,
  handleAdjustBankroll
} from './tools/bankroll.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = parseInt(process.env.PORT || '3000', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://chatgpt.com').split(',');
const DEBUG = process.env.DEBUG_MCP === '1';

function log(...args: unknown[]) {
  if (DEBUG) {
    console.log('[MCP]', new Date().toISOString(), ...args);
  }
}

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================

const app = express();

// CORS middleware for ChatGPT and other clients
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
});

app.use(express.json());

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: '3.0.0',
    database: isDatabaseConnected() ? 'connected' : 'disconnected',
    gemini: isGeminiConfigured() ? 'configured' : 'not configured',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// MCP SERVER SETUP
// ============================================================================

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'betgistics-mcp-server',
    version: '3.0.0'
  });

  // ===========================================================================
  // KELLY CRITERION TOOL
  // ===========================================================================

  server.tool(
    kellyToolDefinition.name,
    kellyToolDefinition.description,
    kellyToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', kellyToolDefinition.name, params);
      try {
        const result = await handleKellyCalculation(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // PROBABILITY ESTIMATION TOOLS
  // ===========================================================================

  server.tool(
    footballProbabilityToolDefinition.name,
    footballProbabilityToolDefinition.description,
    footballProbabilityToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', footballProbabilityToolDefinition.name, params);
      try {
        const result = await handleFootballProbability(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    basketballProbabilityToolDefinition.name,
    basketballProbabilityToolDefinition.description,
    basketballProbabilityToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', basketballProbabilityToolDefinition.name, params);
      try {
        const result = await handleBasketballProbability(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // AI PROBABILITY TOOLS
  // ===========================================================================

  server.tool(
    aiProbabilityToolDefinition.name,
    aiProbabilityToolDefinition.description,
    aiProbabilityToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', aiProbabilityToolDefinition.name, params);
      try {
        const result = await handleAIProbability(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    matchupAnalysisToolDefinition.name,
    matchupAnalysisToolDefinition.description,
    matchupAnalysisToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', matchupAnalysisToolDefinition.name, params);
      try {
        const result = await handleMatchupAnalysis(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // BET LOGGING TOOLS
  // ===========================================================================

  server.tool(
    logBetToolDefinition.name,
    logBetToolDefinition.description,
    logBetToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', logBetToolDefinition.name, params);
      try {
        const result = await handleLogBet(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // BET HISTORY TOOLS
  // ===========================================================================

  server.tool(
    getBetHistoryToolDefinition.name,
    getBetHistoryToolDefinition.description,
    getBetHistoryToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', getBetHistoryToolDefinition.name, params);
      try {
        const result = await handleGetBetHistory(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    getBetByIdToolDefinition.name,
    getBetByIdToolDefinition.description,
    getBetByIdToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', getBetByIdToolDefinition.name, params);
      try {
        const result = await handleGetBetById(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    getPendingBetsToolDefinition.name,
    getPendingBetsToolDefinition.description,
    getPendingBetsToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', getPendingBetsToolDefinition.name, params);
      try {
        const result = await handleGetPendingBets(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // BET OUTCOME TOOL
  // ===========================================================================

  server.tool(
    updateBetOutcomeToolDefinition.name,
    updateBetOutcomeToolDefinition.description,
    updateBetOutcomeToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', updateBetOutcomeToolDefinition.name, params);
      try {
        const result = await handleUpdateBetOutcome(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // AUTH TOOLS
  // ===========================================================================

  server.tool(
    checkAuthToolDefinition.name,
    checkAuthToolDefinition.description,
    checkAuthToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', checkAuthToolDefinition.name, params);
      try {
        const result = await handleCheckAuth(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    getUserProfileToolDefinition.name,
    getUserProfileToolDefinition.description,
    getUserProfileToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', getUserProfileToolDefinition.name, params);
      try {
        const result = await handleGetUserProfile(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    registerUserToolDefinition.name,
    registerUserToolDefinition.description,
    registerUserToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', registerUserToolDefinition.name, params);
      try {
        const result = await handleRegisterUser(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // USER STATS TOOL
  // ===========================================================================

  server.tool(
    getUserStatsToolDefinition.name,
    getUserStatsToolDefinition.description,
    getUserStatsToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', getUserStatsToolDefinition.name, params);
      try {
        const result = await handleGetUserStats(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // ODDS CONVERSION TOOLS
  // ===========================================================================

  server.tool(
    convertOddsToolDefinition.name,
    convertOddsToolDefinition.description,
    convertOddsToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', convertOddsToolDefinition.name, params);
      try {
        const result = await handleConvertOdds(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    calculateVigToolDefinition.name,
    calculateVigToolDefinition.description,
    calculateVigToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', calculateVigToolDefinition.name, params);
      try {
        const result = await handleCalculateVig(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    impliedProbabilityToolDefinition.name,
    impliedProbabilityToolDefinition.description,
    impliedProbabilityToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', impliedProbabilityToolDefinition.name, params);
      try {
        const result = await handleImpliedProbability(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  // ===========================================================================
  // BANKROLL TOOLS
  // ===========================================================================

  server.tool(
    getBankrollToolDefinition.name,
    getBankrollToolDefinition.description,
    getBankrollToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', getBankrollToolDefinition.name, params);
      try {
        const result = await handleGetBankroll(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    setBankrollToolDefinition.name,
    setBankrollToolDefinition.description,
    setBankrollToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', setBankrollToolDefinition.name, params);
      try {
        const result = await handleSetBankroll(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  server.tool(
    adjustBankrollToolDefinition.name,
    adjustBankrollToolDefinition.description,
    adjustBankrollToolDefinition.inputSchema,
    async (params) => {
      log('Tool called:', adjustBankrollToolDefinition.name, params);
      try {
        const result = await handleAdjustBankroll(params);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
          isError: true
        };
      }
    }
  );

  return server;
}

// ============================================================================
// MCP ENDPOINT
// ============================================================================

// Store active transports for session management
const activeTransports = new Map<string, StreamableHTTPServerTransport>();

app.post('/mcp', async (req: Request, res: Response) => {
  log('MCP request received');

  try {
    // Get or create session
    const sessionId = req.headers['mcp-session-id'] as string || `session-${Date.now()}`;

    let transport = activeTransports.get(sessionId);

    if (!transport) {
      log('Creating new MCP transport for session:', sessionId);

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => sessionId,
        onsessioninitialized: (id) => {
          log('Session initialized:', id);
        }
      });

      const server = createMcpServer();
      await server.connect(transport);

      activeTransports.set(sessionId, transport);

      // Clean up old sessions after 30 minutes
      setTimeout(() => {
        activeTransports.delete(sessionId);
        log('Session cleaned up:', sessionId);
      }, 30 * 60 * 1000);
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    log('MCP error:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      id: null
    });
  }
});

// Session cleanup endpoint
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string;

  if (sessionId && activeTransports.has(sessionId)) {
    activeTransports.delete(sessionId);
    log('Session terminated:', sessionId);
    res.status(200).json({ message: 'Session terminated' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function start() {
  console.log('='.repeat(60));
  console.log('  Betgistics MCP Server v3.0.0');
  console.log('='.repeat(60));

  // Connect to MongoDB
  try {
    console.log('\n[Startup] Connecting to MongoDB...');
    await connectToDatabase();
    console.log('[Startup] MongoDB connected successfully');
  } catch (error) {
    console.error('[Startup] MongoDB connection failed:', error);
    console.log('[Startup] Server will start but database features will be unavailable');
  }

  // Initialize Gemini if configured
  if (isGeminiConfigured()) {
    try {
      console.log('[Startup] Initializing Gemini AI...');
      initializeGemini();
      console.log('[Startup] Gemini AI initialized successfully');
    } catch (error) {
      console.error('[Startup] Gemini initialization failed:', error);
    }
  } else {
    console.log('[Startup] Gemini API key not configured - AI features disabled');
  }

  // Start server
  app.listen(PORT, () => {
    console.log('\n[Server] Running on port', PORT);
    console.log('[Server] MCP endpoint: POST /mcp');
    console.log('[Server] Health check: GET /health');
    console.log('\n[Tools Available]');
    console.log('  - kelly_calculate');
    console.log('  - estimate_football_probability');
    console.log('  - estimate_basketball_probability');
    console.log('  - ai_estimate_probability');
    console.log('  - ai_analyze_matchup');
    console.log('  - log_bet');
    console.log('  - get_bet_history');
    console.log('  - get_bet');
    console.log('  - get_pending_bets');
    console.log('  - update_bet_outcome');
    console.log('  - check_auth_status');
    console.log('  - get_user_profile');
    console.log('  - register_user');
    console.log('  - get_user_stats');
    console.log('  - convert_odds');
    console.log('  - calculate_vig');
    console.log('  - calculate_implied_probability');
    console.log('  - get_bankroll');
    console.log('  - set_bankroll');
    console.log('  - adjust_bankroll');
    console.log('\n' + '='.repeat(60));
  });
}

start().catch((error) => {
  console.error('[Fatal] Server startup failed:', error);
  process.exit(1);
});
