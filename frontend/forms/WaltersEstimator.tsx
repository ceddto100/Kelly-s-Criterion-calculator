/**
 * WaltersEstimator.tsx
 *
 * THE WALTERS PROTOCOL — College Football
 *
 * Power ratings, not raw stat averages: college schedules are too uneven for
 * points-per-game to mean the same thing week to week, while SP+ and FPI both
 * adjust every result for the opponent. Each team's rating is the SP+/FPI
 * blend from /stats/cfb, then:
 *
 * - Home field: +3.0 (0 at neutral sites)
 * - S-Factors: off a bye, short week, 2+ time zones / early body clock,
 *   altitude, bounceback after a 21+ loss (all detected automatically from
 *   the weekly slate), plus lookahead (suggested) and letdown (manual)
 * - C-Factors: starting QB out, valued by the backup behind him
 * - Rivalry games pulled toward a pick'em; 28+ point lines cap at LEAN
 *
 * The math lives in mcp-server/src/utils/waltersCfb.ts and is shared with the
 * Today's Games cards and the automatic pick log, so all three agree.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  WALTERS_CFB,
  WALTERS_CFB_VERSION,
  projectWalters,
  updateRating,
  type AutoFactors,
  type QbStatus,
  type Venue,
} from '../utils/waltersCfb';
import {
  buildSlateGames,
  lineLabel,
  loadCFBData,
  prefillForTeams,
  summarizePicks,
  teamLabel,
  type CFBData,
  type PrefillTeam,
  type WaltersPrefill,
} from '../utils/cfbStatsLoader';

/* === TYPES === */
type FactorKey = 'bye' | 'shortWeek' | 'travel' | 'altitude' | 'bounceback' | 'lookahead' | 'letdown';

interface SideState {
  teamId: string;
  name: string;
  abbreviation: string;
  rating: string;
  rank?: number;
  factors: Record<FactorKey, boolean>;
  qb: QbStatus;
  /** What the slate detected for this team; null for a hand-built matchup. */
  auto: AutoFactors | null;
  hints: string[];
}

interface GameInfo {
  gameId?: number;
  week?: number;
  startDate?: string;
  startTimeTbd?: boolean;
  venueName?: string;
  total: number | null;
  lineBooks: number;
}

interface WaltersState {
  a: SideState;
  b: SideState;
  venue: Venue;
  marketSpread: string;
  rivalry: boolean;
  game: GameInfo | null;
}

const NO_FACTORS: Record<FactorKey, boolean> = {
  bye: false, shortWeek: false, travel: false, altitude: false, bounceback: false, lookahead: false, letdown: false,
};

const emptySide = (): SideState => ({
  teamId: '', name: '', abbreviation: '', rating: '', factors: { ...NO_FACTORS }, qb: 'none', auto: null, hints: [],
});

const getInitialState = (): WaltersState => ({
  a: emptySide(), b: emptySide(), venue: 'home', marketSpread: '', rivalry: false, game: null,
});

const fmtRating = (v: number | undefined) => (v === undefined ? '' : v.toFixed(1));

function sideFromPrefill(team: PrefillTeam, auto: AutoFactors, hints: string[]): SideState {
  return {
    teamId: team.teamId !== undefined ? String(team.teamId) : '',
    name: team.name,
    abbreviation: team.abbreviation,
    rating: fmtRating(team.rating),
    rank: team.rank,
    // Detected factors start switched on; a lookahead is only ever suggested.
    factors: { ...NO_FACTORS, bye: auto.bye, shortWeek: auto.shortWeek, travel: auto.travel, altitude: auto.altitude, bounceback: auto.bounceback },
    qb: 'none',
    auto,
    hints,
  };
}

function stateFromPrefill(p: WaltersPrefill): WaltersState {
  return {
    a: sideFromPrefill(p.teamA, p.auto.A, p.hints.A),
    b: sideFromPrefill(p.teamB, p.auto.B, p.hints.B),
    venue: p.venue,
    marketSpread: p.marketSpread === null ? '' : String(p.marketSpread),
    rivalry: false,
    game:
      p.gameId === undefined
        ? null
        : { gameId: p.gameId, week: p.week, startDate: p.startDate, startTimeTbd: p.startTimeTbd, venueName: p.venueName, total: p.total, lineBooks: p.lineBooks },
  };
}

const flipVenue = (v: Venue): Venue => (v === 'home' ? 'away' : v === 'away' ? 'home' : 'neutral');
const signed = (v: number, dp = 1) => `${v > 0 ? '+' : ''}${v.toFixed(dp)}`;
const pts = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)} pts`;
/** A team's own spread as books write it: "+3.5", "-7", or "PK". */
const spreadText = (v: number) => (v === 0 ? 'PK' : `${v > 0 ? '+' : ''}${v}`);

function kickoffLabel(iso?: string, tbd?: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return tbd
    ? `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · time TBD`
    : d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

const shortDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

/* === FACTOR COPY === */
const F = WALTERS_CFB.factors;
const S_FACTORS: { key: FactorKey; label: string; value: number }[] = [
  { key: 'bye', label: 'Off a bye (opponent not)', value: F.bye },
  { key: 'shortWeek', label: 'Short week (≤5 days)', value: F.shortWeek },
  { key: 'travel', label: '2+ time zones / early body clock', value: F.travel },
  { key: 'altitude', label: 'Visiting at altitude', value: F.altitude },
  { key: 'bounceback', label: 'Bounceback (lost by 21+)', value: F.bounceback },
  { key: 'lookahead', label: 'Lookahead (top-10 next)', value: F.lookahead },
  { key: 'letdown', label: 'Letdown spot', value: F.letdown },
];

/* === STYLES === */
const WaltersEstimatorStyles = `
  .walters-panel {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }

  .walters-section-header {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent-electric, #8b5cf6);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .walters-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  @media (max-width: 480px) {
    .walters-grid { grid-template-columns: 1fr; }
  }

  .walters-input-group { margin-bottom: 1rem; }

  .walters-input-group label {
    display: block;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-muted, #94a3b8);
    margin-bottom: 0.35rem;
  }

  .walters-input {
    width: 100%;
    box-sizing: border-box;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #fff);
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  select.walters-input { font-family: inherit; }

  .walters-input:focus {
    outline: none;
    border-color: var(--accent-electric, #8b5cf6);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }

  .walters-input::placeholder { color: rgba(148, 163, 184, 0.5); }

  .walters-info {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
    color: var(--text-secondary, #94a3b8);
    line-height: 1.5;
  }

  .walters-info strong { color: #3b82f6; }
  .walters-status { display: block; margin-top: 0.35rem; font-size: 0.75rem; color: var(--text-muted, #64748b); }

  .walters-warning {
    background: rgba(244, 63, 94, 0.1);
    border: 1px solid rgba(244, 63, 94, 0.35);
    color: #fda4af;
    border-radius: 10px;
    padding: 0.7rem 0.9rem;
    margin-bottom: 1rem;
    font-size: 0.82rem;
    line-height: 1.5;
  }

  /* This week's Top 25 */
  .walters-strip {
    display: flex;
    gap: 0.6rem;
    overflow-x: auto;
    padding-bottom: 0.4rem;
    scroll-snap-type: x proximity;
    /* The tab content is a grid; without this the chips' combined width
       stretches the whole panel past the screen instead of scrolling. */
    width: 0;
    min-width: 100%;
  }

  .walters-chip {
    flex: 0 0 auto;
    width: 200px;
    scroll-snap-align: start;
    text-align: left;
    background: rgba(15, 23, 42, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0.6rem 0.75rem;
    color: var(--text-primary, #fff);
    cursor: pointer;
    transition: border-color 0.15s ease, transform 0.15s ease;
    font: inherit;
  }

  .walters-chip:hover, .walters-chip:focus-visible {
    border-color: var(--accent-electric, #8b5cf6);
    transform: translateY(-1px);
    outline: none;
  }

  .walters-chip.selected { border-color: var(--accent-electric, #8b5cf6); background: rgba(139, 92, 246, 0.15); }
  .chip-teams { font-weight: 700; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chip-meta { font-size: 0.7rem; color: var(--text-muted, #64748b); margin-top: 0.15rem; }
  .chip-lean { font-size: 0.72rem; font-weight: 700; margin-top: 0.35rem; font-family: 'JetBrains Mono', monospace; }

  /* Factor Cards */
  .factor-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(15, 23, 42, 0.5);
    padding: 0.6rem 0.85rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    margin-bottom: 0.5rem;
  }

  .factor-card:hover { background: rgba(15, 23, 42, 0.7); border-color: rgba(255, 255, 255, 0.15); }
  .factor-card.active { background: rgba(139, 92, 246, 0.15); border-color: var(--accent-electric, #8b5cf6); }
  .factor-card:focus-visible { outline: 2px solid var(--accent-electric, #8b5cf6); outline-offset: 2px; }
  .factor-card .factor-label { font-size: 0.8rem; font-weight: 500; color: var(--text-secondary, #cbd5e1); }
  .factor-card .factor-value { font-size: 0.7rem; font-weight: 700; color: var(--text-muted, #64748b); font-family: 'JetBrains Mono', monospace; }
  .factor-card.active .factor-value { color: var(--accent-electric, #8b5cf6); }

  .factor-badge {
    font-size: 0.58rem;
    font-weight: 800;
    letter-spacing: 0.05em;
    padding: 0.08rem 0.35rem;
    border-radius: 6px;
    margin-left: 0.4rem;
    background: rgba(16, 185, 129, 0.18);
    color: #10b981;
    vertical-align: middle;
  }

  .factor-badge.suggested { background: rgba(251, 191, 36, 0.18); color: #fbbf24; }

  .factor-indicator {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    transition: all 0.2s ease;
  }

  .factor-card.active .factor-indicator {
    background: var(--accent-electric, #8b5cf6);
    border-color: var(--accent-electric, #8b5cf6);
    box-shadow: 0 0 8px var(--accent-electric, #8b5cf6);
  }

  .team-column-header {
    text-align: center;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }

  .team-column-header .team-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted, #64748b); }
  .team-column-header .team-name { font-size: 1rem; font-weight: 700; color: var(--text-primary, #fff); }

  .rank-badge {
    display: inline-block;
    font-size: 0.7rem;
    font-weight: 800;
    color: #fbbf24;
    font-family: 'JetBrains Mono', monospace;
  }

  .walters-hint { font-size: 0.72rem; color: #fbbf24; margin: -0.5rem 0 0.75rem; line-height: 1.45; }
  .walters-note { font-size: 0.72rem; color: var(--text-muted, #64748b); margin-top: 0.35rem; line-height: 1.45; }

  /* Updater Tool */
  .updater-tool {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .updater-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  .updater-title { font-size: 0.9rem; font-weight: 700; color: #10b981; }

  .updater-result {
    text-align: center;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    margin-top: 0.75rem;
  }

  .updater-result-label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted, #64748b); }
  .updater-result-value { font-size: 1.5rem; font-weight: 800; color: #10b981; font-family: 'JetBrains Mono', monospace; }

  /* Results Panel */
  .walters-results {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    margin-top: 1.5rem;
    text-align: center;
  }

  .walters-results-header { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted, #64748b); margin-bottom: 0.5rem; }
  .walters-true-line { font-size: 2.25rem; font-weight: 900; font-family: 'JetBrains Mono', monospace; margin-bottom: 0.25rem; }
  .walters-true-line.positive { color: #10b981; }
  .walters-true-line.negative { color: #f43f5e; }

  .walters-edge-display {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin: 1rem 0;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    flex-wrap: wrap;
  }

  .edge-item { text-align: center; }
  .edge-label { font-size: 0.65rem; text-transform: uppercase; color: var(--text-muted, #64748b); }
  .edge-value { font-size: 1.1rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

  .walters-recommendation {
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.95rem;
    margin-top: 1rem;
    display: inline-block;
  }

  .walters-recommendation.strong { background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.4); }
  .walters-recommendation.bet { background: rgba(251, 191, 36, 0.2); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.4); }
  .walters-recommendation.lean { background: rgba(249, 115, 22, 0.2); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.4); }
  .walters-recommendation.no-bet { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); }

  .breakdown-toggle {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-secondary, #94a3b8);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    margin-top: 1rem;
    transition: all 0.2s ease;
  }

  .breakdown-toggle:hover { background: rgba(255, 255, 255, 0.05); color: var(--text-primary, #fff); }

  .breakdown-panel { margin-top: 1rem; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 10px; text-align: left; }

  .breakdown-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.35rem 0;
    font-size: 0.85rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .breakdown-row:last-child {
    border-bottom: none;
    font-weight: 700;
    padding-top: 0.5rem;
    margin-top: 0.25rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .breakdown-label { color: var(--text-muted, #64748b); }
  .breakdown-value { font-family: 'JetBrains Mono', monospace; color: var(--text-primary, #fff); }
  .breakdown-value.positive { color: #10b981; }
  .breakdown-value.negative { color: #f43f5e; }

  .venue-selector { display: flex; gap: 0.5rem; margin-bottom: 1rem; }

  .venue-btn {
    flex: 1;
    min-width: 0;
    padding: 0.6rem;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-secondary, #94a3b8);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .venue-btn:hover { background: rgba(15, 23, 42, 0.7); }
  .venue-btn.active { background: var(--accent-electric, #8b5cf6); border-color: var(--accent-electric, #8b5cf6); color: #fff; }

  .walters-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; }

  .walters-btn {
    flex: 1;
    padding: 0.85rem 1.25rem;
    border-radius: 12px;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    min-width: 100px;
  }

  .walters-btn-primary {
    background: var(--button-primary, linear-gradient(135deg, #8b5cf6, #6366f1));
    color: #fff;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  .walters-btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4); }
  .walters-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .walters-btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-secondary, #94a3b8);
  }

  .walters-btn-secondary:hover { background: rgba(255, 255, 255, 0.08); color: var(--text-primary, #fff); }

  .walters-record { font-size: 0.8rem; color: var(--text-secondary, #94a3b8); line-height: 1.5; }
  .walters-record strong { color: var(--text-primary, #fff); }
`;

/* === COMPONENT: Factor Card === */
interface FactorCardProps {
  label: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  badge?: 'AUTO' | 'SUGGESTED';
}

const FactorCard: React.FC<FactorCardProps> = ({ label, value, checked, onChange, badge }) => (
  <div
    className={`factor-card ${checked ? 'active' : ''}`}
    onClick={onChange}
    role="checkbox"
    aria-checked={checked}
    tabIndex={0}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange();
      }
    }}
  >
    <div>
      <div className="factor-label">
        {label}
        {badge && <span className={`factor-badge ${badge === 'SUGGESTED' ? 'suggested' : ''}`}>{badge}</span>}
      </div>
      <div className="factor-value">{value}</div>
    </div>
    <div className="factor-indicator" />
  </div>
);

/* === COMPONENT: Rating Updater === */
const RatingUpdater: React.FC<{ isOpen: boolean; onToggle: () => void }> = ({ isOpen, onToggle }) => {
  const [form, setForm] = useState({ oldRating: '', oppRating: '', margin: '', adjustment: '0', venue: 'home' as Venue });
  const [result, setResult] = useState<ReturnType<typeof updateRating> | null>(null);
  const decayLabel = `${Math.round(WALTERS_CFB.decayRate * 100)}/${Math.round((1 - WALTERS_CFB.decayRate) * 100)}`;

  const handleCalculate = () => {
    const oldRating = parseFloat(form.oldRating);
    const opponentRating = parseFloat(form.oppRating);
    const actualMargin = parseFloat(form.margin);
    if ([oldRating, opponentRating, actualMargin].some((v) => Number.isNaN(v))) return;
    setResult(updateRating({ oldRating, opponentRating, actualMargin, venue: form.venue, adjustment: parseFloat(form.adjustment) || 0 }));
  };

  if (!isOpen) {
    return (
      <button className="walters-btn walters-btn-secondary" onClick={onToggle} style={{ marginBottom: '1rem', width: '100%' }}>
        🛠️ Open {decayLabel} Rating Updater Tool
      </button>
    );
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value });

  return (
    <div className="updater-tool">
      <div className="updater-header">
        <span className="updater-title">📊 {decayLabel} Weekly Rating Updater</span>
        <button className="walters-btn walters-btn-secondary" onClick={onToggle} style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', flex: 'none' }}>
          Close
        </button>
      </div>

      <div className="walters-info">
        <strong>How it works:</strong> moves your own rating by {Math.round((1 - WALTERS_CFB.decayRate) * 100)}% of the
        surprise — how much better or worse the team did than its rating predicted. Surprises are capped at ±
        {WALTERS_CFB.updateResidualCap} points so a blowout of an overmatched opponent can't swing the rating.
      </div>

      <div className="walters-grid">
        <div className="walters-input-group">
          <label>Old Rating (Pre-Game)</label>
          <input type="number" className="walters-input" value={form.oldRating} onChange={set('oldRating')} placeholder="e.g., 12.5" step="0.1" />
        </div>
        <div className="walters-input-group">
          <label>Opponent's Rating</label>
          <input type="number" className="walters-input" value={form.oppRating} onChange={set('oppRating')} placeholder="e.g., -4.0" step="0.1" />
        </div>
        <div className="walters-input-group">
          <label>Final Margin (Team's Side)</label>
          <input type="number" className="walters-input" value={form.margin} onChange={set('margin')} placeholder="e.g., +14 or -7" step="1" />
        </div>
        <div className="walters-input-group">
          <label>Where They Played</label>
          <select className="walters-input" value={form.venue} onChange={set('venue')}>
            <option value="home">Home</option>
            <option value="away">Away</option>
            <option value="neutral">Neutral site</option>
          </select>
        </div>
        <div className="walters-input-group">
          <label>Injury Adjustment</label>
          <input type="number" className="walters-input" value={form.adjustment} onChange={set('adjustment')} placeholder="e.g., +3 if the QB sat" step="0.5" />
        </div>
      </div>

      <button className="walters-btn walters-btn-primary" onClick={handleCalculate} style={{ width: '100%' }}>
        Calculate New Rating
      </button>

      {result && (
        <div className="updater-result">
          <div className="updater-result-label">New Power Rating</div>
          <div className="updater-result-value">{result.newRating.toFixed(2)}</div>
          <div className="walters-note">
            Expected {signed(result.expectedMargin)} · surprise {signed(result.surprise)}
            {result.cappedSurprise !== result.surprise && ` (capped at ${signed(result.cappedSurprise)})`}
          </div>
        </div>
      )}
    </div>
  );
};

/* === MAIN COMPONENT === */
interface WaltersEstimatorProps {
  onApplyToKelly: (probability: number, matchupData: any, estimationData: any) => void;
  /** A matchup handed over by a Today's Games card; applied whenever a new object arrives. */
  prefill?: WaltersPrefill | null;
}

export const WaltersEstimator: React.FC<WaltersEstimatorProps> = ({ onApplyToKelly, prefill }) => {
  const [state, setState] = useState<WaltersState>(() => (prefill ? stateFromPrefill(prefill) : getInitialState()));
  const [data, setData] = useState<CFBData | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [conference, setConference] = useState('');
  const [showUpdater, setShowUpdater] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    let alive = true;
    loadCFBData()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setDataError(e instanceof Error ? e.message : 'unavailable'));
    return () => {
      alive = false;
    };
  }, []);

  // Re-seed whenever a new pre-fill arrives (a Today's Games tap).
  useEffect(() => {
    if (prefill) setState(stateFromPrefill(prefill));
  }, [prefill]);

  const top25 = useMemo(
    () => (data ? buildSlateGames(data).filter((g) => g.isTop25 && !g.started) : []),
    [data],
  );
  const record = useMemo(() => (data ? summarizePicks(data.picks) : null), [data]);
  const conferences = useMemo(
    () => (data ? [...new Set(data.teams.map((t) => t.conference).filter(Boolean))].sort() : []),
    [data],
  );

  const labelA = state.a.abbreviation || state.a.name || 'Team A';
  const labelB = state.b.abbreviation || state.b.name || 'Team B';

  // Live projection: every input change recomputes, so a result is never stale.
  const result = useMemo(() => {
    const ratingA = parseFloat(state.a.rating);
    const ratingB = parseFloat(state.b.rating);
    if (Number.isNaN(ratingA) || Number.isNaN(ratingB)) return null;
    const spread = parseFloat(state.marketSpread);
    return projectWalters({
      ratingA,
      ratingB,
      venue: state.venue,
      marketSpread: Number.isNaN(spread) ? null : spread,
      rivalry: state.rivalry,
      factorsA: { ...state.a.factors, qb: state.a.qb },
      factorsB: { ...state.b.factors, qb: state.b.qb },
    });
  }, [state]);

  const updateSide = (slot: 'a' | 'b', patch: Partial<SideState>) =>
    setState((prev) => ({ ...prev, [slot]: { ...prev[slot], ...patch } }));

  const toggleFactor = (slot: 'a' | 'b', key: FactorKey) =>
    setState((prev) => ({
      ...prev,
      [slot]: { ...prev[slot], factors: { ...prev[slot].factors, [key]: !prev[slot].factors[key] } },
    }));

  /** Picking a team fills its rating; picking both pulls in this week's game if they meet. */
  const pickTeam = (slot: 'a' | 'b', teamId: string) => {
    if (!data) return;
    setState((prev) => {
      const team = data.teams.find((t) => String(t.teamId) === teamId);
      const side: SideState = team
        ? {
            ...emptySide(),
            teamId,
            name: team.team,
            abbreviation: team.abbreviation,
            rating: fmtRating(team.rating),
            hints: team.ratingsGapBand === '6+' ? ['SP+ and FPI disagree by 6+ points — check QB and injury news'] : [],
          }
        : emptySide();
      const next = { ...prev, game: null, [slot]: side };
      if (next.a.teamId && next.b.teamId) {
        const p = prefillForTeams(data, Number(next.a.teamId), Number(next.b.teamId), prev.venue);
        if (p?.gameId !== undefined) return stateFromPrefill(p);
      }
      return next;
    });
  };

  const handleSwapTeams = () => {
    setState((prev) => {
      const spread = parseFloat(prev.marketSpread);
      return {
        ...prev,
        a: prev.b,
        b: prev.a,
        venue: flipVenue(prev.venue),
        marketSpread: Number.isNaN(spread) ? prev.marketSpread : String(spread === 0 ? 0 : -spread),
      };
    });
  };

  const handleReset = () => {
    setState(getInitialState());
    setShowBreakdown(false);
  };

  // Kelly bets the PICKED side, so it becomes Team A with its own spread and probability.
  const handleApplyToKelly = () => {
    if (!result || result.pick === null || result.pickProbability === null || result.pickSpread === null) return;
    const pickA = result.pick === 'A';
    const picked = pickA ? state.a : state.b;
    const other = pickA ? state.b : state.a;
    const matchupData = {
      sport: 'cfb',
      teamA: { name: picked.name || (pickA ? 'Team A' : 'Team B'), abbreviation: picked.abbreviation || undefined, stats: {} },
      teamB: { name: other.name || (pickA ? 'Team B' : 'Team A'), abbreviation: other.abbreviation || undefined, stats: {} },
      venue: pickA ? state.venue : flipVenue(state.venue),
    };
    const estimationData = {
      pointSpread: result.pickSpread,
      calculatedProbability: result.pickProbability,
      expectedMargin: pickA ? result.predictedMargin : -result.predictedMargin,
      trueLine: pickA ? result.trueLine : -result.trueLine,
      edge: result.edge,
      confidence: result.confidence,
      method: 'walters_protocol_cfb',
      modelVersion: WALTERS_CFB_VERSION,
    };
    onApplyToKelly(result.pickProbability, matchupData, estimationData);
  };

  const teamOptions = (slot: 'a' | 'b') => {
    if (!data) return [];
    const selected = state[slot].teamId;
    return data.teams
      .filter((t) => !conference || t.conference === conference || String(t.teamId) === selected)
      .sort((x, y) => x.team.localeCompare(y.team));
  };

  const noData = data !== null && data.teams.length === 0;
  const pickLabel = result?.pick === 'A' ? labelA : labelB;
  const recommendation =
    !result || result.marketSpread === null
      ? ''
      : result.confidence === 'NO_BET' || result.pick === null
        ? 'NO VALUE - PASS'
        : `${result.confidence === 'STRONG' ? 'STRONG BET' : result.confidence}: ${pickLabel} ${spreadText(result.pickSpread!)}`;

  const renderSide = (slot: 'a' | 'b') => {
    const s = state[slot];
    const label = slot === 'a' ? 'Team A' : 'Team B';
    return (
      <div>
        {data && data.teams.length > 0 && (
          <div className="walters-input-group">
            <label htmlFor={`walters-team-${slot}`}>{label}</label>
            <select id={`walters-team-${slot}`} className="walters-input" value={s.teamId} onChange={(e) => pickTeam(slot, e.target.value)}>
              <option value="">Select a team…</option>
              {teamOptions(slot).map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.team}{t.rating === undefined ? ' (not rated)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="walters-input-group">
          <label>{label} Name</label>
          <input type="text" className="walters-input" value={s.name} onChange={(e) => updateSide(slot, { name: e.target.value, teamId: '', abbreviation: '' })} placeholder={slot === 'a' ? 'e.g., Georgia' : 'e.g., Alabama'} />
        </div>
        <div className="walters-input-group">
          <label>{label} Power Rating</label>
          <input type="number" className="walters-input" value={s.rating} onChange={(e) => updateSide(slot, { rating: e.target.value })} placeholder="e.g., 18.5" step="0.5" />
        </div>
        {s.hints.map((h) => (
          <div key={h} className="walters-hint">⚠ {h}</div>
        ))}
      </div>
    );
  };

  const renderFactors = (slot: 'a' | 'b') => {
    const s = state[slot];
    return (
      <div>
        <div className="team-column-header">
          <div className="team-label">{slot === 'a' ? 'Team A' : 'Team B'}</div>
          <div className="team-name">
            {s.rank !== undefined && <><span className="rank-badge">#{s.rank}</span> </>}
            {s.name || '—'}
          </div>
        </div>
        {S_FACTORS.map((f) => {
          const detected = s.auto?.[f.key as keyof AutoFactors];
          return (
            <FactorCard
              key={f.key}
              label={f.label}
              value={pts(f.value)}
              checked={s.factors[f.key]}
              onChange={() => toggleFactor(slot, f.key)}
              badge={detected ? (f.key === 'lookahead' ? 'SUGGESTED' : 'AUTO') : undefined}
            />
          );
        })}
      </div>
    );
  };

  const renderQb = (slot: 'a' | 'b') => {
    const s = state[slot];
    const options: { value: QbStatus; label: string; points: string }[] = [
      { value: 'none', label: 'Starting QB playing', points: '0.0 pts' },
      { value: 'experienced', label: 'QB out — experienced backup', points: pts(F.qbOutExperienced) },
      { value: 'inexperienced', label: 'QB out — inexperienced backup', points: pts(F.qbOutInexperienced) },
    ];
    return (
      <div role="radiogroup" aria-label={`${slot === 'a' ? labelA : labelB} quarterback`}>
        <div className="team-column-header">
          <div className="team-label">{slot === 'a' ? 'Team A' : 'Team B'}</div>
          <div className="team-name">{s.name || '—'}</div>
        </div>
        {options.map((o) => (
          <FactorCard key={o.value} label={o.label} value={o.points} checked={s.qb === o.value} onChange={() => updateSide(slot, { qb: o.value })} />
        ))}
      </div>
    );
  };

  return (
    <div>
      <style>{WaltersEstimatorStyles}</style>

      {/* Info Panel */}
      <div className="walters-info">
        <strong>College Football Mode:</strong> power ratings blend SP+ and FPI (points vs. an average FBS team), so a
        50-point win over a weak opponent doesn't inflate a team the way scoring averages do. Adds +
        {WALTERS_CFB.homeFieldAdvantage.toFixed(1)} home field, schedule and travel factors, and QB value by backup.
        Lines of {WALTERS_CFB.bigSpread}+ never grade above LEAN.
        {data?.meta?.updatedAt && (
          <span className="walters-status">
            Week {data.meta.week} slate updated {shortDate(data.meta.updatedAt)}
            {data.meta.ratingsUpdatedAt ? ` · ratings updated ${shortDate(data.meta.ratingsUpdatedAt)}` : ''}
            {data.meta.poll ? ` · ranks: ${data.meta.poll}` : ''}
          </span>
        )}
      </div>

      {dataError && (
        <div className="walters-warning">
          Couldn't load /stats/cfb ({dataError}). You can still enter ratings and the spread by hand.
        </div>
      )}
      {noData && (
        <div className="walters-warning">
          College football ratings haven't been generated yet. Once the CFBD_API_KEY secret is added, the stats
          workflow fills them in automatically. You can still enter ratings and the spread by hand.
        </div>
      )}

      {/* This week's Top 25 */}
      {top25.length > 0 && (
        <div className="walters-panel">
          <div className="walters-section-header">
            <span className="icon">🏆</span> This Week's Top 25
          </div>
          <div className="walters-strip">
            {top25.map((g) => {
              const { teamA: home, teamB: away } = g.prefill;
              const p = g.projection;
              const selected = state.game?.gameId === g.row.gameId;
              const lean =
                g.prefill.marketSpread === null
                  ? 'No line yet'
                  : !p
                    ? `Line ${lineLabel(g.prefill.marketSpread, teamLabel(home), teamLabel(away))} · not rated`
                    : p.pick === null || p.confidence === 'NO_BET'
                      ? `${lineLabel(g.prefill.marketSpread, teamLabel(home), teamLabel(away))} · no edge`
                      : `${teamLabel(p.pick === 'A' ? home : away)} ${spreadText(p.pickSpread!)} · ${p.confidence}`;
              return (
                <button
                  key={g.row.gameId}
                  type="button"
                  className={`walters-chip ${selected ? 'selected' : ''}`}
                  onClick={() => setState(stateFromPrefill(g.prefill))}
                  aria-pressed={selected}
                >
                  <div className="chip-teams">
                    {away.rank !== undefined && <><span className="rank-badge">#{away.rank}</span> </>}
                    {teamLabel(away)} {g.row.neutralSite ? 'vs' : '@'}{' '}
                    {home.rank !== undefined && <><span className="rank-badge">#{home.rank}</span> </>}
                    {teamLabel(home)}
                  </div>
                  <div className="chip-meta">{kickoffLabel(g.row.startDate, g.row.startTimeTbd)}</div>
                  <div className="chip-lean">{lean}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Rating Updater */}
      <RatingUpdater isOpen={showUpdater} onToggle={() => setShowUpdater(!showUpdater)} />

      {/* Core Ratings */}
      <div className="walters-panel">
        <div className="walters-section-header">
          <span className="icon">📊</span> Power Ratings
        </div>

        {conferences.length > 0 && (
          <div className="walters-input-group">
            <label htmlFor="walters-conference">Filter teams by conference</label>
            <select id="walters-conference" className="walters-input" value={conference} onChange={(e) => setConference(e.target.value)}>
              <option value="">All conferences</option>
              {conferences.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        <div className="walters-grid">
          {renderSide('a')}
          {renderSide('b')}
        </div>

        <div className="walters-input-group">
          <label>Market Spread (Team A's side)</label>
          <input
            type="number"
            className="walters-input"
            value={state.marketSpread}
            onChange={(e) => setState({ ...state, marketSpread: e.target.value })}
            placeholder="e.g., -3.5 (negative = A favored)"
            step="0.5"
          />
          {state.game && (
            <div className="walters-note">
              {kickoffLabel(state.game.startDate, state.game.startTimeTbd)}
              {state.game.venueName ? ` · ${state.game.venueName}` : ''}
              {state.game.lineBooks > 0
                ? ` · consensus of ${state.game.lineBooks} book${state.game.lineBooks === 1 ? '' : 's'}`
                : ' · no line posted yet'}
              {state.game.total !== null ? ` · total ${state.game.total}` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Venue */}
      <div className="walters-panel">
        <div className="walters-section-header">
          <span className="icon">🏟️</span> Venue & Game Type
        </div>

        <div className="venue-selector">
          <button className={`venue-btn ${state.venue === 'home' ? 'active' : ''}`} onClick={() => setState({ ...state, venue: 'home' })}>
            {labelA} Home
          </button>
          <button className={`venue-btn ${state.venue === 'neutral' ? 'active' : ''}`} onClick={() => setState({ ...state, venue: 'neutral' })}>
            Neutral
          </button>
          <button className={`venue-btn ${state.venue === 'away' ? 'active' : ''}`} onClick={() => setState({ ...state, venue: 'away' })}>
            {labelB} Home
          </button>
        </div>

        <FactorCard
          label="Rivalry game"
          value={`pulls the margin ${WALTERS_CFB.rivalryPull.toFixed(1)} pt toward a pick'em`}
          checked={state.rivalry}
          onChange={() => setState({ ...state, rivalry: !state.rivalry })}
        />
      </div>

      {/* S-Factors */}
      <div className="walters-panel">
        <div className="walters-section-header">
          <span className="icon">⚡</span> S-Factors (Situational)
        </div>
        <div className="walters-grid">
          {renderFactors('a')}
          {renderFactors('b')}
        </div>
        <div className="walters-note">
          AUTO = detected from this week's schedule, travel and stadium data. SUGGESTED = worth a look, never applied on
          its own. Tap any factor to change it.
        </div>
      </div>

      {/* C-Factors */}
      <div className="walters-panel">
        <div className="walters-section-header">
          <span className="icon">🏥</span> C-Factors (Quarterback)
        </div>
        <div className="walters-grid">
          {renderQb('a')}
          {renderQb('b')}
        </div>
        <div className="walters-note">
          There's no NCAA-wide injury report (the SEC and Big Ten publish their own), so QB status is always yours to set.
        </div>
      </div>

      {/* Actions */}
      <div className="walters-actions">
        <button className="walters-btn walters-btn-secondary" onClick={handleSwapTeams}>
          ⇄ Swap
        </button>
        <button className="walters-btn walters-btn-secondary" onClick={handleReset}>
          Reset
        </button>
      </div>

      {!result && (
        <p className="walters-note" style={{ textAlign: 'center', marginTop: '1rem' }}>
          Pick two teams (or enter both power ratings) to see the true line.
        </p>
      )}

      {/* Results */}
      {result && (
        <div className="walters-results">
          <div className="walters-results-header">College Football Walters Protocol Projection</div>
          <div className={`walters-true-line ${result.trueLine < 0 ? 'negative' : 'positive'}`}>
            {result.trueLine > 0 ? '+' : ''}{result.trueLine.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            True line: {lineLabel(Math.round(result.trueLine * 10) / 10, labelA, labelB)}
          </div>

          {result.marketSpread === null ? (
            <p className="walters-note">Enter the market spread to see the edge.</p>
          ) : (
            <>
              <div className="walters-edge-display">
                <div className="edge-item">
                  <div className="edge-label">Market</div>
                  <div className="edge-value">{lineLabel(result.marketSpread, labelA, labelB)}</div>
                </div>
                <div className="edge-item">
                  <div className="edge-label">Edge</div>
                  <div
                    className="edge-value"
                    style={{ color: result.edge! >= WALTERS_CFB.thresholds.bet ? '#10b981' : result.edge! >= WALTERS_CFB.thresholds.lean ? '#fbbf24' : '#ef4444' }}
                  >
                    {result.edge!.toFixed(1)} pts
                  </div>
                </div>
                {result.pick !== null && (
                  <div className="edge-item">
                    <div className="edge-label">{pickLabel} covers</div>
                    <div className="edge-value">{result.pickProbability!.toFixed(1)}%</div>
                  </div>
                )}
              </div>

              <div className={`walters-recommendation ${result.pick === null ? 'no-bet' : result.confidence.toLowerCase().replace('_', '-')}`}>
                {recommendation}
              </div>
              {result.cappedForBigSpread && (
                <p className="walters-note">
                  Capped at LEAN: {WALTERS_CFB.bigSpread}+ point games are the least predictable (starters sit, garbage time).
                </p>
              )}
              {result.pick !== null && result.edge! >= WALTERS_CFB.thresholds.checkNews && (
                <div className="walters-hint" style={{ marginTop: '0.75rem' }}>
                  ⚠ This {result.edge!.toFixed(1)}-point edge usually means the market knows something the ratings don't.
                  Check QB, injury and suspension news before betting.
                </div>
              )}
            </>
          )}

          <div>
            <button className="breakdown-toggle" onClick={() => setShowBreakdown(!showBreakdown)}>
              {showBreakdown ? 'Hide' : 'Show'} Calculation Breakdown
            </button>
          </div>

          {showBreakdown && (
            <div className="breakdown-panel">
              {[
                ['Base Margin (Rating Δ)', result.breakdown.baseMargin],
                ['Home Field Adj', result.breakdown.homeField],
                [`${labelA} S-Factors`, result.breakdown.situationalA],
                [`${labelB} S-Factors`, result.breakdown.situationalB],
                [`${labelA} QB`, result.breakdown.injuriesA],
                [`${labelB} QB`, result.breakdown.injuriesB],
                ['Rivalry Pull', result.breakdown.rivalryAdjustment],
                ['Predicted Margin (A − B)', result.predictedMargin],
              ].map(([label, value]) => (
                <div className="breakdown-row" key={label as string}>
                  <span className="breakdown-label">{label}</span>
                  <span className={`breakdown-value ${(value as number) >= 0 ? 'positive' : 'negative'}`}>
                    {signed(value as number)}
                  </span>
                </div>
              ))}
              <p className="walters-note">
                Cover chance assumes the final margin lands within a normal spread of ±{result.sigma.toFixed(1)} points
                of the projection; pushes are ignored.
              </p>
            </div>
          )}

          <button
            className="walters-btn walters-btn-primary"
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={handleApplyToKelly}
            disabled={result.pick === null}
          >
            {result.pick !== null
              ? `Use ${pickLabel} ${spreadText(result.pickSpread!)} in Kelly Calculator →`
              : result.marketSpread === null
                ? 'Enter a market spread to size a bet'
                : 'No edge at this line'}
          </button>
        </div>
      )}

      {/* Track record */}
      {record && record.picks > 0 && (
        <div className="walters-panel" style={{ marginTop: '1rem' }}>
          <div className="walters-section-header">
            <span className="icon">📈</span> Automatic Model Track Record
          </div>
          <div className="walters-record">
            <strong>{record.picks}</strong> graded picks (LEAN or better, automatic factors only):{' '}
            <strong>{record.wins}-{record.losses}{record.pushes ? `-${record.pushes}` : ''}</strong> against the spread
            {record.withClose > 0 && (
              <>
                {' '}· beat the closing line in <strong>{record.beatClose} of {record.withClose}</strong> (average{' '}
                {signed(record.averageClv ?? 0)} pts)
              </>
            )}
            . Each pick is logged 72 hours before kickoff at the consensus line.
          </div>
        </div>
      )}
    </div>
  );
};

export default WaltersEstimator;
