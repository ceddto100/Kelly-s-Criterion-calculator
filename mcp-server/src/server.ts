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
import cron from 'node-cron';

// Database connection
import { connectToDatabase, ensureDatabaseConnection, isDatabaseConnected } from './config/database.js';

// Initialize Gemini (if configured)
import { isGeminiConfigured, initializeGemini } from './config/gemini.js';

// Tool handlers and schemas
import { kellyToolDefinition, kellyInputSchema, handleKellyCalculation } from './tools/kelly.js';
import {
  footballProbabilityToolDefinition,
  basketballProbabilityToolDefinition,
  footballProbabilityInputSchema,
  basketballProbabilityInputSchema,
  handleFootballProbability,
  handleBasketballProbability
} from './tools/probability.js';
import {
  hockeyProbabilityToolDefinition,
  hockeyProbabilityInputSchema,
  handleHockeyProbability
} from './tools/hockeyProbability.js';
import {
  aiProbabilityToolDefinition,
  matchupAnalysisToolDefinition,
  aiProbabilityInputSchema,
  matchupAnalysisInputSchema,
  handleAIProbability,
  handleMatchupAnalysis
} from './tools/aiProbability.js';
import { logBetToolDefinition, logBetInputSchema, handleLogBet } from './tools/betLogging.js';
import {
  getBetHistoryToolDefinition,
  getBetByIdToolDefinition,
  getPendingBetsToolDefinition,
  getBetHistoryInputSchema,
  getBetByIdInputSchema,
  getPendingBetsInputSchema,
  handleGetBetHistory,
  handleGetBetById,
  handleGetPendingBets
} from './tools/betHistory.js';
import { updateBetOutcomeToolDefinition, updateBetOutcomeInputSchema, handleUpdateBetOutcome } from './tools/betOutcome.js';
import {
  checkAuthToolDefinition,
  getUserProfileToolDefinition,
  registerUserToolDefinition,
  checkAuthInputSchema,
  getUserProfileInputSchema,
  registerUserInputSchema,
  handleCheckAuth,
  handleGetUserProfile,
  handleRegisterUser
} from './tools/auth.js';
import { getUserStatsToolDefinition, getUserStatsInputSchema, handleGetUserStats } from './tools/userStats.js';
import {
  convertOddsToolDefinition,
  calculateVigToolDefinition,
  impliedProbabilityToolDefinition,
  convertOddsInputSchema,
  calculateVigInputSchema,
  impliedProbabilityInputSchema,
  handleConvertOdds,
  handleCalculateVig,
  handleImpliedProbability
} from './tools/oddsConversion.js';
import {
  getBankrollToolDefinition,
  setBankrollToolDefinition,
  adjustBankrollToolDefinition,
  getBankrollInputSchema,
  setBankrollInputSchema,
  adjustBankrollInputSchema,
  handleGetBankroll,
  handleSetBankroll,
  handleAdjustBankroll
} from './tools/bankroll.js';
import {
  orchestrationToolDefinition,
  orchestrationInputSchema,
  handleOrchestration
} from './tools/orchestration.js';
import {
  getTeamStatsToolDefinition,
  getMatchupStatsToolDefinition,
  getTeamStatsInputSchema,
  getMatchupStatsInputSchema,
  handleGetTeamStats,
  handleGetMatchupStats
} from './tools/teamStats.js';
import {
  updateStatsToolDefinition,
  updateStatsInputSchema,
  handleUpdateStats,
  updateAllStats
} from './tools/statsUpdater.js';
import {
  getTodaysGamesToolDefinition,
  getTodaysGamesInputSchema,
  handleGetTodaysGames
} from './tools/gamesOfDay.js';
import {
  runDailyCalcToolDefinition,
  runDailyCalcInputSchema,
  handleRunDailyCalc,
  runDailyCalculations
} from './tools/dailyCalc.js';

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
    kellyInputSchema.shape,
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
    footballProbabilityInputSchema.shape,
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
    basketballProbabilityInputSchema.shape,
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

  server.tool(
    hockeyProbabilityToolDefinition.name,
    hockeyProbabilityToolDefinition.description,
    hockeyProbabilityInputSchema.shape,
    async (params) => {
      log('Tool called:', hockeyProbabilityToolDefinition.name, params);
      try {
        const result = await handleHockeyProbability(params);
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
    aiProbabilityInputSchema.shape,
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
    matchupAnalysisInputSchema.shape,
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
    logBetInputSchema.shape,
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
    getBetHistoryInputSchema.shape,
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
    getBetByIdInputSchema.shape,
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
    getPendingBetsInputSchema.shape,
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
    updateBetOutcomeInputSchema.shape,
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
    checkAuthInputSchema.shape,
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
    getUserProfileInputSchema.shape,
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
    registerUserInputSchema.shape,
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
    getUserStatsInputSchema.shape,
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
    convertOddsInputSchema.shape,
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
    calculateVigInputSchema.shape,
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
    impliedProbabilityInputSchema.shape,
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
    getBankrollInputSchema.shape,
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
    setBankrollInputSchema.shape,
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
    adjustBankrollInputSchema.shape,
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

  // ===========================================================================
  // ORCHESTRATION TOOL (End-to-End Workflow)
  // ===========================================================================

  server.tool(
    orchestrationToolDefinition.name,
    orchestrationToolDefinition.description,
    orchestrationInputSchema.shape,
    async (params) => {
      log('Tool called:', orchestrationToolDefinition.name, params);
      try {
        const result = await handleOrchestration(params);
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
  // TEAM STATS TOOLS
  // ===========================================================================

  server.tool(
    getTeamStatsToolDefinition.name,
    getTeamStatsToolDefinition.description,
    getTeamStatsInputSchema.shape,
    async (params) => {
      log('Tool called:', getTeamStatsToolDefinition.name, params);
      try {
        const result = await handleGetTeamStats(params);
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
    getMatchupStatsToolDefinition.name,
    getMatchupStatsToolDefinition.description,
    getMatchupStatsInputSchema.shape,
    async (params) => {
      log('Tool called:', getMatchupStatsToolDefinition.name, params);
      try {
        const result = await handleGetMatchupStats(params);
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
  // STATS UPDATER TOOL
  // ===========================================================================

  server.tool(
    updateStatsToolDefinition.name,
    updateStatsToolDefinition.description,
    updateStatsInputSchema.shape,
    async (params) => {
      log('Tool called:', updateStatsToolDefinition.name, params);
      try {
        const result = await handleUpdateStats(params as any);
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
  // GAMES OF THE DAY TOOL
  // ===========================================================================

  server.tool(
    getTodaysGamesToolDefinition.name,
    getTodaysGamesToolDefinition.description,
    getTodaysGamesInputSchema.shape,
    async (params) => {
      log('Tool called:', getTodaysGamesToolDefinition.name, params);
      try {
        const result = await handleGetTodaysGames(params as any);
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
  // DAILY CALCULATIONS TOOL
  // ===========================================================================

  server.tool(
    runDailyCalcToolDefinition.name,
    runDailyCalcToolDefinition.description,
    runDailyCalcInputSchema.shape,
    async (params) => {
      log('Tool called:', runDailyCalcToolDefinition.name, params);
      try {
        const result = await handleRunDailyCalc(params as any);
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
    try {
      await ensureDatabaseConnection();
    } catch (error) {
      log('Database connection unavailable for MCP request:', error);
      res.status(503).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Database unavailable for MCP operations'
        },
        id: null
      });
      return;
    }

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
// AUTOMATION HTTP ENDPOINTS
// ============================================================================

/**
 * Verify the admin key from request headers.
 * If ADMIN_KEY env var is set, the header must match.
 * If not set, the endpoint is open (development mode).
 */
function isAuthorized(req: Request): boolean {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) return true; // No key configured — open access
  const provided = req.headers['x-admin-key'];
  return provided === adminKey;
}

/**
 * POST /api/update-stats
 * Triggers a live stats refresh for one or all sports.
 * Returns CSV content so GitHub Actions can commit updated files.
 *
 * Body: { sport?: 'NBA' | 'NFL' | 'NHL' | 'ALL' }
 * Headers: x-admin-key (required if ADMIN_KEY env var is set)
 */
app.post('/api/update-stats', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const sport = (req.body?.sport || 'ALL') as 'NBA' | 'NFL' | 'NHL' | 'ALL';
  console.log(`[HTTP] POST /api/update-stats sport=${sport}`);

  try {
    const result = await updateAllStats(sport);
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HTTP] /api/update-stats error:', message);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/daily-calcs
 * Triggers the daily calculation pipeline manually.
 *
 * Body: { bankroll?, kellyFraction?, americanOdds?, logBets?, sport? }
 * Headers: x-admin-key (required if ADMIN_KEY env var is set)
 */
app.post('/api/daily-calcs', async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  console.log('[HTTP] POST /api/daily-calcs');

  try {
    const result = await runDailyCalculations(req.body || {});
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[HTTP] /api/daily-calcs error:', message);
    res.status(500).json({ success: false, error: message });
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
    console.log('[Server] Stats update: POST /api/update-stats');
    console.log('[Server] Daily calcs:  POST /api/daily-calcs');
    console.log('\n[Tools Available]');
    console.log('  - kelly_calculate');
    console.log('  - estimate_football_probability');
    console.log('  - estimate_basketball_probability');
    console.log('  - estimate_hockey_probability');
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
    console.log('  - analyze_matchup_and_log_bet (orchestration)');
    console.log('  - get_team_stats');
    console.log('  - get_matchup_stats');
    console.log('  - update_stats');
    console.log('  - get_todays_games');
    console.log('  - run_daily_calculations');
    console.log('\n' + '='.repeat(60));
  });

  // ============================================================================
  // SCHEDULED JOBS (node-cron)
  // ============================================================================

  // Stats refresh: every 12 hours (matches GitHub Actions schedule)
  // Runs at 00:00 and 12:00 UTC — keeps Render's local CSV copies fresh
  cron.schedule('0 0,12 * * *', async () => {
    console.log('[Cron] Stats refresh starting...');
    try {
      const result = await updateAllStats('ALL');
      const successCount = Object.values(result.sports).filter((s) => s?.success).length;
      console.log(`[Cron] Stats refresh complete. ${successCount}/3 sports updated`);
    } catch (err) {
      console.error('[Cron] Stats refresh failed:', err);
    }
  });

  // Daily calculations: every day at 9:00 AM UTC
  // Fetches today's games, calculates probabilities, logs value bets
  cron.schedule('0 9 * * *', async () => {
    console.log('[Cron] Daily calculations starting...');
    try {
      const result = await runDailyCalculations({});
      console.log(`[Cron] Daily calc complete. Games: ${result.gamesAnalyzed}, Value bets: ${result.highValueBets.length}, Logged: ${result.betsLogged}`);
    } catch (err) {
      console.error('[Cron] Daily calculations failed:', err);
    }
  });

  console.log('[Cron] Scheduled: stats refresh at 00:00 and 12:00 UTC');
  console.log('[Cron] Scheduled: daily calculations at 09:00 UTC');
}

start().catch((error) => {
  console.error('[Fatal] Server startup failed:', error);
  process.exit(1);
});
