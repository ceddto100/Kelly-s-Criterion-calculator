/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests for Kelly Criterion calculation tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerKellyTool } from '../../tools/kelly.js';

describe('kelly-calculate tool', () => {
  let server: McpServer;
  let toolHandler: any;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    // Spy on server.tool to capture the handler
    const originalTool = server.tool.bind(server);
    vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
      if (name === 'kelly-calculate') {
        toolHandler = handler;
      }
      return originalTool(name, config, handler);
    });

    registerKellyTool(server);
  });

  describe('valid inputs', () => {
    it('should calculate Kelly stake for value bet', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.structuredContent.hasValue).toBe(true);
      expect(result.structuredContent.stake).toBeGreaterThan(0);
      expect(result.structuredContent.stakePercentage).toBeGreaterThan(0);
      expect(result.structuredContent.bankroll).toBe(1000);
      expect(result.structuredContent.probability).toBe(55);
    });

    it('should return no value for bad bet', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: 45, // Below breakeven
        fraction: '1',
      });

      expect(result.structuredContent.hasValue).toBe(false);
      expect(result.structuredContent.stake).toBe(0);
      expect(result.structuredContent.stakePercentage).toBe(0);
    });

    it('should apply half Kelly fraction correctly', async () => {
      const fullKellyResult = await toolHandler({
        bankroll: 1000,
        odds: +150,
        probability: 60,
        fraction: '1',
      });

      const halfKellyResult = await toolHandler({
        bankroll: 1000,
        odds: +150,
        probability: 60,
        fraction: '0.5',
      });

      expect(halfKellyResult.structuredContent.stake).toBeCloseTo(
        fullKellyResult.structuredContent.stake / 2,
        1
      );
    });

    it('should apply quarter Kelly fraction correctly', async () => {
      const fullKellyResult = await toolHandler({
        bankroll: 1000,
        odds: +200,
        probability: 65,
        fraction: '1',
      });

      const quarterKellyResult = await toolHandler({
        bankroll: 1000,
        odds: +200,
        probability: 65,
        fraction: '0.25',
      });

      expect(quarterKellyResult.structuredContent.stake).toBeCloseTo(
        fullKellyResult.structuredContent.stake / 4,
        1
      );
    });

    it('should handle positive American odds', async () => {
      const result = await toolHandler({
        bankroll: 5000,
        odds: +250,
        probability: 55,
        fraction: '1',
      });

      expect(result.structuredContent.decimalOdds).toBe(3.5);
      expect(result.structuredContent.hasValue).toBe(true);
    });

    it('should handle negative American odds', async () => {
      const result = await toolHandler({
        bankroll: 2000,
        odds: -200,
        probability: 70,
        fraction: '1',
      });

      expect(result.structuredContent.decimalOdds).toBe(1.5);
      expect(result.structuredContent.hasValue).toBe(true);
    });

    it('should include timestamp in results', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.structuredContent.lastCalculated).toBeDefined();
      expect(new Date(result.structuredContent.lastCalculated).getTime()).toBeGreaterThan(0);
    });
  });

  describe('input validation', () => {
    it('should reject invalid bankroll (NaN)', async () => {
      const result = await toolHandler({
        bankroll: NaN,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
    });

    it('should reject negative bankroll', async () => {
      const result = await toolHandler({
        bankroll: -500,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_bankroll');
    });

    it('should reject zero bankroll', async () => {
      const result = await toolHandler({
        bankroll: 0,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_bankroll');
    });

    it('should reject bankroll > 1 billion', async () => {
      const result = await toolHandler({
        bankroll: 1000000001,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_bankroll');
    });

    it('should reject invalid odds (NaN)', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: NaN,
        probability: 55,
        fraction: '1',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
    });

    it('should reject odds in invalid range (-100 to 100)', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -50,
        probability: 55,
        fraction: '1',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_odds');
    });

    it('should reject invalid probability (NaN)', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: NaN,
        fraction: '1',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
    });

    it('should accept edge probability values', async () => {
      const lowResult = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: 0.1,
        fraction: '1',
      });
      expect(lowResult.isError).toBeFalsy();

      const highResult = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: 99.9,
        fraction: '1',
      });
      expect(highResult.isError).toBeFalsy();
    });
  });

  describe('edge cases', () => {
    it('should handle very small bankroll', async () => {
      const result = await toolHandler({
        bankroll: 0.01,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.structuredContent.hasValue).toBeDefined();
      expect(result.isError).toBeFalsy();
    });

    it('should handle large bankroll', async () => {
      const result = await toolHandler({
        bankroll: 999999999,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.isError).toBeFalsy();
    });

    it('should handle very high probability', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -300,
        probability: 95,
        fraction: '1',
      });

      expect(result.structuredContent.hasValue).toBe(true);
      expect(result.structuredContent.stake).toBeGreaterThan(0);
    });

    it('should handle underdog odds with low probability', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: +500,
        probability: 15,
        fraction: '1',
      });

      // Should have no value or minimal value
      expect(result.structuredContent.hasValue).toBe(false);
    });
  });

  describe('output format', () => {
    it('should return structured content with all required fields', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.structuredContent).toHaveProperty('hasValue');
      expect(result.structuredContent).toHaveProperty('stake');
      expect(result.structuredContent).toHaveProperty('stakePercentage');
      expect(result.structuredContent).toHaveProperty('bankroll');
      expect(result.structuredContent).toHaveProperty('odds');
      expect(result.structuredContent).toHaveProperty('probability');
      expect(result.structuredContent).toHaveProperty('decimalOdds');
      expect(result.structuredContent).toHaveProperty('fraction');
      expect(result.structuredContent).toHaveProperty('kellyFraction');
      expect(result.structuredContent).toHaveProperty('lastCalculated');
    });

    it('should return content array with text', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result.content).toBeDefined();
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
    });

    it('should include metadata for UI rendering', async () => {
      const result = await toolHandler({
        bankroll: 1000,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(result._meta).toBeDefined();
      expect(result._meta).toHaveProperty('openai/outputTemplate');
      expect(result._meta).toHaveProperty('calculation');
      expect(result._meta).toHaveProperty('displaySettings');
    });
  });
});
