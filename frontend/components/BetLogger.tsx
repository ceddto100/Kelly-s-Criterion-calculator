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
  onBankrollUpdate?: () => void;
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
  onLoginRequired,
  onBankrollUpdate
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

  // Lock body scroll when modal is open (mobile-safe lock/unlock)
  useEffect(() => {
    const scrollY = window.scrollY;

    if (isOpen) {
      document.body.classList.add('mobile-scroll-lock');
      document.body.style.top = `-${scrollY}px`;
    } else {
      const top = document.body.style.top;
      document.body.classList.remove('mobile-scroll-lock');
      document.body.style.top = '';
      if (top) {
        window.scrollTo(0, Math.abs(parseInt(top, 10)) || 0);
      }
      // Force navigation bar to be visible when modal closes
      const navBar = document.getElementById('bottom-navigation-bar');
      if (navBar) {
        navBar.style.visibility = 'visible';
        navBar.style.opacity = '1';
        navBar.style.display = 'block';
      }
    }

    return () => {
      const top = document.body.style.top;
      document.body.classList.remove('mobile-scroll-lock');
      document.body.style.top = '';
      if (top) {
        window.scrollTo(0, Math.abs(parseInt(top, 10)) || 0);
      }
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

      // Trigger bankroll refresh
      if (onBankrollUpdate) {
        onBankrollUpdate();
      }

      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        setNotes('');
        // Ensure navigation bar is visible and page is scrollable
        document.body.classList.remove('mobile-scroll-lock');
        document.body.style.top = '';
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
  onBankrollUpdate?: () => void;
}

export function BetHistory({ isAuthenticated, onBankrollUpdate }: BetHistoryProps) {
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

        // Notify parent to refresh bankroll
        if (onBankrollUpdate) {
          onBankrollUpdate();
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

// Styles moved to index.css
