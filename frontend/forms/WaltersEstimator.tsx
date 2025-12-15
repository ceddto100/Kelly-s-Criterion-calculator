/**
 * WaltersEstimator.tsx
 *
 * THE WALTERS PROTOCOL: Professional Handicapping Engine
 * Now with FULL NBA SUPPORT using Computer Group methodology
 *
 * NFL Mode:
 * - Power Rating differentials (opponent-adjusted)
 * - 90/10 Recursive Updates (anti-recency bias)
 * - S-Factors: Bounceback, Turf Mismatch, West Coast Travel, Rest
 * - C-Factors: QB Value (-7.0), Unit Clusters (-3.5)
 *
 * NBA Mode:
 * - Faster 85/15 decay (more games = faster truth)
 * - Higher HFA (+2.5 modern)
 * - Schedule Factors: Back-to-Back, 3-in-4 nights
 * - Star Power: Superstar (-4.5), All-Star (-2.5), Starter (-1.0)
 * - Depth Cluster penalty for 3+ rotation players out
 *
 * Based on the "Computer Group" methodology (1980-Present)
 */

import React, { useState, useMemo } from 'react';

/* === NFL CONSTANTS (Original Walters) === */
const NFL_CONSTANTS = {
  // The 90/10 Rule
  DECAY_RATE: 0.90,

  // Home Field Advantage
  HFA_MODERN: 1.5,
  HFA_HISTORICAL: 2.5,

  // S-Factors (Situational)
  BOUNCEBACK_VALUE: 3.0,
  TURF_MISMATCH_PENALTY: 1.5,
  WEST_COAST_TAX: 1.5,
  REST_DISADVANTAGE: 1.0,
  DIVISIONAL_FAMILIARITY: 0.5,

  // C-Factors (Injury Clusters)
  QB_VALUE: 7.0,
  ELITE_SKILL_VALUE: 2.5,
  OLINE_CLUSTER: 2.5,
  SECONDARY_CLUSTER: 2.0,

  // Standard deviation for spread calculations
  SIGMA: 13.5,

  // Kelly Cap
  KELLY_CAP: 0.03,
};

/* === NBA CONSTANTS (Computer Group Basketball) === */
const NBA_CONSTANTS = {
  // 85/15 Rule - Faster decay because more games = faster truth
  DECAY_RATE: 0.85,

  // Home Court Advantage (Higher than NFL: Crowd + Travel + Refs)
  HFA_MODERN: 2.5,
  HFA_HISTORICAL: 3.2,

  // S-Factors (Schedule-based)
  B2B_PENALTY: 2.0,           // Back-to-Back (2nd night)
  THREE_IN_FOUR_PENALTY: 3.5, // 3rd game in 4 nights ("Schedule Loss")
  FOUR_IN_FIVE_PENALTY: 4.5,  // 4th game in 5 nights (rare but brutal)
  BLOWOUT_MOTIVATION: 2.5,    // "Zig-Zag": Lost by 15+ previous game
  ALTITUDE_PENALTY: 1.5,      // Playing in Denver (5,280 ft)
  TRAVEL_ZONES: 1.0,          // 2+ timezone change

  // C-Factors (Player Value - based on betting market moves)
  SUPERSTAR_VALUE: 4.5,       // Top 5-10 player (Jokic, Giannis, Luka)
  ALLSTAR_VALUE: 2.5,         // All-Star level (Booker, Mitchell, Brunson)
  STARTER_VALUE: 1.0,         // Quality starter
  DEPTH_CLUSTER: 3.0,         // 3+ rotation players out

  // Standard deviation (NBA is tighter than NFL)
  SIGMA: 11.5,

  // Kelly Cap
  KELLY_CAP: 0.03,
};

/* === TYPES === */
type Sport = 'football' | 'basketball';

interface WaltersState {
  // Core Power Ratings
  teamARating: string;
  teamBRating: string;
  teamAName: string;
  teamBName: string;

  // Market Line
  marketSpread: string;

  // Venue
  venue: 'home' | 'away' | 'neutral';
  hfaMode: 'modern' | 'historical';

  // Shared S-Factors
  isDivisionalGame: boolean;     // NFL: Division game, NBA: Rivalry game
  isBounceBackA: boolean;        // NFL: Lost by 19+, NBA: Lost by 15+
  isBounceBackB: boolean;

  // NFL-Specific S-Factors
  isTurfMismatchA: boolean;
  isTurfMismatchB: boolean;
  isWestCoastTravelA: boolean;
  isWestCoastTravelB: boolean;
  isRestDisadvantageA: boolean;  // NFL: Short week
  isRestDisadvantageB: boolean;

  // NBA-Specific S-Factors
  isB2BA: boolean;               // Back-to-back
  isB2BB: boolean;
  is3in4A: boolean;              // 3 games in 4 nights
  is3in4B: boolean;
  is4in5A: boolean;              // 4 games in 5 nights
  is4in5B: boolean;
  isAltitudeA: boolean;          // Playing at altitude (Denver)
  isAltitudeB: boolean;
  isTravelZonesA: boolean;       // 2+ timezone travel
  isTravelZonesB: boolean;

  // NFL C-Factors (Injuries)
  missingQBA: boolean;
  missingQBB: boolean;
  missingEliteSkillA: boolean;
  missingEliteSkillB: boolean;
  olineClusterA: boolean;
  olineClusterB: boolean;
  secondaryClusterA: boolean;
  secondaryClusterB: boolean;

  // NBA C-Factors (Player Value)
  missingSuperstarA: boolean;    // Top 5-10 player
  missingSuperstarB: boolean;
  missingAllStarA: boolean;      // All-Star level
  missingAllStarB: boolean;
  missingStarterA: boolean;      // Quality starter
  missingStarterB: boolean;
  depthClusterA: boolean;        // 3+ rotation players out
  depthClusterB: boolean;
}

interface RatingUpdaterState {
  oldRating: string;
  oppRating: string;
  netScore: string;
  injuryAdjustment: string;
}

interface WaltersResult {
  predictedMargin: number;
  trueLine: number;
  marketSpread: number;
  edge: number;
  edgeDirection: 'TEAM_A' | 'TEAM_B' | 'NO_EDGE';
  winProbability: number;
  recommendation: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_BET';
  breakdown: {
    baseMargin: number;
    hfaAdjustment: number;
    sFactorAdjustmentA: number;
    sFactorAdjustmentB: number;
    injuryAdjustmentA: number;
    injuryAdjustmentB: number;
  };
}

/* === HELPER: Normal CDF === */
function normCdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1 + sign * y);
}

/* === INITIAL STATE === */
const getInitialState = (): WaltersState => ({
  teamARating: '',
  teamBRating: '',
  teamAName: '',
  teamBName: '',
  marketSpread: '',
  venue: 'neutral',
  hfaMode: 'modern',
  isDivisionalGame: false,

  // Shared
  isBounceBackA: false,
  isBounceBackB: false,

  // NFL S-Factors
  isTurfMismatchA: false,
  isTurfMismatchB: false,
  isWestCoastTravelA: false,
  isWestCoastTravelB: false,
  isRestDisadvantageA: false,
  isRestDisadvantageB: false,

  // NBA S-Factors
  isB2BA: false,
  isB2BB: false,
  is3in4A: false,
  is3in4B: false,
  is4in5A: false,
  is4in5B: false,
  isAltitudeA: false,
  isAltitudeB: false,
  isTravelZonesA: false,
  isTravelZonesB: false,

  // NFL C-Factors
  missingQBA: false,
  missingQBB: false,
  missingEliteSkillA: false,
  missingEliteSkillB: false,
  olineClusterA: false,
  olineClusterB: false,
  secondaryClusterA: false,
  secondaryClusterB: false,

  // NBA C-Factors
  missingSuperstarA: false,
  missingSuperstarB: false,
  missingAllStarA: false,
  missingAllStarB: false,
  missingStarterA: false,
  missingStarterB: false,
  depthClusterA: false,
  depthClusterB: false,
});

const initialUpdaterState: RatingUpdaterState = {
  oldRating: '',
  oppRating: '',
  netScore: '',
  injuryAdjustment: '0',
};

/* === STYLES === */
export const WaltersEstimatorStyles = `
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

  .walters-section-header .icon {
    font-size: 1rem;
  }

  .walters-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  @media (max-width: 480px) {
    .walters-grid {
      grid-template-columns: 1fr;
    }
  }

  .walters-input-group {
    margin-bottom: 1rem;
  }

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
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-primary, #fff);
    padding: 0.65rem 0.85rem;
    border-radius: 10px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 0.95rem;
    transition: all 0.2s ease;
  }

  .walters-input:focus {
    outline: none;
    border-color: var(--accent-electric, #8b5cf6);
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.2);
  }

  .walters-input::placeholder {
    color: rgba(148, 163, 184, 0.5);
  }

  /* Sport Toggle */
  .sport-toggle {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    padding: 0.25rem;
    background: rgba(15, 23, 42, 0.5);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sport-toggle-btn {
    flex: 1;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: var(--text-secondary, #94a3b8);
    font-weight: 700;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .sport-toggle-btn:hover {
    color: var(--text-primary, #fff);
  }

  .sport-toggle-btn.active {
    background: var(--accent-electric, #8b5cf6);
    color: #fff;
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }

  .sport-toggle-btn.active.nba {
    background: #f97316;
    border-color: #f97316;
  }

  .sport-toggle-btn .sport-icon {
    font-size: 1.1rem;
  }

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

  .factor-card:hover {
    background: rgba(15, 23, 42, 0.7);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .factor-card.active {
    background: rgba(139, 92, 246, 0.15);
    border-color: var(--accent-electric, #8b5cf6);
  }

  .factor-card.active.nba {
    background: rgba(249, 115, 22, 0.15);
    border-color: #f97316;
  }

  .factor-card .factor-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary, #cbd5e1);
  }

  .factor-card .factor-value {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-muted, #64748b);
    font-family: 'JetBrains Mono', monospace;
  }

  .factor-card.active .factor-value {
    color: var(--accent-electric, #8b5cf6);
  }

  .factor-card.active.nba .factor-value {
    color: #f97316;
  }

  .factor-indicator {
    width: 14px;
    height: 14px;
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

  .factor-card.active.nba .factor-indicator {
    background: #f97316;
    border-color: #f97316;
    box-shadow: 0 0 8px #f97316;
  }

  /* Team Column Headers */
  .team-column-header {
    text-align: center;
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    margin-bottom: 0.5rem;
  }

  .team-column-header .team-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted, #64748b);
  }

  .team-column-header .team-name {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary, #fff);
  }

  /* Updater Tool */
  .updater-tool {
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .updater-tool.nba {
    background: rgba(249, 115, 22, 0.08);
    border-color: rgba(249, 115, 22, 0.3);
  }

  .updater-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .updater-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #10b981;
  }

  .updater-title.nba {
    color: #f97316;
  }

  .updater-result {
    text-align: center;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    margin-top: 0.75rem;
  }

  .updater-result-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: var(--text-muted, #64748b);
  }

  .updater-result-value {
    font-size: 1.5rem;
    font-weight: 800;
    color: #10b981;
    font-family: 'JetBrains Mono', monospace;
  }

  .updater-result-value.nba {
    color: #f97316;
  }

  /* Results Panel */
  .walters-results {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    margin-top: 1.5rem;
    text-align: center;
  }

  .walters-results.nba {
    background: linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(251, 191, 36, 0.1));
    border-color: rgba(249, 115, 22, 0.3);
  }

  .walters-results-header {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted, #64748b);
    margin-bottom: 0.5rem;
  }

  .walters-true-line {
    font-size: 2.25rem;
    font-weight: 900;
    font-family: 'JetBrains Mono', monospace;
    margin-bottom: 0.25rem;
  }

  .walters-true-line.positive {
    color: #10b981;
  }

  .walters-true-line.negative {
    color: #f43f5e;
  }

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

  .edge-item {
    text-align: center;
  }

  .edge-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    color: var(--text-muted, #64748b);
  }

  .edge-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }

  .walters-recommendation {
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.95rem;
    margin-top: 1rem;
    display: inline-block;
  }

  .walters-recommendation.high {
    background: rgba(16, 185, 129, 0.2);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.4);
  }

  .walters-recommendation.medium {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.4);
  }

  .walters-recommendation.low {
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
    border: 1px solid rgba(249, 115, 22, 0.4);
  }

  .walters-recommendation.no-bet {
    background: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  /* Breakdown */
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

  .breakdown-toggle:hover {
    background: rgba(255, 255, 255, 0.05);
    color: var(--text-primary, #fff);
  }

  .breakdown-panel {
    margin-top: 1rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    text-align: left;
  }

  .breakdown-row {
    display: flex;
    justify-content: space-between;
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

  .breakdown-label {
    color: var(--text-muted, #64748b);
  }

  .breakdown-value {
    font-family: 'JetBrains Mono', monospace;
    color: var(--text-primary, #fff);
  }

  .breakdown-value.positive { color: #10b981; }
  .breakdown-value.negative { color: #f43f5e; }

  /* Venue Selector */
  .venue-selector {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .venue-btn {
    flex: 1;
    padding: 0.6rem;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-secondary, #94a3b8);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .venue-btn:hover {
    background: rgba(15, 23, 42, 0.7);
  }

  .venue-btn.active {
    background: var(--accent-electric, #8b5cf6);
    border-color: var(--accent-electric, #8b5cf6);
    color: #fff;
  }

  .venue-btn.active.nba {
    background: #f97316;
    border-color: #f97316;
  }

  /* Action Buttons */
  .walters-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }

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

  .walters-btn-primary.nba {
    background: linear-gradient(135deg, #f97316, #f59e0b);
    box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
  }

  .walters-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
  }

  .walters-btn-primary.nba:hover:not(:disabled) {
    box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4);
  }

  .walters-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .walters-btn-secondary {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--text-secondary, #94a3b8);
  }

  .walters-btn-secondary:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-primary, #fff);
  }

  /* Info Box */
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

  .walters-info.nba {
    background: rgba(249, 115, 22, 0.1);
    border-color: rgba(249, 115, 22, 0.3);
  }

  .walters-info strong {
    color: #3b82f6;
  }

  .walters-info.nba strong {
    color: #f97316;
  }

  /* Toggle Row */
  .toggle-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .toggle-btn {
    flex: 1;
    padding: 0.5rem;
    background: rgba(15, 23, 42, 0.5);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: var(--text-secondary, #94a3b8);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .toggle-btn.active {
    background: rgba(16, 185, 129, 0.2);
    border-color: #10b981;
    color: #10b981;
  }

  .toggle-btn.active.nba {
    background: rgba(249, 115, 22, 0.2);
    border-color: #f97316;
    color: #f97316;
  }
`;

/* === COMPONENT: Factor Card === */
interface FactorCardProps {
  label: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  isNBA?: boolean;
}

const FactorCard: React.FC<FactorCardProps> = ({ label, value, checked, onChange, isNBA = false }) => (
  <div
    className={`factor-card ${checked ? 'active' : ''} ${isNBA ? 'nba' : ''}`}
    onClick={onChange}
    role="checkbox"
    aria-checked={checked}
    tabIndex={0}
    onKeyPress={(e) => e.key === 'Enter' && onChange()}
  >
    <div>
      <div className="factor-label">{label}</div>
      <div className="factor-value">{value}</div>
    </div>
    <div className="factor-indicator" />
  </div>
);

/* === COMPONENT: Rating Updater === */
interface RatingUpdaterProps {
  isOpen: boolean;
  onToggle: () => void;
  sport: Sport;
}

const RatingUpdater: React.FC<RatingUpdaterProps> = ({ isOpen, onToggle, sport }) => {
  const [state, setState] = useState<RatingUpdaterState>(initialUpdaterState);
  const [newRating, setNewRating] = useState<number | null>(null);

  const isNBA = sport === 'basketball';
  const CONSTANTS = isNBA ? NBA_CONSTANTS : NFL_CONSTANTS;
  const decayLabel = isNBA ? '85/15' : '90/10';

  const handleCalculate = () => {
    const old = parseFloat(state.oldRating);
    const opp = parseFloat(state.oppRating);
    const score = parseFloat(state.netScore);
    const inj = parseFloat(state.injuryAdjustment) || 0;

    if (isNaN(old) || isNaN(opp) || isNaN(score)) return;

    const tgpl = score + opp + inj;
    const updated = (CONSTANTS.DECAY_RATE * old) + ((1 - CONSTANTS.DECAY_RATE) * tgpl);
    setNewRating(updated);
  };

  if (!isOpen) {
    return (
      <button
        className={`walters-btn walters-btn-secondary`}
        onClick={onToggle}
        style={{ marginBottom: '1rem', width: '100%' }}
      >
        🛠️ Open {decayLabel} Rating Updater Tool
      </button>
    );
  }

  return (
    <div className={`updater-tool ${isNBA ? 'nba' : ''}`}>
      <div className="updater-header">
        <span className={`updater-title ${isNBA ? 'nba' : ''}`}>
          📊 {decayLabel} {isNBA ? 'Game-to-Game' : 'Weekly'} Rating Updater
        </span>
        <button
          className="walters-btn walters-btn-secondary"
          onClick={onToggle}
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
        >
          Close
        </button>
      </div>

      <div className={`walters-info ${isNBA ? 'nba' : ''}`}>
        <strong>How it works:</strong> {isNBA
          ? 'NBA uses 85/15 weighting (faster updates due to more games). Update after each game.'
          : 'NFL uses 90/10 weighting to prevent overreacting to single games. Update weekly.'}
      </div>

      <div className="walters-grid">
        <div className="walters-input-group">
          <label>Old Rating (Pre-Game)</label>
          <input
            type="number"
            className="walters-input"
            value={state.oldRating}
            onChange={(e) => setState({ ...state, oldRating: e.target.value })}
            placeholder="e.g., 6.5"
            step="0.1"
          />
        </div>
        <div className="walters-input-group">
          <label>Opponent's Rating</label>
          <input
            type="number"
            className="walters-input"
            value={state.oppRating}
            onChange={(e) => setState({ ...state, oppRating: e.target.value })}
            placeholder="e.g., -2.0"
            step="0.1"
          />
        </div>
        <div className="walters-input-group">
          <label>Net Score (Win Margin)</label>
          <input
            type="number"
            className="walters-input"
            value={state.netScore}
            onChange={(e) => setState({ ...state, netScore: e.target.value })}
            placeholder="e.g., +14 or -7"
            step="1"
          />
        </div>
        <div className="walters-input-group">
          <label>{isNBA ? 'Rest/Injury Adj' : 'Injury Adjustment'}</label>
          <input
            type="number"
            className="walters-input"
            value={state.injuryAdjustment}
            onChange={(e) => setState({ ...state, injuryAdjustment: e.target.value })}
            placeholder="e.g., -1.5"
            step="0.5"
          />
        </div>
      </div>

      <button
        className={`walters-btn walters-btn-primary ${isNBA ? 'nba' : ''}`}
        onClick={handleCalculate}
        style={{ width: '100%' }}
      >
        Calculate New Rating
      </button>

      {newRating !== null && (
        <div className="updater-result">
          <div className="updater-result-label">New Power Rating</div>
          <div className={`updater-result-value ${isNBA ? 'nba' : ''}`}>{newRating.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
};

/* === MAIN COMPONENT === */
interface WaltersEstimatorProps {
  onApplyToKelly: (probability: number, matchupData: any, estimationData: any) => void;
  initialSport?: Sport;
}

export const WaltersEstimator: React.FC<WaltersEstimatorProps> = ({
  onApplyToKelly,
  initialSport = 'football'
}) => {
  const [sport, setSport] = useState<Sport>(initialSport);
  const [state, setState] = useState<WaltersState>(getInitialState());
  const [result, setResult] = useState<WaltersResult | null>(null);
  const [showUpdater, setShowUpdater] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const isNBA = sport === 'basketball';
  const CONSTANTS = isNBA ? NBA_CONSTANTS : NFL_CONSTANTS;

  // Reset state when sport changes
  const handleSportChange = (newSport: Sport) => {
    setSport(newSport);
    setState(getInitialState());
    setResult(null);
    setShowBreakdown(false);
  };

  // Form validation
  const isFormValid = useMemo(() => {
    const hasRatings = state.teamARating !== '' && state.teamBRating !== '';
    const hasSpread = state.marketSpread !== '';
    return hasRatings && hasSpread;
  }, [state.teamARating, state.teamBRating, state.marketSpread]);

  // Toggle handler
  const toggle = (field: keyof WaltersState) => {
    setState(prev => ({ ...prev, [field]: !prev[field] }));
  };

  // Core Calculation Engine
  const calculateEdge = () => {
    const ratingA = parseFloat(state.teamARating);
    const ratingB = parseFloat(state.teamBRating);
    const marketSpread = parseFloat(state.marketSpread);

    if (isNaN(ratingA) || isNaN(ratingB) || isNaN(marketSpread)) return;

    // === STEP 1: Base Margin ===
    const baseMargin = ratingA - ratingB;

    // === STEP 2: Home Field/Court Adjustment ===
    let hfaAdjustment = 0;
    const hfaValue = state.hfaMode === 'modern'
      ? CONSTANTS.HFA_MODERN
      : CONSTANTS.HFA_HISTORICAL;

    if (state.venue === 'home') hfaAdjustment = hfaValue;
    else if (state.venue === 'away') hfaAdjustment = -hfaValue;

    // === STEP 3: S-Factors ===
    let sFactorA = 0;
    let sFactorB = 0;

    if (isNBA) {
      // NBA S-Factors

      // Bounceback (Zig-Zag: Lost by 15+)
      if (state.isBounceBackA) sFactorA += NBA_CONSTANTS.BLOWOUT_MOTIVATION;
      if (state.isBounceBackB) sFactorB += NBA_CONSTANTS.BLOWOUT_MOTIVATION;

      // Back-to-Back
      if (state.isB2BA) sFactorA -= NBA_CONSTANTS.B2B_PENALTY;
      if (state.isB2BB) sFactorB -= NBA_CONSTANTS.B2B_PENALTY;

      // 3-in-4 Nights
      if (state.is3in4A) sFactorA -= NBA_CONSTANTS.THREE_IN_FOUR_PENALTY;
      if (state.is3in4B) sFactorB -= NBA_CONSTANTS.THREE_IN_FOUR_PENALTY;

      // 4-in-5 Nights
      if (state.is4in5A) sFactorA -= NBA_CONSTANTS.FOUR_IN_FIVE_PENALTY;
      if (state.is4in5B) sFactorB -= NBA_CONSTANTS.FOUR_IN_FIVE_PENALTY;

      // Altitude (Denver)
      if (state.isAltitudeA) sFactorA -= NBA_CONSTANTS.ALTITUDE_PENALTY;
      if (state.isAltitudeB) sFactorB -= NBA_CONSTANTS.ALTITUDE_PENALTY;

      // Travel Zones
      if (state.isTravelZonesA) sFactorA -= NBA_CONSTANTS.TRAVEL_ZONES;
      if (state.isTravelZonesB) sFactorB -= NBA_CONSTANTS.TRAVEL_ZONES;

    } else {
      // NFL S-Factors

      // Bounceback (Lost by 19+)
      if (state.isBounceBackA) sFactorA += NFL_CONSTANTS.BOUNCEBACK_VALUE;
      if (state.isBounceBackB) sFactorB += NFL_CONSTANTS.BOUNCEBACK_VALUE;

      // Turf Mismatch
      if (state.isTurfMismatchA) sFactorA -= NFL_CONSTANTS.TURF_MISMATCH_PENALTY;
      if (state.isTurfMismatchB) sFactorB -= NFL_CONSTANTS.TURF_MISMATCH_PENALTY;

      // West Coast Travel
      if (state.isWestCoastTravelA) sFactorA -= NFL_CONSTANTS.WEST_COAST_TAX;
      if (state.isWestCoastTravelB) sFactorB -= NFL_CONSTANTS.WEST_COAST_TAX;

      // Rest Disadvantage
      if (state.isRestDisadvantageA) sFactorA -= NFL_CONSTANTS.REST_DISADVANTAGE;
      if (state.isRestDisadvantageB) sFactorB -= NFL_CONSTANTS.REST_DISADVANTAGE;
    }

    // Divisional/Rivalry penalty (both sports)
    const divisionalPenalty = state.isDivisionalGame
      ? (isNBA ? 0.5 : NFL_CONSTANTS.DIVISIONAL_FAMILIARITY)
      : 0;

    // === STEP 4: C-Factors (Injuries/Players) ===
    let injuryA = 0;
    let injuryB = 0;

    if (isNBA) {
      // NBA Player Values
      if (state.missingSuperstarA) injuryA -= NBA_CONSTANTS.SUPERSTAR_VALUE;
      if (state.missingSuperstarB) injuryB -= NBA_CONSTANTS.SUPERSTAR_VALUE;

      if (state.missingAllStarA) injuryA -= NBA_CONSTANTS.ALLSTAR_VALUE;
      if (state.missingAllStarB) injuryB -= NBA_CONSTANTS.ALLSTAR_VALUE;

      if (state.missingStarterA) injuryA -= NBA_CONSTANTS.STARTER_VALUE;
      if (state.missingStarterB) injuryB -= NBA_CONSTANTS.STARTER_VALUE;

      if (state.depthClusterA) injuryA -= NBA_CONSTANTS.DEPTH_CLUSTER;
      if (state.depthClusterB) injuryB -= NBA_CONSTANTS.DEPTH_CLUSTER;

    } else {
      // NFL Injury Values
      if (state.missingQBA) injuryA -= NFL_CONSTANTS.QB_VALUE;
      if (state.missingQBB) injuryB -= NFL_CONSTANTS.QB_VALUE;

      if (state.missingEliteSkillA) injuryA -= NFL_CONSTANTS.ELITE_SKILL_VALUE;
      if (state.missingEliteSkillB) injuryB -= NFL_CONSTANTS.ELITE_SKILL_VALUE;

      if (state.olineClusterA) injuryA -= NFL_CONSTANTS.OLINE_CLUSTER;
      if (state.olineClusterB) injuryB -= NFL_CONSTANTS.OLINE_CLUSTER;

      if (state.secondaryClusterA) injuryA -= NFL_CONSTANTS.SECONDARY_CLUSTER;
      if (state.secondaryClusterB) injuryB -= NFL_CONSTANTS.SECONDARY_CLUSTER;
    }

    // === STEP 5: Calculate True Line ===
    const totalMargin = baseMargin + hfaAdjustment + (sFactorA - sFactorB) + (injuryA - injuryB) - divisionalPenalty;
    const trueLine = -totalMargin;

    // === STEP 6: Calculate Edge ===
    const rawEdge = Math.abs(marketSpread - trueLine);

    let edgeDirection: 'TEAM_A' | 'TEAM_B' | 'NO_EDGE' = 'NO_EDGE';
    if (trueLine < marketSpread) edgeDirection = 'TEAM_A';
    else if (trueLine > marketSpread) edgeDirection = 'TEAM_B';

    // === STEP 7: Win Probability ===
    const z = (totalMargin + marketSpread) / CONSTANTS.SIGMA;
    const winProb = normCdf(z) * 100;

    // === STEP 8: Recommendation ===
    let recommendation = '';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_BET' = 'NO_BET';

    // NBA has tighter margins, so adjust thresholds
    const highThreshold = isNBA ? 2.5 : 3.0;
    const medThreshold = isNBA ? 1.5 : 2.0;
    const lowThreshold = isNBA ? 0.75 : 1.0;

    if (rawEdge >= highThreshold) {
      confidence = 'HIGH';
      recommendation = edgeDirection === 'TEAM_A'
        ? `STRONG BET: ${state.teamAName || 'Team A'}`
        : `STRONG BET: ${state.teamBName || 'Team B'}`;
    } else if (rawEdge >= medThreshold) {
      confidence = 'MEDIUM';
      recommendation = edgeDirection === 'TEAM_A'
        ? `BET: ${state.teamAName || 'Team A'}`
        : `BET: ${state.teamBName || 'Team B'}`;
    } else if (rawEdge >= lowThreshold) {
      confidence = 'LOW';
      recommendation = `LEAN: ${edgeDirection === 'TEAM_A' ? (state.teamAName || 'Team A') : (state.teamBName || 'Team B')}`;
    } else {
      confidence = 'NO_BET';
      recommendation = 'NO VALUE - PASS';
    }

    setResult({
      predictedMargin: totalMargin,
      trueLine,
      marketSpread,
      edge: rawEdge,
      edgeDirection,
      winProbability: winProb,
      recommendation,
      confidence,
      breakdown: {
        baseMargin,
        hfaAdjustment,
        sFactorAdjustmentA: sFactorA,
        sFactorAdjustmentB: sFactorB,
        injuryAdjustmentA: injuryA,
        injuryAdjustmentB: injuryB,
      },
    });
  };

  // Apply to Kelly
  const handleApplyToKelly = () => {
    if (!result) return;

    const matchupData = {
      sport,
      teamA: {
        name: state.teamAName || 'Team A',
        abbreviation: state.teamAName || undefined,
        powerRating: parseFloat(state.teamARating),
      },
      teamB: {
        name: state.teamBName || 'Team B',
        abbreviation: state.teamBName || undefined,
        powerRating: parseFloat(state.teamBRating),
      },
      venue: state.venue,
    };

    const estimationData = {
      pointSpread: result.marketSpread,
      calculatedProbability: result.winProbability,
      expectedMargin: result.predictedMargin,
      trueLine: result.trueLine,
      edge: result.edge,
      edgeDirection: result.edgeDirection,
      confidence: result.confidence,
      method: 'walters_protocol',
    };

    onApplyToKelly(result.winProbability, matchupData, estimationData);
  };

  // Swap teams
  const handleSwapTeams = () => {
    setState(prev => ({
      ...prev,
      teamARating: prev.teamBRating,
      teamBRating: prev.teamARating,
      teamAName: prev.teamBName,
      teamBName: prev.teamAName,
      venue: prev.venue === 'home' ? 'away' : prev.venue === 'away' ? 'home' : 'neutral',
      marketSpread: prev.marketSpread ? String(-parseFloat(prev.marketSpread)) : '',
      // Swap all factors
      isBounceBackA: prev.isBounceBackB, isBounceBackB: prev.isBounceBackA,
      isTurfMismatchA: prev.isTurfMismatchB, isTurfMismatchB: prev.isTurfMismatchA,
      isWestCoastTravelA: prev.isWestCoastTravelB, isWestCoastTravelB: prev.isWestCoastTravelA,
      isRestDisadvantageA: prev.isRestDisadvantageB, isRestDisadvantageB: prev.isRestDisadvantageA,
      isB2BA: prev.isB2BB, isB2BB: prev.isB2BA,
      is3in4A: prev.is3in4B, is3in4B: prev.is3in4A,
      is4in5A: prev.is4in5B, is4in5B: prev.is4in5A,
      isAltitudeA: prev.isAltitudeB, isAltitudeB: prev.isAltitudeA,
      isTravelZonesA: prev.isTravelZonesB, isTravelZonesB: prev.isTravelZonesA,
      missingQBA: prev.missingQBB, missingQBB: prev.missingQBA,
      missingEliteSkillA: prev.missingEliteSkillB, missingEliteSkillB: prev.missingEliteSkillA,
      olineClusterA: prev.olineClusterB, olineClusterB: prev.olineClusterA,
      secondaryClusterA: prev.secondaryClusterB, secondaryClusterB: prev.secondaryClusterA,
      missingSuperstarA: prev.missingSuperstarB, missingSuperstarB: prev.missingSuperstarA,
      missingAllStarA: prev.missingAllStarB, missingAllStarB: prev.missingAllStarA,
      missingStarterA: prev.missingStarterB, missingStarterB: prev.missingStarterA,
      depthClusterA: prev.depthClusterB, depthClusterB: prev.depthClusterA,
    }));
    setResult(null);
  };

  // Reset
  const handleReset = () => {
    setState(getInitialState());
    setResult(null);
    setShowBreakdown(false);
  };

  return (
    <div>
      <style>{WaltersEstimatorStyles}</style>

      {/* Sport Toggle */}
      <div className="sport-toggle">
        <button
          className={`sport-toggle-btn ${sport === 'football' ? 'active' : ''}`}
          onClick={() => handleSportChange('football')}
        >
          <span className="sport-icon">🏈</span> NFL
        </button>
        <button
          className={`sport-toggle-btn ${sport === 'basketball' ? 'active' : ''}`}
          onClick={() => handleSportChange('basketball')}
        >
          <span className="sport-icon">🏀</span> NBA
        </button>
      </div>

      {/* Rating Updater */}
      <RatingUpdater isOpen={showUpdater} onToggle={() => setShowUpdater(!showUpdater)} sport={sport} />

      {/* Info Panel */}
      <div className={`walters-info ${isNBA ? 'nba' : ''}`}>
        <strong>{isNBA ? 'NBA Mode:' : 'NFL Mode:'}</strong> {isNBA
          ? 'Uses 85/15 decay, higher HFA (+2.5), schedule fatigue factors (B2B, 3-in-4), and player-tier values (Superstar: -4.5, All-Star: -2.5).'
          : 'Uses 90/10 decay, situational factors (Turf, Travel, Rest), and injury clusters (QB: -7.0, O-Line: -2.5).'}
      </div>

      {/* Core Ratings */}
      <div className="walters-panel">
        <div className="walters-section-header">
          <span className="icon">📊</span> Power Ratings
        </div>

        <div className="walters-grid">
          <div>
            <div className="walters-input-group">
              <label>Team A Name</label>
              <input
                type="text"
                className="walters-input"
                value={state.teamAName}
                onChange={(e) => setState({ ...state, teamAName: e.target.value })}
                placeholder={isNBA ? "e.g., LAL" : "e.g., KC"}
              />
            </div>
            <div className="walters-input-group">
              <label>Team A Power Rating</label>
              <input
                type="number"
                className="walters-input"
                value={state.teamARating}
                onChange={(e) => setState({ ...state, teamARating: e.target.value })}
                placeholder="e.g., 7.5"
                step="0.5"
              />
            </div>
          </div>
          <div>
            <div className="walters-input-group">
              <label>Team B Name</label>
              <input
                type="text"
                className="walters-input"
                value={state.teamBName}
                onChange={(e) => setState({ ...state, teamBName: e.target.value })}
                placeholder={isNBA ? "e.g., BOS" : "e.g., BUF"}
              />
            </div>
            <div className="walters-input-group">
              <label>Team B Power Rating</label>
              <input
                type="number"
                className="walters-input"
                value={state.teamBRating}
                onChange={(e) => setState({ ...state, teamBRating: e.target.value })}
                placeholder="e.g., 5.0"
                step="0.5"
              />
            </div>
          </div>
        </div>

        <div className="walters-input-group">
          <label>Market Spread (Team A perspective)</label>
          <input
            type="number"
            className="walters-input"
            value={state.marketSpread}
            onChange={(e) => setState({ ...state, marketSpread: e.target.value })}
            placeholder="e.g., -3.5 (negative = A favored)"
            step="0.5"
          />
        </div>
      </div>

      {/* Venue */}
      <div className="walters-panel">
        <div className="walters-section-header">
          <span className="icon">🏟️</span> Venue & Game Type
        </div>

        <div className="venue-selector">
          <button
            className={`venue-btn ${state.venue === 'home' ? 'active' : ''} ${isNBA ? 'nba' : ''}`}
            onClick={() => setState({ ...state, venue: 'home' })}
          >
            {state.teamAName || 'A'} Home
          </button>
          <button
            className={`venue-btn ${state.venue === 'neutral' ? 'active' : ''} ${isNBA ? 'nba' : ''}`}
            onClick={() => setState({ ...state, venue: 'neutral' })}
          >
            Neutral
          </button>
          <button
            className={`venue-btn ${state.venue === 'away' ? 'active' : ''} ${isNBA ? 'nba' : ''}`}
            onClick={() => setState({ ...state, venue: 'away' })}
          >
            {state.teamBName || 'B'} Home
          </button>
        </div>

        <div className="toggle-row">
          <button
            className={`toggle-btn ${state.hfaMode === 'modern' ? 'active' : ''} ${isNBA ? 'nba' : ''}`}
            onClick={() => setState({ ...state, hfaMode: 'modern' })}
          >
            Modern {isNBA ? 'HCA' : 'HFA'} (+{isNBA ? '2.5' : '1.5'})
          </button>
          <button
            className={`toggle-btn ${state.hfaMode === 'historical' ? 'active' : ''} ${isNBA ? 'nba' : ''}`}
            onClick={() => setState({ ...state, hfaMode: 'historical' })}
          >
            Historical (+{isNBA ? '3.2' : '2.5'})
          </button>
        </div>

        <FactorCard
          label={isNBA ? "Rivalry Game" : "Divisional Game"}
          value="-0.5 pts edge"
          checked={state.isDivisionalGame}
          onChange={() => toggle('isDivisionalGame')}
          isNBA={isNBA}
        />
      </div>

      {/* S-Factors */}
      <div className="walters-panel">
        <div className="walters-section-header">
          <span className="icon">⚡</span> {isNBA ? 'Schedule Factors' : 'S-Factors (Situational)'}
        </div>

        <div className="walters-grid">
          <div>
            <div className="team-column-header">
              <div className="team-label">Team A</div>
              <div className="team-name">{state.teamAName || '—'}</div>
            </div>

            {/* Bounceback - Both sports */}
            <FactorCard
              label={isNBA ? "Blowout Loss (15+)" : "Bounceback (19+ Loss)"}
              value={isNBA ? "+2.5 pts" : "+3.0 pts"}
              checked={state.isBounceBackA}
              onChange={() => toggle('isBounceBackA')}
              isNBA={isNBA}
            />

            {isNBA ? (
              <>
                <FactorCard label="Back-to-Back" value="-2.0 pts" checked={state.isB2BA} onChange={() => toggle('isB2BA')} isNBA />
                <FactorCard label="3-in-4 Nights" value="-3.5 pts" checked={state.is3in4A} onChange={() => toggle('is3in4A')} isNBA />
                <FactorCard label="4-in-5 Nights" value="-4.5 pts" checked={state.is4in5A} onChange={() => toggle('is4in5A')} isNBA />
                <FactorCard label="Altitude (Denver)" value="-1.5 pts" checked={state.isAltitudeA} onChange={() => toggle('isAltitudeA')} isNBA />
                <FactorCard label="2+ Timezone Travel" value="-1.0 pts" checked={state.isTravelZonesA} onChange={() => toggle('isTravelZonesA')} isNBA />
              </>
            ) : (
              <>
                <FactorCard label="Turf Mismatch" value="-1.5 pts" checked={state.isTurfMismatchA} onChange={() => toggle('isTurfMismatchA')} />
                <FactorCard label="West Coast Travel" value="-1.5 pts" checked={state.isWestCoastTravelA} onChange={() => toggle('isWestCoastTravelA')} />
                <FactorCard label="Rest Disadvantage" value="-1.0 pts" checked={state.isRestDisadvantageA} onChange={() => toggle('isRestDisadvantageA')} />
              </>
            )}
          </div>

          <div>
            <div className="team-column-header">
              <div className="team-label">Team B</div>
              <div className="team-name">{state.teamBName || '—'}</div>
            </div>

            <FactorCard
              label={isNBA ? "Blowout Loss (15+)" : "Bounceback (19+ Loss)"}
              value={isNBA ? "+2.5 pts" : "+3.0 pts"}
              checked={state.isBounceBackB}
              onChange={() => toggle('isBounceBackB')}
              isNBA={isNBA}
            />

            {isNBA ? (
              <>
                <FactorCard label="Back-to-Back" value="-2.0 pts" checked={state.isB2BB} onChange={() => toggle('isB2BB')} isNBA />
                <FactorCard label="3-in-4 Nights" value="-3.5 pts" checked={state.is3in4B} onChange={() => toggle('is3in4B')} isNBA />
                <FactorCard label="4-in-5 Nights" value="-4.5 pts" checked={state.is4in5B} onChange={() => toggle('is4in5B')} isNBA />
                <FactorCard label="Altitude (Denver)" value="-1.5 pts" checked={state.isAltitudeB} onChange={() => toggle('isAltitudeB')} isNBA />
                <FactorCard label="2+ Timezone Travel" value="-1.0 pts" checked={state.isTravelZonesB} onChange={() => toggle('isTravelZonesB')} isNBA />
              </>
            ) : (
              <>
                <FactorCard label="Turf Mismatch" value="-1.5 pts" checked={state.isTurfMismatchB} onChange={() => toggle('isTurfMismatchB')} />
                <FactorCard label="West Coast Travel" value="-1.5 pts" checked={state.isWestCoastTravelB} onChange={() => toggle('isWestCoastTravelB')} />
                <FactorCard label="Rest Disadvantage" value="-1.0 pts" checked={state.isRestDisadvantageB} onChange={() => toggle('isRestDisadvantageB')} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* C-Factors / Player Value */}
      <div className="walters-panel">
        <div className="walters-section-header">
          <span className="icon">🏥</span> {isNBA ? 'Player Value (Injuries)' : 'C-Factors (Injury Clusters)'}
        </div>

        <div className="walters-grid">
          <div>
            <div className="team-column-header">
              <div className="team-label">Team A</div>
              <div className="team-name">{state.teamAName || '—'}</div>
            </div>

            {isNBA ? (
              <>
                <FactorCard label="Missing Superstar" value="-4.5 pts" checked={state.missingSuperstarA} onChange={() => toggle('missingSuperstarA')} isNBA />
                <FactorCard label="Missing All-Star" value="-2.5 pts" checked={state.missingAllStarA} onChange={() => toggle('missingAllStarA')} isNBA />
                <FactorCard label="Missing Starter" value="-1.0 pts" checked={state.missingStarterA} onChange={() => toggle('missingStarterA')} isNBA />
                <FactorCard label="Depth Cluster (3+ out)" value="-3.0 pts" checked={state.depthClusterA} onChange={() => toggle('depthClusterA')} isNBA />
              </>
            ) : (
              <>
                <FactorCard label="Missing Starting QB" value="-7.0 pts" checked={state.missingQBA} onChange={() => toggle('missingQBA')} />
                <FactorCard label="Elite Skill Player Out" value="-2.5 pts" checked={state.missingEliteSkillA} onChange={() => toggle('missingEliteSkillA')} />
                <FactorCard label="O-Line Cluster (2+ out)" value="-2.5 pts" checked={state.olineClusterA} onChange={() => toggle('olineClusterA')} />
                <FactorCard label="Secondary Cluster (2+ out)" value="-2.0 pts" checked={state.secondaryClusterA} onChange={() => toggle('secondaryClusterA')} />
              </>
            )}
          </div>

          <div>
            <div className="team-column-header">
              <div className="team-label">Team B</div>
              <div className="team-name">{state.teamBName || '—'}</div>
            </div>

            {isNBA ? (
              <>
                <FactorCard label="Missing Superstar" value="-4.5 pts" checked={state.missingSuperstarB} onChange={() => toggle('missingSuperstarB')} isNBA />
                <FactorCard label="Missing All-Star" value="-2.5 pts" checked={state.missingAllStarB} onChange={() => toggle('missingAllStarB')} isNBA />
                <FactorCard label="Missing Starter" value="-1.0 pts" checked={state.missingStarterB} onChange={() => toggle('missingStarterB')} isNBA />
                <FactorCard label="Depth Cluster (3+ out)" value="-3.0 pts" checked={state.depthClusterB} onChange={() => toggle('depthClusterB')} isNBA />
              </>
            ) : (
              <>
                <FactorCard label="Missing Starting QB" value="-7.0 pts" checked={state.missingQBB} onChange={() => toggle('missingQBB')} />
                <FactorCard label="Elite Skill Player Out" value="-2.5 pts" checked={state.missingEliteSkillB} onChange={() => toggle('missingEliteSkillB')} />
                <FactorCard label="O-Line Cluster (2+ out)" value="-2.5 pts" checked={state.olineClusterB} onChange={() => toggle('olineClusterB')} />
                <FactorCard label="Secondary Cluster (2+ out)" value="-2.0 pts" checked={state.secondaryClusterB} onChange={() => toggle('secondaryClusterB')} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="walters-actions">
        <button
          className={`walters-btn walters-btn-primary ${isNBA ? 'nba' : ''}`}
          onClick={calculateEdge}
          disabled={!isFormValid}
        >
          Calculate True Line
        </button>
        <button className="walters-btn walters-btn-secondary" onClick={handleSwapTeams}>
          ⇄ Swap
        </button>
        <button className="walters-btn walters-btn-secondary" onClick={handleReset}>
          Reset
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className={`walters-results ${isNBA ? 'nba' : ''}`}>
          <div className="walters-results-header">
            {isNBA ? 'NBA' : 'NFL'} WALTERS PROTOCOL PROJECTION
          </div>
          <div className={`walters-true-line ${result.trueLine < 0 ? 'negative' : 'positive'}`}>
            {result.trueLine > 0 ? '+' : ''}{result.trueLine.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            True Line: {state.teamAName || 'Team A'} {result.trueLine < 0 ? 'favored by' : 'underdog by'} {Math.abs(result.trueLine).toFixed(1)}
          </div>

          <div className="walters-edge-display">
            <div className="edge-item">
              <div className="edge-label">Market</div>
              <div className="edge-value">{result.marketSpread > 0 ? '+' : ''}{result.marketSpread.toFixed(1)}</div>
            </div>
            <div className="edge-item">
              <div className="edge-label">Edge</div>
              <div className="edge-value" style={{ color: result.edge >= (isNBA ? 1.5 : 2) ? '#10b981' : result.edge >= (isNBA ? 0.75 : 1) ? '#fbbf24' : '#ef4444' }}>
                {result.edge.toFixed(1)} pts
              </div>
            </div>
            <div className="edge-item">
              <div className="edge-label">Win Prob</div>
              <div className="edge-value">{result.winProbability.toFixed(1)}%</div>
            </div>
          </div>

          <div className={`walters-recommendation ${result.confidence.toLowerCase().replace('_', '-')}`}>
            {result.recommendation}
          </div>

          <button className="breakdown-toggle" onClick={() => setShowBreakdown(!showBreakdown)}>
            {showBreakdown ? 'Hide' : 'Show'} Calculation Breakdown
          </button>

          {showBreakdown && (
            <div className="breakdown-panel">
              <div className="breakdown-row">
                <span className="breakdown-label">Base Margin (Rating Δ)</span>
                <span className={`breakdown-value ${result.breakdown.baseMargin >= 0 ? 'positive' : 'negative'}`}>
                  {result.breakdown.baseMargin >= 0 ? '+' : ''}{result.breakdown.baseMargin.toFixed(1)}
                </span>
              </div>
              <div className="breakdown-row">
                <span className="breakdown-label">{isNBA ? 'Home Court' : 'Home Field'} Adj</span>
                <span className={`breakdown-value ${result.breakdown.hfaAdjustment >= 0 ? 'positive' : 'negative'}`}>
                  {result.breakdown.hfaAdjustment >= 0 ? '+' : ''}{result.breakdown.hfaAdjustment.toFixed(1)}
                </span>
              </div>
              <div className="breakdown-row">
                <span className="breakdown-label">{state.teamAName || 'A'} {isNBA ? 'Schedule' : 'S-Factors'}</span>
                <span className={`breakdown-value ${result.breakdown.sFactorAdjustmentA >= 0 ? 'positive' : 'negative'}`}>
                  {result.breakdown.sFactorAdjustmentA >= 0 ? '+' : ''}{result.breakdown.sFactorAdjustmentA.toFixed(1)}
                </span>
              </div>
              <div className="breakdown-row">
                <span className="breakdown-label">{state.teamBName || 'B'} {isNBA ? 'Schedule' : 'S-Factors'}</span>
                <span className={`breakdown-value ${result.breakdown.sFactorAdjustmentB >= 0 ? 'positive' : 'negative'}`}>
                  {result.breakdown.sFactorAdjustmentB >= 0 ? '+' : ''}{result.breakdown.sFactorAdjustmentB.toFixed(1)}
                </span>
              </div>
              <div className="breakdown-row">
                <span className="breakdown-label">{state.teamAName || 'A'} {isNBA ? 'Players' : 'Injuries'}</span>
                <span className={`breakdown-value ${result.breakdown.injuryAdjustmentA >= 0 ? 'positive' : 'negative'}`}>
                  {result.breakdown.injuryAdjustmentA >= 0 ? '+' : ''}{result.breakdown.injuryAdjustmentA.toFixed(1)}
                </span>
              </div>
              <div className="breakdown-row">
                <span className="breakdown-label">{state.teamBName || 'B'} {isNBA ? 'Players' : 'Injuries'}</span>
                <span className={`breakdown-value ${result.breakdown.injuryAdjustmentB >= 0 ? 'positive' : 'negative'}`}>
                  {result.breakdown.injuryAdjustmentB >= 0 ? '+' : ''}{result.breakdown.injuryAdjustmentB.toFixed(1)}
                </span>
              </div>
              <div className="breakdown-row">
                <span className="breakdown-label">Predicted Margin</span>
                <span className={`breakdown-value ${result.predictedMargin >= 0 ? 'positive' : 'negative'}`}>
                  {result.predictedMargin >= 0 ? '+' : ''}{result.predictedMargin.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          <button
            className={`walters-btn walters-btn-primary ${isNBA ? 'nba' : ''}`}
            style={{ marginTop: '1rem', width: '100%' }}
            onClick={handleApplyToKelly}
          >
            Use in Kelly Calculator →
          </button>
        </div>
      )}
    </div>
  );
};

export default WaltersEstimator;
