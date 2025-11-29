/**
 * BetLogger.tsx - Component for logging bets and viewing bet history
 * Integrates with the Kelly Calculator workflow
 */
import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';

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

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // Force navigation bar to be visible when modal closes
      const navBar = document.getElementById('bottom-navigation-bar');
      if (navBar) {
        navBar.style.visibility = 'visible';
        navBar.style.opacity = '1';
        navBar.style.display = 'block';
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
      // Ensure navigation bar is visible on cleanup
      const navBar = document.getElementById('bottom-navigation-bar');
      if (navBar) {
        navBar.style.visibility = 'visible';
        navBar.style.opacity = '1';
        navBar.style.display = 'block';
      }
    };
  }, [isOpen]);

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
        // Ensure navigation bar is visible and page is scrollable
        document.body.style.overflow = 'unset';
        const navBar = document.getElementById('bottom-navigation-bar');
        if (navBar) {
          navBar.style.visibility = 'visible';
          navBar.style.opacity = '1';
          navBar.style.display = 'block';
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const modalContent = isOpen && (
    <div className="log-bet-modal" onClick={(e) => {
      if (e.target === e.currentTarget) setIsOpen(false);
    }}>
      <div className="log-bet-content">
        <div className="modal-header">
          <h3>Log This Bet</h3>
          <button
            className="modal-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Matchup Summary */}
        <div className="bet-summary">
          <div className="your-pick-banner">
            <div className="pick-indicator">✓ YOUR PICK</div>
            <div className="pick-team">{teamA.abbreviation || teamA.name}</div>
            <div className="pick-details">
              {pointSpread > 0 ? '+' : ''}{pointSpread} vs {teamB.abbreviation || teamB.name}
            </div>
          </div>

          <div className="summary-divider"></div>

          <div className="summary-row">
            <span className="summary-label">Sport:</span>
            <span className="summary-value">{sport === 'football' ? '🏈 Football' : '🏀 Basketball'}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Venue:</span>
            <span className="summary-value">
              {venue === 'home' ? '🏠 Home' : venue === 'away' ? '✈️ Away' : '⚖️ Neutral'}
            </span>
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

  return (
    <>
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
      {modalContent && ReactDOM.createPortal(modalContent, document.body)}
    </>
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
                  <div className="teams-container">
                    <div className="your-pick-label">
                      <span className="pick-badge">YOUR PICK</span>
                      <span className="pick-team-name">{bet.matchup.teamA.abbreviation || bet.matchup.teamA.name}</span>
                    </div>
                    <span className="vs-text">vs {bet.matchup.teamB.abbreviation || bet.matchup.teamB.name}</span>
                  </div>
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

// ==================== Styles - GLASSMORPHISM ====================
export const BetLoggerStyles = `
  /* Log Bet Button - Glass Material */
  .log-bet-btn {
    background: linear-gradient(135deg, #059669, #10b981);
    color: #fff;
    border: none;
    padding: .9rem 1.5rem;
    border-radius: 14px;
    cursor: pointer;
    font-weight: 700;
    font-size: 1rem;
    transition: .3s ease;
    box-shadow:
      0 8px 24px rgba(16, 185, 129, .4),
      0 0 0 1px rgba(255, 255, 255, 0.2) inset;
    display: flex;
    align-items: center;
    gap: .5rem;
    width: 100%;
    justify-content: center;
    margin-top: 1rem;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    position: relative;
    z-index: 1;
  }
  .log-bet-btn:hover {
    transform: translateY(-2px);
    box-shadow:
      0 12px 32px rgba(16, 185, 129, .5),
      0 0 0 1px rgba(255, 255, 255, 0.3) inset;
  }

  /* Log Bet Modal - Glass Overlay */
  .log-bet-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200;
    padding: 1rem;
    animation: fadeIn 0.3s ease;
  }
  .log-bet-content {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 20px;
    padding: 2rem;
    padding-bottom: calc(2rem + 120px);
    max-width: 520px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    animation: slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow:
      0 24px 48px rgba(0, 0, 0, 0.6),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  /* Mobile-first: Full screen modal for better UX */
  @media (max-width: 640px) {
    .log-bet-modal {
      padding: 0;
      align-items: flex-start;
    }
    .log-bet-content {
      max-width: 100%;
      max-height: 100vh;
      min-height: 100vh;
      border-radius: 0;
      padding: 1.5rem 1rem;
      padding-bottom: calc(1.5rem + 120px);
      display: flex;
      flex-direction: column;
    }
  }
  /* Modal Header with Close Button */
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }
  .modal-header h3 {
    margin: 0;
    color: rgba(255, 255, 255, 1);
    font-size: 1.5rem;
    font-weight: 700;
    background: var(--accent-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .modal-close-btn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: .2s ease;
    flex-shrink: 0;
  }
  .modal-close-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    transform: scale(1.1);
  }

  /* Bet Summary - Glass Panel */
  .bet-summary {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  /* Your Pick Banner */
  .your-pick-banner {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.15));
    border: 2px solid rgba(16, 185, 129, 0.4);
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1rem;
    text-align: center;
  }
  .pick-indicator {
    font-size: 0.75rem;
    font-weight: 700;
    color: #10b981;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
  }
  .pick-team {
    font-size: 1.75rem;
    font-weight: 900;
    color: rgba(255, 255, 255, 1);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    margin-bottom: 0.5rem;
    text-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }
  .pick-details {
    font-size: 1.1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
  /* Mobile adjustments for pick banner */
  @media (max-width: 640px) {
    .pick-team {
      font-size: 1.5rem;
    }
    .pick-details {
      font-size: 1rem;
    }
  }
  .summary-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    margin: 1rem 0;
  }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: .5rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 0.95rem;
  }
  .summary-row:last-child {
    border-bottom: none;
  }
  .summary-label {
    color: rgba(255, 255, 255, 0.5);
    font-size: .9rem;
  }
  .summary-value {
    color: rgba(255, 255, 255, 1);
    font-weight: 600;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  /* Wager Presets - Glass Buttons */
  .wager-presets {
    display: flex;
    gap: .5rem;
    margin-top: .75rem;
  }
  .wager-presets button {
    flex: 1;
    padding: .5rem .75rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.7);
    border-radius: 10px;
    cursor: pointer;
    font-size: .85rem;
    font-weight: 600;
    transition: .2s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .wager-presets button:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 1);
    transform: translateY(-1px);
  }

  /* Error/Success Messages */
  .bet-error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    padding: 1rem;
    border-radius: 12px;
    margin-bottom: 1rem;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .bet-success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
    padding: 1rem;
    border-radius: 12px;
    margin-bottom: 1rem;
    text-align: center;
    font-weight: 600;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  /* Actions */
  .log-bet-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  .log-bet-actions button {
    flex: 1;
  }

  /* Textarea styling */
  textarea.input-field {
    resize: vertical;
    min-height: 80px;
    font-family: 'Inter', sans-serif;
  }

  /* ==================== Bet History Styles - GLASSMORPHISM ==================== */
  .bet-history-container {
    padding: 0;
  }

  .bet-history-auth-prompt,
  .bet-history-loading {
    text-align: center;
    padding: 3rem 2rem;
    color: rgba(255, 255, 255, 0.5);
  }
  .bet-history-auth-prompt h3 {
    color: rgba(255, 255, 255, 1);
    margin-bottom: 1rem;
    font-size: 1.5rem;
    font-weight: 700;
  }

  /* Stats Dashboard - Glass Panel */
  .stats-dashboard {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  }
  .stats-dashboard h3 {
    margin: 0 0 1.25rem;
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--accent-cyan);
  }
  /* Better spacing on mobile */
  @media (max-width: 640px) {
    .stats-dashboard {
      padding: 1.25rem 1rem;
    }
    .stats-dashboard h3 {
      font-size: 1rem;
    }
  }
  .stats-grid-dashboard {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  @media (min-width: 480px) {
    .stats-grid-dashboard {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 768px) {
    .stats-grid-dashboard {
      grid-template-columns: repeat(6, 1fr);
    }
  }
  .stat-card {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 1rem .75rem;
    text-align: center;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    transition: .2s ease;
  }
  .stat-card:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.12);
    transform: translateY(-2px);
  }
  /* Better mobile spacing */
  @media (max-width: 640px) {
    .stat-card {
      padding: 1.25rem 0.5rem;
    }
  }
  .stat-value {
    font-size: 1.5rem;
    font-weight: 800;
    color: rgba(255, 255, 255, 1);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    margin-bottom: .25rem;
  }
  .stat-label {
    font-size: .75rem;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: .05em;
    font-weight: 600;
  }
  /* Better readability on mobile */
  @media (max-width: 640px) {
    .stat-value {
      font-size: 1.75rem;
    }
    .stat-label {
      font-size: .8rem;
    }
  }

  /* Filters - Glass Controls */
  .bet-filters {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .filter-group {
    display: flex;
    align-items: center;
    gap: .5rem;
  }
  .filter-group label {
    font-size: .9rem;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
  }
  .filter-group select {
    padding: .5rem .75rem;
    font-size: .9rem;
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 1);
    border-radius: 10px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .filter-group select:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }
  .export-btn {
    margin-left: auto;
    padding: .5rem 1rem;
    background: var(--accent-gradient);
    border: none;
    color: rgba(255, 255, 255, 1);
    border-radius: 10px;
    text-decoration: none;
    font-size: .9rem;
    font-weight: 600;
    transition: .2s ease;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  }
  .export-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
  }

  /* No Bets State */
  .no-bets {
    text-align: center;
    padding: 3rem 2rem;
    color: rgba(255, 255, 255, 0.5);
    background: rgba(0, 0, 0, 0.2);
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  /* Bet List */
  .bet-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* Bet Card - Glass Material */
  .bet-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    cursor: pointer;
    transition: .3s ease;
    overflow: hidden;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
  .bet-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  }
  .bet-card.win {
    border-left: 4px solid #10b981;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.2),
      -4px 0 12px rgba(16, 185, 129, 0.15);
  }
  .bet-card.loss {
    border-left: 4px solid #ef4444;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.2),
      -4px 0 12px rgba(239, 68, 68, 0.15);
  }
  .bet-card.push {
    border-left: 4px solid #f59e0b;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.2),
      -4px 0 12px rgba(245, 158, 11, 0.15);
  }
  .bet-card.pending {
    /* Pending bets stay neutral silver across themes */
    border-left: 4px solid #c0c0c0;
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.2),
      -4px 0 12px rgba(192, 192, 192, 0.25);
  }

  .bet-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .bet-matchup {
    display: flex;
    align-items: center;
    gap: .75rem;
  }
  .sport-icon {
    font-size: 1.25rem;
  }
  .teams {
    font-weight: 700;
    color: rgba(255, 255, 255, 1);
    font-size: 1rem;
  }
  /* Pick indicator in bet history cards */
  .teams-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .your-pick-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .pick-badge {
    font-size: 0.65rem;
    font-weight: 700;
    color: #10b981;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .pick-team-name {
    font-weight: 900;
    color: rgba(255, 255, 255, 1);
    font-size: 1.1rem;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
  .vs-text {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.6);
    font-weight: 600;
    margin-left: 1.5rem;
  }
  @media (max-width: 640px) {
    .pick-badge {
      font-size: 0.6rem;
      padding: 0.15rem 0.4rem;
    }
    .pick-team-name {
      font-size: 1rem;
    }
    .vs-text {
      font-size: 0.85rem;
      margin-left: 1rem;
    }
  }
  .bet-status {
    font-size: .85rem;
    font-weight: 700;
    padding: .4rem .75rem;
    border-radius: 8px;
    text-transform: uppercase;
    letter-spacing: .03em;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .bet-status.pending {
    /* Use a consistent silver badge for pending across themes */
    background: rgba(192, 192, 192, 0.15);
    color: #e5e5e5;
    border: 1px solid rgba(192, 192, 192, 0.35);
  }
  .bet-status.win {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .bet-status.loss {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .bet-status.push {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .bet-card-body {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: .75rem;
    padding: 1rem 1.25rem;
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
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    font-weight: 600;
    letter-spacing: .05em;
  }
  .bet-detail span:last-child {
    font-weight: 600;
    color: rgba(255, 255, 255, 1);
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }

  /* Expanded Card - Glass Panel */
  .bet-card-expanded {
    padding: 1.25rem;
    background: rgba(0, 0, 0, 0.4);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .expanded-details {
    display: grid;
    gap: .75rem;
    margin-bottom: 1.25rem;
  }
  .detail-row {
    display: flex;
    justify-content: space-between;
    font-size: .95rem;
    padding-bottom: .5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .detail-row:last-child {
    border-bottom: none;
  }
  .detail-row span:first-child {
    color: rgba(255, 255, 255, 0.5);
  }
  .detail-row span:last-child {
    color: rgba(255, 255, 255, 1);
    font-weight: 600;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
  }
  .detail-row.notes {
    flex-direction: column;
    gap: .5rem;
  }
  .detail-row.notes span:last-child {
    font-family: 'Inter', sans-serif;
    font-weight: 400;
  }

  /* Outcome Actions - Glass Buttons */
  .outcome-actions {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .outcome-actions p {
    margin: 0 0 .75rem;
    font-size: .9rem;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
  }
  .outcome-buttons {
    display: flex;
    gap: .75rem;
  }
  .outcome-btn {
    flex: 1;
    padding: .75rem;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 700;
    font-size: .9rem;
    transition: .2s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    text-transform: uppercase;
    letter-spacing: .03em;
  }
  .outcome-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .outcome-btn.win {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .outcome-btn.win:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  }
  .outcome-btn.loss {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .outcome-btn.loss:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }
  .outcome-btn.push {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .outcome-btn.push:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.25);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
  }

  /* Delete Button - Glass */
  .delete-bet-btn {
    width: 100%;
    margin-top: 1rem;
    padding: .75rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    border-radius: 10px;
    cursor: pointer;
    font-size: .9rem;
    font-weight: 600;
    transition: .2s ease;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .delete-bet-btn:hover {
    background: rgba(239, 68, 68, 0.2);
    transform: translateY(-1px);
  }

  /* Animations */
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
    }
    to {
      opacity: 1;
      max-height: 600px;
    }
  }
`;

export default { LogBetButton, BetHistory, BetLoggerStyles };
