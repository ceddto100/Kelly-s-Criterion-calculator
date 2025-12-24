/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Integration tests for complete betting workflows
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerKellyTool } from '../../tools/kelly.js';
import { registerFootballProbabilityTool } from '../../tools/probabilityFootball.js';
import { registerBasketballProbabilityTool } from '../../tools/probabilityBasketball.js';
import { registerBankrollTools } from '../../tools/bankroll.js';
import { registerBetLoggerTool } from '../../tools/betLogger.js';

describe('End-to-End Betting Workflows', () => {
  let server: McpServer;
  let handlers: Record<string, any> = {};

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    // Capture all tool handlers
    const originalTool = server.tool.bind(server);
    vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
      handlers[name] = handler;
      return originalTool(name, config, handler);
    });

    // Register all tools
    registerKellyTool(server);
    registerFootballProbabilityTool(server);
    registerBasketballProbabilityTool(server);
    registerBankrollTools(server);
    registerBetLoggerTool(server);
  });

  describe('Football Betting Workflow', () => {
    it('should complete full football betting workflow', async () => {
      // Step 1: Check current bankroll
      const bankrollResult = await handlers['get-bankroll']({});
      expect(bankrollResult.structuredContent.bankroll).toBe(1000);
      const bankroll = bankrollResult.structuredContent.bankroll;

      // Step 2: Estimate probability for football game
      const probResult = await handlers['probability-estimate-football']({
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

      expect(probResult.structuredContent.probability).toBeGreaterThan(0);
      const probability = probResult.structuredContent.probability;

      // Step 3: Calculate Kelly stake
      const kellyResult = await handlers['kelly-calculate']({
        bankroll: bankroll,
        odds: -110,
        probability: probability,
        fraction: '0.5', // Half Kelly for safety
      });

      expect(kellyResult.structuredContent).toBeDefined();
      const recommendedStake = kellyResult.structuredContent.stake;

      // Step 4: Log the bet
      const logResult = await handlers['log-bet']({
        sport: 'football',
        teamA: 'Team A',
        teamB: 'Team B',
        spread: -3.5,
        probability: probability,
        odds: -110,
        bankroll: bankroll,
        recommendedStake: recommendedStake,
        actualWager: Math.min(recommendedStake, bankroll * 0.05), // Cap at 5% of bankroll
        notes: 'Test bet',
      });

      expect(logResult.structuredContent.betId).toBeDefined();
      expect(logResult.isError).toBeFalsy();

      // Step 5: Verify bet history
      const historyResult = await handlers['get-bet-history']({ limit: 10 });
      expect(historyResult.structuredContent.bets.length).toBeGreaterThan(0);
      expect(historyResult.structuredContent.bets[0].sport).toBe('football');
    });

    it('should handle no-value bet scenario', async () => {
      // Get bankroll
      const bankrollResult = await handlers['get-bankroll']({});
      const bankroll = bankrollResult.structuredContent.bankroll;

      // Estimate probability (should be low for bad matchup)
      const probResult = await handlers['probability-estimate-football']({
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

      const probability = probResult.structuredContent.probability;
      expect(probability).toBeLessThan(50);

      // Calculate Kelly (should show no value)
      const kellyResult = await handlers['kelly-calculate']({
        bankroll: bankroll,
        odds: -110,
        probability: probability,
        fraction: '1',
      });

      expect(kellyResult.structuredContent.hasValue).toBe(false);
      expect(kellyResult.structuredContent.stake).toBe(0);
    });
  });

  describe('Basketball Betting Workflow', () => {
    it('should complete full basketball betting workflow', async () => {
      // Step 1: Set custom bankroll
      await handlers['set-bankroll']({
        amount: 5000,
        reason: 'Basketball season starting bankroll',
      });

      const bankrollResult = await handlers['get-bankroll']({});
      expect(bankrollResult.structuredContent.bankroll).toBe(5000);

      // Step 2: Estimate basketball probability
      const probResult = await handlers['probability-estimate-basketball']({
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

      const probability = probResult.structuredContent.probability;

      // Step 3: Calculate Kelly with quarter Kelly for conservative approach
      const kellyResult = await handlers['kelly-calculate']({
        bankroll: 5000,
        odds: +150,
        probability: probability,
        fraction: '0.25',
      });

      const recommendedStake = kellyResult.structuredContent.stake;

      // Step 4: Log bet
      const logResult = await handlers['log-bet']({
        sport: 'basketball',
        teamA: 'Lakers',
        teamB: 'Warriors',
        spread: -4.5,
        probability: probability,
        odds: +150,
        bankroll: 5000,
        recommendedStake: recommendedStake,
        actualWager: recommendedStake,
        notes: 'Quarter Kelly bet',
      });

      expect(logResult.structuredContent.betId).toBeDefined();
      expect(logResult.structuredContent.edge).toBeDefined();
    });
  });

  describe('Bankroll Management Workflow', () => {
    it('should track bankroll through wins and losses', async () => {
      // Initial bankroll
      await handlers['set-bankroll']({ amount: 1000, reason: 'Starting' });

      // Place and win a bet
      const winAmount = 100;
      await handlers['adjust-bankroll']({
        adjustment: winAmount,
        reason: 'Bet won',
      });

      let bankroll = await handlers['get-bankroll']({});
      expect(bankroll.structuredContent.bankroll).toBe(1100);

      // Place and lose a bet
      await handlers['adjust-bankroll']({
        adjustment: -50,
        reason: 'Bet lost',
      });

      bankroll = await handlers['get-bankroll']({});
      expect(bankroll.structuredContent.bankroll).toBe(1050);

      // Check history shows all changes
      const history = await handlers['get-bankroll-history']({ limit: 10 });
      expect(history.structuredContent.totalEntries).toBeGreaterThan(2);
      expect(history.content[0].text).toContain('Net Change');
    });

    it('should prevent bankroll from going negative', async () => {
      await handlers['set-bankroll']({ amount: 100, reason: 'Low bankroll' });

      const result = await handlers['adjust-bankroll']({
        adjustment: -200,
        reason: 'Trying to lose too much',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('insufficient_funds');

      // Verify bankroll didn't change
      const bankroll = await handlers['get-bankroll']({});
      expect(bankroll.structuredContent.bankroll).toBe(100);
    });
  });

  describe('Bet Outcome Tracking', () => {
    it('should track bet from placement to outcome', async () => {
      // Place bet
      const logResult = await handlers['log-bet']({
        sport: 'football',
        teamA: 'Team A',
        teamB: 'Team B',
        spread: -7,
        probability: 60,
        odds: -110,
        bankroll: 1000,
        recommendedStake: 50,
        actualWager: 50,
        notes: 'Tracking test',
      });

      const betId = logResult.structuredContent.betId;
      expect(betId).toBeDefined();

      // Update outcome to win
      const updateResult = await handlers['update-bet-outcome']({
        betId: betId,
        outcome: 'win',
      });

      expect(updateResult.structuredContent.outcome).toBe('win');
      expect(updateResult.structuredContent.profit).toBeGreaterThan(0);
      expect(updateResult.isError).toBeFalsy();

      // Verify in history
      const history = await handlers['get-bet-history']({ limit: 10 });
      const bet = history.structuredContent.bets.find((b: any) => b.id === betId);
      expect(bet.outcome).toBe('win');
    });

    it('should calculate correct profit for loss', async () => {
      const logResult = await handlers['log-bet']({
        sport: 'basketball',
        teamA: 'Team C',
        teamB: 'Team D',
        spread: -3.5,
        probability: 55,
        odds: -110,
        bankroll: 1000,
        recommendedStake: 30,
        actualWager: 30,
        notes: 'Loss test',
      });

      const updateResult = await handlers['update-bet-outcome']({
        betId: logResult.structuredContent.betId,
        outcome: 'loss',
      });

      expect(updateResult.structuredContent.profit).toBe(-30);
    });

    it('should handle push with zero profit', async () => {
      const logResult = await handlers['log-bet']({
        sport: 'football',
        teamA: 'Team E',
        teamB: 'Team F',
        spread: -3,
        probability: 52,
        odds: -110,
        bankroll: 1000,
        recommendedStake: 40,
        actualWager: 40,
        notes: 'Push test',
      });

      const updateResult = await handlers['update-bet-outcome']({
        betId: logResult.structuredContent.betId,
        outcome: 'push',
      });

      expect(updateResult.structuredContent.profit).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid tool inputs gracefully', async () => {
      const kellyResult = await handlers['kelly-calculate']({
        bankroll: -1000,
        odds: -110,
        probability: 55,
        fraction: '1',
      });

      expect(kellyResult.isError).toBe(true);
    });

    it('should handle missing required fields', async () => {
      const logResult = await handlers['log-bet']({
        sport: 'football',
        // Missing teamA
        teamB: 'Team B',
        spread: -7,
        probability: 60,
        odds: -110,
        bankroll: 1000,
        recommendedStake: 50,
        actualWager: 50,
      });

      expect(logResult.isError).toBe(true);
    });
  });
});
