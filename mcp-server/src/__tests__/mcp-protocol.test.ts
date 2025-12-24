/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MCP Protocol Integration Tests
 * These tests verify that the MCP server responds correctly to JSON-RPC requests
 * from clients like OpenAI's tool scanner using the StreamableHTTPServerTransport.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server.js';

describe('MCP Protocol - JSON-RPC over HTTP (StreamableHTTPServerTransport)', () => {
  describe('POST /mcp - Initialize', () => {
    it('should handle initialize request and return valid response', async () => {
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'test-client',
              version: '1.0.0'
            }
          },
          id: 1
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('protocolVersion');
      expect(response.body.result).toHaveProperty('capabilities');
      expect(response.body.result).toHaveProperty('serverInfo');
      expect(response.body.result.serverInfo.name).toBe('kelly-criterion-calculator');
      expect(response.body.id).toBe(1);
    }, 10000);

    it('should respond quickly (< 2 seconds)', async () => {
      const startTime = Date.now();

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
          id: 1
        })
        .set('Content-Type', 'application/json');

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000);
    }, 10000);
  });

  describe('POST /mcp - Tools List', () => {
    it('should return list of registered tools after initialize', async () => {
      // First initialize
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
          id: 1
        })
        .set('Content-Type', 'application/json');

      // Then list tools
      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 2
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('tools');
      expect(Array.isArray(response.body.result.tools)).toBe(true);
      expect(response.body.result.tools.length).toBeGreaterThan(0);
      expect(response.body.id).toBe(2);

      // Verify each tool has required fields
      response.body.result.tools.forEach((tool: any) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
      });
    }, 15000);

    it('should include kelly-calculate tool', async () => {
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
          id: 1
        })
        .set('Content-Type', 'application/json');

      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 3
        })
        .set('Content-Type', 'application/json');

      const kellyTool = response.body.result.tools.find(
        (t: any) => t.name === 'kelly-calculate'
      );

      expect(kellyTool).toBeDefined();
      expect(kellyTool.name).toBe('kelly-calculate');
      expect(kellyTool.inputSchema).toBeDefined();
    }, 15000);

    it('should respond quickly (< 2 seconds)', async () => {
      // Initialize
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
          id: 1
        })
        .set('Content-Type', 'application/json');

      const startTime = Date.now();

      await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 4
        })
        .set('Content-Type', 'application/json');

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000);
    }, 15000);
  });

  describe('POST /mcp - Tools Call', () => {
    it('should execute kelly-calculate tool successfully', async () => {
      // Initialize
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
          id: 1
        })
        .set('Content-Type', 'application/json');

      const response = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'kelly-calculate',
            arguments: {
              bankroll: 1000,
              odds: -110,
              probability: 55,
              fraction: '1'
            }
          },
          id: 5
        })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('result');
      expect(response.body.id).toBe(5);

      // The result should contain content
      expect(response.body.result).toHaveProperty('content');
      expect(Array.isArray(response.body.result.content)).toBe(true);
    }, 20000);
  });

  describe('Complete MCP Flow', () => {
    it('should complete full scanner flow: initialize -> tools/list -> tools/call', async () => {
      // Step 1: Initialize
      const initResponse = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'openai-scanner', version: '1.0.0' }
          },
          id: 1
        })
        .set('Content-Type', 'application/json');

      expect(initResponse.status).toBe(200);
      expect(initResponse.body.result).toBeDefined();

      // Step 2: List tools
      const listResponse = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          params: {},
          id: 2
        })
        .set('Content-Type', 'application/json');

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.result.tools.length).toBeGreaterThan(0);

      const firstTool = listResponse.body.result.tools.find(
        (t: any) => t.name === 'kelly-calculate'
      );
      expect(firstTool).toBeDefined();

      // Step 3: Call a tool
      const callResponse = await request(app)
        .post('/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'kelly-calculate',
            arguments: {
              bankroll: 1000,
              odds: -110,
              probability: 55,
              fraction: '0.5'
            }
          },
          id: 3
        })
        .set('Content-Type', 'application/json');

      expect(callResponse.status).toBe(200);
      expect(callResponse.body.result).toBeDefined();
    }, 30000);
  });

  describe('POST /mcp/ - Trailing Slash', () => {
    it('should handle POST /mcp/ (with trailing slash)', async () => {
      const response = await request(app)
        .post('/mcp/')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' }
          },
          id: 11
        })
        .set('Content-Type', 'application/json');

      // Should handle without redirecting
      expect(response.status).toBeLessThan(300);
      expect(response.status).toBeGreaterThanOrEqual(200);
    }, 10000);
  });
});

describe('Health Check', () => {
  it('should respond to /health quickly', async () => {
    const startTime = Date.now();

    const response = await request(app).get('/health');

    const elapsed = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'ok');
    expect(elapsed).toBeLessThan(500);
  });

  it('should not depend on external services', async () => {
    // Health check should succeed even if external services are down
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});

describe('Domain Verification', () => {
  it('should serve OpenAI domain verification token', async () => {
    const response = await request(app).get('/.well-known/openai-apps-challenge');

    expect(response.status).toBe(200);
    expect(response.text).toBe('QphJXcnbOxYcoU7_XrjYgVss4BgeQfOUUWtz12ALEcc');
    expect(response.type).toContain('text/plain');
  });
});
