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
    background: #0f172a; /* Dark slate */
    color: #fff;
    border: 2px solid var(--success);
    padding: .75rem;
    border-radius: .5rem;
    cursor: pointer;
    font-weight: 700;
    width: 100%;
    transition: .2s ease;
  }
  .log-bet-btn:hover {
    background: var(--success);
    color: #fff;
  }

  /* Log Bet Modal */
  .log-bet-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: fadeIn 0.2s ease;
  }
  .log-bet-content {
    background: #1e293b; /* Slate 800 */
    border: 1px solid #334155;
    color: #f8fafc;
    border-radius: 1rem;
    padding: 1.5rem;
    max-width: 500px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease;
  }
  .log-bet-content h3 {
    margin: 0 0 1rem;
    color: #f8fafc;
    font-size: 1.25rem;
  }

  /* Bet Summary */
  .bet-summary {
    background: #0f172a;
    border-radius: 0.5rem;
    padding: 1rem;
    border: 1px solid #334155;
    margin-bottom: 1rem;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: .35rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
  .summary-row:last-child {
    border-bottom: none;
  }
  .summary-label {
    color: #94a3b8;
    font-size: .9rem;
  }
  .summary-value {
    color: #fff;
    font-weight: bold;
  }

  /* Wager Presets */
  .wager-presets {
    display: flex;
    gap: .5rem;
    margin-top: .5rem;
  }
  .wager-presets button {
    flex: 1;
    padding: .4rem .6rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #93c5fd;
    border-radius: .4rem;
    cursor: pointer;
    font-size: .8rem;
    transition: .2s ease;
  }
  .wager-presets button:hover {
    background: rgba(59, 130, 246, 0.2);
  }

  /* Error/Success */
  .bet-error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
    padding: .75rem;
    border-radius: .5rem;
    margin-bottom: 1rem;
  }
  .bet-success {
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #6ee7b7;
    padding: .75rem;
    border-radius: .5rem;
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
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
    padding: 2rem;
    color: #94a3b8;
  }
  .bet-history-auth-prompt h3 {
    color: #f8fafc;
    margin-bottom: .5rem;
  }

  /* Stats Dashboard */
  .stats-dashboard {
    background: #1e293b;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: .8rem;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  .stats-dashboard h3 {
    margin: 0 0 .75rem;
    font-size: 1rem;
    color: #93c5fd;
  }
  .stats-grid-dashboard {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: .75rem;
  }
  @media (min-width: 640px) {
    .stats-grid-dashboard {
      grid-template-columns: repeat(6, 1fr);
    }
  }
  .stat-card {
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: .5rem;
    padding: .6rem;
    text-align: center;
  }
  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
  }
  .stat-label {
    font-size: .7rem;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: .03em;
  }

  /* Filters */
  .bet-filters {
    display: flex;
    gap: .75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: .35rem;
  }
  .filter-group label {
    font-size: .85rem;
    color: #94a3b8;
  }
  .filter-group select {
    padding: .4rem .6rem;
    font-size: .85rem;
  }
  .export-btn {
    margin-left: auto;
    padding: .4rem .8rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    color: #93c5fd;
    border-radius: .5rem;
    text-decoration: none;
    font-size: .85rem;
    font-weight: 600;
    transition: .2s ease;
  }
  .export-btn:hover {
    background: rgba(59, 130, 246, 0.2);
  }

  /* No Bets */
  .no-bets {
    text-align: center;
    padding: 2rem;
    color: #94a3b8;
    background: #1e293b;
    border-radius: .6rem;
  }

  /* Bet List */
  .bet-list {
    display: flex;
    flex-direction: column;
    gap: .75rem;
  }

  /* Bet Card */
  .bet-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: .6rem;
    cursor: pointer;
    transition: .2s ease;
    overflow: hidden;
  }
  .bet-card:hover {
    border-color: rgba(59, 130, 246, 0.5);
  }
  .bet-card.win {
    border-left: 3px solid #10b981;
  }
  .bet-card.loss {
    border-left: 3px solid #ef4444;
  }
  .bet-card.push {
    border-left: 3px solid #f59e0b;
  }
  .bet-card.pending {
    border-left: 3px solid #3b82f6;
  }

  .bet-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: .75rem;
    background: rgba(0, 0, 0, 0.2);
  }
  .bet-matchup {
    display: flex;
    align-items: center;
    gap: .5rem;
  }
  .sport-icon {
    font-size: 1.1rem;
  }
  .teams {
    font-weight: 600;
    color: #f8fafc;
  }
  .bet-status {
    font-size: .8rem;
    font-weight: 600;
    padding: .25rem .5rem;
    border-radius: .35rem;
  }
  .bet-status.pending {
    background: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
  }
  .bet-status.win {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
  }
  .bet-status.loss {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }
  .bet-status.push {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
  }

  .bet-card-body {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: .5rem;
    padding: .75rem;
  }
  @media (min-width: 640px) {
    .bet-card-body {
      grid-template-columns: repeat(4, 1fr);
    }
  }
  .bet-detail {
    display: flex;
    flex-direction: column;
    gap: .15rem;
  }
  .detail-label {
    font-size: .7rem;
    color: #94a3b8;
    text-transform: uppercase;
  }
  .bet-detail span:last-child {
    font-weight: 600;
    color: #f8fafc;
  }

  /* Expanded Card */
  .bet-card-expanded {
    padding: 1rem;
    background: rgba(0, 0, 0, 0.3);
    border-top: 1px solid #334155;
    animation: slideDown 0.2s ease;
  }
  .expanded-details {
    display: grid;
    gap: .5rem;
    margin-bottom: 1rem;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    font-size: .9rem;
  }
  .detail-row span:first-child {
    color: #94a3b8;
  }
  .detail-row span:last-child {
    color: #f8fafc;
    font-weight: 500;
  }
  .detail-row.notes {
    flex-direction: column;
    gap: .25rem;
  }

  /* Outcome Actions */
  .outcome-actions {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #334155;
  }
  .outcome-actions p {
    margin: 0 0 .5rem;
    font-size: .85rem;
    color: #94a3b8;
  }
  .outcome-buttons {
    display: flex;
    gap: .5rem;
  }
  .outcome-btn {
    flex: 1;
    padding: .5rem;
    border: none;
    border-radius: .4rem;
    cursor: pointer;
    font-weight: 600;
    font-size: .85rem;
    transition: .2s ease;
  }
  .outcome-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .outcome-btn.win {
    background: rgba(16, 185, 129, 0.2);
    color: #6ee7b7;
    border: 1px solid rgba(16, 185, 129, 0.35);
  }
  .outcome-btn.win:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.35);
  }
  .outcome-btn.loss {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
    border: 1px solid rgba(239, 68, 68, 0.35);
  }
  .outcome-btn.loss:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.35);
  }
  .outcome-btn.push {
    background: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.35);
  }
  .outcome-btn.push:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.35);
  }

  /* Delete Button */
  .delete-bet-btn {
    width: 100%;
    margin-top: 1rem;
    padding: .5rem;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.35);
    color: #fca5a5;
    border-radius: .4rem;
    cursor: pointer;
    font-size: .85rem;
    transition: .2s ease;
  }
  .delete-bet-btn:hover {
    background: rgba(239, 68, 68, 0.15);
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
