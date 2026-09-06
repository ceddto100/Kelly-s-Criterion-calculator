/**
 * Unit Tests for Orchestration Tool
 *
 * Tests for the end-to-end betting workflow orchestration,
 * including probability estimation, Kelly calculation, and result formatting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOrchestration, orchestrationInputSchema } from '../tools/orchestration.js';

// Mock database connection
vi.mock('../config/database.js', () => ({
  isDatabaseConnected: () => false
}));

// ============================================================================
// INPUT VALIDATION TESTS
// ============================================================================

describe('Orchestration Input Validation', () => {
  it('should validate correct input', () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      bankroll: 1000,
      americanOdds: -110,
      kellyFraction: 0.5
    };

    const result = orchestrationInputSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should reject too short userText', () => {
    const input = {
      userText: 'short'
    };

    const result = orchestrationInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should apply default values', () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks'
    };

    const result = orchestrationInputSchema.parse(input);
    expect(result.kellyFraction).toBe(0.5);
    expect(result.logBet).toBe(true);
  });

  it('should validate Kelly fraction range', () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      kellyFraction: 1.5 // Invalid - too high
    };

    const result = orchestrationInputSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// ORCHESTRATION HANDLER TESTS
// ============================================================================

describe('Orchestration Handler', () => {
  it('should successfully process NBA betting request', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks, game in Atlanta',
      bankroll: 1000,
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.success).toBe(true);
    expect(result.workflow.step1_parsing.success).toBe(true);
    expect(result.workflow.step1_parsing.sport).toBe('NBA');
    expect(result.workflow.step1_parsing.pick).toBe('Hawks');
    expect(result.workflow.step1_parsing.spread).toBe(-3.5);
    expect(result.workflow.step1_parsing.venue).toBe('home');
  });

  it('should successfully process NFL betting request', async () => {
    const input = {
      userText: 'NFL: Cowboys vs Eagles, Eagles +2.5, taking Eagles, Philly at home',
      bankroll: 5000,
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.success).toBe(true);
    expect(result.workflow.step1_parsing.sport).toBe('NFL');
    expect(result.workflow.step1_parsing.pick).toBe('Eagles');
    expect(result.workflow.step1_parsing.spread).toBe(2.5);
  });

  it('should estimate probability correctly', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.workflow.step2_probability.success).toBe(true);
    expect(result.workflow.step2_probability.coverProbability).toBeGreaterThan(0);
    expect(result.workflow.step2_probability.coverProbability).toBeLessThan(100);
    expect(result.workflow.step2_probability.interpretation).toBeDefined();
  });

  it('should calculate Kelly correctly', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      bankroll: 1000,
      americanOdds: -110,
      kellyFraction: 0.5,
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.workflow.step4_kelly.success).toBe(true);
    expect(result.workflow.step4_kelly.recommendedStake).toBeGreaterThanOrEqual(0);
    expect(result.workflow.step4_kelly.stakePercentage).toBeGreaterThanOrEqual(0);
    expect(result.workflow.step4_kelly.recommendation).toBeDefined();
  });

  it('should use default odds when not provided', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.workflow.step3_odds.americanOdds).toBe(-110);
    expect(result.workflow.step3_odds.oddsAssumed).toBe(true);
    expect(result.assumptions).toContain('Odds assumed as -110 (standard juice)');
  });

  it('should track assumptions made', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.assumptions).toBeInstanceOf(Array);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it('should generate human-readable summary', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.summary.human).toBeDefined();
    expect(result.summary.human).toContain('Hawks');
    expect(result.summary.human).toContain('Heat');
    expect(result.summary.human).toContain('Probability');
    expect(result.summary.human).toContain('Kelly');
  });

  it('should include structured data in summary', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      bankroll: 2000,
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.summary.data.sport).toBe('NBA');
    expect(result.summary.data.pick).toBe('Hawks');
    expect(result.summary.data.spread).toBe(-3.5);
    expect(result.summary.data.bankroll).toBe(2000);
    expect(result.summary.data.coverProbability).toBeDefined();
    expect(result.summary.data.recommendedStake).toBeDefined();
  });

  it('should preserve raw input for traceability', async () => {
    const userText = 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks';
    const input = {
      userText,
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.rawInput).toBe(userText);
  });
});

// ============================================================================
// EDGE CASES
// ============================================================================

describe('Edge Cases', () => {
  it('should handle underdog picks correctly', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Heat',
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.success).toBe(true);
    expect(result.workflow.step1_parsing.pick).toBe('Heat');
    // Heat is underdog so spread should be positive
    expect(result.workflow.step1_parsing.spread).toBe(3.5);
  });

  it('should handle neutral venue', async () => {
    const input = {
      userText: 'NFL: Cowboys vs Eagles, Eagles +3, taking Eagles, neutral site',
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.workflow.step1_parsing.venue).toBe('neutral');
    expect(result.workflow.step1_parsing.venueAssumed).toBe(false);
  });

  it('should handle custom team stats', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      teamAStats: {
        ppg: 120,
        pointsAllowed: 105
      },
      teamBStats: {
        ppg: 108,
        pointsAllowed: 115
      },
      logBet: false
    };

    const result = await handleOrchestration(input);

    expect(result.success).toBe(true);
    // With better stats for Hawks, probability should be higher
    expect(result.workflow.step2_probability.coverProbability).toBeGreaterThan(40);
  });

  it('should handle different Kelly fractions', async () => {
    // Use custom stats to ensure there's positive value
    const baseInput = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      bankroll: 1000,
      logBet: false,
      teamAStats: {
        ppg: 120,
        pointsAllowed: 100
      },
      teamBStats: {
        ppg: 100,
        pointsAllowed: 120
      }
    };

    const fullKelly = await handleOrchestration({ ...baseInput, kellyFraction: 1.0 });
    const halfKelly = await handleOrchestration({ ...baseInput, kellyFraction: 0.5 });
    const quarterKelly = await handleOrchestration({ ...baseInput, kellyFraction: 0.25 });

    // When there's value, fractions should affect the result
    // If full Kelly has value > 0, half Kelly should be less
    if (fullKelly.workflow.step4_kelly.hasValue) {
      expect(halfKelly.workflow.step4_kelly.adjustedKellyFraction).toBeLessThan(
        fullKelly.workflow.step4_kelly.adjustedKellyFraction
      );
      expect(quarterKelly.workflow.step4_kelly.adjustedKellyFraction).toBeLessThan(
        halfKelly.workflow.step4_kelly.adjustedKellyFraction
      );
    } else {
      // No value, all should be 0
      expect(fullKelly.workflow.step4_kelly.adjustedKellyFraction).toBe(0);
      expect(halfKelly.workflow.step4_kelly.adjustedKellyFraction).toBe(0);
      expect(quarterKelly.workflow.step4_kelly.adjustedKellyFraction).toBe(0);
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe('Error Handling', () => {
  it('should throw error for invalid team names', async () => {
    const input = {
      userText: 'XYZ Team vs ABC Team, -3.5, taking XYZ',
      logBet: false
    };

    await expect(handleOrchestration(input)).rejects.toThrow();
  });

  it('should throw error for missing spread', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, taking Hawks',
      logBet: false
    };

    await expect(handleOrchestration(input)).rejects.toThrow();
  });

  it('should handle database unavailable gracefully', async () => {
    const input = {
      userText: 'NBA: Heat vs Hawks, Hawks -3.5, taking Hawks',
      logBet: true // Try to log but DB is mocked as unavailable
    };

    const result = await handleOrchestration(input);

    // Should still succeed overall
    expect(result.success).toBe(true);
    // But logging should have failed
    expect(result.workflow.step5_logging?.success).toBe(false);
  });
});
