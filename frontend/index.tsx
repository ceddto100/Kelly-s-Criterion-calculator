/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UPDATED: With Bet Logging Integration + Performance Optimizations + SEO
*/
import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

/* === Lazy load tab components for better performance === */
const FootballEstimator = lazy(() => import("./forms/FootballEstimator"));
const BasketballEstimator = lazy(() => import("./forms/BasketballEstimator"));
const SportsMatchup = lazy(() => import("./forms/SportsMatchup"));
const NFLMatchup = lazy(() => import("./forms/NFLMatchup"));
const WaltersEstimator = lazy(() => import("./forms/WaltersEstimator"));

/* === NEW: Import Bet Logger components (eager for now, used in Kelly calc) === */
import { LogBetButton, BetHistory, BetLoggerStyles } from './components/BetLogger';

/* === Audio Orb Component === */
import { AudioOrbStyles } from './components/AudioOrb';
import { SwipeableAudioOrbs } from './components/SwipeableAudioOrbs';

/* === Bottom Navigation and New Pages === */
import { BottomNavigation } from './components/BottomNavigation';
import { AccountSettings } from './components/AccountSettings';
import { PromoPage } from './components/PromoPage';
import { StatsPage } from './components/StatsPage';

/* === SEO Component === */
import { SEO, SEO_CONFIG } from './components/SEO';

/* === Backend URL configuration === */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

const THEME_OPTIONS = [
  {
    key: 'midnight',
    label: 'Midnight Neon',
    description: 'Cyan + violet glow with the original look',
    accent: '#8b5cf6',
    preview: 'linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)',
  },
  {
    key: 'deep-sea',
    label: 'Deep Sea',
    description: 'Ocean gradients with aqua orbs',
    accent: '#0ea5e9',
    preview: 'linear-gradient(135deg, #0ea5e9, #14b8a6, #22d3ee)',
  },
  {
    key: 'crimson',
    label: 'Crimson Pulse',
    description: 'Rich magenta reds with neon glows',
    accent: '#f43f5e',
    preview: 'linear-gradient(135deg, #f43f5e, #fb7185, #e11d48)',
  },
  {
    key: 'gamma',
    label: 'Gamma Hulk',
    description: 'Radioactive green with gamma energy',
    accent: '#3ECF54',
    preview: 'linear-gradient(135deg, #22c55e, #3ECF54, #84cc16)',
  },
  {
    key: 'gold-mouth',
    label: 'Gold Mouth',
    description: 'Luxurious gold with amber shine',
    accent: '#FFD700',
    preview: 'linear-gradient(135deg, #DAA520, #FFD700, #FFA500)',
  },
] as const;

type ThemeKey = typeof THEME_OPTIONS[number]['key'];

/* =========================== Inline Styles - Minimal Component Styling =========================== */
const GlobalStyle = () => (
  <style>{`
    /* Site Background */
    .site-bg {
      position: relative;
      min-height: 100vh;
      width: 100%;
      max-width: 100vw;
      background: var(--bg-primary);
    }

    .bg-overlay {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }

    /* Page Layout */
    .page-wrap {
      position: relative;
      z-index: 1;
      padding: var(--space-xl);
      padding-bottom: 120px;
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 640px) {
      .page-wrap {
        padding: var(--space-lg);
        padding-bottom: 100px;
      }
    }

    /* Panels */
    .panel {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      padding: var(--space-xl);
      box-shadow: var(--shadow-lg);
      margin: 0 auto var(--space-lg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    .panel-strong {
      background: var(--glass-bg-hover);
    }

    @media (min-width: 768px) {
      .panel {
        padding: var(--space-2xl);
      }
    }

    /* Header */
    .header {
      text-align: center;
      margin-bottom: var(--space-xl);
    }

    .title {
      font-size: clamp(1.75rem, 5vw, 2.5rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: var(--space-md);
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .title-part-1 {
      background: var(--accent-gradient);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .title-part-2 {
      font-size: 0.5em;
      font-weight: 600;
      color: var(--accent-primary);
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }

    /* Auth & Brand */
    .brand-logo-container {
      position: absolute;
      top: var(--space-lg);
      left: var(--space-lg);
      z-index: 100;
    }

    .brand-logo {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      border: 2px solid rgba(var(--accent-primary-rgb), 0.3);
      box-shadow: 0 4px 16px rgba(var(--accent-primary-rgb), 0.2);
      object-fit: cover;
      transition: var(--transition-base);
    }

    .brand-logo:hover {
      transform: scale(1.05);
    }

    .auth-container {
      position: absolute;
      top: var(--space-lg);
      right: var(--space-lg);
      z-index: 100;
    }

    .auth-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      background: var(--accent-gradient);
      color: white;
      border: none;
      border-radius: var(--radius-md);
      font-weight: 600;
      font-size: 0.875rem;
      cursor: pointer;
      text-decoration: none;
      transition: var(--transition-base);
      box-shadow: 0 4px 16px rgba(var(--accent-primary-rgb), 0.3);
    }

    .auth-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(var(--accent-primary-rgb), 0.4);
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      backdrop-filter: blur(10px);
    }

    .user-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid rgba(var(--accent-primary-rgb), 0.3);
    }

    .user-details {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .user-email {
      font-size: 0.7rem;
      color: var(--text-muted);
    }

    .logout-btn {
      padding: var(--space-xs) var(--space-sm);
      background: var(--danger-bg);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--danger);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      margin-left: var(--space-sm);
      transition: var(--transition-fast);
    }

    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.15);
    }

    /* Tabs - overrides */
    .tabs {
      display: flex;
      gap: var(--space-xs);
      padding: var(--space-sm);
      overflow-x: auto;
      scrollbar-width: none;
    }

    .tabs::-webkit-scrollbar {
      display: none;
    }

    .tab {
      flex: 1;
      min-width: max-content;
      padding: var(--space-sm) var(--space-md);
      background: transparent;
      border: none;
      border-radius: var(--radius-sm);
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-base);
      white-space: nowrap;
    }

    .tab:hover {
      color: var(--text-secondary);
      background: var(--glass-bg);
    }

    .tab.active {
      color: var(--text-primary);
      background: var(--accent-gradient);
      box-shadow: 0 4px 12px rgba(var(--accent-primary-rgb), 0.25);
    }

    /* Chat & Matchup */
    .sports-matchup-container {
      display: flex;
      flex-direction: column;
      height: 500px;
      max-height: 65vh;
    }

    .quick-examples {
      display: flex;
      gap: var(--space-sm);
      flex-wrap: wrap;
      padding: var(--space-md);
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-md);
    }

    .example-btn {
      padding: var(--space-xs) var(--space-sm);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .example-btn:hover {
      background: var(--glass-bg-hover);
      color: var(--text-primary);
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-md);
      background: var(--bg-tertiary);
      border-radius: var(--radius-md);
      margin-bottom: var(--space-md);
    }

    .chat-message {
      margin-bottom: var(--space-md);
      padding: var(--space-md);
      border-radius: var(--radius-md);
    }

    .chat-message.user {
      background: rgba(var(--accent-primary-rgb), 0.1);
      border: 1px solid rgba(var(--accent-primary-rgb), 0.2);
      margin-left: var(--space-xl);
    }

    .chat-message.assistant {
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      margin-right: var(--space-xl);
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: var(--space-sm);
      font-size: 0.75rem;
    }

    .message-role {
      font-weight: 700;
      color: var(--accent-primary);
    }

    .message-time {
      color: var(--text-muted);
    }

    .message-content {
      color: var(--text-primary);
      line-height: 1.6;
    }

    .chat-input-form {
      display: flex;
      gap: var(--space-sm);
    }

    .chat-input {
      flex: 1;
      padding: var(--space-md);
      background: var(--bg-tertiary);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      color: var(--text-primary);
      font-size: 0.95rem;
      transition: var(--transition-base);
    }

    .chat-input:focus {
      outline: none;
      border-color: var(--accent-primary);
    }

    .chat-submit-btn {
      padding: var(--space-md) var(--space-lg);
      background: var(--accent-gradient);
      border: none;
      border-radius: var(--radius-md);
      color: white;
      font-weight: 700;
      font-size: 1.1rem;
      cursor: pointer;
      transition: var(--transition-base);
    }

    .chat-submit-btn:hover:not(:disabled) {
      transform: translateY(-2px);
    }

    .chat-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .clear-chat-btn {
      padding: var(--space-md);
      background: var(--danger-bg);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: var(--danger);
      border-radius: var(--radius-md);
      font-weight: 600;
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .clear-chat-btn:hover {
      background: rgba(239, 68, 68, 0.15);
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: var(--space-xl);
    }

    .footer-card {
      display: inline-block;
      padding: var(--space-lg) var(--space-xl);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      backdrop-filter: blur(10px);
    }

    .doc-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-sm);
      width: 100%;
      padding: var(--space-sm);
      background: transparent;
      border: none;
      color: var(--text-secondary);
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      transition: var(--transition-base);
    }

    .doc-toggle:hover {
      color: var(--text-primary);
    }

    .doc-chevron {
      transition: transform 0.2s ease;
    }

    .doc-chevron.open {
      transform: rotate(180deg);
    }

    .doc-hint {
      margin-top: var(--space-sm);
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    .doc-panel-wrapper {
      max-width: 900px;
      margin: 0 auto var(--space-lg);
      overflow: hidden;
      transition: var(--transition-base);
    }

    .doc-panel-wrapper.closed {
      max-height: 0;
      opacity: 0;
      pointer-events: none;
    }

    .doc-panel-wrapper.open {
      max-height: 1200px;
      opacity: 1;
    }

    .doc-panel {
      position: relative;
    }

    .doc-close {
      position: absolute;
      top: var(--space-md);
      right: var(--space-md);
      padding: var(--space-xs) var(--space-sm);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      color: var(--text-secondary);
      border-radius: var(--radius-sm);
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .doc-close:hover {
      background: var(--glass-bg-hover);
      color: var(--text-primary);
    }

    /* Demo Button & Popover */
    .demo-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      color: var(--text-primary);
      border-radius: var(--radius-md);
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: var(--transition-base);
    }

    .demo-btn:hover {
      background: var(--glass-bg-hover);
      transform: translateY(-1px);
    }

    .demo-popover {
      position: absolute;
      width: min(400px, calc(100vw - 32px));
      padding: var(--space-md);
      background: var(--bg-secondary);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      display: none;
      z-index: 9999;
      backdrop-filter: blur(12px);
    }

    .demo-popover.is-open {
      display: block;
    }

    .demo-popover__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-md);
    }

    .demo-popover__title {
      font-weight: 600;
      color: var(--text-primary);
    }

    .demo-popover__close {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition-fast);
    }

    .demo-popover__close:hover {
      background: var(--glass-bg-hover);
    }

    .demo-popover__video {
      width: 100%;
      aspect-ratio: 9 / 16;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: #000;
    }

    .demo-popover__video iframe {
      width: 100%;
      height: 100%;
      border: 0;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .brand-logo-container,
      .auth-container {
        position: relative;
        top: auto;
        left: auto;
        right: auto;
        margin: 0 auto var(--space-md);
        text-align: center;
      }

      .brand-logo {
        width: 48px;
        height: 48px;
      }

      .user-info {
        flex-wrap: wrap;
        justify-content: center;
        text-align: center;
      }

      .chat-message.user {
        margin-left: var(--space-sm);
      }

      .chat-message.assistant {
        margin-right: var(--space-sm);
      }
    }

    @keyframes fadeInScale {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    /* Bet Logger Styles */
    ${BetLoggerStyles}

    /* Audio Orb Styles */
    ${AudioOrbStyles()}
  `}</style>
);

/* =============================== App Constants ============================= */
const CONSTANTS = {
  TABS: {
    KELLY: 'kelly',
    ESTIMATOR: 'estimator',
    WALTERS: 'walters',
    MATCHUP: 'matchup',
    NFL_MATCHUP: 'nfl_matchup',
    BET_HISTORY: 'bet_history',  // Bet tracking
    STATS: 'stats',  // NBA/NFL statistics
    ACCOUNT: 'account',  // Account settings
    PROMO: 'promo'  // Promotional links
  },
  SPORTS: { FOOTBALL: 'football', BASKETBALL: 'basketball' },
};

/* ========================= API helper (Kelly insight) ====================== */
async function fetchFromApi(prompt: string, systemInstruction: string) {
  const response = await fetch(`${BACKEND_URL}/api/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemInstruction }),
  });
  if (!response.ok) {
    let message = 'API request failed';
    try { const body = await response.json(); message = body.message || message; } catch {}
    throw new Error(message);
  }
  return response.json();
}

/* ======================== Probability engine (Normal) ====================== */
function normCdf(x: number): number {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1, z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + p * z);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z);
  return 0.5 * (1 + sign * y);
}

function coverProbabilityFromMargin(predictedMargin: number, spread: number, sigma: number): number {
  const Z = (predictedMargin + spread) / sigma;
  const p = normCdf(Z);
  return Math.max(1, Math.min(99, p * 100));
}

/* ========================== Sport-specific margin math ===================== */
function predictedMarginFootball(stats: any, isHome: boolean | null = null): number {
  const teamAPointDiff = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const teamBPointDiff = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
  const pointDiffComponent = (teamAPointDiff - teamBPointDiff) * 0.4;

  const teamAYardDiff = parseFloat(stats.teamOffYards) - parseFloat(stats.teamDefYards);
  const teamBYardDiff = parseFloat(stats.opponentOffYards) - parseFloat(stats.opponentDefYards);
  const yardDiffComponent = ((teamAYardDiff - teamBYardDiff) / 25) * 0.25;

  let teamTO = parseFloat(stats.teamTurnoverDiff) || 0;
  let oppTO = parseFloat(stats.opponentTurnoverDiff) || 0;
  teamTO = Math.max(-10, Math.min(10, teamTO));
  oppTO = Math.max(-10, Math.min(10, oppTO));
  const turnoverComponent = (teamTO - oppTO) * 4 * 0.5 * 0.2;

  const homeFieldAdvantage = isHome === null ? 0 : (isHome ? 2.5 : -2.5);

  return pointDiffComponent + yardDiffComponent + turnoverComponent + homeFieldAdvantage;
}

function predictedMarginBasketball(stats: any, isHome: boolean | null = null): number {
  const teamAPointDiff = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const teamBPointDiff = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
  const pointDiffComponent = (teamAPointDiff - teamBPointDiff) * 0.35;

  const teamAFg = parseFloat(stats.teamFgPct) || 0;
  const teamBFg = parseFloat(stats.opponentFgPct) || 0;
  const fgDiffComponent = (teamAFg - teamBFg) * 1.0 * 0.30;

  const teamAReb = parseFloat(stats.teamReboundMargin) || 0;
  const teamBReb = parseFloat(stats.opponentReboundMargin) || 0;
  const reboundComponent = (teamAReb - teamBReb) * 0.5 * 0.20;

  const teamATov = parseFloat(stats.teamTurnoverMargin) || 0;
  const teamBTov = parseFloat(stats.opponentTurnoverMargin) || 0;
  // Turnovers: positive margin = worse ball security, so invert the edge
  const turnoverComponent = (teamBTov - teamATov) * 1.0 * 0.15;

  const homeCourtAdvantage = isHome === null ? 0 : (isHome ? 3.0 : -3.0);

  return pointDiffComponent + fgDiffComponent + reboundComponent + turnoverComponent + homeCourtAdvantage;
}

/* ================================= Utilities ============================== */
const formatCurrency = (v: any) => isNaN(Number(v)) ? '$0.00' :
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));

const formatBankrollValue = (value: string | number) => {
  if (value === '') return '';
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) return '';
  return numValue.toFixed(2);
};

export const initialFootballState = {
  teamPointsFor: '', opponentPointsFor: '',
  teamPointsAgainst: '', opponentPointsAgainst: '',
  teamOffYards: '', opponentOffYards: '',
  teamDefYards: '', opponentDefYards: '',
  teamTurnoverDiff: '', opponentTurnoverDiff: '',
  teamAName: '', teamBName: '',
};
export const initialBasketballState = {
  teamPointsFor: '', opponentPointsFor: '',
  teamPointsAgainst: '', opponentPointsAgainst: '',
  teamFgPct: '', opponentFgPct: '',
  teamReboundMargin: '', opponentReboundMargin: '',
  teamTurnoverMargin: '', opponentTurnoverMargin: '',
  teamAName: '', teamBName: '',
};

/* ======================== NEW: Types for Bet Logging ======================= */
interface MatchupData {
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
}

interface EstimationData {
  pointSpread: number;
  calculatedProbability: number;
  expectedMargin?: number;
}

/* ========================= Probability Estimator panel ===================== */
function ProbabilityEstimator({
  setProbability,
  setActiveTab,
  activeSport,
  setActiveSport,
  footballStats,
  setFootballStats,
  basketballStats,
  setBasketballStats,
  pointSpread,
  setPointSpread,
  calculatedProb,
  setCalculatedProb,
  expectedDiff,
  setExpectedDiff,
  isTeamAHome,
  setIsTeamAHome,
  // NEW: Callbacks to store data for bet logging
  setCurrentMatchup,
  setCurrentEstimation
}: {
  setProbability:(v:string)=>void;
  setActiveTab:(t:string)=>void;
  activeSport: string;
  setActiveSport: (v:string)=>void;
  footballStats: any;
  setFootballStats: (v:any)=>void;
  basketballStats: any;
  setBasketballStats: (v:any)=>void;
  pointSpread: string;
  setPointSpread: (v:string)=>void;
  calculatedProb: number|null;
  setCalculatedProb: (v:number|null)=>void;
  expectedDiff: number|null;
  setExpectedDiff: (v:number|null)=>void;
  isTeamAHome: boolean|null;
  setIsTeamAHome: (v:boolean|null)=>void;
  // NEW props
  setCurrentMatchup: (v: MatchupData | null) => void;
  setCurrentEstimation: (v: EstimationData | null) => void;
}) {

  const isFormValid = useMemo(() => {
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    const requiredFields = Object.entries(current)
      .filter(([key]) => key !== 'teamAName' && key !== 'teamBName')
      .map(([, value]) => value);
    const ok = requiredFields.every(v => v !== '');
    return ok && pointSpread !== '';
  }, [activeSport, footballStats, basketballStats, pointSpread]);

  const progress = useMemo(() => {
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    const statEntries = Object.entries(current).filter(([key]) => key !== 'teamAName' && key !== 'teamBName');
    const filledFields = statEntries.filter(([, v]) => v !== '').length;
    const totalFields = statEntries.length;
    const hasSpread = pointSpread !== '';
    return {
      stats: filledFields,
      totalStats: totalFields,
      spread: hasSpread,
      allComplete: filledFields === totalFields && hasSpread
    };
  }, [activeSport, footballStats, basketballStats, pointSpread]);

  const loadExample = () => {
    if (activeSport === CONSTANTS.SPORTS.FOOTBALL) {
      setFootballStats({
        teamPointsFor: '28.5', opponentPointsFor: '24.2',
        teamPointsAgainst: '21.3', opponentPointsAgainst: '26.8',
        teamOffYards: '395', opponentOffYards: '362',
        teamDefYards: '315', opponentDefYards: '385',
        teamTurnoverDiff: '8', opponentTurnoverDiff: '-3',
        teamAName: 'KC', teamBName: 'BUF'
      });
      setPointSpread('-6.5');
    } else {
      setBasketballStats({
        teamPointsFor: '112.5', opponentPointsFor: '108.3',
        teamPointsAgainst: '106.2', opponentPointsAgainst: '110.8',
        teamFgPct: '47.8', opponentFgPct: '45.2',
        teamReboundMargin: '4.2', opponentReboundMargin: '-1.5',
        teamTurnoverMargin: '2.8', opponentTurnoverMargin: '-1.2',
        teamAName: 'Lakers', teamBName: 'Warriors'
      });
      setPointSpread('-4.5');
    }
  };

  const handleCalculate = () => {
    try {
      const spread = parseFloat(pointSpread);
      if (Number.isNaN(spread)) throw new Error('Invalid spread');

      const m = activeSport === CONSTANTS.SPORTS.FOOTBALL
        ? predictedMarginFootball(footballStats, isTeamAHome)
        : predictedMarginBasketball(basketballStats, isTeamAHome);

      const sigma = activeSport === CONSTANTS.SPORTS.FOOTBALL ? 13.5 : 11.5;
      const p = coverProbabilityFromMargin(m, spread, sigma);

      setCalculatedProb(p);
      setExpectedDiff(m);
    } catch (e) {
      console.error(e);
      setCalculatedProb(null);
      setExpectedDiff(null);
    }
  };

  const selectedTeamName = useMemo(() => {
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    return current.teamAName?.trim() || 'Your Team';
  }, [activeSport, basketballStats, footballStats]);

  const formattedMargin = useMemo(() => {
    if (expectedDiff === null) return null;
    return `${expectedDiff > 0 ? '+' : ''}${expectedDiff.toFixed(1)}`;
  }, [expectedDiff]);

  // UPDATED: Store matchup data when applying to Kelly
  const handleApplyAndSwitch = (prob: number) => {
    setProbability(prob.toFixed(2));

    const stats = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;

    // Build matchup data for bet logging
    const matchupData: MatchupData = {
      sport: activeSport as 'football' | 'basketball',
      teamA: {
        name: stats.teamAName || 'Team A',
        abbreviation: stats.teamAName || undefined,
        stats: activeSport === CONSTANTS.SPORTS.FOOTBALL
          ? {
              pointsFor: parseFloat(stats.teamPointsFor) || 0,
              pointsAgainst: parseFloat(stats.teamPointsAgainst) || 0,
              offYards: parseFloat(stats.teamOffYards) || 0,
              defYards: parseFloat(stats.teamDefYards) || 0,
              turnoverDiff: parseFloat(stats.teamTurnoverDiff) || 0
            }
          : {
              pointsFor: parseFloat(stats.teamPointsFor) || 0,
              pointsAgainst: parseFloat(stats.teamPointsAgainst) || 0,
              fgPct: parseFloat(stats.teamFgPct) || 0,
              reboundMargin: parseFloat(stats.teamReboundMargin) || 0,
              turnoverMargin: parseFloat(stats.teamTurnoverMargin) || 0
            }
      },
      teamB: {
        name: stats.teamBName || 'Team B',
        abbreviation: stats.teamBName || undefined,
        stats: activeSport === CONSTANTS.SPORTS.FOOTBALL
          ? {
              pointsFor: parseFloat(stats.opponentPointsFor) || 0,
              pointsAgainst: parseFloat(stats.opponentPointsAgainst) || 0,
              offYards: parseFloat(stats.opponentOffYards) || 0,
              defYards: parseFloat(stats.opponentDefYards) || 0,
              turnoverDiff: parseFloat(stats.opponentTurnoverDiff) || 0
            }
          : {
              pointsFor: parseFloat(stats.opponentPointsFor) || 0,
              pointsAgainst: parseFloat(stats.opponentPointsAgainst) || 0,
              fgPct: parseFloat(stats.opponentFgPct) || 0,
              reboundMargin: parseFloat(stats.opponentReboundMargin) || 0,
              turnoverMargin: parseFloat(stats.opponentTurnoverMargin) || 0
            }
      },
      venue: isTeamAHome === null ? 'neutral' : isTeamAHome ? 'home' : 'away'
    };

    const estimationData: EstimationData = {
      pointSpread: parseFloat(pointSpread),
      calculatedProbability: prob,
      expectedMargin: expectedDiff || undefined
    };

    setCurrentMatchup(matchupData);
    setCurrentEstimation(estimationData);
    setActiveTab(CONSTANTS.TABS.KELLY);
  };

  const handleSwap = () => {
    if (activeSport === CONSTANTS.SPORTS.FOOTBALL) {
      setFootballStats({
        teamPointsFor: footballStats.opponentPointsFor,
        opponentPointsFor: footballStats.teamPointsFor,
        teamPointsAgainst: footballStats.opponentPointsAgainst,
        opponentPointsAgainst: footballStats.teamPointsAgainst,
        teamOffYards: footballStats.opponentOffYards,
        opponentOffYards: footballStats.teamOffYards,
        teamDefYards: footballStats.opponentDefYards,
        opponentDefYards: footballStats.teamDefYards,
        teamTurnoverDiff: footballStats.opponentTurnoverDiff,
        opponentTurnoverDiff: footballStats.teamTurnoverDiff,
        teamAName: footballStats.teamBName,
        teamBName: footballStats.teamAName,
      });
    } else {
      setBasketballStats({
        teamPointsFor: basketballStats.opponentPointsFor,
        opponentPointsFor: basketballStats.teamPointsFor,
        teamPointsAgainst: basketballStats.opponentPointsAgainst,
        opponentPointsAgainst: basketballStats.teamPointsAgainst,
        teamFgPct: basketballStats.opponentFgPct,
        opponentFgPct: basketballStats.teamFgPct,
        teamReboundMargin: basketballStats.opponentReboundMargin,
        opponentReboundMargin: basketballStats.teamReboundMargin,
        teamTurnoverMargin: basketballStats.opponentTurnoverMargin,
        opponentTurnoverMargin: basketballStats.teamTurnoverMargin,
        teamAName: basketballStats.teamBName,
        teamBName: basketballStats.teamAName,
      });
    }

    if (pointSpread !== '') {
      const currentSpread = parseFloat(pointSpread);
      if (!isNaN(currentSpread)) {
        setPointSpread((-currentSpread).toString());
      }
    }

    if (isTeamAHome !== null) {
      setIsTeamAHome(!isTeamAHome);
    }
  };

  return (
    <div className="panel panel-strong">
      <div className="tabs nested-tabs" role="tablist" aria-label="Sport selector">
        <button className={`tab ${activeSport === CONSTANTS.SPORTS.FOOTBALL ? 'active' : ''}`}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.FOOTBALL)}>Football</button>
        <button className={`tab ${activeSport === CONSTANTS.SPORTS.BASKETBALL ? 'active' : ''}`}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.BASKETBALL)}>Basketball</button>
      </div>

      <div className="progress-container">
        <div className={`progress-step ${progress.spread ? 'completed' : progress.stats === 0 ? 'active' : ''}`}>
          {progress.spread ? '✓' : '1'} Point Spread
        </div>
        <div className={`progress-step ${progress.allComplete ? 'completed' : progress.spread ? 'active' : ''}`}>
          {progress.allComplete ? '✓' : progress.stats}/{progress.totalStats} Team Stats
        </div>
      </div>

      {progress.stats === 0 && !pointSpread && (
        <div className="empty-state">
          <h3>Get Started</h3>
          <p>Enter team statistics and point spread to calculate win probability</p>
          <button className="try-example-btn" onClick={loadExample}>
            Try Example Data
          </button>
        </div>
      )}

      <div className="input-group">
        <label htmlFor="pointSpread">
          Point Spread (Your Team)
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Negative = your team favored (e.g., -6.5 means your team must win by more than 6.5). Positive = underdog</span>
          </span>
        </label>
        <input id="pointSpread" type="number" name="pointSpread" value={pointSpread}
               onChange={(e)=>setPointSpread(e.target.value)} className="input-field" placeholder="e.g., -6.5 or 3" step="0.5" />
        <p style={{fontSize:'.8rem', color:'var(--text-muted)'}}>
          Negative = your team favored, Positive = your team underdog
        </p>
      </div>

      <div className="input-group">
        <label htmlFor="venue">
          Venue
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Home field advantage is worth ~2.5 pts (NFL) or ~3 pts (NBA)</span>
          </span>
        </label>
        <select
          id="venue"
          className="input-field"
          value={isTeamAHome === null ? 'neutral' : isTeamAHome ? 'home' : 'away'}
          onChange={(e) => {
            const val = e.target.value;
            setIsTeamAHome(val === 'neutral' ? null : val === 'home');
          }}
        >
          <option value="neutral">Neutral Site</option>
          <option value="home">Your Team is Home</option>
          <option value="away">Your Team is Away</option>
        </select>
      </div>

      <Suspense fallback={<div style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>Loading...</div>}>
        {activeSport === CONSTANTS.SPORTS.FOOTBALL ? (
          <FootballEstimator
            stats={footballStats}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFootballStats({ ...footballStats, [e.target.name]: e.target.value })}
          />
        ) : (
          <BasketballEstimator
            stats={basketballStats}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setBasketballStats({ ...basketballStats, [e.target.name]: e.target.value })}
          />
        )}
      </Suspense>

      <div style={{display:'flex', gap:'.75rem', flexWrap:'wrap'}}>
        <button className="btn-primary" onClick={handleCalculate} disabled={!isFormValid} style={{flex:'1'}}>
          Calculate Probability
        </button>
        <button
          className="btn-secondary"
          onClick={handleSwap}
          style={{flex:'0 0 auto', minWidth:'150px'}}
          title="Swap team and opponent values to see probability from the other perspective"
        >
          ⇄ Swap Teams
        </button>
      </div>

      {calculatedProb !== null && (
        <div className="results" role="status" aria-live="polite">
          <p>Estimated Cover Probability</p>
          <h2 className="results-team" style={{margin:'0.25rem 0 0.35rem'}}>{selectedTeamName}</h2>
          <div className="matchup-result-stats">
            <div className="matchup-result-value">
              {calculatedProb.toFixed(2)}%
            </div>
            {formattedMargin !== null && (
              <div className="matchup-result-margin">Predicted Margin: {formattedMargin} pts</div>
            )}
          </div>
          <div style={{marginTop:'.6rem'}}>
            <button className="btn-primary" onClick={()=>handleApplyAndSwitch(calculatedProb!)}>
              Use in Kelly Calculator →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Kelly Calculator =========================== */
const calculateImpliedProbability = (americanOdds: string): number | null => {
  const odds = parseFloat(americanOdds);
  if (isNaN(odds)) return null;
  if (odds < 0) {
    return (-odds) / (-odds + 100) * 100;
  }
  return 100 / (odds + 100) * 100;
};

type HistoryEntry = { bankroll:string; odds:string; probability:string; stake:number; timestamp:number };

const DEFAULT_BANKROLL = '1000.00';

function KellyCalculator({
  probability,
  setProbability,
  // NEW: Props for bet logging
  isAuthenticated,
  matchupData,
  estimationData,
  onLoginRequired,
  bankrollRefreshTrigger
}: {
  probability: string;
  setProbability: (v: string) => void;
  isAuthenticated: boolean;
  matchupData: MatchupData | null;
  estimationData: EstimationData | null;
  onLoginRequired: () => void;
  bankrollRefreshTrigger?: number;
}) {
  const [bankroll, setBankroll] = useState(DEFAULT_BANKROLL);
  const [savedBankroll, setSavedBankroll] = useState(DEFAULT_BANKROLL); // Track saved value
  const [isSavingBankroll, setIsSavingBankroll] = useState(false);
  const [odds, setOdds] = useState('-110');
  const [fraction, setFraction] = useState('1');
  const [explanation, setExplanation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Check if bankroll has been manually changed
  const hasBankrollChanged = bankroll !== savedBankroll;

  // Load persisted bankroll on mount
  useEffect(() => {
    const storedBankroll = localStorage.getItem('kelly-bankroll');
    if (storedBankroll !== null) {
      setBankroll(storedBankroll);
      setSavedBankroll(storedBankroll);
    }
  }, []);

  // Persist bankroll changes without interfering with typing (debounced)
  useEffect(() => {
    const handle = setTimeout(() => {
      localStorage.setItem('kelly-bankroll', bankroll);
    }, 500);

    return () => clearTimeout(handle);
  }, [bankroll]);

  const validation = useMemo(() => {
    const numBankroll = parseFloat(bankroll);
    const americanOdds = parseFloat(odds);
    const numProbability = parseFloat(probability);

    return {
      bankroll: bankroll === '' ? null : (numBankroll > 0),
      odds: odds === '' ? null : (americanOdds <= -100 || americanOdds >= 100),
      probability: probability === '' ? null : (numProbability > 0 && numProbability < 100)
    };
  }, [bankroll, odds, probability]);

  const { stake, stakePercentage, hasValue } = useMemo(() => {
    const numBankroll = parseFloat(bankroll);
    const americanOdds = parseFloat(odds);
    const numProbability = parseFloat(probability) / 100;
    const numFraction = parseFloat(fraction);

    if (isNaN(numBankroll) || numBankroll <= 0 ||
        isNaN(americanOdds) || (americanOdds > -100 && americanOdds < 100) ||
        isNaN(numProbability) || numProbability <= 0 || numProbability >= 1) {
      return { stake:0, stakePercentage:0, hasValue:false };
    }
    const decimalOdds = americanOdds > 0 ? (americanOdds/100)+1 : (100/Math.abs(americanOdds))+1;
    const b = decimalOdds - 1;
    const k = ((b * numProbability) - (1 - numProbability)) / b;
    if (k <= 0) return { stake:0, stakePercentage:0, hasValue:false };
    const calculatedStake = numBankroll * k * numFraction;
    const calculatedPercentage = k*100*numFraction;
    return {
      stake: calculatedStake,
      stakePercentage: calculatedPercentage,
      hasValue:true
    };
  }, [bankroll, odds, probability, fraction]);

  const { impliedProb, edge, edgeColor } = useMemo(() => {
    const implied = calculateImpliedProbability(odds);
    const userProb = parseFloat(probability);

    if (!implied || isNaN(userProb)) return { impliedProb: null, edge: null, edgeColor: 'grey' };

    const currentEdge = userProb - implied;
    const color = currentEdge > 0 ? '#10b981' : '#ef4444';

    return {
      impliedProb: implied,
      edge: currentEdge,
      edgeColor: color
    };
  }, [odds, probability]);

  useEffect(() => {
    if (hasValue && stake > 0) {
      const newEntry: HistoryEntry = {
        bankroll, odds, probability, stake, timestamp: Date.now()
      };
      setHistory(prev => [newEntry, ...prev.slice(0, 4)]);
    }
  }, [stake, hasValue, bankroll, odds, probability]);

  const handleBankrollChange = (value: string) => {
    setBankroll(value);
  };

  // Function to fetch bankroll from backend
  const fetchBankroll = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch(`${BACKEND_URL}/auth/bankroll`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.bankroll !== undefined) {
          const bankrollValue = formatBankrollValue(data.bankroll);
          setBankroll(bankrollValue);
          setSavedBankroll(bankrollValue); // Also update saved value
        } else {
          setBankroll(DEFAULT_BANKROLL);
          setSavedBankroll(DEFAULT_BANKROLL);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bankroll:', error);
    }
  };

  // Fetch bankroll when authenticated or when refresh is triggered
  useEffect(() => {
    fetchBankroll();
  }, [isAuthenticated, bankrollRefreshTrigger]);

  useEffect(() => {
    if (!probability) return;
    const getExplanation = async () => {
      setIsGenerating(true); setExplanation('');
      try {
        const systemInstruction =
          "You are an elite betting analyst. Give sharp, 1–2 sentence insights explaining each Kelly Criterion recommendation. Be confident, direct, and responsibly bold with a touch of sass. Keep explanations concise, varied, and never repetitive.";
        const userPrompt = hasValue
          ? `A user's inputs (Bankroll: ${formatCurrency(bankroll)}, Odds: ${odds}, Win Probability: ${probability}%) result in a recommended stake of ${formatCurrency(stake)} (${stakePercentage.toFixed(2)}%). Provide a concise, 1-2 sentence explanation.`
          : `A user's inputs (Bankroll: ${formatCurrency(bankroll)}, Odds: ${odds}, Win Probability: ${probability}%) indicate a "No Value" bet. Provide a concise explanation emphasizing bankroll protection.`;
        const response = await fetchFromApi(userPrompt, systemInstruction);
        setExplanation(response.text);
      } catch (e:any) {
        setExplanation(e?.message || "Could not generate an analysis at this time.");
      } finally { setIsGenerating(false); }
    };
    const t = setTimeout(getExplanation, 500);
    return () => clearTimeout(t);
  }, [stake, stakePercentage, hasValue, bankroll, odds, probability]);

  const loadHistoryItem = (item: HistoryEntry) => {
    setBankroll(formatBankrollValue(item.bankroll));
    setOdds(item.odds);
    setProbability(item.probability);
  };

  const getValidationClass = (isValid: boolean|null) => {
    if (isValid === null) return '';
    return isValid ? 'valid' : 'invalid';
  };

  // Save bankroll to backend when user clicks Save button
  const handleSaveBankroll = async () => {
    if (!isAuthenticated) {
      alert('Please login to save your bankroll.');
      return;
    }

    const numBankroll = parseFloat(bankroll);
    if (isNaN(numBankroll) || numBankroll < 0) {
      alert('Please enter a valid positive bankroll amount.');
      return;
    }

    // Confirm save
    if (!confirm(`Save bankroll as $${numBankroll.toFixed(2)}?`)) {
      return;
    }

    setIsSavingBankroll(true);
    try {
      const response = await fetch(`${BACKEND_URL}/auth/bankroll`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ bankroll: numBankroll })
      });

      if (response.ok) {
        setSavedBankroll(bankroll); // Update saved value
        alert('Bankroll saved successfully!');
      } else {
        alert('Failed to save bankroll. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save bankroll:', error);
      alert('Failed to save bankroll. Please try again.');
    } finally {
      setIsSavingBankroll(false);
    }
  };

  // Check if we have complete data for bet logging
  const canLogBet = hasValue && matchupData && estimationData;

  return (
    <div className="panel">
      <div className="input-group">
        <label htmlFor="bankroll">
          Bankroll
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Total amount of money available for betting</span>
          </span>
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input
            id="bankroll"
            type="text"
            className={`input-field ${getValidationClass(validation.bankroll)}`}
            value={bankroll}
            onChange={(e)=>handleBankrollChange(e.target.value)}
            placeholder="e.g., 1000"
            style={{ flex: 1 }}
            inputMode="decimal"
          />
          {isAuthenticated && hasBankrollChanged && (
            <button
              onClick={handleSaveBankroll}
              disabled={isSavingBankroll || validation.bankroll === false}
              className="save-bankroll-btn"
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--accent)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isSavingBankroll ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                whiteSpace: 'nowrap',
                opacity: validation.bankroll === false ? 0.5 : 1
              }}
            >
              {isSavingBankroll ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
        {validation.bankroll === false && <div className="error-message">⚠ Bankroll must be positive</div>}
        {isAuthenticated && hasBankrollChanged && validation.bankroll !== false && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            💡 Click "Save" to update your bankroll
          </div>
        )}
        {!isAuthenticated && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Default bankroll is set to $1,000. Sign in with Google to save your preferred bankroll size.
          </div>
        )}
      </div>

      <div className="input-group">
        <label htmlFor="odds">
          American Odds
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Negative = favorite (e.g., -110), Positive = underdog (e.g., +150)</span>
          </span>
        </label>
        <input
          id="odds"
          type="number"
          className={`input-field ${getValidationClass(validation.odds)}`}
          value={odds}
          onChange={(e)=>setOdds(e.target.value)}
          placeholder="e.g., -110 or 150"
        />
        {validation.odds === false && <div className="error-message">⚠ Odds must be ≤-100 or ≥100</div>}
      </div>

      <div className="input-group">
        <label htmlFor="probability">
          Win Probability (%)
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Your estimated probability of winning (0-100%)</span>
          </span>
        </label>
        <div className="slider-group">
          <input
            id="probability"
            type="number"
            className={`input-field ${getValidationClass(validation.probability)}`}
            value={probability}
            onChange={(e)=>setProbability(e.target.value)}
            min="0"
            max="100"
            step="0.1"
          />
          <input type="range" min="0" max="100" value={probability} step="0.1" className="slider" onChange={(e)=>setProbability(e.target.value)} />
        </div>
        {validation.probability === false && <div className="error-message">⚠ Probability must be between 0 and 100</div>}
      </div>

      <div className="input-group">
        <label htmlFor="fraction">
          Kelly Fraction
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Half Kelly (0.5x) reduces volatility</span>
          </span>
        </label>
        <select id="fraction" className="input-field" value={fraction} onChange={(e)=>setFraction(e.target.value)}>
          <option value="1">Full Kelly (1x)</option>
          <option value="0.5">Half Kelly (0.5x)</option>
          <option value="0.25">Quarter Kelly (0.25x)</option>
        </select>
      </div>

      {hasValue ? (
        <div className="results">
          <p>Recommended Stake</p>
          <h2>{formatCurrency(stake)}</h2>
          <div className="results-details">
            <span>{stakePercentage.toFixed(2)}% of Bankroll</span>
          </div>

          {/* NEW: Log Bet Button */}
          {canLogBet && (
            <LogBetButton
              sport={matchupData!.sport}
              teamA={matchupData!.teamA}
              teamB={matchupData!.teamB}
              venue={matchupData!.venue}
              pointSpread={estimationData!.pointSpread}
              calculatedProbability={estimationData!.calculatedProbability}
              expectedMargin={estimationData!.expectedMargin}
              impliedProbability={impliedProb || undefined}
              edge={edge || undefined}
              bankroll={parseFloat(bankroll)}
              americanOdds={parseFloat(odds)}
              kellyFraction={parseFloat(fraction)}
              recommendedStake={stake}
              stakePercentage={stakePercentage}
              isAuthenticated={isAuthenticated}
              onLoginRequired={onLoginRequired}
              onBankrollUpdate={fetchBankroll}
            />
          )}

          {/* Show sign-in prompt if no matchup data or not authenticated */}
          {!canLogBet && hasValue && (
            <div style={{ marginTop: '1rem', padding: '.75rem', background: 'rgba(99,102,241,.1)', borderRadius: '.5rem', textAlign: 'center' }}>
              {!isAuthenticated ? (
                <button className="log-bet-btn" style={{ opacity: 0.8 }} onClick={onLoginRequired}>
                  🔒 Sign in to Log Bets
                </button>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '.9rem', margin: 0 }}>
                  💡 Use the Probability Estimator first to enable bet logging with full matchup data
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="results no-value"><h2>No Value - Do Not Bet</h2></div>
      )}

      {impliedProb !== null && edge !== null && (
        <div style={{
          marginTop: '1rem',
          padding: '.75rem',
          borderRadius: '.6rem',
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.9rem'
        }}>
          <div>
            <span style={{color: 'var(--text-muted)', display:'block', fontSize:'.75rem'}}>Implied Win %</span>
            <strong>{impliedProb.toFixed(1)}%</strong>
          </div>
          <div style={{textAlign: 'right'}}>
            <span style={{color: 'var(--text-muted)', display:'block', fontSize:'.75rem'}}>Your Edge</span>
            <strong style={{color: edgeColor}}>
              {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
            </strong>
          </div>
        </div>
      )}

      <div className="analyst-insight">
        <h3 style={{marginTop:0}}>Analyst's Insight</h3>
        {isGenerating && (
          <p style={{display:'flex', alignItems:'center'}}>
            <span className="loading-spinner"></span>
            Analyst is analyzing your bet...
          </p>
        )}
        {!isGenerating && explanation && <p>{explanation}</p>}
      </div>

      {history.length > 0 && (
        <div className="history-panel">
          <h3 style={{marginTop:0, marginBottom:'.75rem', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <span>Recent Calculations</span>
            <button
              className="btn-secondary"
              style={{width:'auto', padding:'.3rem .6rem', fontSize:'.8rem'}}
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </h3>
          {showHistory && history.map((item, i) => (
            <div key={item.timestamp} className="history-item" onClick={() => loadHistoryItem(item)}>
              <div>
                <strong>{formatCurrency(item.stake)}</strong>
                <div style={{fontSize:'.75rem', color:'var(--text-muted)'}}>
                  Bankroll: {formatCurrency(item.bankroll)} | Odds: {item.odds} | Prob: {item.probability}%
                </div>
              </div>
              <span style={{fontSize:'.75rem', color:'var(--text-muted)'}}>Load</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
/* ================================== App =================================== */
function App() {
  const [activeTab, setActiveTab] = useState(CONSTANTS.TABS.KELLY);
  const [probability, setProbability] = useState('60');

  const [theme, setTheme] = useState<ThemeKey>('midnight');

  // Probability estimator state
  const [activeSport, setActiveSport] = useState(CONSTANTS.SPORTS.FOOTBALL);
  const [footballStats, setFootballStats] = useState(initialFootballState);
  const [basketballStats, setBasketballStats] = useState(initialBasketballState);
  const [pointSpread, setPointSpread] = useState<string>('');
  const [calculatedProb, setCalculatedProb] = useState<number|null>(null);
  const [expectedDiff, setExpectedDiff] = useState<number|null>(null);
  const [isTeamAHome, setIsTeamAHome] = useState<boolean | null>(null);

  // Authentication state
  const [authUser, setAuthUser] = useState<{name: string; email: string; avatar: string} | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Documentation visibility
  const [isDocOpen, setIsDocOpen] = useState(false);

  useEffect(() => {
    const savedTheme = (localStorage.getItem('betgistics-theme') as ThemeKey | null);
    if (savedTheme && THEME_OPTIONS.some((option) => option.key === savedTheme)) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('betgistics-theme', theme);
  }, [theme]);

  // NEW: State for bet logging data flow
  const [currentMatchup, setCurrentMatchup] = useState<MatchupData | null>(null);
  const [currentEstimation, setCurrentEstimation] = useState<EstimationData | null>(null);

  // Bankroll refresh trigger - increment to force refresh
  const [bankrollRefreshTrigger, setBankrollRefreshTrigger] = useState(0);

  // Check authentication status on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch(`${BACKEND_URL}/auth/status`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          if (data.authenticated && data.user) {
            setAuthUser(data.user);
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setAuthLoading(false);
      }
    }
    checkAuth();
  }, []);

  // Demo Popover functionality
  useEffect(() => {
    const VIDEO_ID = "A6RZpBjjIns";

    const btn = document.getElementById("demoPopoverBtn");
    const popover = document.getElementById("demoPopover");
    const closeBtn = document.getElementById("demoPopoverClose");
    const iframe = document.getElementById("demoPopoverIframe") as HTMLIFrameElement | null;

    if (!btn || !popover || !closeBtn || !iframe) return;

    function setPopoverPosition() {
      if (!btn || !popover) return;
      const r = btn.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      // Left aligned to button, but keep on-screen
      const desiredLeft = r.left + scrollX;
      const maxLeft = scrollX + document.documentElement.clientWidth - popover.offsetWidth - 12;
      const left = Math.max(scrollX + 12, Math.min(desiredLeft, maxLeft));

      // Position above the button
      const top = r.top + scrollY - popover.offsetHeight - 10;

      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;
    }

    function openPopover(pushUrl = true) {
      if (!popover || !iframe) return;
      popover.classList.add("is-open");
      popover.setAttribute("aria-hidden", "false");

      setPopoverPosition();

      // load video only when open
      iframe.src = `https://www.youtube.com/embed/${VIDEO_ID}`;

      // set shareable URL: ?demo=1
      if (pushUrl) {
        const url = new URL(window.location.href);
        url.searchParams.set("demo", "1");
        history.pushState({ demo: true }, "", url.toString());
      }
    }

    function closePopover(pushUrl = true) {
      if (!popover || !iframe) return;
      popover.classList.remove("is-open");
      popover.setAttribute("aria-hidden", "true");

      // stop playback
      iframe.src = "";

      // remove param
      if (pushUrl) {
        const url = new URL(window.location.href);
        url.searchParams.delete("demo");
        history.pushState({ demo: false }, "", url.toString());
      }
    }

    const handleBtnClick = () => {
      if (!popover) return;
      const isOpen = popover.classList.contains("is-open");
      if (isOpen) closePopover(true);
      else openPopover(true);
    };

    const handleCloseClick = () => closePopover(true);

    const handleDocumentClick = (e: MouseEvent) => {
      if (!popover || !btn) return;
      if (!popover.classList.contains("is-open")) return;
      if (popover.contains(e.target as Node) || btn.contains(e.target as Node)) return;
      closePopover(true);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (!popover) return;
      if (e.key === "Escape" && popover.classList.contains("is-open")) closePopover(true);
    };

    const handleResize = () => {
      if (!popover) return;
      if (popover.classList.contains("is-open")) setPopoverPosition();
    };

    const handleScroll = () => {
      if (!popover) return;
      if (popover.classList.contains("is-open")) setPopoverPosition();
    };

    const handlePopstate = () => {
      if (!popover) return;
      const url = new URL(window.location.href);
      const shouldOpen = url.searchParams.get("demo") === "1";
      const isOpen = popover.classList.contains("is-open");

      if (shouldOpen && !isOpen) openPopover(false);
      if (!shouldOpen && isOpen) closePopover(false);
    };

    // auto-open if page loads with ?demo=1
    const url = new URL(window.location.href);
    if (url.searchParams.get("demo") === "1") openPopover(false);

    // Add event listeners
    btn.addEventListener("click", handleBtnClick);
    closeBtn.addEventListener("click", handleCloseClick);
    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, { passive: true } as any);
    window.addEventListener("popstate", handlePopstate);

    // Cleanup
    return () => {
      btn.removeEventListener("click", handleBtnClick);
      closeBtn.removeEventListener("click", handleCloseClick);
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("popstate", handlePopstate);
    };
  }, []);

  // Authentication handlers
  const handleGoogleLogin = () => {
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  const handleLogout = () => {
    window.location.href = `${BACKEND_URL}/auth/logout`;
  };

  const getTeamAbbreviation = (fullName: string): string => {
    if (!fullName) return '';
    const words = fullName.trim().split(' ');
    return words[words.length - 1];
  };

  // Handler to transfer NBA matchup data to Basketball Estimator
  const handleTransferToEstimator = (matchupData: any) => {
    setBasketballStats({
      teamPointsFor: matchupData.teamA.points_per_game?.toFixed(1) || '',
      opponentPointsFor: matchupData.teamB.points_per_game?.toFixed(1) || '',
      teamPointsAgainst: matchupData.teamA.points_allowed?.toFixed(1) || '',
      opponentPointsAgainst: matchupData.teamB.points_allowed?.toFixed(1) || '',
      teamFgPct: matchupData.teamA.field_goal_pct?.toFixed(1) || '',
      opponentFgPct: matchupData.teamB.field_goal_pct?.toFixed(1) || '',
      teamReboundMargin: matchupData.teamA.rebound_margin?.toFixed(1) || '',
      opponentReboundMargin: matchupData.teamB.rebound_margin?.toFixed(1) || '',
      teamTurnoverMargin: matchupData.teamA.turnover_margin?.toFixed(1) || '',
      opponentTurnoverMargin: matchupData.teamB.turnover_margin?.toFixed(1) || '',
      teamAName: getTeamAbbreviation(matchupData.teamA.team || ''),
      teamBName: getTeamAbbreviation(matchupData.teamB.team || ''),
    });
    setActiveSport(CONSTANTS.SPORTS.BASKETBALL);
    setActiveTab(CONSTANTS.TABS.ESTIMATOR);
  };

  // Handler to transfer NFL matchup data to Football Estimator
  const handleNFLTransferToEstimator = (matchupData: any) => {
    setFootballStats({
      teamPointsFor: matchupData.teamPointsFor || '',
      opponentPointsFor: matchupData.opponentPointsFor || '',
      teamPointsAgainst: matchupData.teamPointsAgainst || '',
      opponentPointsAgainst: matchupData.opponentPointsAgainst || '',
      teamOffYards: matchupData.teamOffYards || '',
      opponentOffYards: matchupData.opponentOffYards || '',
      teamDefYards: matchupData.teamDefYards || '',
      opponentDefYards: matchupData.opponentDefYards || '',
      teamTurnoverDiff: matchupData.teamTurnoverDiff || '',
      opponentTurnoverDiff: matchupData.opponentTurnoverDiff || '',
      teamAName: matchupData.teamAName || '',
      teamBName: matchupData.teamBName || '',
    });
    setActiveSport(CONSTANTS.SPORTS.FOOTBALL);
    setActiveTab(CONSTANTS.TABS.ESTIMATOR);
  };

  // Handler for Walters Protocol to apply to Kelly Calculator
  const handleWaltersApplyToKelly = (probability: number, matchupData: any, estimationData: any) => {
    setProbability(probability.toFixed(2));
    setCurrentMatchup(matchupData);
    setCurrentEstimation(estimationData);
    setActiveTab(CONSTANTS.TABS.KELLY);
  };

  // Login redirect handler
  const handleLoginRequired = () => {
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  // Get SEO config based on active tab
  const getSEOForTab = () => {
    switch (activeTab) {
      case CONSTANTS.TABS.KELLY:
        return SEO_CONFIG.kelly;
      case CONSTANTS.TABS.ESTIMATOR:
        return SEO_CONFIG.estimator;
      case CONSTANTS.TABS.MATCHUP:
        return SEO_CONFIG.nba_matchup;
      case CONSTANTS.TABS.NFL_MATCHUP:
        return SEO_CONFIG.nfl_matchup;
      case CONSTANTS.TABS.BET_HISTORY:
        return SEO_CONFIG.bet_history;
      case CONSTANTS.TABS.STATS:
        return SEO_CONFIG.stats;
      case CONSTANTS.TABS.ACCOUNT:
        return SEO_CONFIG.account;
      case CONSTANTS.TABS.PROMO:
        return SEO_CONFIG.promo;
      default:
        return SEO_CONFIG.kelly;
    }
  };

  const currentSEO = getSEOForTab();

  return (
    <>
      {/* Dynamic SEO meta tags based on active tab */}
      <SEO {...currentSEO} />

      <div className="site-bg">
        <div className="bg-overlay" />
        <div className="blob blob-a" />
        <div className="blob blob-b" />

        {/* Brand Logo */}
        <div className="brand-logo-container">
          <img
            src="/betgistics.png"
            alt="Betgistics Logo"
            className="brand-logo"
            title="Betgistics - Point Spread Betting Analytics"
            loading="eager"
            fetchpriority="high"
            width="64"
            height="64"
          />
        </div>

        {/* Authentication UI */}
        <div className="auth-container">
          {authLoading ? (
            <div style={{color: 'var(--text-muted)', fontSize: '.9rem'}}>Loading...</div>
          ) : authUser ? (
            <div className="user-info">
              {authUser.avatar && <img src={authUser.avatar} alt={authUser.name} className="user-avatar" />}
              <div className="user-details">
                <div className="user-name">{authUser.name}</div>
                <div className="user-email">{authUser.email}</div>
              </div>
              <a href={`${BACKEND_URL}/auth/logout`} className="logout-btn">Logout</a>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <a href={`${BACKEND_URL}/auth/google`} className="auth-btn">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </a>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', maxWidth: '240px' }}>
                By signing in, you agree to our{' '}
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                  Privacy Policy
                </a>
                {' '}and{' '}
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                  Terms of Service
                </a>
              </p>
            </div>
          )}
        </div>

        <div className="page-wrap">
          <header className="header">
            <h1 className="title">
              <span className="title-part-1">Bet Like A Pro</span>
              <span className="title-part-2">Betgistics</span>
            </h1>
            <SwipeableAudioOrbs
              orbs={[
                {
                  audioSrc: '/intro.mp3',
                  label: 'Introduction',
                  icon: '🎙️',
                },
                {
                  audioSrc: '/mission_statement.mp3',
                  label: 'Mission Statement',
                  icon: '🎯',
                },
                {
                  audioSrc: '/quick_guide.mp3',
                  label: 'Quick Start Guide',
                  icon: '🎧',
                },
                {
                  audioSrc: '/math_stats.mp3',
                  label: 'Magnify Stats',
                  icon: '🔍',
                },
              ]}
            />
          </header>

          <div className="panel" style={{maxWidth:900}}>
            <div className="tabs" role="tablist">
              {[
                { key: CONSTANTS.TABS.KELLY, label: 'Kelly Criterion' },
                { key: CONSTANTS.TABS.ESTIMATOR, label: 'Probability Estimator' },
                { key: CONSTANTS.TABS.WALTERS, label: '⚡ Walters Protocol' },
                { key: CONSTANTS.TABS.MATCHUP, label: 'NBA Matchup' },
                { key: CONSTANTS.TABS.NFL_MATCHUP, label: 'NFL Matchup' },
                { key: CONSTANTS.TABS.BET_HISTORY, label: '📊 Bet History' },  // NEW TAB
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                  aria-selected={activeTab === tab.key}
                  role="tab"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeTab === CONSTANTS.TABS.KELLY && (
            <KellyCalculator
              probability={probability}
              setProbability={setProbability}
              isAuthenticated={!!authUser}
              matchupData={currentMatchup}
              estimationData={currentEstimation}
              onLoginRequired={handleLoginRequired}
              bankrollRefreshTrigger={bankrollRefreshTrigger}
            />
          )}
          {activeTab === CONSTANTS.TABS.ESTIMATOR && (
            <ProbabilityEstimator
              setProbability={setProbability}
              setActiveTab={setActiveTab}
              activeSport={activeSport}
              setActiveSport={setActiveSport}
              footballStats={footballStats}
              setFootballStats={setFootballStats}
              basketballStats={basketballStats}
              setBasketballStats={setBasketballStats}
              pointSpread={pointSpread}
              setPointSpread={setPointSpread}
              calculatedProb={calculatedProb}
              setCalculatedProb={setCalculatedProb}
              expectedDiff={expectedDiff}
              setExpectedDiff={setExpectedDiff}
              isTeamAHome={isTeamAHome}
              setIsTeamAHome={setIsTeamAHome}
              // NEW: Pass setters for bet logging
              setCurrentMatchup={setCurrentMatchup}
              setCurrentEstimation={setCurrentEstimation}
            />
          )}
          {activeTab === CONSTANTS.TABS.WALTERS && (
            <div className="panel">
              <Suspense fallback={<div style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>Loading Walters Protocol...</div>}>
                <WaltersEstimator onApplyToKelly={handleWaltersApplyToKelly} />
              </Suspense>
            </div>
          )}
          {activeTab === CONSTANTS.TABS.MATCHUP && (
            <div className="panel">
              <Suspense fallback={<div style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>Loading matchup data...</div>}>
                <SportsMatchup
                  onTransferToEstimator={handleTransferToEstimator}
                />
              </Suspense>
            </div>
          )}
          {activeTab === CONSTANTS.TABS.NFL_MATCHUP && (
            <div className="panel">
              <Suspense fallback={<div style={{padding:'2rem', textAlign:'center', color:'var(--text-muted)'}}>Loading matchup data...</div>}>
                <NFLMatchup
                  onTransferToEstimator={handleNFLTransferToEstimator}
                />
              </Suspense>
            </div>
          )}
          {/* NEW: Bet History Tab */}
          {activeTab === CONSTANTS.TABS.BET_HISTORY && (
            <div className="panel">
              <BetHistory
                isAuthenticated={!!authUser}
                onBankrollUpdate={() => setBankrollRefreshTrigger(prev => prev + 1)}
              />
            </div>
          )}

          {/* Stats Page Tab */}
          {activeTab === CONSTANTS.TABS.STATS && (
            <StatsPage />
          )}

          {/* Account Settings Tab */}
          {activeTab === CONSTANTS.TABS.ACCOUNT && (
            <AccountSettings
              user={authUser}
              onLogout={handleLogout}
              onLogin={handleGoogleLogin}
              theme={theme}
              themeOptions={THEME_OPTIONS}
              onThemeChange={(value) => setTheme(value as ThemeKey)}
            />
          )}

          {/* Promo Page Tab */}
          {activeTab === CONSTANTS.TABS.PROMO && (
            <PromoPage user={authUser} />
          )}

          <div
            className={`doc-panel-wrapper ${isDocOpen ? 'open' : 'closed'}`}
            id="app-documentation"
            aria-hidden={!isDocOpen}
          >
            <div className="panel info-panel doc-panel">
              <button className="doc-close" type="button" onClick={() => setIsDocOpen(false)} aria-label="Close documentation">
                Close
              </button>
              <h2 style={{marginTop:0, marginBottom:'0.5rem'}}>How this app works</h2>
                <p style={{color:'var(--text-muted)', marginTop:0}}>
                  Follow these steps to move from matchup stats to a fully logged bet:
                </p>
                
                <ol style={{paddingLeft:'1.25rem', lineHeight:1.6, color:'var(--text-muted)'}}>
                  <li>
                    Start in the <strong>NBA Matchup</strong> or <strong>NFL Matchup</strong> tab to load team stats and compare both sides of the game.
                  </li>
                  <li>
                    Move to the <strong>Probability Estimator</strong>, enter your point spread, select whether your team is home or away, and hit <strong>Calculate Probability</strong> to generate your fair win probability.
                  </li>
                  <li>
                    Switch to the <strong>Kelly Criterion</strong>, enter your bankroll and odds, then paste in the win probability to calculate your optimal bet size.
                  </li>
                  <li>
                    Finally, use <strong>Log Bet</strong> to save the wager and track your results over time.
                  </li>
                </ol>
                
                <h3 style={{marginBottom:'0.35rem'}}>Feature guide</h3>
                <ul style={{paddingLeft:'1.25rem', lineHeight:1.6, color:'var(--text-muted)'}}>
                  <li><strong>Kelly Criterion</strong>: Calculates your optimal stake based on bankroll, odds, and your win probability.</li>
                  <li><strong>Probability Estimator</strong>: Converts matchup stats and point spreads into a projected win probability and expected margin.</li>
                  <li><strong>NBA Matchup</strong> / <strong>NFL Matchup</strong>: Pulls team performance data and pre-fills stats for the estimator.</li>
                  <li><strong>📊 Bet History</strong>: Stores your logged bets and tracks performance (sign-in required).</li>
                </ul>
            </div>
          </div>
        </div>

        <footer className="footer">
          <div className="footer-card">
            <button
              type="button"
              className="doc-toggle"
              onClick={() => setIsDocOpen((open) => !open)}
              aria-expanded={isDocOpen}
              aria-controls="app-documentation"
            >
              <span>{isDocOpen ? 'Hide documentation & workflow guide' : 'Show documentation & workflow guide'}</span>
              <span className={`doc-chevron ${isDocOpen ? 'open' : ''}`} aria-hidden>▾</span>
            </button>
            <p className="doc-hint">
              {isDocOpen
                ? 'Click to tuck the instructions away once you are comfortable with the flow.'
                : 'Open the drop-up to review the workflow and feature explanations.'}
            </p>

            {/* Watch Demo Button */}
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button id="demoPopoverBtn" className="demo-btn" type="button">
                🎬 Watch Demo
              </button>
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.5rem 0' }}>
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none', marginRight: '1.5rem' }}>
                  Privacy Policy
                </a>
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                  Terms of Service
                </a>
              </p>
            </div>
          </div>
        </footer>

        {/* Demo Popover (place right after footer) */}
        <div id="demoPopover" className="demo-popover" role="dialog" aria-hidden="true" aria-label="Demo video popover">
          <div className="demo-popover__header">
            <span className="demo-popover__title">Demo</span>
            <button id="demoPopoverClose" className="demo-popover__close" type="button" aria-label="Close">✕</button>
          </div>

          <div className="demo-popover__video">
            <iframe
              id="demoPopoverIframe"
              src=""
              title="Demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen>
            </iframe>
          </div>
        </div>

        {/* Bottom Navigation Bar */}
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          TABS={{
            BET_HISTORY: CONSTANTS.TABS.BET_HISTORY,
            STATS: CONSTANTS.TABS.STATS,
            ACCOUNT: CONSTANTS.TABS.ACCOUNT,
            PROMO: CONSTANTS.TABS.PROMO,
          }}
        />
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <HelmetProvider>
    <GlobalStyle />
    <App />
  </HelmetProvider>
);
