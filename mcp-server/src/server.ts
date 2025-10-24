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
import { registerUnitBettingTool } from './tools/unitBetting.js';

// Import component resources
import { registerComponentResources } from './components/resources.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);

// Create Express app
const app = express();
app.use(express.json());

// Create MCP server
const mcpServer = new McpServer({
  name: 'kelly-criterion-calculator',
  version: '1.0.0'
});

// Register all component resources
registerComponentResources(mcpServer);

// Register all tools
registerKellyTool(mcpServer);
registerFootballProbabilityTool(mcpServer);
registerBasketballProbabilityTool(mcpServer);
registerUnitBettingTool(mcpServer);

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

// CORS middleware for ChatGPT
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

// Start server
app.listen(PORT, () => {
  console.log('========================================');
  console.log('Kelly Criterion MCP Server');
  console.log('========================================');
  console.log(`Server: kelly-criterion-calculator v1.0.0`);
  console.log(`Port: ${PORT}`);
  console.log(`MCP Endpoint: http://localhost:${PORT}/mcp`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
  console.log('');
  console.log('Registered Tools:');
  console.log('  - kelly-calculate');
  console.log('  - probability-estimate-football');
  console.log('  - probability-estimate-basketball');
  console.log('  - unit-calculate');
  console.log('');
  console.log('Registered Resources:');
  console.log('  - kelly-calculator.html');
  console.log('  - probability-estimator.html');
  console.log('  - unit-calculator.html');
  console.log('========================================');
});
