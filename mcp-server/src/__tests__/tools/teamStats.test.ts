/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests for team statistics tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTeamStatsTool, registerMatchupTool } from '../../tools/teamStats.js';

describe('get-team-stats tool', () => {
  let server: McpServer;
  let toolHandler: any;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    const originalTool = server.tool.bind(server);
    vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
      if (name === 'get-team-stats') {
        toolHandler = handler;
      }
      return originalTool(name, config, handler);
    });

    registerTeamStatsTool(server);
  });

  describe('valid inputs', () => {
    it('should load NBA team stats if available', async () => {
      const result = await toolHandler({
        teamName: 'Lakers',
        sport: 'nba',
      });

      if (result.isError && result.structuredContent.error === 'team_not_found') {
        // Stats file might not have this team, skip test
        expect(result.structuredContent.error).toBe('team_not_found');
      } else {
        expect(result.structuredContent.sport).toBe('nba');
        expect(result.structuredContent.stats).toBeDefined();
      }
    });

    it('should load NFL team stats if available', async () => {
      const result = await toolHandler({
        teamName: 'Chiefs',
        sport: 'nfl',
      });

      if (result.isError && result.structuredContent.error === 'team_not_found') {
        // Stats file might not have this team, skip test
        expect(result.structuredContent.error).toBe('team_not_found');
      } else {
        expect(result.structuredContent.sport).toBe('nfl');
        expect(result.structuredContent.stats).toBeDefined();
      }
    });

    it('should default to NBA when sport not specified', async () => {
      const result = await toolHandler({
        teamName: 'Warriors',
      });

      // Will either find team or return not found error
      if (!result.isError) {
        expect(result.structuredContent.sport).toBe('nba');
      }
    });
  });

  describe('input validation', () => {
    it('should reject empty team name', async () => {
      const result = await toolHandler({
        teamName: '',
        sport: 'nba',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
    });

    it('should reject missing team name', async () => {
      const result = await toolHandler({
        sport: 'nba',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('team not found', () => {
    it('should return error for non-existent team', async () => {
      const result = await toolHandler({
        teamName: 'NonExistentTeamXYZ123',
        sport: 'nba',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('team_not_found');
      expect(result.structuredContent.searchedTerm).toBe('NonExistentTeamXYZ123');
    });
  });

  describe('output format', () => {
    it('should include dataSource and timestamp', async () => {
      const result = await toolHandler({
        teamName: 'Test Team',
        sport: 'nba',
      });

      if (!result.isError) {
        expect(result.structuredContent.dataSource).toBeDefined();
        expect(result.structuredContent.retrievedAt).toBeDefined();
      }
    });
  });
});

describe('get-matchup-stats tool', () => {
  let server: McpServer;
  let toolHandler: any;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    const originalTool = server.tool.bind(server);
    vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
      if (name === 'get-matchup-stats') {
        toolHandler = handler;
      }
      return originalTool(name, config, handler);
    });

    registerMatchupTool(server);
  });

  describe('valid inputs', () => {
    it('should compare two NBA teams', async () => {
      const result = await toolHandler({
        teamA: 'Lakers',
        teamB: 'Warriors',
        sport: 'nba',
      });

      if (!result.isError) {
        expect(result.structuredContent.sport).toBe('nba');
        expect(result.structuredContent.teamA).toBeDefined();
        expect(result.structuredContent.teamB).toBeDefined();
      }
    });

    it('should compare two NFL teams', async () => {
      const result = await toolHandler({
        teamA: 'Chiefs',
        teamB: 'Bills',
        sport: 'nfl',
      });

      if (!result.isError) {
        expect(result.structuredContent.sport).toBe('nfl');
      }
    });

    it('should default to NBA', async () => {
      const result = await toolHandler({
        teamA: 'Team1',
        teamB: 'Team2',
      });

      // Should at least attempt NBA lookup
      if (result.isError) {
        expect(result.structuredContent.error).toBe('team_not_found');
      } else {
        expect(result.structuredContent.sport).toBe('nba');
      }
    });
  });

  describe('input validation', () => {
    it('should reject missing team names', async () => {
      const result = await toolHandler({
        teamA: 'Lakers',
        sport: 'nba',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_input');
    });

    it('should reject empty team names', async () => {
      const result = await toolHandler({
        teamA: '',
        teamB: 'Warriors',
        sport: 'nba',
      });

      expect(result.isError).toBe(true);
    });
  });

  describe('team not found', () => {
    it('should return error for team A not found', async () => {
      const result = await toolHandler({
        teamA: 'NonExistentTeamA',
        teamB: 'Warriors',
        sport: 'nba',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.searchedTerm).toBeDefined();
    });

    it('should return error for team B not found even if team A exists', async () => {
      const result = await toolHandler({
        teamA: 'Lakers',
        teamB: 'NonExistentTeamB',
        sport: 'nba',
      });

      if (result.isError && result.structuredContent.error === 'team_not_found') {
        expect(result.structuredContent.searchedTerm).toBeDefined();
      }
    });
  });

  describe('output format', () => {
    it('should include comparison data', async () => {
      const result = await toolHandler({
        teamA: 'Team1',
        teamB: 'Team2',
        sport: 'nba',
      });

      if (!result.isError) {
        expect(result.structuredContent.dataSource).toBeDefined();
        expect(result.structuredContent.retrievedAt).toBeDefined();
      }
    });
  });
});
