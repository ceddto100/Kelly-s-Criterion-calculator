/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Bet logging tool for MCP - integrates with backend API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { t } from '../utils/translations.js';
import { getCurrentLocale } from '../server.js';

// In-memory storage for bets when backend is not available
// This is reset when the server restarts
const localBetStorage: Map<string, BetRecord[]> = new Map();

interface BetRecord {
  id: string;
  sport: 'football' | 'basketball';
  teamA: string;
  teamB: string;
  spread: number;
  probability: number;
  edge: number;
  bankroll: number;
  odds: number;
  recommendedStake: number;
  actualWager: number;
  notes: string;
  createdAt: string;
  outcome: 'pending' | 'win' | 'loss' | 'push';
}

function generateId(): string {
  return `bet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Try to log bet to backend API if configured
 */
async function logBetToBackend(betData: any): Promise<{ success: boolean; error?: string }> {
  const backendUrl = process.env.BACKEND_URL;
  const apiKey = process.env.MCP_API_KEY;

  if (!backendUrl) {
    return { success: false, error: 'Backend URL not configured' };
  }

  try {
    const response = await fetch(`${backendUrl}/api/bets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      body: JSON.stringify(betData),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      return { success: false, error: error.message || error.error || 'Failed to log bet' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error logging bet to backend:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

export function registerBetLoggerTool(server: McpServer) {
  server.tool(
    'log-bet',
    {
      title: 'Log a Bet',
      description: 'Use this when the user wants to record/log a bet they are placing or have placed. Stores the bet details including matchup, probability, Kelly calculation, and actual wager amount. This helps track betting history and performance over time.',
      inputSchema: {
        sport: z.enum(['football', 'basketball']).describe('Sport type: "football" for NFL/CFB, "basketball" for NBA/CBB'),
        teamA: z.string().describe('Name of the team being bet on (your team)'),
        teamB: z.string().describe('Name of the opposing team'),
        spread: z.number().describe('Point spread for your team. Negative if favored, positive if underdog. Example: -7 or +3.5'),
        probability: z.number().min(0).max(100).describe('Calculated win/cover probability as percentage. Example: 55.5 for 55.5%'),
        odds: z.number().describe('American odds for the bet. Example: -110 or +150'),
        bankroll: z.number().positive().describe('Current bankroll amount in USD. Example: 1000'),
        recommendedStake: z.number().min(0).describe('Kelly-recommended stake amount in USD. Example: 52.50'),
        actualWager: z.number().min(0).describe('Actual amount wagered in USD. Example: 50'),
        notes: z.string().default('').describe('Optional notes about the bet. Example: "Home game, key player injured"')
      },
      annotations: {
        readOnlyHint: false, // Creates new bet records in storage
        openWorldHint: true, // May call external backend API to persist data
        destructiveHint: false // Creates new data but doesn't delete existing
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Logging bet...',
        'openai/toolInvocation/invoked': 'Bet logged successfully'
      }
    },
    async (args, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { sport, teamA, teamB, spread, probability, odds, bankroll, recommendedStake, actualWager, notes } = args;

      // Validate inputs
      if (!teamA || !teamB) {
        return {
          structuredContent: { error: 'invalid_input', message: 'Both team names are required' },
          content: [{ type: 'text' as const, text: 'Please provide both team names.' }],
          isError: true
        };
      }

      // Calculate edge (user's probability vs implied probability from odds)
      let impliedProb: number;
      if (odds < 0) {
        impliedProb = (Math.abs(odds) / (Math.abs(odds) + 100)) * 100;
      } else {
        impliedProb = (100 / (odds + 100)) * 100;
      }
      const edge = probability - impliedProb;

      // Create bet record
      const betRecord: BetRecord = {
        id: generateId(),
        sport,
        teamA,
        teamB,
        spread,
        probability,
        edge,
        bankroll,
        odds,
        recommendedStake,
        actualWager,
        notes: notes || '',
        createdAt: new Date().toISOString(),
        outcome: 'pending'
      };

      // Try to log to backend first
      const backendResult = await logBetToBackend({
        matchup: {
          sport,
          teamA: { name: teamA },
          teamB: { name: teamB },
          venue: 'neutral'
        },
        estimation: {
          pointSpread: spread,
          calculatedProbability: probability,
          impliedProbability: impliedProb,
          edge
        },
        kelly: {
          bankroll,
          americanOdds: odds,
          kellyFraction: 1,
          recommendedStake,
          stakePercentage: (recommendedStake / bankroll) * 100
        },
        actualWager,
        notes
      });

      // Store locally as backup
      const sessionId = extra?._meta?.sessionId || 'default';
      if (!localBetStorage.has(sessionId)) {
        localBetStorage.set(sessionId, []);
      }
      localBetStorage.get(sessionId)!.push(betRecord);

      const spreadText = spread > 0 ? `+${spread}` : spread.toString();
      const oddsText = odds > 0 ? `+${odds}` : odds.toString();
      const edgeText = edge > 0 ? `+${edge.toFixed(1)}%` : `${edge.toFixed(1)}%`;

      const responseText = `## Bet Logged\n\n` +
        `**${teamA}** vs ${teamB} (${sport === 'football' ? 'Football' : 'Basketball'})\n\n` +
        `| Detail | Value |\n` +
        `|--------|-------|\n` +
        `| Spread | ${spreadText} |\n` +
        `| Win Probability | ${probability.toFixed(1)}% |\n` +
        `| Odds | ${oddsText} |\n` +
        `| Edge | ${edgeText} |\n` +
        `| Recommended Stake | $${recommendedStake.toFixed(2)} |\n` +
        `| **Actual Wager** | **$${actualWager.toFixed(2)}** |\n\n` +
        (notes ? `**Notes:** ${notes}\n\n` : '') +
        (backendResult.success
          ? '_Bet synced to your account._'
          : '_Bet stored locally. Sign in to sync across devices._');

      return {
        structuredContent: {
          betId: betRecord.id,
          ...betRecord,
          impliedProbability: impliedProb,
          syncedToBackend: backendResult.success,
          loggedAt: betRecord.createdAt
        },
        content: [{
          type: 'text' as const,
          text: responseText
        }],
        _meta: {
          'openai/locale': locale
        }
      };
    }
  );

  // Tool to retrieve bet history
  server.tool(
    'get-bet-history',
    {
      title: 'Get Bet History',
      description: 'Use this when the user wants to see their recent bets, betting history, or track their betting performance. Returns a list of logged bets with outcomes and statistics.',
      inputSchema: {
        limit: z.number().min(1).max(50).default(10).describe('Maximum number of bets to return. Default is 10.')
      },
      annotations: {
        readOnlyHint: true, // Only reads bet history from storage
        openWorldHint: false, // Reads from local in-memory storage only
        destructiveHint: false // No data modification or deletion
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Loading bet history...',
        'openai/toolInvocation/invoked': 'Bet history loaded'
      }
    },
    async (args, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { limit } = args;
      const sessionId = extra?._meta?.sessionId || 'default';
      const bets = localBetStorage.get(sessionId) || [];

      if (bets.length === 0) {
        return {
          structuredContent: {
            bets: [],
            total: 0,
            message: 'No bets logged yet'
          },
          content: [{
            type: 'text' as const,
            text: 'No bets have been logged yet. Use the log-bet tool to start tracking your bets.'
          }]
        };
      }

      // Get most recent bets
      const recentBets = bets.slice(-limit).reverse();

      // Calculate summary stats
      const settled = bets.filter(b => b.outcome !== 'pending');
      const wins = settled.filter(b => b.outcome === 'win').length;
      const losses = settled.filter(b => b.outcome === 'loss').length;
      const pending = bets.filter(b => b.outcome === 'pending').length;
      const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
      const avgEdge = bets.reduce((sum, b) => sum + b.edge, 0) / bets.length;
      const totalWagered = bets.reduce((sum, b) => sum + b.actualWager, 0);

      let responseText = `## Bet History (${recentBets.length} of ${bets.length})\n\n`;

      // Summary stats
      responseText += `### Summary\n` +
        `- **Total Bets:** ${bets.length}\n` +
        `- **Pending:** ${pending}\n` +
        `- **Record:** ${wins}W - ${losses}L (${winRate.toFixed(1)}%)\n` +
        `- **Avg Edge:** ${avgEdge > 0 ? '+' : ''}${avgEdge.toFixed(1)}%\n` +
        `- **Total Wagered:** $${totalWagered.toFixed(2)}\n\n`;

      // Recent bets table
      responseText += `### Recent Bets\n` +
        `| Date | Matchup | Spread | Wager | Outcome |\n` +
        `|------|---------|--------|-------|--------|\n`;

      for (const bet of recentBets) {
        const date = new Date(bet.createdAt).toLocaleDateString();
        const spreadText = bet.spread > 0 ? `+${bet.spread}` : bet.spread.toString();
        const outcomeEmoji = bet.outcome === 'win' ? '✅' : bet.outcome === 'loss' ? '❌' : bet.outcome === 'push' ? '➖' : '⏳';

        responseText += `| ${date} | ${bet.teamA} vs ${bet.teamB} | ${spreadText} | $${bet.actualWager} | ${outcomeEmoji} ${bet.outcome} |\n`;
      }

      return {
        structuredContent: {
          bets: recentBets,
          total: bets.length,
          summary: {
            pending,
            wins,
            losses,
            winRate,
            avgEdge,
            totalWagered
          }
        },
        content: [{
          type: 'text' as const,
          text: responseText
        }],
        _meta: {
          'openai/locale': locale
        }
      };
    }
  );

  // Tool to update bet outcome
  server.tool(
    'update-bet-outcome',
    {
      title: 'Update Bet Outcome',
      description: 'Use this when the user wants to record the result of a bet (win, loss, or push). Updates the bet record with the actual outcome.',
      inputSchema: {
        betId: z.string().describe('The bet ID to update (from log-bet response)'),
        outcome: z.enum(['win', 'loss', 'push']).describe('The outcome of the bet: "win", "loss", or "push"'),
        payout: z.number().optional().describe('Optional: Actual payout amount if different from calculated')
      },
      annotations: {
        readOnlyHint: false, // Modifies existing bet outcome
        openWorldHint: false, // Updates local storage only
        destructiveHint: false // Modifies data but can be updated again, non-destructive
      },
      _meta: {
        'openai/toolInvocation/invoking': 'Updating bet outcome...',
        'openai/toolInvocation/invoked': 'Bet outcome updated'
      }
    },
    async (args, extra?: any) => {
      const locale: string = (extra?._meta?.['openai/locale'] as string)
                  || (extra?._meta?.['webplus/i18n'] as string)
                  || getCurrentLocale();

      const { betId, outcome, payout } = args;
      const sessionId = extra?._meta?.sessionId || 'default';
      const bets = localBetStorage.get(sessionId) || [];

      const bet = bets.find(b => b.id === betId);

      if (!bet) {
        return {
          structuredContent: {
            error: 'bet_not_found',
            message: `Bet with ID "${betId}" not found`
          },
          content: [{
            type: 'text' as const,
            text: `Could not find bet with ID "${betId}". Use get-bet-history to see your bets.`
          }],
          isError: true
        };
      }

      // Update outcome
      bet.outcome = outcome;

      // Calculate profit/loss
      let profit: number;
      if (outcome === 'win') {
        if (payout !== undefined) {
          profit = payout - bet.actualWager;
        } else if (bet.odds > 0) {
          profit = bet.actualWager * (bet.odds / 100);
        } else {
          profit = bet.actualWager * (100 / Math.abs(bet.odds));
        }
      } else if (outcome === 'loss') {
        profit = -bet.actualWager;
      } else {
        profit = 0; // Push
      }

      const outcomeEmoji = outcome === 'win' ? '✅' : outcome === 'loss' ? '❌' : '➖';
      const profitText = profit >= 0 ? `+$${profit.toFixed(2)}` : `-$${Math.abs(profit).toFixed(2)}`;

      return {
        structuredContent: {
          betId: bet.id,
          teamA: bet.teamA,
          teamB: bet.teamB,
          outcome,
          profit,
          actualWager: bet.actualWager,
          updatedAt: new Date().toISOString()
        },
        content: [{
          type: 'text' as const,
          text: `## Bet Updated ${outcomeEmoji}\n\n` +
            `**${bet.teamA}** vs ${bet.teamB}\n\n` +
            `- **Outcome:** ${outcome.toUpperCase()}\n` +
            `- **Wager:** $${bet.actualWager.toFixed(2)}\n` +
            `- **Profit/Loss:** ${profitText}\n`
        }],
        _meta: {
          'openai/locale': locale
        }
      };
    }
  );
}
