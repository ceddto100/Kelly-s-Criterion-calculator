/**
 * BetLogger.tsx - Component for logging bets and viewing bet history
 * Integrates with the Kelly Calculator workflow
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ReactDOM from 'react-dom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

// Supported sports/leagues. League codes are the canonical values; the
// generic football/basketball/hockey/baseball values are kept for
// backward compatibility with bets logged via the calculator workflow.
export type SportKey =
  | 'nfl' | 'cfb' | 'nba' | 'wnba' | 'cbb' | 'mlb' | 'nhl'
  | 'football' | 'basketball' | 'hockey' | 'baseball';

// Options shown in the manual logger / filter dropdowns
export const SPORT_OPTIONS: { value: SportKey; label: string; icon: string }[] = [
  { value: 'nfl', label: 'NFL', icon: '🏈' },
  { value: 'cfb', label: 'College Football', icon: '🏈' },
  { value: 'nba', label: 'NBA', icon: '🏀' },
  { value: 'wnba', label: 'WNBA', icon: '🏀' },
  { value: 'cbb', label: 'College Basketball', icon: '🏀' },
  { value: 'mlb', label: 'MLB', icon: '⚾' },
  { value: 'nhl', label: 'NHL', icon: '🏒' },
];

// Full metadata map including legacy generic values
const SPORT_META: Record<string, { label: string; icon: string }> = {
  ...Object.fromEntries(SPORT_OPTIONS.map(o => [o.value, { label: o.label, icon: o.icon }])),
  football: { label: 'Football', icon: '🏈' },
  basketball: { label: 'Basketball', icon: '🏀' },
  hockey: { label: 'Hockey', icon: '🏒' },
  baseball: { label: 'Baseball', icon: '⚾' },
};

export const getSportMeta = (sport: string) =>
  SPORT_META[sport] || { label: sport, icon: '🎯' };

// Legacy generic sport values that should match a league filter
const SPORT_ALIASES: Record<string, string[]> = {
  nhl: ['hockey'],
  mlb: ['baseball'],
};
const sportMatchesFilter = (betSport: string, filter: string) =>
  betSport === filter || (SPORT_ALIASES[filter] || []).includes(betSport);

// ---- Bet type (spread vs over/under) ----
export type BetType = 'spread' | 'total' | 'moneyline';
export type TotalSide = 'over' | 'under';

// Sports that are bet as over/under totals by default (no spread market in the app)
const TOTALS_SPORTS = new Set(['hockey', 'nhl']);

/** Bets logged before betType existed: hockey was always a total, everything else a spread. */
const resolveBetType = (sport: string, betType?: BetType): BetType =>
  betType || (TOTALS_SPORTS.has(sport) ? 'total' : 'spread');

/** What a total counts, for labels like "6.5 total goals". */
const totalUnit = (sport: string) =>
  TOTALS_SPORTS.has(sport) ? 'goals' : sport === 'mlb' || sport === 'baseball' ? 'runs' : 'points';

const sideLabel = (side?: TotalSide) =>
  side === 'over' ? 'OVER' : side === 'under' ? 'UNDER' : 'OVER/UNDER';

const formatSpread = (n: number) => `${n > 0 ? '+' : ''}${n}`;

// Types
interface BetLogData {
  matchup: {
    sport: SportKey;
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
    /** 'total' = over/under; pointSpread then holds the total line. */
    betType?: BetType;
    totalSide?: TotalSide;
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
    autoGraded?: boolean;
    gameId?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/** Live game info for a pending bet, from POST /api/bets/sync-scores. */
interface LiveBetInfo {
  matched: boolean;
  gameId?: string;
  status?: 'scheduled' | 'in_progress' | 'final' | 'postponed';
  statusDetail?: string;
  startTime?: string;
  scoreA?: number | null;
  scoreB?: number | null;
  teamAIsHome?: boolean;
  currentGrade?: 'win' | 'loss' | 'push' | null;
}

// How often the Bets tab refreshes live scores while a game is on.
const LIVE_POLL_MS = 60 * 1000;

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
  sport: SportKey;
  teamA: { name: string; abbreviation?: string; stats: Record<string, number> };
  teamB: { name: string; abbreviation?: string; stats: Record<string, number> };
  venue: 'home' | 'away' | 'neutral';
  pointSpread: number;
  betType?: BetType;
  totalSide?: TotalSide;
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
  betType: betTypeProp,
  totalSide,
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
  const betType = resolveBetType(sport, betTypeProp);
  const isTotal = betType === 'total';

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
        navBar.style.display = '';
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
        navBar.style.display = '';
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
        betType,
        totalSide: isTotal ? totalSide : undefined,
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
          navBar.style.display = '';
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
          {isTotal ? (
            <div className={`your-pick-banner total-pick ${totalSide || ''}`}>
              <div className="pick-indicator">✓ OVER/UNDER BET</div>
              <div className="pick-team">{sideLabel(totalSide)} {pointSpread}</div>
              <div className="pick-details">
                Total {totalUnit(sport)} · {teamB.abbreviation || teamB.name} @ {teamA.abbreviation || teamA.name}
              </div>
            </div>
          ) : (
            <div className="your-pick-banner">
              <div className="pick-indicator">✓ YOUR PICK</div>
              <div className="pick-team">{teamA.abbreviation || teamA.name}</div>
              <div className="pick-details">
                {formatSpread(pointSpread)} vs {teamB.abbreviation || teamB.name}
              </div>
            </div>
          )}

          <div className="summary-divider"></div>

          <div className="summary-row">
            <span className="summary-label">Sport:</span>
            <span className="summary-value">{getSportMeta(sport).icon} {getSportMeta(sport).label}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Bet Type:</span>
            <span className="summary-value">{isTotal ? 'Over/Under (Total)' : betType === 'moneyline' ? 'Moneyline' : 'Point Spread'}</span>
          </div>
          {!isTotal && (
            <div className="summary-row">
              <span className="summary-label">Venue:</span>
              <span className="summary-value">
                {venue === 'home' ? '🏠 Home' : venue === 'away' ? '✈️ Away' : '⚖️ Neutral'}
              </span>
            </div>
          )}
          <div className="summary-row">
            <span className="summary-label">
              {isTotal ? `${totalSide === 'under' ? 'Under' : 'Over'} Probability:` : 'Win Probability:'}
            </span>
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

// ==================== Manual Log Bet Component ====================
// Compute the bookmaker's implied win probability (%) from American odds
const impliedProbabilityFromOdds = (odds: number): number => {
  if (!odds) return 0;
  if (odds > 0) {
    return (100 / (odds + 100)) * 100;
  }
  return (Math.abs(odds) / (Math.abs(odds) + 100)) * 100;
};

interface ManualLogBetButtonProps {
  isAuthenticated: boolean;
  onLoginRequired?: () => void;
  onBetLogged?: () => void;
}

export function ManualLogBetButton({
  isAuthenticated,
  onLoginRequired,
  onBetLogged
}: ManualLogBetButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sport, setSport] = useState<SportKey>('nfl');
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [venue, setVenue] = useState<'home' | 'away' | 'neutral'>('neutral');
  const [americanOdds, setAmericanOdds] = useState('');
  const [actualWager, setActualWager] = useState('');
  const [pointSpread, setPointSpread] = useState('');
  const [betType, setBetType] = useState<BetType>('spread');
  const [totalSide, setTotalSide] = useState<TotalSide>('over');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTotal = betType === 'total';

  const handleSportChange = (next: SportKey) => {
    setSport(next);
    // NHL is bet as over/under totals by default
    if (TOTALS_SPORTS.has(next)) setBetType('total');
    else if (TOTALS_SPORTS.has(sport) && betType === 'total') setBetType('spread');
  };

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
    }

    return () => {
      document.body.classList.remove('mobile-scroll-lock');
      document.body.style.top = '';
    };
  }, [isOpen]);

  const resetForm = () => {
    setSport('nfl');
    setTeamA('');
    setTeamB('');
    setVenue('neutral');
    setAmericanOdds('');
    setActualWager('');
    setPointSpread('');
    setBetType('spread');
    setTotalSide('over');
    setNotes('');
    setError(null);
  };

  const handleLogBet = async () => {
    if (!isAuthenticated) {
      onLoginRequired?.();
      return;
    }

    // Validate the fields the user entered manually
    if (!teamA.trim() || !teamB.trim()) {
      setError('Please enter both team names.');
      return;
    }
    const line = parseFloat(pointSpread);
    if (isTotal && (Number.isNaN(line) || line <= 0)) {
      setError('Please enter the total line (e.g. 6.5).');
      return;
    }
    const odds = parseInt(americanOdds, 10);
    if (!odds || Number.isNaN(odds)) {
      setError('Please enter valid American odds (e.g. -110 or +150).');
      return;
    }
    const wager = parseFloat(actualWager);
    if (Number.isNaN(wager) || wager < 0) {
      setError('Please enter a valid wager amount.');
      return;
    }

    setIsLoading(true);
    setError(null);

    // Pull the user's current bankroll so Kelly stats are meaningful.
    // Falls back to 0 if unavailable (manual bets don't require it).
    let bankroll = 0;
    try {
      const bankrollRes = await fetch(`${BACKEND_URL}/auth/bankroll`, { credentials: 'include' });
      if (bankrollRes.ok) {
        const bankrollData = await bankrollRes.json();
        if (bankrollData.bankroll !== undefined && bankrollData.bankroll !== null) {
          bankroll = parseFloat(bankrollData.bankroll) || 0;
        }
      }
    } catch {
      // Ignore — bankroll is best-effort for manually logged bets
    }

    const impliedProbability = impliedProbabilityFromOdds(odds);

    const betData: BetLogData = {
      matchup: {
        sport,
        teamA: { name: teamA.trim(), stats: {} },
        teamB: { name: teamB.trim(), stats: {} },
        venue: isTotal ? 'neutral' : venue
      },
      estimation: {
        betType,
        totalSide: isTotal ? totalSide : undefined,
        pointSpread: betType === 'moneyline' ? 0 : (parseFloat(pointSpread) || 0),
        // No model probability for a manual bet — use the odds-implied value
        calculatedProbability: impliedProbability,
        impliedProbability,
        edge: 0
      },
      kelly: {
        bankroll,
        americanOdds: odds,
        kellyFraction: 1,
        recommendedStake: wager,
        stakePercentage: bankroll > 0 ? (wager / bankroll) * 100 : 0
      },
      actualWager: wager,
      notes: notes || undefined,
      tags: ['manual']
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
      onBetLogged?.();

      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
        resetForm();
        document.body.classList.remove('mobile-scroll-lock');
        document.body.style.top = '';
      }, 1200);
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
          <h3>Log a Bet Manually</h3>
          <button
            className="modal-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <p className="manual-log-hint">
          Enter a bet directly — no calculator required. Win probability is
          estimated from the odds you enter.
        </p>

        {/* Sport */}
        <div className="input-group">
          <label htmlFor="manualSport">Sport</label>
          <select
            id="manualSport"
            className="input-field"
            value={sport}
            onChange={(e) => handleSportChange(e.target.value as SportKey)}
          >
            {SPORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bet type */}
        <div className="input-group">
          <label>Bet Type</label>
          <div className="bet-type-toggle" role="radiogroup" aria-label="Bet type">
            {([
              ['spread', 'Spread'],
              ['total', 'Over/Under'],
              ['moneyline', 'Moneyline'],
            ] as [BetType, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={betType === value}
                className={`bet-type-option ${betType === value ? 'active' : ''}`}
                onClick={() => setBetType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Over/Under side + line */}
        {isTotal && (
          <>
            <div className="input-group">
              <label>Your Pick</label>
              <div className="bet-type-toggle" role="radiogroup" aria-label="Over or under">
                {(['over', 'under'] as TotalSide[]).map(side => (
                  <button
                    key={side}
                    type="button"
                    role="radio"
                    aria-checked={totalSide === side}
                    className={`bet-type-option ${side} ${totalSide === side ? 'active' : ''}`}
                    onClick={() => setTotalSide(side)}
                  >
                    {side === 'over' ? '⬆ OVER' : '⬇ UNDER'}
                  </button>
                ))}
              </div>
            </div>
            <div className="input-group">
              <label htmlFor="manualSpread">Total Line ({totalUnit(sport)})</label>
              <input
                id="manualSpread"
                type="number"
                className="input-field"
                value={pointSpread}
                onChange={(e) => setPointSpread(e.target.value)}
                placeholder={TOTALS_SPORTS.has(sport) ? 'e.g. 6.5' : 'e.g. 47.5'}
                min="0"
                step="0.5"
              />
            </div>
          </>
        )}

        {/* Teams */}
        <div className="input-group">
          <label htmlFor="manualTeamA">{isTotal ? 'Home Team' : 'Your Pick (Team)'}</label>
          <input
            id="manualTeamA"
            type="text"
            className="input-field"
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            placeholder={TOTALS_SPORTS.has(sport) ? 'e.g. Philadelphia Flyers' : 'e.g. Kansas City Chiefs'}
          />
        </div>
        <div className="input-group">
          <label htmlFor="manualTeamB">{isTotal ? 'Away Team' : 'Opponent (Team)'}</label>
          <input
            id="manualTeamB"
            type="text"
            className="input-field"
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            placeholder={TOTALS_SPORTS.has(sport) ? 'e.g. Utah Mammoth' : 'e.g. Buffalo Bills'}
          />
        </div>

        {/* Venue (not meaningful for a total — both teams share the result) */}
        {!isTotal && (
        <div className="input-group">
          <label htmlFor="manualVenue">Venue (for your pick)</label>
          <select
            id="manualVenue"
            className="input-field"
            value={venue}
            onChange={(e) => setVenue(e.target.value as 'home' | 'away' | 'neutral')}
          >
            <option value="home">🏠 Home</option>
            <option value="away">✈️ Away</option>
            <option value="neutral">⚖️ Neutral</option>
          </select>
        </div>
        )}

        {/* Odds + Wager */}
        <div className="input-group">
          <label htmlFor="manualOdds">American Odds</label>
          <input
            id="manualOdds"
            type="number"
            className="input-field"
            value={americanOdds}
            onChange={(e) => setAmericanOdds(e.target.value)}
            placeholder="e.g. -110 or +150"
            step="1"
          />
        </div>
        <div className="input-group">
          <label htmlFor="manualWager">Wager Amount</label>
          <input
            id="manualWager"
            type="number"
            className="input-field"
            value={actualWager}
            onChange={(e) => setActualWager(e.target.value)}
            placeholder="e.g. 50.00"
            min="0"
            step="0.01"
          />
        </div>

        {/* Optional spread */}
        {betType === 'spread' && (
        <div className="input-group">
          <label htmlFor="manualSpread">Point Spread (optional)</label>
          <input
            id="manualSpread"
            type="number"
            className="input-field"
            value={pointSpread}
            onChange={(e) => setPointSpread(e.target.value)}
            placeholder="e.g. -3.5"
            step="0.5"
          />
        </div>
        )}

        {/* Notes */}
        <div className="input-group">
          <label htmlFor="manualNotes">Notes (optional)</label>
          <textarea
            id="manualNotes"
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
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="loading-spinner"></span>
                Logging...
              </>
            ) : (
              'Log Bet'
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="manual-log-bet-btn"
        onClick={() => {
          if (!isAuthenticated) {
            onLoginRequired?.();
          } else {
            setIsOpen(true);
          }
        }}
      >
        ➕ Log a Bet Manually
      </button>
      {modalContent && ReactDOM.createPortal(modalContent, document.body)}
    </>
  );
}

// ==================== Live score line ====================
/**
 * What to show under a bet card: the live/final score, game status and, while
 * the game is on, how the bet stands right now.
 */
function getScoreLine(bet: SavedBet, info: LiveBetInfo | undefined, isTotal: boolean) {
  const A = bet.matchup.teamA.abbreviation || bet.matchup.teamA.name;
  const B = bet.matchup.teamB.abbreviation || bet.matchup.teamB.name;
  // Totals are shown "away @ home" (teamB first), spreads/moneylines as "pick vs opponent".
  const fmt = (a: number, b: number) => isTotal ? `${B} ${b} – ${a} ${A}` : `${A} ${a} – ${b} ${B}`;

  if (bet.outcome.result !== 'pending') {
    const s = bet.outcome.actualScore;
    if (!s || s.teamA == null || s.teamB == null) return null;
    return {
      state: 'final',
      score: fmt(s.teamA, s.teamB),
      status: bet.outcome.autoGraded ? 'Final · auto-graded' : 'Final',
      tracking: isTotal ? `Total ${s.teamA + s.teamB}` : '',
      trackingClass: '',
    };
  }

  if (!info?.matched) return null;
  if (info.status === 'scheduled' || info.status === 'postponed' || info.scoreA == null || info.scoreB == null) {
    const when = info.startTime
      ? new Date(info.startTime).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })
      : '';
    return {
      state: 'scheduled',
      score: info.status === 'postponed' ? 'Postponed' : 'Not started',
      status: info.status === 'postponed' ? (info.statusDetail || '') : when,
      tracking: '',
      trackingClass: '',
    };
  }

  const g = info.currentGrade;
  const isFinal = info.status === 'final';
  const tracking = g
    ? isFinal
      ? g === 'win' ? 'Won' : g === 'loss' ? 'Lost' : 'Push'
      : g === 'win' ? 'Winning' : g === 'loss' ? 'Losing' : 'Push'
    : '';
  return {
    state: isFinal ? 'final' : 'live',
    score: fmt(info.scoreA, info.scoreB),
    status: isFinal ? 'Final' : `🔴 ${info.statusDetail || 'Live'}`,
    tracking: isTotal
      ? `Total ${info.scoreA + info.scoreB}${tracking ? ` · ${tracking}` : ''}`
      : tracking,
    trackingClass: g || '',
  };
}

// ==================== Bet History Component ====================
interface BetHistoryProps {
  isAuthenticated: boolean;
  onBankrollUpdate?: () => void;
  onLoginRequired?: () => void;
}

export function BetHistory({ isAuthenticated, onBankrollUpdate, onLoginRequired }: BetHistoryProps) {
  const [bets, setBets] = useState<SavedBet[]>([]);
  const [stats, setStats] = useState<BetStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'settled'>('all');
  const [sportFilter, setSportFilter] = useState<'all' | SportKey>('all');
  const [betTypeFilter, setBetTypeFilter] = useState<'all' | BetType>('all');
  const [expandedBet, setExpandedBet] = useState<string | null>(null);
  const [updatingBet, setUpdatingBet] = useState<string | null>(null);
  const [live, setLive] = useState<Record<string, LiveBetInfo>>({});
  const [justGraded, setJustGraded] = useState<SavedBet[]>([]);

  // Pull live scores for pending bets; the backend auto-grades any whose game
  // has gone final and returns them already settled.
  const syncScores = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/bets/sync-scores`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) return;
      const data: { live: Record<string, LiveBetInfo>; graded: SavedBet[] } = await res.json();
      setLive(data.live || {});
      if (data.graded?.length) {
        const byId = new Map(data.graded.map(b => [b._id, b]));
        setBets(prev => prev.map(b => byId.get(b._id) || b));
        setJustGraded(data.graded);
        const statsRes = await fetch(`${BACKEND_URL}/api/bets/stats`, { credentials: 'include' });
        if (statsRes.ok) setStats(await statsRes.json());
        onBankrollUpdate?.();
      }
    } catch (err) {
      console.error('Failed to sync live scores:', err);
    }
  }, [isAuthenticated, onBankrollUpdate]);

  // Fetch bets and stats
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return;

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
  }, [isAuthenticated]);

  useEffect(() => {
    fetchData().then(syncScores);
  }, [fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep polling while any pending bet's game is live (or about to start).
  const hasLiveGames = useMemo(() => {
    const soon = Date.now() + 30 * 60 * 1000;
    return bets.some(b => {
      if (b.outcome.result !== 'pending') return false;
      const info = live[b._id];
      if (!info?.matched) return false;
      return info.status === 'in_progress' ||
        (info.status === 'scheduled' && !!info.startTime && new Date(info.startTime).getTime() < soon);
    });
  }, [bets, live]);

  useEffect(() => {
    if (!hasLiveGames) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') syncScores();
    }, LIVE_POLL_MS);
    return () => window.clearInterval(id);
  }, [hasLiveGames, syncScores]);

  // Filter bets
  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      if (filter === 'pending' && bet.outcome.result !== 'pending') return false;
      if (filter === 'settled' && bet.outcome.result === 'pending') return false;
      if (sportFilter !== 'all' && !sportMatchesFilter(bet.matchup.sport, sportFilter)) return false;
      if (betTypeFilter !== 'all' && resolveBetType(bet.matchup.sport, bet.estimation.betType) !== betTypeFilter) return false;
      return true;
    });
  }, [bets, filter, sportFilter, betTypeFilter]);

  // Record Over/Under on a totals bet that was logged without a side
  const setTotalSide = async (betId: string, totalSide: TotalSide) => {
    setUpdatingBet(betId);
    try {
      const response = await fetch(`${BACKEND_URL}/api/bets/${betId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ totalSide })
      });
      if (response.ok) {
        const data = await response.json();
        setBets(prev => prev.map(b => b._id === betId ? data.bet : b));
      }
    } catch (err) {
      console.error('Failed to set over/under side:', err);
    } finally {
      setUpdatingBet(null);
    }
  };

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

  // Delete all bets
  const deleteAllBets = async () => {
    if (!confirm('Are you sure you want to delete ALL betting history? This cannot be undone.')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/bets`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setBets([]);
        setStats(null);
      }
    } catch (err) {
      console.error('Failed to delete all bets:', err);
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
      {/* Manually log a bet without going through the calculator */}
      <div className="manual-log-bar">
        <ManualLogBetButton
          isAuthenticated={isAuthenticated}
          onLoginRequired={onLoginRequired}
          onBetLogged={() => {
            fetchData();
            onBankrollUpdate?.();
          }}
        />
      </div>

      {justGraded.length > 0 && (
        <div className="auto-graded-banner" onClick={() => setJustGraded([])}>
          🤖 Auto-graded {justGraded.length} bet{justGraded.length > 1 ? 's' : ''} from final scores:{' '}
          {justGraded.map(b => `${b.matchup.teamA.abbreviation || b.matchup.teamA.name} ${b.outcome.result.toUpperCase()}`).join(' · ')}
          <span className="dismiss">✕</span>
        </div>
      )}

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
            {SPORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Type:</label>
          <select value={betTypeFilter} onChange={(e) => setBetTypeFilter(e.target.value as any)}>
            <option value="all">All Types</option>
            <option value="spread">Spread</option>
            <option value="total">Over/Under</option>
            <option value="moneyline">Moneyline</option>
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
        {bets.length > 0 && (
          <button className="delete-all-btn" onClick={deleteAllBets}>
            🗑️ Delete All
          </button>
        )}
      </div>

      {/* Bet List */}
      {filteredBets.length === 0 ? (
        <div className="no-bets">
          <p>No bets found. Start logging your bets to track your performance!</p>
        </div>
      ) : (
        <div className="bet-list">
          {filteredBets.map(bet => {
            const betType = resolveBetType(bet.matchup.sport, bet.estimation.betType);
            const isTotal = betType === 'total';
            const side = bet.estimation.totalSide;
            const home = bet.matchup.teamA.abbreviation || bet.matchup.teamA.name;
            const away = bet.matchup.teamB.abbreviation || bet.matchup.teamB.name;
            const scoreLine = getScoreLine(bet, live[bet._id], isTotal);
            return (
            <div
              key={bet._id}
              className={`bet-card ${bet.outcome.result}`}
              onClick={() => setExpandedBet(expandedBet === bet._id ? null : bet._id)}
            >
              <div className="bet-card-header">
                <div className="bet-matchup">
                  <span className="sport-icon" title={getSportMeta(bet.matchup.sport).label}>
                    {getSportMeta(bet.matchup.sport).icon}
                  </span>
                  {isTotal ? (
                    <div className="teams-container">
                      <div className="your-pick-label">
                        <span className={`pick-badge total-badge ${side || 'unknown'}`}>
                          {side ? `O/U · ${sideLabel(side)}` : 'O/U TOTAL'}
                        </span>
                        <span className="pick-team-name">
                          {side ? `${side === 'over' ? 'Over' : 'Under'} ${bet.estimation.pointSpread}` : `Total ${bet.estimation.pointSpread}`}
                        </span>
                      </div>
                      <span className="vs-text">{away} @ {home} · total {totalUnit(bet.matchup.sport)}</span>
                    </div>
                  ) : (
                    <div className="teams-container">
                      <div className="your-pick-label">
                        <span className="pick-badge">YOUR PICK</span>
                        <span className="pick-team-name">{home}</span>
                      </div>
                      <span className="vs-text">vs {away}</span>
                    </div>
                  )}
                </div>
                <div className={`bet-status ${bet.outcome.result}`}>
                  {bet.outcome.result === 'pending' ? '⏳ Pending' :
                   bet.outcome.result === 'win' ? '✅ Won' :
                   bet.outcome.result === 'loss' ? '❌ Lost' :
                   bet.outcome.result === 'push' ? '↔️ Push' : '🚫 Cancelled'}
                </div>
              </div>

              {scoreLine && (
                <div className={`bet-live-score ${scoreLine.state}`}>
                  <span className="score-pill">{scoreLine.score}</span>
                  <span className="score-status">{scoreLine.status}</span>
                  {scoreLine.tracking && (
                    <span className={`score-tracking ${scoreLine.trackingClass}`}>{scoreLine.tracking}</span>
                  )}
                </div>
              )}

              <div className="bet-card-body">
                <div className="bet-detail">
                  <span className="detail-label">{isTotal ? 'Total Line:' : betType === 'moneyline' ? 'Bet:' : 'Spread:'}</span>
                  <span>
                    {isTotal
                      ? `${side === 'over' ? 'O ' : side === 'under' ? 'U ' : ''}${bet.estimation.pointSpread}`
                      : betType === 'moneyline' ? 'Moneyline' : formatSpread(bet.estimation.pointSpread)}
                  </span>
                </div>
                <div className="bet-detail">
                  <span className="detail-label">{isTotal && side ? `${side === 'over' ? 'Over' : 'Under'} Prob:` : 'Prob:'}</span>
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
                      <span>Bet type:</span>
                      <span>{isTotal ? `Over/Under — ${side ? sideLabel(side) : 'side not recorded'}` : betType === 'moneyline' ? 'Moneyline' : 'Point Spread'}</span>
                    </div>
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

                  {/* Older totals bets didn't save which side was bet — let the user record it */}
                  {isTotal && !side && bet.outcome.result === 'pending' && (
                    <div className="outcome-actions">
                      <p>Which side did you bet?</p>
                      <div className="outcome-buttons">
                        <button
                          className="outcome-btn side-over"
                          onClick={() => setTotalSide(bet._id, 'over')}
                          disabled={updatingBet === bet._id}
                        >
                          ⬆ Over {bet.estimation.pointSpread}
                        </button>
                        <button
                          className="outcome-btn side-under"
                          onClick={() => setTotalSide(bet._id, 'under')}
                          disabled={updatingBet === bet._id}
                        >
                          ⬇ Under {bet.estimation.pointSpread}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Outcome Actions for Pending Bets */}
                  {bet.outcome.result === 'pending' && (
                    <div className="outcome-actions">
                      <p className="auto-grade-hint">
                        {live[bet._id]?.matched
                          ? isTotal && !side
                            ? 'Pick Over or Under above so this bet can auto-grade when the game goes final.'
                            : '🤖 This bet will grade itself automatically when the game goes final.'
                          : live[bet._id]
                            ? "Couldn't find this game on the live scoreboard — grade it manually."
                            : ''}
                      </p>
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
            );
          })}
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

  /* Manual Log Bet Button + Bar */
  .manual-log-bar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 1.5rem;
  }
  .manual-log-bet-btn {
    background: var(--accent-gradient);
    color: #fff;
    border: none;
    padding: .75rem 1.25rem;
    border-radius: 12px;
    cursor: pointer;
    font-weight: 700;
    font-size: .95rem;
    transition: .25s ease;
    box-shadow:
      0 6px 18px rgba(59, 130, 246, .35),
      0 0 0 1px rgba(255, 255, 255, 0.15) inset;
    display: flex;
    align-items: center;
    gap: .5rem;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .manual-log-bet-btn:hover {
    transform: translateY(-2px);
    box-shadow:
      0 10px 24px rgba(59, 130, 246, .45),
      0 0 0 1px rgba(255, 255, 255, 0.25) inset;
  }
  @media (max-width: 640px) {
    .manual-log-bar {
      justify-content: stretch;
    }
    .manual-log-bet-btn {
      width: 100%;
      justify-content: center;
    }
  }
  /* Hint text inside the manual log modal */
  .manual-log-hint {
    margin: 0 0 1.5rem;
    font-size: .9rem;
    line-height: 1.4;
    color: rgba(255, 255, 255, 0.55);
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
    z-index: 100000;
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
  .delete-all-btn {
    padding: .5rem 1rem;
    background: linear-gradient(135deg, #ef4444, #dc2626);
    border: none;
    color: #fff;
    border-radius: 8px;
    cursor: pointer;
    font-size: .9rem;
    font-weight: 600;
    transition: .2s ease;
    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
  }
  .delete-all-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(239, 68, 68, 0.45);
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
  .bet-live-score {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: .5rem;
    margin: .25rem 1rem .5rem;
    font-size: .85rem;
  }
  .bet-live-score .score-pill {
    padding: .2rem .65rem;
    border-radius: 999px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    background: #475569;
    color: #f8fafc;
  }
  .bet-live-score.live .score-pill { background: #f59e0b; color: #111827; }
  .bet-live-score.scheduled .score-pill { background: rgba(148,163,184,.2); color: #cbd5e1; }
  .bet-live-score .score-status { color: #94a3b8; }
  .bet-live-score .score-tracking { font-weight: 700; color: #cbd5e1; }
  .bet-live-score .score-tracking.win { color: #10b981; }
  .bet-live-score .score-tracking.loss { color: #ef4444; }
  .bet-live-score .score-tracking.push { color: #f59e0b; }
  .auto-graded-banner {
    position: relative;
    margin: 0 0 1rem;
    padding: .75rem 2rem .75rem 1rem;
    border-radius: 12px;
    background: rgba(16,185,129,.12);
    border: 1px solid rgba(16,185,129,.4);
    color: #a7f3d0;
    font-weight: 600;
    font-size: .9rem;
    cursor: pointer;
  }
  .auto-graded-banner .dismiss { position: absolute; right: .75rem; top: .7rem; opacity: .7; }
  .outcome-actions p.auto-grade-hint {
    font-size: .8rem;
    color: #94a3b8;
    font-weight: 500;
    margin-bottom: .5rem;
  }
  .outcome-actions p.auto-grade-hint:empty { display: none; }

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
  /* ---- Over/Under (totals) bets ----
     Over = sky blue, Under = violet: kept distinct from the win/loss
     green/red so a side never reads as a result. */
  .pick-badge.total-badge.over {
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.15);
    border-color: rgba(56, 189, 248, 0.4);
  }
  .pick-badge.total-badge.under {
    color: #a78bfa;
    background: rgba(167, 139, 250, 0.15);
    border-color: rgba(167, 139, 250, 0.4);
  }
  .pick-badge.total-badge.unknown {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.35);
  }
  .your-pick-banner.total-pick.over {
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(14, 165, 233, 0.1));
    border-color: rgba(56, 189, 248, 0.45);
  }
  .your-pick-banner.total-pick.over .pick-indicator { color: #38bdf8; }
  .your-pick-banner.total-pick.under {
    background: linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(139, 92, 246, 0.1));
    border-color: rgba(167, 139, 250, 0.45);
  }
  .your-pick-banner.total-pick.under .pick-indicator { color: #a78bfa; }
  .outcome-btn.side-over {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.35);
  }
  .outcome-btn.side-under {
    background: rgba(167, 139, 250, 0.12);
    color: #a78bfa;
    border: 1px solid rgba(167, 139, 250, 0.35);
  }
  .bet-type-toggle {
    display: flex;
    gap: 0.5rem;
  }
  .bet-type-option {
    flex: 1;
    padding: 0.6rem 0.5rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    min-height: 44px;
  }
  .bet-type-option.active {
    border-color: rgba(16, 185, 129, 0.6);
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }
  .bet-type-option.over.active {
    border-color: rgba(56, 189, 248, 0.6);
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
  }
  .bet-type-option.under.active {
    border-color: rgba(167, 139, 250, 0.6);
    background: rgba(167, 139, 250, 0.15);
    color: #a78bfa;
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
