/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MCP JSON-RPC format tests for probability-estimate-basketball
 * These tests verify that the tool accepts proper MCP protocol requests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerBasketballProbabilityTool } from '../../tools/probabilityBasketball.js';
import { registerFootballProbabilityTool } from '../../tools/probabilityFootball.js';

describe('MCP JSON-RPC Format - probability-estimate-basketball', () => {
  let app: express.Application;
  let mcpServer: McpServer;

  beforeAll(() => {
    // Create a minimal test server
    app = express();
    app.use(express.json());

    mcpServer = new McpServer({
      name: 'test-kelly-calculator',
      version: '1.0.0'
    });

    // Register probability tools
    registerBasketballProbabilityTool(mcpServer);
    registerFootballProbabilityTool(mcpServer);

    // MCP endpoint
    app.use('/mcp', async (req, res) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined,
          enableJsonResponse: true
        });

        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error: any) {
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal server error',
            message: error.message
          });
        }
      }
    });
  });

  describe('Basketball Tool - Correct MCP Format', () => {
    it('should accept MCP JSON-RPC format with Houston Rockets vs Lakers', async () => {
      // Initialize first
      await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
          },
          id: 0
        })
        .set('Content-Type', 'application/json');

      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-basketball',
            arguments: {
              team_favorite: 'Houston Rockets',
              team_underdog: 'Los Angeles Lakers',
              spread: -3.5
            }
          },
          id: 1
        })
        .set('Content-Type', 'application/json');

      if (response.status !== 200) {
        console.error('Response:', response.status, response.body);
      }
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
      expect(response.body.id).toBe(1);

      // Parse the text content
      const content = response.body.result.content[0];
      expect(content.type).toBe('text');

      const data = JSON.parse(content.text);
      expect(data).toHaveProperty('favorite_cover_probability');
      expect(data).toHaveProperty('underdog_cover_probability');
      expect(data).toHaveProperty('inputs');
      expect(data).toHaveProperty('normalized');

      // Verify probabilities
      expect(data.favorite_cover_probability).toBeGreaterThan(0);
      expect(data.favorite_cover_probability).toBeLessThan(1);
      expect(data.underdog_cover_probability).toBeGreaterThan(0);
      expect(data.underdog_cover_probability).toBeLessThan(1);

      // Verify sum equals 1.0
      const sum = data.favorite_cover_probability + data.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);

      // Verify inputs are preserved
      expect(data.inputs.team_favorite).toBe('Houston Rockets');
      expect(data.inputs.team_underdog).toBe('Los Angeles Lakers');
      expect(data.inputs.spread).toBe(-3.5);

      // Verify normalized team names
      expect(data.normalized.team_favorite).toContain('Rockets');
      expect(data.normalized.team_underdog).toContain('Lakers');
    });

    it('should accept abbreviations (HOU vs LAL)', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-basketball',
            arguments: {
              team_favorite: 'HOU',
              team_underdog: 'LAL',
              spread: -3.5
            }
          },
          id: 2
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data.inputs.team_favorite).toBe('HOU');
      expect(data.inputs.team_underdog).toBe('LAL');
      expect(data.normalized.team_favorite).toContain('Rockets');
      expect(data.normalized.team_underdog).toContain('Lakers');
    });

    it('should accept field aliases (favorite_team, underdog_team)', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-basketball',
            arguments: {
              favorite_team: 'Rockets',
              underdog_team: 'Lakers',
              spread: -3.5
            }
          },
          id: 3
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data.favorite_cover_probability).toBeGreaterThan(0);
      expect(data.underdog_cover_probability).toBeGreaterThan(0);
    });

    it('should accept short aliases (fav, dog)', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-basketball',
            arguments: {
              fav: 'HOU',
              dog: 'LAL',
              spread: -3.5
            }
          },
          id: 4
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data.favorite_cover_probability).toBeDefined();
      expect(data.underdog_cover_probability).toBeDefined();
    });
  });

  describe('Basketball Tool - Error Handling', () => {
    it('should return error for missing team_favorite', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-basketball',
            arguments: {
              team_underdog: 'Los Angeles Lakers',
              spread: -3.5
            }
          },
          id: 5
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty('error', 'invalid_input');
      expect(data.message).toContain('Missing required field(s)');
      expect(data.message).toContain('team_favorite');
    });

    it('should return error for missing team_underdog', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-basketball',
            arguments: {
              team_favorite: 'Houston Rockets',
              spread: -3.5
            }
          },
          id: 6
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty('error', 'invalid_input');
      expect(data.message).toContain('Missing required field(s)');
      expect(data.message).toContain('team_underdog');
    });

    it('should return error for missing spread', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-basketball',
            arguments: {
              team_favorite: 'Houston Rockets',
              team_underdog: 'Los Angeles Lakers'
            }
          },
          id: 7
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty('error', 'invalid_input');
      expect(data.message).toContain('Missing required field(s)');
      expect(data.message).toContain('spread');
    });

    it('should return suggestions for unknown team', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-basketball',
            arguments: {
              team_favorite: 'InvalidTeamXYZ',
              team_underdog: 'Los Angeles Lakers',
              spread: -3.5
            }
          },
          id: 8
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty('error', 'invalid_input');
      expect(data.message).toContain('Unknown team name');
      expect(data).toHaveProperty('team_searched', 'InvalidTeamXYZ');
      expect(data).toHaveProperty('suggestions');
      expect(Array.isArray(data.suggestions)).toBe(true);
    });
  });

  describe('Football Tool - Correct MCP Format', () => {
    it('should accept MCP JSON-RPC format with Dallas Cowboys vs Giants', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-football',
            arguments: {
              team_favorite: 'Dallas Cowboys',
              team_underdog: 'New York Giants',
              spread: -6.5
            }
          },
          id: 9
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data).toHaveProperty('favorite_cover_probability');
      expect(data).toHaveProperty('underdog_cover_probability');
      expect(data).toHaveProperty('inputs');
      expect(data).toHaveProperty('normalized');

      const sum = data.favorite_cover_probability + data.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    it('should accept abbreviations (DAL vs NYG)', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'probability-estimate-football',
            arguments: {
              team_favorite: 'DAL',
              team_underdog: 'NYG',
              spread: -6.5
            }
          },
          id: 10
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);

      const content = response.body.result.content[0];
      const data = JSON.parse(content.text);

      expect(data.inputs.team_favorite).toBe('DAL');
      expect(data.inputs.team_underdog).toBe('NYG');
      expect(data.normalized.team_favorite).toContain('Dallas');
      expect(data.normalized.team_underdog).toContain('Giants');
    });
  });
});
