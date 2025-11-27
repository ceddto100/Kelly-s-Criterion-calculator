/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UPDATED: With Bet Logging Integration
*/
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

/* === bring in your committed form input components === */
import FootballEstimator from "./forms/FootballEstimator";
import BasketballEstimator from "./forms/BasketballEstimator";
import SportsMatchup from "./forms/SportsMatchup";
import NFLMatchup from "./forms/NFLMatchup";

/* === NEW: Import Bet Logger components === */
import { LogBetButton, BetHistory, BetLoggerStyles } from './components/BetLogger';

/* === Backend URL configuration === */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

/* =========================== Inline theme tweaks - GLASSMORPHISM =========================== */
const GlobalStyle = () => (
  <style>{`
    /* Additional glassmorphism styles for components not in main CSS */
    .site-bg {
      position: relative;
      min-height: 100vh;
      width: 100%;
      max-width: 100vw;
      background: #050510;
      -webkit-overflow-scrolling: touch;
    }

    .site-bg video,
    .site-bg img.bg-fallback {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.15;
      pointer-events: none;
      z-index: 0;
      filter: blur(10px);
    }

    .bg-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        90deg,
        rgba(6, 182, 212, 0.05),
        rgba(139, 92, 246, 0.05)
      );
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      z-index: 0;
      pointer-events: none;
    }

    .page-wrap {
      position: relative;
      z-index: 1;
      padding: 3rem 1rem;
      max-width: 1100px;
      margin: 0 auto;
      width: 100%;
    }

    @media (max-width: 480px) {
      .page-wrap { padding: 2rem 0.75rem; }
    }
    @media (max-width: 360px) {
      .page-wrap { padding: 1.5rem 0.5rem; }
    }

    /* Panel Overrides for Glass Effect */
    .panel {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 24px;
      padding: 1.5rem;
      box-shadow:
        0 24px 48px rgba(0, 0, 0, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.05) inset;
      margin: 0 auto 1rem;
      max-width: 900px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }

    .panel-strong {
      background: rgba(255, 255, 255, 0.04);
    }

    .info-panel {
      max-width: 1100px;
    }

    /* Footer Glass Panel */
    .footer {
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      padding: 2rem 1rem 3rem;
      font-size: 0.95rem;
      display: flex;
      justify-content: center;
      position: relative;
      z-index: 2;
    }

    .footer-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 1rem 1.5rem;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      max-width: 820px;
      width: 100%;
    }

    /* Documentation Toggle */
    .doc-toggle {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      justify-content: center;
      width: 100%;
      padding: 0.5rem 0.75rem;
      border-radius: 12px;
      transition: 0.2s ease;
    }

    .doc-toggle:hover {
      color: rgba(255, 255, 255, 1);
      background: rgba(255, 255, 255, 0.05);
    }

    .doc-toggle:focus-visible {
      outline: 2px solid #3b82f6;
      outline-offset: 2px;
    }

    .doc-chevron {
      transition: transform 0.2s ease;
    }

    .doc-chevron.open {
      transform: rotate(180deg);
    }

    .doc-hint {
      margin: 0.5rem 0 0;
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.9rem;
    }

    .doc-panel-wrapper {
      max-width: 1100px;
      margin: 0 auto 1rem;
      transition: all 0.25s ease;
      overflow: hidden;
    }

    .doc-panel-wrapper.closed {
      max-height: 0;
      opacity: 0;
      transform: translateY(8px);
      pointer-events: none;
    }

    .doc-panel-wrapper.open {
      max-height: 1200px;
      opacity: 1;
      transform: translateY(0);
    }

    .doc-panel {
      position: relative;
    }

    .doc-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
      border-radius: 10px;
      padding: 0.5rem 0.8rem;
      cursor: pointer;
      font-weight: 700;
      transition: 0.2s ease;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    /* Mobile-first tab styling to mirror the compact layout */
    .tabs {
      display: flex;
      gap: 0.5rem;
      justify-content: center;
      margin: 1rem auto 1.25rem;
      flex-wrap: wrap;
    }

    .tab {
      background: transparent;
      color: #c7d2fe;
      border: 1px solid rgba(99, 102, 241, 0.35);
      padding: 0.6rem 1rem;
      border-radius: 0.75rem;
      cursor: pointer;
      transition: 0.2s ease;
      font-weight: 600;
    }

    .tab:hover {
      background: rgba(99, 102, 241, 0.12);
    }

    .tab.active {
      color: white;
      background: linear-gradient(90deg, #4f46e5, #7c3aed);
      border-color: transparent;
      box-shadow: 0 8px 26px rgba(79, 70, 229, 0.35);
    }

    .doc-close:hover {
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 1);
    }

    /* Brand Logo Circle */
    .brand-logo-container {
      position: fixed;
      top: 1rem;
      left: 1rem;
      z-index: 100;
      contain: layout paint;
      pointer-events: auto;
    }

    .brand-logo {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 2px solid rgba(59, 130, 246, 0.5);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
      object-fit: cover;
      display: block;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      transform: translate3d(0, 0, 0);
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }

    .brand-logo:hover {
      transform: translate3d(0, 0, 0) scale(1.05);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
    }

    /* Auth Container Glass */
    .auth-container {
      position: absolute;
      top: 1rem;
      right: 1rem;
      z-index: 100;
    }

    .auth-btn {
      background: linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6);
      color: #fff;
      border: none;
      padding: 0.75rem 1.25rem;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: 0.2s ease;
      box-shadow:
        0 6px 20px rgba(59, 130, 246, 0.4),
        0 0 0 1px rgba(255, 255, 255, 0.2) inset;
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .auth-btn:hover {
      transform: translateY(-2px);
      box-shadow:
        0 8px 24px rgba(59, 130, 246, 0.5),
        0 0 0 1px rgba(255, 255, 255, 0.3) inset;
    }

    .user-info {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 0.75rem 1rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      border: 2px solid rgba(59, 130, 246, 0.5);
    }

    .user-details {
      display: flex;
      flex-direction: column;
      gap: 0.1rem;
    }

    .user-name {
      color: rgba(255, 255, 255, 1);
      font-weight: 600;
      font-size: 0.9rem;
      line-height: 1.2;
    }

    .user-email {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.75rem;
      line-height: 1.2;
    }

    .logout-btn {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: 0.2s ease;
      font-size: 0.85rem;
      margin-left: 0.5rem;
      text-decoration: none;
    }

    .logout-btn:hover {
      background: rgba(239, 68, 68, 0.2);
    }

    /* Chat & Sports Matchup Glass Panels */
    .sports-matchup-container {
      display: flex;
      flex-direction: column;
      height: 600px;
      max-height: 70vh;
    }

    .quick-examples {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
      flex-wrap: wrap;
      align-items: center;
      padding: 0.75rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .example-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      transition: 0.2s ease;
    }

    .example-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      transform: translateY(-1px);
      color: rgba(255, 255, 255, 1);
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 1rem;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .chat-messages::-webkit-scrollbar {
      width: 8px;
    }

    .chat-messages::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb {
      background: rgba(59, 130, 246, 0.4);
      border-radius: 4px;
    }

    .chat-messages::-webkit-scrollbar-thumb:hover {
      background: rgba(59, 130, 246, 0.6);
    }

    .chat-message {
      margin-bottom: 1.25rem;
      padding: 0.75rem 1rem;
      border-radius: 14px;
      animation: fadeInScale 0.3s ease-out;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .chat-message.user {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      margin-left: 2rem;
    }

    .chat-message.assistant {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      margin-right: 2rem;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
    }

    .message-role {
      font-weight: 700;
      color: #06b6d4;
    }

    .message-time {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.75rem;
    }

    .message-content {
      color: rgba(255, 255, 255, 0.9);
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .chat-input-form {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .chat-input {
      flex: 1;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 1);
      padding: 0.75rem 1rem;
      border-radius: 12px;
      outline: none;
      transition: all 0.2s ease;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .chat-input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }

    .chat-input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .chat-submit-btn {
      background: linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6);
      color: #fff;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 700;
      font-size: 1.2rem;
      transition: 0.2s ease;
      box-shadow: 0 6px 18px rgba(59, 130, 246, 0.35);
      min-width: 60px;
    }

    .chat-submit-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.45);
    }

    .chat-submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .clear-chat-btn {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #fca5a5;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 600;
      transition: 0.2s ease;
    }

    .clear-chat-btn:hover {
      background: rgba(239, 68, 68, 0.2);
    }

    /* Team Name Label for forms */
    .team-name-label {
      position: absolute;
      top: 0.35rem;
      left: 0.75rem;
      font-size: 0.65rem;
      font-weight: 600;
      color: #06b6d4;
      pointer-events: none;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.8;
      line-height: 1;
    }

    /* Responsive Overrides */
    @media (max-width: 640px) {
      .brand-logo-container {
        top: 0.75rem;
        left: 50%;
        transform: translateX(-50%);
      }

      .brand-logo {
        width: 56px;
        height: 56px;
      }

      .auth-container {
        position: relative;
        left: auto;
        right: auto;
        top: auto;
        margin: 0 auto 1rem;
        display: flex;
        justify-content: center;
      }

      .user-info {
        flex-wrap: wrap;
        justify-content: center;
      }

      .user-details {
        text-align: center;
      }

      .sports-matchup-container {
        height: 500px;
      }

      .chat-message.user {
        margin-left: 0.5rem;
      }

      .chat-message.assistant {
        margin-right: 0.5rem;
      }
    }

    @media (min-width: 768px) {
      .page-wrap {
        padding: 3.5rem 1.5rem;
      }

      .panel {
        padding: 2rem;
      }

      .chat-message.user {
        margin-left: 3rem;
      }

      .chat-message.assistant {
        margin-right: 3rem;
      }

      .sports-matchup-container {
        height: 650px;
        max-height: 75vh;
      }
    }

    @media (min-width: 1024px) {
      .page-wrap {
        padding: 4rem 2rem;
      }

      .panel {
        padding: 2.5rem;
        max-width: 1000px;
      }

      .chat-message.user {
        margin-left: 4rem;
      }

      .chat-message.assistant {
        margin-right: 4rem;
      }

      .chat-message {
        padding: 1rem 1.25rem;
      }

      .message-content {
        font-size: 1.05rem;
        line-height: 1.7;
      }

      .sports-matchup-container {
        height: 700px;
        max-height: 80vh;
      }
    }

    @media (min-width: 1440px) {
      .page-wrap {
        padding: 4.5rem 2.5rem;
      }

      .panel {
        max-width: 1100px;
      }

      .sports-matchup-container {
        height: 750px;
      }
    }

    /* NEW: Include Bet Logger Styles */
    ${BetLoggerStyles}
  `}</style>
);

/* =============================== App Constants ============================= */
const CONSTANTS = {
  TABS: {
    KELLY: 'kelly',
    ESTIMATOR: 'estimator',
    MATCHUP: 'matchup',
    NFL_MATCHUP: 'nfl_matchup',
    BET_HISTORY: 'bet_history'  // NEW TAB
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
  const turnoverComponent = (teamATov - teamBTov) * 1.0 * 0.15;

  const homeCourtAdvantage = isHome === null ? 0 : (isHome ? 3.0 : -3.0);

  return pointDiffComponent + fgDiffComponent + reboundComponent + turnoverComponent + homeCourtAdvantage;
}

/* ================================= Utilities ============================== */
const formatCurrency = (v: any) => isNaN(Number(v)) ? '$0.00' :
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));

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
          <h2 style={{margin:'0.25rem 0 0.35rem'}}>{calculatedProb.toFixed(2)}%</h2>
          {expectedDiff !== null && (
            <div className="results-details">
              Predicted Margin: {expectedDiff > 0 ? '+' : ''}{expectedDiff.toFixed(1)} pts
            </div>
          )}
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

function KellyCalculator({
  probability,
  setProbability,
  // NEW: Props for bet logging
  isAuthenticated,
  matchupData,
  estimationData,
  onLoginRequired
}: {
  probability: string;
  setProbability: (v: string) => void;
  isAuthenticated: boolean;
  matchupData: MatchupData | null;
  estimationData: EstimationData | null;
  onLoginRequired: () => void;
}) {
  const [bankroll, setBankroll] = useState('1000');
  const [odds, setOdds] = useState('-110');
  const [fraction, setFraction] = useState('1');
  const [explanation, setExplanation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

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
    setBankroll(item.bankroll);
    setOdds(item.odds);
    setProbability(item.probability);
  };

  const getValidationClass = (isValid: boolean|null) => {
    if (isValid === null) return '';
    return isValid ? 'valid' : 'invalid';
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
        <input
          id="bankroll"
          type="number"
          className={`input-field ${getValidationClass(validation.bankroll)}`}
          value={bankroll}
          onChange={(e)=>setBankroll(e.target.value)}
          placeholder="e.g., 1000"
        />
        {validation.bankroll === false && <div className="error-message">⚠ Bankroll must be positive</div>}
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
  const [probability, setProbability] = useState('50');

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

  // NEW: State for bet logging data flow
  const [currentMatchup, setCurrentMatchup] = useState<MatchupData | null>(null);
  const [currentEstimation, setCurrentEstimation] = useState<EstimationData | null>(null);

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

  // Login redirect handler
  const handleLoginRequired = () => {
    window.location.href = `${BACKEND_URL}/auth/google`;
  };

  return (
    <>
      <div className="site-bg">
        <video autoPlay loop muted playsInline>
          <source src="background.mp4" type="video/mp4" />
        </video>
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
            loading="lazy"
            decoding="async"
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
            <a href={`${BACKEND_URL}/auth/google`} className="auth-btn">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </a>
          )}
        </div>

        <div className="page-wrap">
          <header className="header">
            <h1 className="title">Point Spread Bet Calculator</h1>
            <p className="subtitle">"Analyze matchups, estimate your edge, and get your recommended bet size—step by step."</p>
          </header>

          <div className="panel" style={{maxWidth:900}}>
            <div className="tabs" role="tablist">
              {[
                { key: CONSTANTS.TABS.KELLY, label: 'Kelly Criterion' },
                { key: CONSTANTS.TABS.ESTIMATOR, label: 'Probability Estimator' },
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
          {activeTab === CONSTANTS.TABS.MATCHUP && (
            <div className="panel">
              <SportsMatchup
                backendUrl={BACKEND_URL || 'https://kelly-s-criterion-calculator.onrender.com'}
                onTransferToEstimator={handleTransferToEstimator}
              />
            </div>
          )}
          {activeTab === CONSTANTS.TABS.NFL_MATCHUP && (
            <div className="panel">
              <NFLMatchup
                onTransferToEstimator={handleNFLTransferToEstimator}
              />
            </div>
          )}
          {/* NEW: Bet History Tab */}
          {activeTab === CONSTANTS.TABS.BET_HISTORY && (
            <div className="panel">
              <BetHistory isAuthenticated={!!authUser} />
            </div>
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
                Follow these steps to move from estimating your edge to logging a bet with confidence:
              </p>
              <ol style={{paddingLeft:'1.25rem', lineHeight:1.6, color:'var(--text-muted)'}}>
                <li>
                  Start in <strong>Probability Estimator</strong> to enter matchup stats (Football or Basketball) and calculate a fair win probability.
                  You can also import stats directly from <strong>NBA Matchup</strong> or <strong>NFL Matchup</strong> using their transfer buttons.
                </li>
                <li>
                  Switch to <strong>Kelly Criterion</strong>, input your bankroll and odds, and paste the estimated win probability. The tool shows your suggested stake and edge.
                </li>
                <li>
                  Use <strong>Unit Betting</strong> if you prefer staking by units instead of Kelly sizing.
                </li>
                <li>
                  (Optional) Review recent recommendations in <strong>📊 Bet History</strong>—saved automatically when you calculate a positive-value bet while authenticated.
                </li>
              </ol>

              <h3 style={{marginBottom:'0.35rem'}}>Feature guide</h3>
              <ul style={{paddingLeft:'1.25rem', lineHeight:1.6, color:'var(--text-muted)'}}>
                <li><strong>Kelly Criterion</strong>: Calculates optimal stake size based on bankroll, odds, and your estimated win probability.</li>
                <li><strong>Probability Estimator</strong>: Converts matchup stats and point spreads into a projected win probability and expected margin.</li>
                <li><strong>Unit Betting</strong>: Turns your bankroll into unit sizes for flat- or multiple-unit staking.</li>
                <li><strong>NBA Matchup</strong> / <strong>NFL Matchup</strong>: Pulls team data, compares opponents, and lets you push the results into the estimator.</li>
                <li><strong>📊 Bet History</strong>: Displays recently logged Kelly recommendations (requires sign-in).</li>
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
          </div>
        </footer>
      </div>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <>
    <GlobalStyle />
    <App />
  </>
);
