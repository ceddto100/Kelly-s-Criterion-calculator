/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests for probability estimation tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerFootballProbabilityTool } from '../../tools/probabilityFootball.js';
import { registerBasketballProbabilityTool } from '../../tools/probabilityBasketball.js';

describe('probability-estimate-football tool', () => {
  let server: McpServer;
  let toolHandler: any;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    const originalTool = server.tool.bind(server);
    vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
      if (name === 'probability-estimate-football') {
        toolHandler = handler;
      }
      return originalTool(name, config, handler);
    });

    registerFootballProbabilityTool(server);
  });

  describe('valid inputs', () => {
    it('should estimate probability for football matchup', async () => {
      const result = await toolHandler({
        teamPointsFor: 28,
        teamPointsAgainst: 20,
        opponentPointsFor: 21,
        opponentPointsAgainst: 24,
        teamOffYards: 380,
        teamDefYards: 310,
        opponentOffYards: 330,
        opponentDefYards: 360,
        teamTurnoverDiff: 1.5,
        opponentTurnoverDiff: -0.5,
        spread: -3.5,
      });

      expect(result.structuredContent.sport).toBe('football');
      expect(result.structuredContent.probability).toBeGreaterThan(0);
      expect(result.structuredContent.probability).toBeLessThan(100);
      expect(result.structuredContent.predictedMargin).toBeDefined();
      expect(result.structuredContent.sigma).toBe(13.5);
    });

    it('should return >50% for favorite expected to cover', async () => {
      const result = await toolHandler({
        teamPointsFor: 31,
        teamPointsAgainst: 18,
        opponentPointsFor: 20,
        opponentPointsAgainst: 26,
        teamOffYards: 420,
        teamDefYards: 290,
        opponentOffYards: 310,
        opponentDefYards: 380,
        teamTurnoverDiff: 2.5,
        opponentTurnoverDiff: -1.8,
        spread: -7,
      });

      expect(result.structuredContent.probability).toBeGreaterThan(50);
    });

    it('should return <50% when unlikely to cover', async () => {
      const result = await toolHandler({
        teamPointsFor: 18,
        teamPointsAgainst: 28,
        opponentPointsFor: 27,
        opponentPointsAgainst: 19,
        teamOffYards: 300,
        teamDefYards: 400,
        opponentOffYards: 390,
        opponentDefYards: 320,
        teamTurnoverDiff: -1.2,
        opponentTurnoverDiff: 1.8,
        spread: -3,
      });

      expect(result.structuredContent.probability).toBeLessThan(50);
    });

    it('should include team and opponent stats in output', async () => {
      const result = await toolHandler({
        teamPointsFor: 24,
        teamPointsAgainst: 21,
        opponentPointsFor: 22,
        opponentPointsAgainst: 23,
        teamOffYards: 360,
        teamDefYards: 340,
        opponentOffYards: 350,
        opponentDefYards: 350,
        teamTurnoverDiff: 0.5,
        opponentTurnoverDiff: 0,
        spread: -2.5,
      });

      expect(result.structuredContent.teamStats).toBeDefined();
      expect(result.structuredContent.opponentStats).toBeDefined();
      expect(result.structuredContent.teamStats.pointsFor).toBe(24);
      expect(result.structuredContent.opponentStats.pointsFor).toBe(22);
    });
  });

  describe('input validation', () => {
    it('should reject NaN values', async () => {
      const result = await toolHandler({
        teamPointsFor: NaN,
        teamPointsAgainst: 20,
        opponentPointsFor: 21,
        opponentPointsAgainst: 24,
        teamOffYards: 380,
        teamDefYards: 310,
        opponentOffYards: 330,
        opponentDefYards: 360,
        teamTurnoverDiff: 1.5,
        opponentTurnoverDiff: -0.5,
        spread: -3.5,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
    });

    it('should reject out-of-range points', async () => {
      const result = await toolHandler({
        teamPointsFor: 150, // > 100
        teamPointsAgainst: 20,
        opponentPointsFor: 21,
        opponentPointsAgainst: 24,
        teamOffYards: 380,
        teamDefYards: 310,
        opponentOffYards: 330,
        opponentDefYards: 360,
        teamTurnoverDiff: 1.5,
        opponentTurnoverDiff: -0.5,
        spread: -3.5,
      });

      expect(result.isError).toBe(true);
    });

    it('should reject out-of-range yards', async () => {
      const result = await toolHandler({
        teamPointsFor: 28,
        teamPointsAgainst: 20,
        opponentPointsFor: 21,
        opponentPointsAgainst: 24,
        teamOffYards: 1500, // > 1000
        teamDefYards: 310,
        opponentOffYards: 330,
        opponentDefYards: 360,
        teamTurnoverDiff: 1.5,
        opponentTurnoverDiff: -0.5,
        spread: -3.5,
      });

      expect(result.isError).toBe(true);
    });

    it('should reject out-of-range turnover differential', async () => {
      const result = await toolHandler({
        teamPointsFor: 28,
        teamPointsAgainst: 20,
        opponentPointsFor: 21,
        opponentPointsAgainst: 24,
        teamOffYards: 380,
        teamDefYards: 310,
        opponentOffYards: 330,
        opponentDefYards: 360,
        teamTurnoverDiff: 100, // > 50
        opponentTurnoverDiff: -0.5,
        spread: -3.5,
      });

      expect(result.isError).toBe(true);
    });

    it('should reject out-of-range spread', async () => {
      const result = await toolHandler({
        teamPointsFor: 28,
        teamPointsAgainst: 20,
        opponentPointsFor: 21,
        opponentPointsAgainst: 24,
        teamOffYards: 380,
        teamDefYards: 310,
        opponentOffYards: 330,
        opponentDefYards: 360,
        teamTurnoverDiff: 1.5,
        opponentTurnoverDiff: -0.5,
        spread: 150, // > 100
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero values', async () => {
      const result = await toolHandler({
        teamPointsFor: 0,
        teamPointsAgainst: 0,
        opponentPointsFor: 0,
        opponentPointsAgainst: 0,
        teamOffYards: 0,
        teamDefYards: 0,
        opponentOffYards: 0,
        opponentDefYards: 0,
        teamTurnoverDiff: 0,
        opponentTurnoverDiff: 0,
        spread: 0,
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.probability).toBeCloseTo(50, 0);
    });

    it('should cap probability at 99.9', async () => {
      const result = await toolHandler({
        teamPointsFor: 50,
        teamPointsAgainst: 10,
        opponentPointsFor: 10,
        opponentPointsAgainst: 50,
        teamOffYards: 600,
        teamDefYards: 200,
        opponentOffYards: 200,
        opponentDefYards: 600,
        teamTurnoverDiff: 10,
        opponentTurnoverDiff: -10,
        spread: 50,
      });

      expect(result.structuredContent.probability).toBeLessThanOrEqual(99.9);
    });

    it('should cap probability at 0.1', async () => {
      const result = await toolHandler({
        teamPointsFor: 10,
        teamPointsAgainst: 50,
        opponentPointsFor: 50,
        opponentPointsAgainst: 10,
        teamOffYards: 200,
        teamDefYards: 600,
        opponentOffYards: 600,
        opponentDefYards: 200,
        teamTurnoverDiff: -10,
        opponentTurnoverDiff: 10,
        spread: -50,
      });

      expect(result.structuredContent.probability).toBeGreaterThanOrEqual(0.1);
    });
  });
});

describe('probability-estimate-basketball tool', () => {
  let server: McpServer;
  let toolHandler: any;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    const originalTool = server.tool.bind(server);
    vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
      if (name === 'probability-estimate-basketball') {
        toolHandler = handler;
      }
      return originalTool(name, config, handler);
    });

    registerBasketballProbabilityTool(server);
  });

  describe('valid inputs', () => {
    it('should estimate probability for basketball matchup', async () => {
      const result = await toolHandler({
        teamPointsFor: 115,
        teamPointsAgainst: 108,
        opponentPointsFor: 110,
        opponentPointsAgainst: 112,
        teamFgPct: 0.475,
        opponentFgPct: 0.445,
        teamReboundMargin: 3.5,
        opponentReboundMargin: -1.2,
        teamTurnoverMargin: 1.8,
        opponentTurnoverMargin: -0.5,
        spread: -4.5,
      });

      expect(result.structuredContent.sport).toBe('basketball');
      expect(result.structuredContent.probability).toBeGreaterThan(0);
      expect(result.structuredContent.probability).toBeLessThan(100);
      expect(result.structuredContent.sigma).toBe(12.0);
    });

    it('should validate field goal percentage range', async () => {
      const result = await toolHandler({
        teamPointsFor: 115,
        teamPointsAgainst: 108,
        opponentPointsFor: 110,
        opponentPointsAgainst: 112,
        teamFgPct: 1.5, // Invalid: > 1
        opponentFgPct: 0.445,
        teamReboundMargin: 3.5,
        opponentReboundMargin: -1.2,
        teamTurnoverMargin: 1.8,
        opponentTurnoverMargin: -0.5,
        spread: -4.5,
      });

      expect(result.isError).toBe(true);
    });

    it('should include team statistics', async () => {
      const result = await toolHandler({
        teamPointsFor: 112,
        teamPointsAgainst: 110,
        opponentPointsFor: 108,
        opponentPointsAgainst: 106,
        teamFgPct: 0.465,
        opponentFgPct: 0.445,
        teamReboundMargin: 2.5,
        opponentReboundMargin: 1.0,
        teamTurnoverMargin: 0.8,
        opponentTurnoverMargin: 0.3,
        spread: -3,
      });

      expect(result.structuredContent.teamStats).toBeDefined();
      expect(result.structuredContent.teamStats.fgPct).toBe(0.465);
      expect(result.structuredContent.opponentStats).toBeDefined();
    });
  });

  describe('input validation', () => {
    it('should reject negative field goal percentage', async () => {
      const result = await toolHandler({
        teamPointsFor: 115,
        teamPointsAgainst: 108,
        opponentPointsFor: 110,
        opponentPointsAgainst: 112,
        teamFgPct: -0.1,
        opponentFgPct: 0.445,
        teamReboundMargin: 3.5,
        opponentReboundMargin: -1.2,
        teamTurnoverMargin: 1.8,
        opponentTurnoverMargin: -0.5,
        spread: -4.5,
      });

      expect(result.isError).toBe(true);
    });

    it('should reject out-of-range points', async () => {
      const result = await toolHandler({
        teamPointsFor: 250, // > 200
        teamPointsAgainst: 108,
        opponentPointsFor: 110,
        opponentPointsAgainst: 112,
        teamFgPct: 0.475,
        opponentFgPct: 0.445,
        teamReboundMargin: 3.5,
        opponentReboundMargin: -1.2,
        teamTurnoverMargin: 1.8,
        opponentTurnoverMargin: -0.5,
        spread: -4.5,
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle perfect shooting percentage', async () => {
      const result = await toolHandler({
        teamPointsFor: 120,
        teamPointsAgainst: 100,
        opponentPointsFor: 100,
        opponentPointsAgainst: 105,
        teamFgPct: 1.0,
        opponentFgPct: 0.4,
        teamReboundMargin: 5,
        opponentReboundMargin: -5,
        teamTurnoverMargin: 3,
        opponentTurnoverMargin: -3,
        spread: -10,
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.probability).toBeGreaterThan(50);
    });

    it('should handle zero margins', async () => {
      const result = await toolHandler({
        teamPointsFor: 110,
        teamPointsAgainst: 110,
        opponentPointsFor: 110,
        opponentPointsAgainst: 110,
        teamFgPct: 0.45,
        opponentFgPct: 0.45,
        teamReboundMargin: 0,
        opponentReboundMargin: 0,
        teamTurnoverMargin: 0,
        opponentTurnoverMargin: 0,
        spread: 0,
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.probability).toBeCloseTo(50, 0);
    });
  });
});
