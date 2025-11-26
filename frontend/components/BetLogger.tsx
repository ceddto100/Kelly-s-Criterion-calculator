/**
 * BetLogger.tsx - Component for logging bets and viewing bet history
 * Integrates with the Kelly Calculator workflow
 */
import React, { useState, useEffect, useMemo } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

// Types
interface BetLogData {
  matchup: {
    sport: 'football' | 'basketball';
    teamA: {
      name: string;
      abbreviation?: string;
      stats: Record<string, number>;
    };
    teamB: {
      name: string;
      abbreviation?: string;
      stats: Record<string, number>;
    };
    venue: 'home' | 'away' | 'neutral';
  };
  estimation: {
    pointSpread: number;
    calculatedProbability: number;
    expectedMargin?: number;
    impliedProbability?: number;
    edge?: number;
  };
  kelly: {
    bankroll: number;
    americanOdds: number;
    kellyFraction: number;
    recommendedStake: number;
    stakePercentage: number;
  };
  actualWager: number;
  notes?: string;
  tags?: string[];
}

interface SavedBet extends BetLogData {
  _id: string;
  outcome: {
    result: 'pending' | 'win' | 'loss' | 'push' | 'cancelled';
    actualScore?: { teamA: number; teamB: number };
    payout?: number;
    settledAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface BetStats {
  totalBets: number;
  pendingBets: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: string;
  totalWagered: number;
  totalPayout: number;
  netProfit: number;
  roi: string;
  avgProbability: string;
  avgEdge: string;
}

interface LogBetButtonProps {
  // Data from the calculator workflow
  sport: 'football' | 'basketball';
  teamA: { name: string; abbreviation?: string; stats: Record<string, number> };
  teamB: { name: string; abbreviation?: string; stats: Record<string, number> };
  venue: 'home' | 'away' | 'neutral';
  pointSpread: number;
  calculatedProbability: number;
  expectedMargin?: number;
  impliedProbability?: number;
  edge?: number;
  bankroll: number;
  americanOdds: number;
  kellyFraction: number;
  recommendedStake: number;
  stakePercentage: number;
  // User auth state
  isAuthenticated: boolean;
  onLoginRequired?: () => void;
}

// Helper to format currency
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

// ==================== Log Bet Button Component ====================
export function LogBetButton({
  sport,
  teamA,
  teamB,
  venue,
  pointSpread,
  calculatedProbability,
  expectedMargin,
  impliedProbability,
  edge,
  bankroll,
  americanOdds,
  kellyFraction,
  recommendedStake,
  stakePercentage,
  isAuthenticated,
  onLoginRequired
}: LogBetButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actualWager, setActualWager] = useState(recommendedStake.toFixed(2));
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset wager when recommended stake changes
  useEffect(() => {
    setActualWager(recommendedStake.toFixed(2));
  }, [recommendedStake]);

  const handleLogBet = async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }

    setIsLoading(true);
    setError(null);

    const betData: BetLogData = {
      matchup: {
        sport,
        teamA,
        teamB,
        venue
      },
      estimation: {
        pointSpread,
        calculatedProbability,
        expectedMargin,
        impliedProbability,
        edge
      },
      kelly: {
        bankroll,
        americanOdds,
        kellyFraction,
        recommendedStake,
        stakePercentage
      },
      actualWager: parseFloat(actualWager),
      notes: notes || undefined
    };

    try {
      const response = await fetch(`${BACKEND_URL}/api/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(betData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to log bet');
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        setNotes('');
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        className="log-bet-btn"
        onClick={() => {
          if (!isAuthenticated) {
            onLoginRequired?.();
          } else {
            setIsOpen(true);
          }
        }}
      >
        📝 Log This Bet
      </button>
    );
  }

  return (
    <div className="log-bet-modal">
      <div className="log-bet-content">
        <h3>Log This Bet</h3>

        {/* Matchup Summary */}
        <div className="bet-summary">
          <div className="summary-row">
            <span className="summary-label">Matchup:</span>
            <span className="summary-value">
              {teamA.abbreviation || teamA.name} vs {teamB.abbreviation || teamB.name}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Sport:</span>
            <span className="summary-value">{sport === 'football' ? '🏈 Football' : '🏀 Basketball'}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Spread:</span>
            <span className="summary-value">{pointSpread > 0 ? '+' : ''}{pointSpread}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Win Probability:</span>
            <span className="summary-value">{calculatedProbability.toFixed(1)}%</span>
          </div>
          {edge !== undefined && (
            <div className="summary-row">
              <span className="summary-label">Your Edge:</span>
              <span className="summary-value" style={{ color: edge > 0 ? '#10b981' : '#ef4444' }}>
                {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
              </span>
            </div>
          )}
          <div className="summary-row">
            <span className="summary-label">Odds:</span>
            <span className="summary-value">{americanOdds > 0 ? '+' : ''}{americanOdds}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Kelly Recommends:</span>
            <span className="summary-value">{formatCurrency(recommendedStake)} ({stakePercentage.toFixed(1)}%)</span>
          </div>
        </div>

        {/* Actual Wager Input */}
        <div className="input-group">
          <label htmlFor="actualWager">Actual Wager Amount</label>
          <input
            id="actualWager"
            type="number"
            className="input-field"
            value={actualWager}
            onChange={(e) => setActualWager(e.target.value)}
            min="0"
            step="0.01"
          />
          <div className="wager-presets">
            <button onClick={() => setActualWager(recommendedStake.toFixed(2))}>
              Kelly ({formatCurrency(recommendedStake)})
            </button>
            <button onClick={() => setActualWager((recommendedStake * 0.5).toFixed(2))}>
              Half ({formatCurrency(recommendedStake * 0.5)})
            </button>
            <button onClick={() => setActualWager('0')}>
              Skip
            </button>
          </div>
        </div>

        {/* Notes */}
        <div className="input-group">
          <label htmlFor="betNotes">Notes (optional)</label>
          <textarea
            id="betNotes"
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes about this bet..."
            rows={2}
          />
        </div>

        {/* Error/Success Messages */}
        {error && <div className="bet-error">{error}</div>}
        {success && <div className="bet-success">✓ Bet logged successfully!</div>}

        {/* Actions */}
        <div className="log-bet-actions">
          <button
            className="btn-secondary"
            onClick={() => setIsOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleLogBet}
            disabled={isLoading || !actualWager || parseFloat(actualWager) < 0}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Logging...
              </>
            ) : (
              'Confirm & Log Bet'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Bet History Component ====================
interface BetHistoryProps {
  isAuthenticated: boolean;
}

export function BetHistory({ isAuthenticated }: BetHistoryProps) {
  const [bets, setBets] = useState<SavedBet[]>([]);
  const [stats, setStats] = useState<BetStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('all');
  const [sportFilter, setSportFilter] = useState<'all' | 'football' | 'basketball'>('all');
  const [expandedBet, setExpandedBet] = useState<string | null>(null);
  const [updatingBet, setUpdatingBet] = useState<string | null>(null);

  // Fetch bets and stats
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [betsRes, statsRes] = await Promise.all([
          fetch(`${BACKEND_URL}/api/bets?limit=50`, { credentials: 'include' }),
          fetch(`${BACKEND_URL}/api/bets/stats`, { credentials: 'include' })
        ]);

        if (betsRes.ok) {
          const betsData = await betsRes.json();
          setBets(betsData.bets);
        }

        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }
      } catch (err) {
        console.error('Failed to fetch bet data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isAuthenticated]);

  // Filter bets
  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      if (filter === 'pending' && bet.outcome.result !== 'pending') return false;
      if (filter === 'settled' && bet.outcome.result === 'pending') return false;
      if (sportFilter !== 'all' && bet.matchup.sport !== sportFilter) return false;
      return true;
    });
  }, [bets, filter, sportFilter]);

  // Update bet outcome
  const updateOutcome = async (betId: string, result: 'win' | 'loss' | 'push', actualScore?: { teamA: number; teamB: number }) => {
    setUpdatingBet(betId);
    try {
      const response = await fetch(`${BACKEND_URL}/api/bets/${betId}/outcome`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ result, actualScore })
      });

      if (response.ok) {
        const data = await response.json();
        setBets(prev => prev.map(b => b._id === betId ? data.bet : b));

        // Refresh stats
        const statsRes = await fetch(`${BACKEND_URL}/api/bets/stats`, { credentials: 'include' });
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      }
    } catch (err) {
      console.error('Failed to update outcome:', err);
    } finally {
      setUpdatingBet(null);
    }
  };

  // Delete bet
  const deleteBet = async (betId: string) => {
    if (!confirm('Are you sure you want to delete this bet?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/bets/${betId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setBets(prev => prev.filter(b => b._id !== betId));

        // Refresh stats
        const statsRes = await fetch(`${BACKEND_URL}/api/bets/stats`, { credentials: 'include' });
        if (statsRes.ok) {
          setStats(await statsRes.json());
        }
      }
    } catch (err) {
      console.error('Failed to delete bet:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="bet-history-auth-prompt">
        <h3>🔒 Sign in to view your bet history</h3>
        <p>Log in with Google to track your bets and see your performance stats.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bet-history-loading">
        <span className="loading-spinner"></span>
        Loading your bet history...
      </div>
    );
  }

  return (
    <div className="bet-history-container">
      {/* Stats Dashboard */}
      {stats && (
        <div className="stats-dashboard">
          <h3>📊 Your Betting Stats</h3>
          <div className="stats-grid-dashboard">
            <div className="stat-card">
              <div className="stat-value">{stats.totalBets}</div>
              <div className="stat-label">Total Bets</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.wins}-{stats.losses}</div>
              <div className="stat-label">Record</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: parseFloat(stats.winRate) >= 50 ? '#10b981' : '#ef4444' }}>
                {stats.winRate}%
              </div>
              <div className="stat-label">Win Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: stats.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                {formatCurrency(stats.netProfit)}
              </div>
              <div className="stat-label">Net Profit</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: parseFloat(stats.roi) >= 0 ? '#10b981' : '#ef4444' }}>
                {stats.roi}%
              </div>
              <div className="stat-label">ROI</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.pendingBets}</div>
              <div className="stat-label">Pending</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bet-filters">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All Bets</option>
            <option value="pending">Pending</option>
            <option value="settled">Settled</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Sport:</label>
          <select value={sportFilter} onChange={(e) => setSportFilter(e.target.value as any)}>
            <option value="all">All Sports</option>
            <option value="football">Football</option>
            <option value="basketball">Basketball</option>
          </select>
        </div>
        <a
          href={`${BACKEND_URL}/api/bets/export/csv`}
          className="export-btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          📥 Export CSV
        </a>
      </div>

      {/* Bet List */}
      {filteredBets.length === 0 ? (
        <div className="no-bets">
          <p>No bets found. Start logging your bets to track your performance!</p>
        </div>
      ) : (
        <div className="bet-list">
          {filteredBets.map(bet => (
            <div
              key={bet._id}
              className={`bet-card ${bet.outcome.result}`}
              onClick={() => setExpandedBet(expandedBet === bet._id ? null : bet._id)}
            >
              <div className="bet-card-header">
                <div className="bet-matchup">
                  <span className="sport-icon">
                    {bet.matchup.sport === 'football' ? '🏈' : '🏀'}
                  </span>
                  <span className="teams">
                    {bet.matchup.teamA.abbreviation || bet.matchup.teamA.name} vs {bet.matchup.teamB.abbreviation || bet.matchup.teamB.name}
                  </span>
                </div>
                <div className={`bet-status ${bet.outcome.result}`}>
                  {bet.outcome.result === 'pending' ? '⏳ Pending' :
                   bet.outcome.result === 'win' ? '✅ Won' :
                   bet.outcome.result === 'loss' ? '❌ Lost' :
                   bet.outcome.result === 'push' ? '↔️ Push' : '🚫 Cancelled'}
                </div>
              </div>

              <div className="bet-card-body">
                <div className="bet-detail">
                  <span className="detail-label">Spread:</span>
                  <span>{bet.estimation.pointSpread > 0 ? '+' : ''}{bet.estimation.pointSpread}</span>
                </div>
                <div className="bet-detail">
                  <span className="detail-label">Prob:</span>
                  <span>{bet.estimation.calculatedProbability.toFixed(1)}%</span>
                </div>
                <div className="bet-detail">
                  <span className="detail-label">Wager:</span>
                  <span>{formatCurrency(bet.actualWager)}</span>
                </div>
                <div className="bet-detail">
                  <span className="detail-label">Date:</span>
                  <span>{new Date(bet.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedBet === bet._id && (
                <div className="bet-card-expanded" onClick={(e) => e.stopPropagation()}>
                  <div className="expanded-details">
                    <div className="detail-row">
                      <span>Odds:</span>
                      <span>{bet.kelly.americanOdds > 0 ? '+' : ''}{bet.kelly.americanOdds}</span>
                    </div>
                    <div className="detail-row">
                      <span>Bankroll at time:</span>
                      <span>{formatCurrency(bet.kelly.bankroll)}</span>
                    </div>
                    <div className="detail-row">
                      <span>Kelly Recommended:</span>
                      <span>{formatCurrency(bet.kelly.recommendedStake)} ({bet.kelly.stakePercentage.toFixed(1)}%)</span>
                    </div>
                    {bet.estimation.edge && (
                      <div className="detail-row">
                        <span>Edge:</span>
                        <span style={{ color: bet.estimation.edge > 0 ? '#10b981' : '#ef4444' }}>
                          {bet.estimation.edge > 0 ? '+' : ''}{bet.estimation.edge.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {bet.notes && (
                      <div className="detail-row notes">
                        <span>Notes:</span>
                        <span>{bet.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Outcome Actions for Pending Bets */}
                  {bet.outcome.result === 'pending' && (
                    <div className="outcome-actions">
                      <p>Mark outcome:</p>
                      <div className="outcome-buttons">
                        <button
                          className="outcome-btn win"
                          onClick={() => updateOutcome(bet._id, 'win')}
                          disabled={updatingBet === bet._id}
                        >
                          ✅ Win
                        </button>
                        <button
                          className="outcome-btn loss"
                          onClick={() => updateOutcome(bet._id, 'loss')}
                          disabled={updatingBet === bet._id}
                        >
                          ❌ Loss
                        </button>
                        <button
                          className="outcome-btn push"
                          onClick={() => updateOutcome(bet._id, 'push')}
                          disabled={updatingBet === bet._id}
                        >
                          ↔️ Push
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    className="delete-bet-btn"
                    onClick={() => deleteBet(bet._id)}
                  >
                    🗑️ Delete Bet
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== Styles ====================
export const BetLoggerStyles = `
  /* Log Bet Button */
  .log-bet-btn {
    background: #b8ff9f;
    color: #000000;
    border: 4px solid #000000;
    padding: .9rem 1.5rem;
    cursor: pointer;
    font-weight: 800;
    font-size: 1rem;
    transition: .15s ease;
    box-shadow: 6px 6px 0px #000000;
    display: flex;
    align-items: center;
    gap: .5rem;
    width: 100%;
    justify-content: center;
    margin-top: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .log-bet-btn:hover {
    background: #22d3ee;
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0px #000000;
  }
  .log-bet-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px #000000;
  }

  /* Log Bet Modal */
  .log-bet-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }
  .log-bet-content {
    background: #ffffff;
    border: 4px solid #000000;
    padding: 2rem;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.3s ease;
    box-shadow: 8px 8px 0px #000000;
  }
  .log-bet-content h3 {
    margin: 0 0 1.25rem;
    color: #000000;
    font-size: 1.5rem;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }

  /* Bet Summary */
  .bet-summary {
    background: #f0f0f0;
    border: 3px solid #000000;
    padding: 1rem;
    margin-bottom: 1.25rem;
    box-shadow: 4px 4px 0px #000000;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: .5rem 0;
    border-bottom: 2px solid #000000;
  }
  .summary-row:last-child {
    border-bottom: none;
  }
  .summary-label {
    color: #333333;
    font-size: .85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .summary-value {
    color: #000000;
    font-weight: 800;
  }

  /* Wager Presets */
  .wager-presets {
    display: flex;
    gap: .75rem;
    margin-top: .75rem;
  }
  .wager-presets button {
    flex: 1;
    padding: .5rem .75rem;
    background: #ffffff;
    border: 3px solid #000000;
    color: #000000;
    cursor: pointer;
    font-size: .8rem;
    transition: .15s ease;
    font-weight: 700;
    box-shadow: 3px 3px 0px #000000;
    text-transform: uppercase;
  }
  .wager-presets button:hover {
    background: #22d3ee;
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0px #000000;
  }
  .wager-presets button:active {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0px #000000;
  }

  /* Error/Success */
  .bet-error {
    background: #ff90e8;
    border: 3px solid #000000;
    color: #000000;
    padding: .9rem;
    margin-bottom: 1rem;
    font-weight: 700;
    box-shadow: 4px 4px 0px #000000;
  }
  .bet-success {
    background: #b8ff9f;
    border: 3px solid #000000;
    color: #000000;
    padding: .9rem;
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 800;
    box-shadow: 4px 4px 0px #000000;
    text-transform: uppercase;
  }

  /* Actions */
  .log-bet-actions {
    display: flex;
    gap: .75rem;
    margin-top: 1rem;
  }
  .log-bet-actions button {
    flex: 1;
  }

  /* Textarea styling */
  textarea.input-field {
    resize: vertical;
    min-height: 60px;
  }

  /* ==================== Bet History Styles ==================== */
  .bet-history-container {
    padding: 0;
  }

  .bet-history-auth-prompt,
  .bet-history-loading {
    text-align: center;
    padding: 3rem 2rem;
    color: #333333;
  }
  .bet-history-auth-prompt h3 {
    color: #000000;
    margin-bottom: .75rem;
    font-weight: 900;
    font-size: 1.5rem;
    text-transform: uppercase;
  }

  /* Stats Dashboard */
  .stats-dashboard {
    background: #f0f0f0;
    border: 4px solid #000000;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 6px 6px 0px #000000;
  }
  .stats-dashboard h3 {
    margin: 0 0 1rem;
    font-size: 1.2rem;
    color: #000000;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: -0.02em;
  }
  .stats-grid-dashboard {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
  }
  @media (min-width: 640px) {
    .stats-grid-dashboard {
      grid-template-columns: repeat(6, 1fr);
    }
  }
  .stat-card {
    background: #ffffff;
    border: 3px solid #000000;
    padding: .9rem;
    text-align: center;
    box-shadow: 4px 4px 0px #000000;
  }
  .stat-value {
    font-size: 1.5rem;
    font-weight: 900;
    color: #000000;
  }
  .stat-label {
    font-size: .7rem;
    color: #333333;
    text-transform: uppercase;
    letter-spacing: .05em;
    font-weight: 800;
    margin-top: .25rem;
  }

  /* Filters */
  .bet-filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 1rem;
    background: #f0f0f0;
    border: 3px solid #000000;
    box-shadow: 4px 4px 0px #000000;
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: .5rem;
  }
  .filter-group label {
    font-size: .85rem;
    color: #000000;
    font-weight: 800;
    text-transform: uppercase;
  }
  .filter-group select {
    padding: .5rem .75rem;
    font-size: .85rem;
    border: 3px solid #000000;
    background: #ffffff;
    font-weight: 700;
  }
  .export-btn {
    margin-left: auto;
    padding: .5rem .9rem;
    background: #b8ff9f;
    border: 3px solid #000000;
    color: #000000;
    text-decoration: none;
    font-size: .85rem;
    font-weight: 800;
    transition: .15s ease;
    box-shadow: 3px 3px 0px #000000;
    text-transform: uppercase;
  }
  .export-btn:hover {
    background: #22d3ee;
    transform: translate(-2px, -2px);
    box-shadow: 5px 5px 0px #000000;
  }
  .export-btn:active {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0px #000000;
  }

  /* No Bets */
  .no-bets {
    text-align: center;
    padding: 3rem 2rem;
    color: #333333;
    background: #f0f0f0;
    border: 3px solid #000000;
    box-shadow: 4px 4px 0px #000000;
    font-weight: 700;
  }

  /* Bet List */
  .bet-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Bet Card */
  .bet-card {
    background: #ffffff;
    border: 4px solid #000000;
    cursor: pointer;
    transition: .15s ease;
    overflow: hidden;
    box-shadow: 6px 6px 0px #000000;
  }
  .bet-card:hover {
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0px #000000;
  }
  .bet-card.win {
    border-left: 8px solid #b8ff9f;
  }
  .bet-card.loss {
    border-left: 8px solid #ff90e8;
  }
  .bet-card.push {
    border-left: 8px solid #ffd700;
  }
  .bet-card.pending {
    border-left: 8px solid #22d3ee;
  }

  .bet-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f0f0f0;
    border-bottom: 3px solid #000000;
  }
  .bet-matchup {
    display: flex;
    align-items: center;
    gap: .75rem;
  }
  .sport-icon {
    font-size: 1.3rem;
  }
  .teams {
    font-weight: 800;
    color: #000000;
    text-transform: uppercase;
  }
  .bet-status {
    font-size: .8rem;
    font-weight: 800;
    padding: .4rem .75rem;
    border: 3px solid #000000;
    text-transform: uppercase;
    box-shadow: 3px 3px 0px #000000;
  }
  .bet-status.pending {
    background: #22d3ee;
    color: #000000;
  }
  .bet-status.win {
    background: #b8ff9f;
    color: #000000;
  }
  .bet-status.loss {
    background: #ff90e8;
    color: #000000;
  }
  .bet-status.push {
    background: #ffd700;
    color: #000000;
  }

  .bet-card-body {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: .75rem;
    padding: 1rem;
  }
  @media (min-width: 640px) {
    .bet-card-body {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .bet-detail {
    display: flex;
    flex-direction: column;
    gap: .25rem;
  }
  .detail-label {
    font-size: .7rem;
    color: #333333;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.05em;
  }
  .bet-detail span:last-child {
    font-weight: 700;
    color: #000000;
    font-family: 'Courier New', monospace;
  }

  /* Expanded Card */
  .bet-card-expanded {
    padding: 1.25rem;
    background: #f0f0f0;
    border-top: 3px solid #000000;
    animation: slideDown 0.2s ease;
  }
  .expanded-details {
    display: grid;
    gap: .75rem;
    margin-bottom: 1.25rem;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    font-size: .9rem;
    padding: .5rem 0;
    border-bottom: 2px solid #000000;
  }
  .detail-row:last-child {
    border-bottom: none;
  }
  .detail-row span:first-child {
    color: #333333;
    font-weight: 700;
    text-transform: uppercase;
    font-size: .8rem;
  }
  .detail-row span:last-child {
    color: #000000;
    font-weight: 700;
    font-family: 'Courier New', monospace;
  }
  .detail-row.notes {
    flex-direction: column;
    gap: .5rem;
  }

  /* Outcome Actions */
  .outcome-actions {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 3px solid #000000;
  }
  .outcome-actions p {
    margin: 0 0 .75rem;
    font-size: .85rem;
    color: #000000;
    font-weight: 800;
    text-transform: uppercase;
  }
  .outcome-buttons {
    display: flex;
    gap: .75rem;
  }
  .outcome-btn {
    flex: 1;
    padding: .65rem;
    border: 3px solid #000000;
    cursor: pointer;
    font-weight: 800;
    font-size: .85rem;
    transition: .15s ease;
    box-shadow: 4px 4px 0px #000000;
    text-transform: uppercase;
  }
  .outcome-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .outcome-btn.win {
    background: #b8ff9f;
    color: #000000;
  }
  .outcome-btn.win:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #000000;
  }
  .outcome-btn.win:active:not(:disabled) {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px #000000;
  }
  .outcome-btn.loss {
    background: #ff90e8;
    color: #000000;
  }
  .outcome-btn.loss:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #000000;
  }
  .outcome-btn.loss:active:not(:disabled) {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px #000000;
  }
  .outcome-btn.push {
    background: #ffd700;
    color: #000000;
  }
  .outcome-btn.push:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #000000;
  }
  .outcome-btn.push:active:not(:disabled) {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px #000000;
  }

  /* Delete Button */
  .delete-bet-btn {
    width: 100%;
    margin-top: 1.25rem;
    padding: .65rem;
    background: #ffffff;
    border: 3px solid #000000;
    color: #000000;
    cursor: pointer;
    font-size: .85rem;
    transition: .15s ease;
    font-weight: 800;
    box-shadow: 4px 4px 0px #000000;
    text-transform: uppercase;
  }
  .delete-bet-btn:hover {
    background: #ff90e8;
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px #000000;
  }
  .delete-bet-btn:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px #000000;
  }

  /* Animations */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideDown {
    from { opacity: 0; max-height: 0; }
    to { opacity: 1; max-height: 500px; }
  }
`;

export default { LogBetButton, BetHistory, BetLoggerStyles };
