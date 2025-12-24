/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests for bankroll management tools
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBankrollTools } from '../../tools/bankroll.js';

describe('Bankroll Management Tools', () => {
  let server: McpServer;
  let getBankrollHandler: any;
  let setBankrollHandler: any;
  let adjustBankrollHandler: any;
  let getHistoryHandler: any;

  beforeEach(() => {
    server = new McpServer({
      name: 'test-server',
      version: '1.0.0',
    });

    const originalTool = server.tool.bind(server);
    vi.spyOn(server, 'tool').mockImplementation((name, config, handler) => {
      if (name === 'get-bankroll') getBankrollHandler = handler;
      if (name === 'set-bankroll') setBankrollHandler = handler;
      if (name === 'adjust-bankroll') adjustBankrollHandler = handler;
      if (name === 'get-bankroll-history') getHistoryHandler = handler;
      return originalTool(name, config, handler);
    });

    registerBankrollTools(server);
  });

  describe('get-bankroll', () => {
    it('should return default bankroll of 1000', async () => {
      const result = await getBankrollHandler({});

      expect(result.structuredContent.bankroll).toBe(1000);
      expect(result.structuredContent.currency).toBe('USD');
      expect(result.structuredContent.lastUpdated).toBeDefined();
    });

    it('should include formatted text', async () => {
      const result = await getBankrollHandler({});

      expect(result.content[0].text).toContain('$1,000.00');
    });
  });

  describe('set-bankroll', () => {
    it('should set new bankroll amount', async () => {
      const setResult = await setBankrollHandler({
        amount: 2500,
        reason: 'Deposit',
      });

      expect(setResult.structuredContent.bankroll).toBe(2500);
      expect(setResult.structuredContent.previousAmount).toBe(1000);
      expect(setResult.structuredContent.change).toBe(1500);

      // Verify it persists
      const getResult = await getBankrollHandler({});
      expect(getResult.structuredContent.bankroll).toBe(2500);
    });

    it('should reject zero bankroll', async () => {
      const result = await setBankrollHandler({
        amount: 0,
        reason: 'Test',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_amount');
    });

    it('should reject negative bankroll', async () => {
      const result = await setBankrollHandler({
        amount: -100,
        reason: 'Test',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('invalid_amount');
    });

    it('should track history', async () => {
      await setBankrollHandler({ amount: 1500, reason: 'First deposit' });
      await setBankrollHandler({ amount: 2000, reason: 'Second deposit' });

      const history = await getHistoryHandler({ limit: 10 });
      expect(history.structuredContent.history.length).toBeGreaterThan(1);
    });

    it('should use default reason if not provided', async () => {
      const result = await setBankrollHandler({
        amount: 1500,
      });

      expect(result.structuredContent.reason).toBe('Manual update');
    });
  });

  describe('adjust-bankroll', () => {
    it('should add to bankroll with positive adjustment', async () => {
      const result = await adjustBankrollHandler({
        adjustment: 500,
        reason: 'Won bet',
      });

      expect(result.structuredContent.bankroll).toBe(1500);
      expect(result.structuredContent.previousAmount).toBe(1000);
      expect(result.structuredContent.adjustment).toBe(500);
    });

    it('should subtract from bankroll with negative adjustment', async () => {
      const result = await adjustBankrollHandler({
        adjustment: -200,
        reason: 'Lost bet',
      });

      expect(result.structuredContent.bankroll).toBe(800);
      expect(result.structuredContent.adjustment).toBe(-200);
    });

    it('should reject adjustment resulting in negative bankroll', async () => {
      const result = await adjustBankrollHandler({
        adjustment: -1500,
        reason: 'Too much',
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent.error).toBe('insufficient_funds');
      expect(result.structuredContent.currentBankroll).toBe(1000);
    });

    it('should allow adjustment to exactly zero', async () => {
      const result = await adjustBankrollHandler({
        adjustment: -1000,
        reason: 'Withdrawal',
      });

      expect(result.isError).toBe(false);
      expect(result.structuredContent.bankroll).toBe(0);
    });

    it('should use default reason based on sign', async () => {
      const positiveResult = await adjustBankrollHandler({
        adjustment: 100,
      });
      expect(positiveResult.structuredContent.reason).toBe('Deposit');

      const negativeResult = await adjustBankrollHandler({
        adjustment: -50,
      });
      expect(negativeResult.structuredContent.reason).toBe('Withdrawal');
    });
  });

  describe('get-bankroll-history', () => {
    it('should return history with initial entry', async () => {
      const result = await getHistoryHandler({ limit: 10 });

      expect(result.structuredContent.currentBankroll).toBe(1000);
      expect(result.structuredContent.history.length).toBeGreaterThan(0);
      expect(result.structuredContent.totalEntries).toBeGreaterThan(0);
    });

    it('should limit results to specified limit', async () => {
      // Add multiple entries
      await adjustBankrollHandler({ adjustment: 100, reason: 'Entry 1' });
      await adjustBankrollHandler({ adjustment: 100, reason: 'Entry 2' });
      await adjustBankrollHandler({ adjustment: 100, reason: 'Entry 3' });

      const result = await getHistoryHandler({ limit: 2 });

      expect(result.structuredContent.history.length).toBeLessThanOrEqual(2);
    });

    it('should show most recent entries first', async () => {
      await adjustBankrollHandler({ adjustment: 100, reason: 'First' });
      await adjustBankrollHandler({ adjustment: 200, reason: 'Second' });

      const result = await getHistoryHandler({ limit: 10 });

      // Most recent should have highest amount
      expect(result.structuredContent.history[0].amount).toBeGreaterThan(
        result.structuredContent.history[result.structuredContent.history.length - 1].amount
      );
    });

    it('should include performance stats when multiple entries', async () => {
      await setBankrollHandler({ amount: 1500, reason: 'Increase' });

      const result = await getHistoryHandler({ limit: 10 });

      expect(result.content[0].text).toContain('Performance');
      expect(result.content[0].text).toContain('Starting Bankroll');
      expect(result.content[0].text).toContain('Net Change');
    });
  });

  describe('workflow integration', () => {
    it('should track complete bankroll lifecycle', async () => {
      // Initial bankroll
      const initial = await getBankrollHandler({});
      expect(initial.structuredContent.bankroll).toBe(1000);

      // Set new bankroll
      await setBankrollHandler({ amount: 2000, reason: 'Initial deposit' });

      // Win a bet
      await adjustBankrollHandler({ adjustment: 150, reason: 'Bet won' });

      // Lose a bet
      await adjustBankrollHandler({ adjustment: -100, reason: 'Bet lost' });

      // Check final amount
      const final = await getBankrollHandler({});
      expect(final.structuredContent.bankroll).toBe(2050);

      // Check history
      const history = await getHistoryHandler({ limit: 10 });
      expect(history.structuredContent.totalEntries).toBeGreaterThan(3);
    });
  });
});
