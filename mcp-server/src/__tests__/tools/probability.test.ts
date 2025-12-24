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
    it('should estimate probability for Eagles -7 vs Commanders', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: 'Eagles',
        team_underdog: 'Commanders',
        spread: -7,
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeGreaterThan(0);
      expect(result.structuredContent.favorite_cover_probability).toBeLessThan(1);
      expect(result.structuredContent.underdog_cover_probability).toBeGreaterThan(0);
      expect(result.structuredContent.underdog_cover_probability).toBeLessThan(1);
      expect(result.structuredContent.model_confidence).toMatch(/^(high|medium|low)$/);
      expect(result.structuredContent.inputs_normalized).toBe(true);

      // Probabilities should sum to 1.00
      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should accept team abbreviations', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: 'KC',
        team_underdog: 'LV',
        spread: -3.5,
      });

      // Should work with abbreviations
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
    });

    it('should return JSON-only output', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: 'Eagles',
        team_underdog: 'Commanders',
        spread: -7,
      });

      // Content should be JSON string
      expect(result.content[0].text).toContain('favorite_cover_probability');
      expect(result.content[0].text).toContain('underdog_cover_probability');
      expect(result.content[0].text).toContain('model_confidence');
      expect(result.content[0].text).toContain('inputs_normalized');
    });
  });

  describe('input validation', () => {
    it('should reject missing favorite team name', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: '',
        team_underdog: 'Commanders',
        spread: -7,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('Favorite team name is required');
    });

    it('should reject missing underdog team name', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: 'Eagles',
        team_underdog: '',
        spread: -7,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('Underdog team name is required');
    });

    it('should reject missing spread', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: 'Eagles',
        team_underdog: 'Commanders',
        spread: NaN,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
    });

    it('should reject positive spread', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: 'Eagles',
        team_underdog: 'Commanders',
        spread: 7,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('negative');
    });

    it('should reject invalid team names', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: 'InvalidTeamXYZ',
        team_underdog: 'Commanders',
        spread: -7,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('team_not_found');
      expect(result.structuredContent.searchedTerm).toBe('InvalidTeamXYZ');
    });
  });

  describe('output format', () => {
    it('should match required schema exactly', async () => {
      const result = await toolHandler({
        sport: 'football',
        team_favorite: 'Eagles',
        team_underdog: 'Commanders',
        spread: -7,
      });

      expect(result.isError).toBeFalsy();

      const output = result.structuredContent;
      expect(output).toHaveProperty('favorite_cover_probability');
      expect(output).toHaveProperty('underdog_cover_probability');
      expect(output).toHaveProperty('model_confidence');
      expect(output).toHaveProperty('inputs_normalized');

      expect(typeof output.favorite_cover_probability).toBe('number');
      expect(typeof output.underdog_cover_probability).toBe('number');
      expect(typeof output.model_confidence).toBe('string');
      expect(output.inputs_normalized).toBe(true);
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
    it('should estimate probability for Knicks -5.5 vs Cavaliers', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'Knicks',
        team_underdog: 'Cavaliers',
        spread: -5.5,
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeGreaterThan(0);
      expect(result.structuredContent.favorite_cover_probability).toBeLessThan(1);
      expect(result.structuredContent.underdog_cover_probability).toBeGreaterThan(0);
      expect(result.structuredContent.underdog_cover_probability).toBeLessThan(1);
      expect(result.structuredContent.model_confidence).toMatch(/^(high|medium|low)$/);
      expect(result.structuredContent.inputs_normalized).toBe(true);

      // Probabilities should sum to 1.00
      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should estimate probability for Rockets -3.5 vs Lakers', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'Houston Rockets',
        team_underdog: 'Los Angeles Lakers',
        spread: -3.5,
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
      expect(result.structuredContent.underdog_cover_probability).toBeDefined();
      expect(result.structuredContent.model_confidence).toBeDefined();

      // Probabilities should sum to 1.00
      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(sum).toBeCloseTo(1.0, 2);
    });

    it('should accept team abbreviations', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'HOU',
        team_underdog: 'LAL',
        spread: -3.5,
      });

      // Should work with abbreviations
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
    });

    it('should return JSON-only output', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'Knicks',
        team_underdog: 'Cavaliers',
        spread: -5.5,
      });

      // Content should be JSON string
      expect(result.content[0].text).toContain('favorite_cover_probability');
      expect(result.content[0].text).toContain('underdog_cover_probability');
      expect(result.content[0].text).toContain('model_confidence');
      expect(result.content[0].text).toContain('inputs_normalized');
    });
  });

  describe('input validation', () => {
    it('should reject missing favorite team name', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: '',
        team_underdog: 'Cavaliers',
        spread: -5.5,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('Favorite team name is required');
    });

    it('should reject missing underdog team name', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'Knicks',
        team_underdog: '',
        spread: -5.5,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('Underdog team name is required');
    });

    it('should reject missing spread', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'Knicks',
        team_underdog: 'Cavaliers',
        spread: NaN,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
    });

    it('should reject positive spread', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'Knicks',
        team_underdog: 'Cavaliers',
        spread: 5.5,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('negative');
    });

    it('should reject invalid team names', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'InvalidTeamXYZ',
        team_underdog: 'Cavaliers',
        spread: -5.5,
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('team_not_found');
      expect(result.structuredContent.searchedTerm).toBe('InvalidTeamXYZ');
    });
  });

  describe('output format', () => {
    it('should match required schema exactly', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'Knicks',
        team_underdog: 'Cavaliers',
        spread: -5.5,
      });

      expect(result.isError).toBeFalsy();

      const output = result.structuredContent;
      expect(output).toHaveProperty('favorite_cover_probability');
      expect(output).toHaveProperty('underdog_cover_probability');
      expect(output).toHaveProperty('model_confidence');
      expect(output).toHaveProperty('inputs_normalized');

      expect(typeof output.favorite_cover_probability).toBe('number');
      expect(typeof output.underdog_cover_probability).toBe('number');
      expect(typeof output.model_confidence).toBe('string');
      expect(output.inputs_normalized).toBe(true);
    });

    it('should ensure probabilities sum to 1.00', async () => {
      const result = await toolHandler({
        sport: 'basketball',
        team_favorite: 'Rockets',
        team_underdog: 'Lakers',
        spread: -3.5,
      });

      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(sum).toBeCloseTo(1.0, 2);
    });
  });
});
