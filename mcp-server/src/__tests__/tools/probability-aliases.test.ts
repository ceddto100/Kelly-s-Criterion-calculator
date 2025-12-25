/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBasketballProbabilityTool } from '../../tools/probabilityBasketball.js';
import { registerFootballProbabilityTool } from '../../tools/probabilityFootball.js';

describe('probability tools input normalization', () => {
  describe('basketball normalization', () => {
    let basketballHandler: any;

    beforeEach(() => {
      const server = new McpServer({ name: 'test', version: '1.0.0' });
      const originalTool = server.tool.bind(server);

      vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
        if (name === 'probability-estimate-basketball') {
          basketballHandler = handler;
        }
        return originalTool(name, config, handler);
      });

      registerBasketballProbabilityTool(server);
    });

    it('accepts canonical fields with spread as string', async () => {
      const result = await basketballHandler({
        team_favorite: 'Houston Rockets',
        team_underdog: 'Los Angeles Lakers',
        spread: '-3.5'
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.inputs.spread).toBeCloseTo(-3.5);
    });

    it('accepts fav and dog aliases', async () => {
      const result = await basketballHandler({
        fav: 'HOU',
        dog: 'LAL',
        spread: -3.5
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.inputs.team_favorite).toBe('HOU');
      expect(result.structuredContent.inputs.team_underdog).toBe('LAL');
    });

    it('parses JSON string arguments', async () => {
      const jsonArgs = JSON.stringify({
        team_favorite: 'Rockets',
        team_underdog: 'Lakers',
        spread: '-4.5'
      });

      const result = await basketballHandler(jsonArgs);

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.inputs.team_favorite).toBe('Rockets');
      expect(result.structuredContent.inputs.team_underdog).toBe('Lakers');
      expect(result.structuredContent.inputs.spread).toBeCloseTo(-4.5);
    });
  });

  describe('football normalization', () => {
    let footballHandler: any;

    beforeEach(() => {
      const server = new McpServer({ name: 'test', version: '1.0.0' });
      const originalTool = server.tool.bind(server);

      vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
        if (name === 'probability-estimate-football') {
          footballHandler = handler;
        }
        return originalTool(name, config, handler);
      });

      registerFootballProbabilityTool(server);
    });

    it('accepts favorite and underdog aliases', async () => {
      const result = await footballHandler({
        favorite: 'Dallas Cowboys',
        underdog: 'New York Giants',
        spread: -7
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.inputs.team_favorite).toBe('Dallas Cowboys');
      expect(result.structuredContent.inputs.team_underdog).toBe('New York Giants');
    });

    it('accepts fav and dog aliases with string spread', async () => {
      const result = await footballHandler({
        fav: 'DAL',
        dog: 'NYG',
        spread: '-6.5'
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent.inputs.spread).toBeCloseTo(-6.5);
    });

    it('returns helpful error when fields are missing', async () => {
      const result = await footballHandler({});

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
      expect(result.structuredContent.message).toContain('team_favorite');
      expect(result.structuredContent.message).toContain('team_underdog');
      expect(result.structuredContent.message).toContain('spread');
    });
  });
});

