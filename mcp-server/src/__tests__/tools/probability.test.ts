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

  describe('canonical field names', () => {
    it('should estimate probability with team_favorite and team_underdog', async () => {
      const result = await toolHandler({
        team_favorite: 'Dallas Cowboys',
        team_underdog: 'New York Giants',
        spread: -6.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeGreaterThan(0);
      expect(result.structuredContent.favorite_cover_probability).toBeLessThan(1);
      expect(result.structuredContent.underdog_cover_probability).toBeGreaterThan(0);
      expect(result.structuredContent.underdog_cover_probability).toBeLessThan(1);
      expect(result.structuredContent.inputs).toBeDefined();
      expect(result.structuredContent.normalized).toBeDefined();

      // Probabilities must sum to 1.0
      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    it('should accept abbreviations', async () => {
      const result = await toolHandler({
        team_favorite: 'DAL',
        team_underdog: 'NYG',
        spread: -6.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
      expect(result.structuredContent.inputs.team_favorite).toBe('DAL');
      expect(result.structuredContent.inputs.team_underdog).toBe('NYG');
      expect(result.structuredContent.normalized.team_favorite).toContain('Dallas');
      expect(result.structuredContent.normalized.team_underdog).toContain('Giants');
    });
  });

  describe('alias field names', () => {
    it('should accept favorite_team and underdog_team aliases', async () => {
      const result = await toolHandler({
        favorite_team: 'Eagles',
        underdog_team: 'Commanders',
        spread: -7
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();

      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    it('should accept favorite and underdog aliases', async () => {
      const result = await toolHandler({
        favorite: 'Kansas City Chiefs',
        underdog: 'Las Vegas Raiders',
        spread: -10.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
    });

    it('should accept fav and dog aliases', async () => {
      const result = await toolHandler({
        fav: 'KC',
        dog: 'LV',
        spread: -10.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
    });
  });

  describe('output schema', () => {
    it('should match required output schema', async () => {
      const result = await toolHandler({
        team_favorite: 'Eagles',
        team_underdog: 'Commanders',
        spread: -7
      });

      expect(result.isError).toBeFalsy();

      const output = result.structuredContent;
      expect(output).toHaveProperty('favorite_cover_probability');
      expect(output).toHaveProperty('underdog_cover_probability');
      expect(output).toHaveProperty('inputs');
      expect(output).toHaveProperty('normalized');

      expect(output.inputs.team_favorite).toBe('Eagles');
      expect(output.inputs.team_underdog).toBe('Commanders');
      expect(output.inputs.spread).toBe(-7);

      expect(typeof output.normalized.team_favorite).toBe('string');
      expect(typeof output.normalized.team_underdog).toBe('string');

      // Probabilities sum to 1.0
      const sum = output.favorite_cover_probability + output.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });
  });

  describe('input validation', () => {
    it('should reject missing team_favorite', async () => {
      const result = await toolHandler({
        team_underdog: 'Commanders',
        spread: -7
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('team_favorite');
      expect(result.structuredContent.missing_fields).toBeDefined();
    });

    it('should reject missing team_underdog', async () => {
      const result = await toolHandler({
        team_favorite: 'Eagles',
        spread: -7
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('team_underdog');
    });

    it('should auto-convert positive spread to negative', async () => {
      const result = await toolHandler({
        team_favorite: 'Eagles',
        team_underdog: 'Commanders',
        spread: 7
      });

      // Positive spread should be auto-converted to -7
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent.inputs.spread).toBe(7);
      expect(result.structuredContent.inputs.spread_normalized).toBe(-7);
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
    });

    it('should provide suggestions for unknown teams', async () => {
      const result = await toolHandler({
        team_favorite: 'InvalidTeamXYZ',
        team_underdog: 'Commanders',
        spread: -7
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('Unknown team name');
      expect(result.structuredContent.team_searched).toBe('InvalidTeamXYZ');
      expect(result.structuredContent.suggestions).toBeDefined();
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

  describe('canonical field names', () => {
    it('should estimate probability for Houston Rockets vs Los Angeles Lakers', async () => {
      const result = await toolHandler({
        team_favorite: 'Houston Rockets',
        team_underdog: 'Los Angeles Lakers',
        spread: -3.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeGreaterThan(0);
      expect(result.structuredContent.favorite_cover_probability).toBeLessThan(1);
      expect(result.structuredContent.underdog_cover_probability).toBeGreaterThan(0);
      expect(result.structuredContent.underdog_cover_probability).toBeLessThan(1);
      expect(result.structuredContent.inputs).toBeDefined();
      expect(result.structuredContent.normalized).toBeDefined();

      // Probabilities must sum to 1.0
      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    it('should accept abbreviations HOU vs LAL', async () => {
      const result = await toolHandler({
        team_favorite: 'HOU',
        team_underdog: 'LAL',
        spread: -3.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
      expect(result.structuredContent.inputs.team_favorite).toBe('HOU');
      expect(result.structuredContent.inputs.team_underdog).toBe('LAL');
      expect(result.structuredContent.normalized.team_favorite).toContain('Rockets');
      expect(result.structuredContent.normalized.team_underdog).toContain('Lakers');
    });

    it('should estimate probability for Knicks vs Cavaliers', async () => {
      const result = await toolHandler({
        team_favorite: 'Knicks',
        team_underdog: 'Cavaliers',
        spread: -5.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();

      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });
  });

  describe('alias field names', () => {
    it('should accept favorite_team and underdog_team aliases', async () => {
      const result = await toolHandler({
        favorite_team: 'Rockets',
        underdog_team: 'Lakers',
        spread: -3.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();

      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    it('should accept favorite and underdog aliases', async () => {
      const result = await toolHandler({
        favorite: 'Houston Rockets',
        underdog: 'Los Angeles Lakers',
        spread: -3.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
    });

    it('should accept fav and dog aliases', async () => {
      const result = await toolHandler({
        fav: 'HOU',
        dog: 'LAL',
        spread: -3.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
    });
  });

  describe('output schema', () => {
    it('should match required output schema', async () => {
      const result = await toolHandler({
        team_favorite: 'Knicks',
        team_underdog: 'Cavaliers',
        spread: -5.5
      });

      expect(result.isError).toBeFalsy();

      const output = result.structuredContent;
      expect(output).toHaveProperty('favorite_cover_probability');
      expect(output).toHaveProperty('underdog_cover_probability');
      expect(output).toHaveProperty('inputs');
      expect(output).toHaveProperty('normalized');

      expect(output.inputs.team_favorite).toBe('Knicks');
      expect(output.inputs.team_underdog).toBe('Cavaliers');
      expect(output.inputs.spread).toBe(-5.5);

      expect(typeof output.normalized.team_favorite).toBe('string');
      expect(typeof output.normalized.team_underdog).toBe('string');

      // Probabilities sum to 1.0
      const sum = output.favorite_cover_probability + output.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });

    it('should ensure probabilities sum to exactly 1.00', async () => {
      const result = await toolHandler({
        team_favorite: 'Rockets',
        team_underdog: 'Lakers',
        spread: -3.5
      });

      const sum = result.structuredContent.favorite_cover_probability +
                  result.structuredContent.underdog_cover_probability;
      expect(Math.abs(sum - 1.0)).toBeLessThan(1e-6);
    });
  });

  describe('input validation', () => {
    it('should reject missing team_favorite', async () => {
      const result = await toolHandler({
        team_underdog: 'Cavaliers',
        spread: -5.5
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('team_favorite');
      expect(result.structuredContent.missing_fields).toBeDefined();
    });

    it('should reject missing team_underdog', async () => {
      const result = await toolHandler({
        team_favorite: 'Knicks',
        spread: -5.5
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('team_underdog');
    });

    it('should auto-convert positive spread to negative', async () => {
      const result = await toolHandler({
        team_favorite: 'Knicks',
        team_underdog: 'Cavaliers',
        spread: 5.5
      });

      // Positive spread should be auto-converted to -5.5
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent.inputs.spread).toBe(5.5);
      expect(result.structuredContent.inputs.spread_normalized).toBe(-5.5);
      expect(result.structuredContent.favorite_cover_probability).toBeDefined();
    });

    it('should provide suggestions for unknown teams', async () => {
      const result = await toolHandler({
        team_favorite: 'InvalidTeamXYZ',
        team_underdog: 'Cavaliers',
        spread: -5.5
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('Unknown team name');
      expect(result.structuredContent.team_searched).toBe('InvalidTeamXYZ');
      expect(result.structuredContent.suggestions).toBeDefined();
    });
  });
});
