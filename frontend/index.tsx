/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

/* === bring in your committed form input components === */
import FootballEstimator from "./forms/FootballEstimator";
import BasketballEstimator from "./forms/BasketballEstimator";
import SportsMatchup from "./forms/SportsMatchup";
import ThemeSwitcher from "./ThemeSwitcher";

/* === Backend URL configuration === */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

/* =========================== Inline theme tweaks =========================== */
const GlobalStyle = () => (
  <style>{`
    :root{
      --bg-from:#0b1030; --bg-to:#1a1248;
      --glass: rgba(17, 24, 39, .72);
      --glass-strong: rgba(17, 24, 39, .86);
      --border: rgba(100, 116, 139, .35);
      --accent:#4f46e5; --accent-2:#6366f1;
      --text:#ffffff; --text-muted:#cbd5e1;
    }
    body{ margin:0; color:var(--text); background:#000;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; }
    .site-bg{ position:relative; min-height:100vh; overflow-x:hidden;
      background: linear-gradient(135deg, var(--bg-from), var(--bg-to)); }
    .site-bg video,.site-bg img.bg-fallback{ position:absolute; inset:0; width:100%; height:100%;
      object-fit:cover; opacity:.5; pointer-events:none; transform: translateY(-10%); }
    .bg-overlay{ position:absolute; inset:0; background: linear-gradient(90deg, rgba(30,64,175,.65), rgba(76,29,149,.65)); backdrop-filter: blur(2px); }
    .blob{ position:absolute; border-radius:9999px; filter: blur(36px); opacity:.25; pointer-events:none; }
    .blob-a{ width:22rem; height:22rem; background: radial-gradient(closest-side, #60a5fa, transparent); top:12%; right:-6%; animation: float 14s ease-in-out infinite; }
    .blob-b{ width:24rem; height:24rem; background: radial-gradient(closest-side, #a78bfa, transparent); bottom:10%; left:-8%; animation: pulse 18s ease-in-out infinite; }
    @keyframes float{ 0%,100%{ transform: translateY(-10px); } 50%{ transform: translateY(10px); } }
    @keyframes pulse{ 0%,100%{ transform: scale(1); } 50%{ transform: scale(1.06); } }

    .page-wrap{ position:relative; z-index:1; padding:3rem 1rem; max-width:1100px; margin:0 auto; }
    .header{ margin-bottom:1.25rem; text-align:center; }
    .title{ font-weight:800; line-height:1.1; margin:.25rem 0 .5rem;
      background: linear-gradient(90deg, #93c5fd, #a78bfa); -webkit-background-clip:text; background-clip:text; color:transparent;
      font-size: clamp(1.75rem, 2.6vw, 2.25rem); }
    .subtitle{ color:var(--text-muted); margin:0 auto 1.25rem; max-width:46rem; }

    .tabs{ display:flex; gap:.5rem; justify-content:center; margin:1rem auto 1.25rem; flex-wrap:wrap; }
    .tab{ background:transparent; color:#c7d2fe; border:1px solid rgba(99,102,241,.35);
      padding:.6rem 1rem; border-radius:.75rem; cursor:pointer; transition:.2s ease; font-weight:600; }
    .tab:hover{ background: rgba(99,102,241,.12); }
    .tab.active{ color:white; background: linear-gradient(90deg, #4f46e5, #7c3aed);
      border-color: transparent; box-shadow: 0 8px 26px rgba(79,70,229,.35); }

    .panel{ background:var(--glass); border:1px solid var(--border);
      border-radius:1rem; padding:1.25rem; box-shadow: 0 10px 28px rgba(0,0,0,.35);
      margin: 0 auto 1rem; max-width:900px; }
    .panel-strong{ background:var(--glass-strong); }

    .input-group{ display:flex; flex-direction:column; gap:.35rem; margin-bottom:1rem; position:relative; }
    .input-field, select{ background:#0f1836; border:1px solid rgba(148,163,184,.35); color:var(--text);
      padding:.65rem .75rem; border-radius:.6rem; outline:none; width:100%; transition: all 0.2s ease; }
    .input-field:focus, select:focus{ border-color:#818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,.25); }
    .input-field.valid{ border-color:#10b981; }
    .input-field.invalid{ border-color:#ef4444; box-shadow: 0 0 0 2px rgba(239,68,68,.15); }
    .error-message{ color:#ef4444; font-size:.8rem; margin-top:.25rem; display:flex; align-items:center; gap:.35rem; }
    .slider-group{ display:grid; grid-template-columns: 1fr; gap:.5rem; }
    .slider{ width:100%; accent-color:#6366f1; }
    .help-icon{ display:inline-flex; align-items:center; justify-content:center; width:18px; height:18px;
      border-radius:50%; background:rgba(99,102,241,.2); color:#a5b4fc; cursor:help; font-size:.75rem; font-weight:bold;
      margin-left:.35rem; transition:.2s ease; }
    .help-icon:hover{ background:rgba(99,102,241,.35); transform:scale(1.1); }

    .btn-primary, .btn-secondary{ border:none; cursor:pointer; padding:.75rem 1rem; border-radius:.8rem; font-weight:700; transition:.2s ease; width:100%; }
    .btn-primary{ background: linear-gradient(90deg, #4f46e5, #7c3aed); color:#fff; box-shadow: 0 10px 24px rgba(79,70,229,.35); }
    .btn-primary:disabled{ opacity:.5; cursor:not-allowed; }
    .btn-primary:hover{ filter: brightness(1.05); transform: translateY(-1px); }
    .btn-secondary{ background: rgba(99,102,241,.14); color:#c7d2fe; border:1px solid rgba(99,102,241,.35); }
    .btn-secondary:hover{ background: rgba(99,102,241,.22); }

    .results{ margin-top:1rem; padding:1rem; border-radius:.8rem; border:1px solid rgba(99,102,241,.35); background: rgba(30,27,75,.45);
      animation: fadeInScale 0.3s ease-out; }
    .results.no-value{ background: rgba(127,29,29,.25); border-color: rgba(248,113,113,.35); }
    .results.warning{ background: rgba(217,119,6,.15); border-color: rgba(251,191,36,.35); }
    .results-details{ color:#cbd5e1; margin-top:.35rem; }
    .results h2{ font-size: clamp(1.75rem, 3vw, 2.5rem); margin:0.25rem 0 0.35rem; font-weight:800; }
    .analyst-insight{ margin-top:1rem; padding:1rem; border-radius:.8rem; background: rgba(2,6,23,.5); border:1px solid rgba(100,116,139,.3); }

    .container{ display:flex; flex-direction:column; gap:1rem; }

    /* Animations */
    @keyframes fadeInScale{ 0%{ opacity:0; transform:scale(0.95); } 100%{ opacity:1; transform:scale(1); } }
    @keyframes spin{ 0%{ transform:rotate(0deg); } 100%{ transform:rotate(360deg); } }
    @keyframes pulse-glow{ 0%,100%{ box-shadow: 0 8px 26px rgba(79,70,229,.35); } 50%{ box-shadow: 0 8px 38px rgba(79,70,229,.55); } }
    @keyframes shimmer{ 0%{ background-position: -200% center; } 100%{ background-position: 200% center; } }

    /* Loading states */
    .loading-spinner{ display:inline-block; width:20px; height:20px; border:3px solid rgba(99,102,241,.2);
      border-top-color:#6366f1; border-radius:50%; animation: spin 0.8s linear infinite; margin-right:.5rem; }
    .skeleton{ background: linear-gradient(90deg, rgba(100,116,139,.2) 25%, rgba(100,116,139,.35) 50%, rgba(100,116,139,.2) 75%);
      background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius:.6rem; height:1.2rem; margin:.5rem 0; }

    /* Enhanced hover states */
    .btn-secondary:hover, .tab:hover{ transform: translateY(-1px); }
    .results:hover{ border-color: rgba(99,102,241,.5); }

    /* Copy button */
    .copy-btn{ background: rgba(99,102,241,.14); border:1px solid rgba(99,102,241,.35); color:#c7d2fe;
      padding:.4rem .8rem; border-radius:.5rem; cursor:pointer; font-size:.85rem; font-weight:600;
      transition:.2s ease; margin-top:.5rem; display:inline-flex; align-items:center; gap:.35rem; }
    .copy-btn:hover{ background: rgba(99,102,241,.25); }
    .toast{ position:fixed; bottom:2rem; right:2rem; background:#10b981; color:white; padding:.75rem 1.25rem;
      border-radius:.6rem; box-shadow: 0 10px 28px rgba(0,0,0,.35); animation: fadeInScale 0.3s ease-out;
      z-index:1000; font-weight:600; }

    /* History panel */
    .history-panel{ margin-top:1rem; padding:1rem; border-radius:.8rem; background: rgba(2,6,23,.5);
      border:1px solid rgba(100,116,139,.3); }
    .history-item{ padding:.6rem; border-radius:.5rem; background: rgba(30,27,75,.25); margin-bottom:.5rem;
      font-size:.85rem; display:flex; justify-content:space-between; align-items:center; cursor:pointer;
      transition:.2s ease; border:1px solid transparent; }
    .history-item:hover{ background: rgba(30,27,75,.45); border-color: rgba(99,102,241,.25); }

    /* Progress indicators */
    .progress-container{ display:flex; gap:.5rem; margin-bottom:1rem; flex-wrap:wrap; }
    .progress-step{ display:flex; align-items:center; gap:.35rem; padding:.4rem .8rem; border-radius:.5rem;
      background: rgba(100,116,139,.15); border:1px solid rgba(100,116,139,.25); font-size:.85rem;
      color:var(--text-muted); }
    .progress-step.completed{ background: rgba(16,185,129,.15); border-color:rgba(16,185,129,.35); color:#10b981; }
    .progress-step.active{ background: rgba(99,102,241,.15); border-color:rgba(99,102,241,.35); color:#a5b4fc; }

    /* Tooltips */
    .tooltip{ position:relative; display:inline-block; }
    .tooltip .tooltiptext{ visibility:hidden; width:220px; background:#1e293b; color:var(--text);
      text-align:center; border-radius:.6rem; padding:.6rem; position:absolute; z-index:1;
      bottom:125%; left:50%; margin-left:-110px; opacity:0; transition:.3s ease;
      font-size:.85rem; border:1px solid rgba(100,116,139,.35); box-shadow: 0 8px 20px rgba(0,0,0,.4); }
    .tooltip:hover .tooltiptext{ visibility:visible; opacity:1; }

    /* Empty state */
    .empty-state{ text-align:center; padding:2rem 1rem; color:var(--text-muted); }
    .empty-state h3{ color:var(--text); margin-bottom:.5rem; }
    .try-example-btn{ background: linear-gradient(90deg, #4f46e5, #7c3aed); color:#fff; border:none;
      padding:.6rem 1.2rem; border-radius:.6rem; cursor:pointer; font-weight:600; margin-top:1rem;
      transition:.2s ease; box-shadow: 0 6px 18px rgba(79,70,229,.25); }
    .try-example-btn:hover{ filter: brightness(1.1); transform: translateY(-1px); }

    /* Stats grid responsive */
    .stats-grid{ display:grid; grid-template-columns: 2fr 1fr 1fr; gap:.75rem; align-items:center;
      margin-bottom:1rem; }
    .grid-header{ font-weight:700; color:#a5b4fc; margin:0; font-size:.9rem; }
    @media (max-width: 640px) {
      .stats-grid{ grid-template-columns: 1fr; gap:.5rem; }
      .grid-header{ display:none; }
      .stats-grid > span:nth-child(3n+1){ font-weight:600; color:#a5b4fc; margin-top:.75rem; }
    }

    /* Enhanced focus indicators */
    button:focus-visible, input:focus-visible, select:focus-visible{
      outline: 2px solid #818cf8; outline-offset: 2px;
    }

    /* ==================== Sports Matchup Chat Styles ==================== */
    .sports-matchup-container{ display:flex; flex-direction:column; height:600px; max-height:70vh; }

    .quick-examples{ display:flex; gap:.5rem; margin-bottom:1rem; flex-wrap:wrap; align-items:center;
      padding:.75rem; background: rgba(2,6,23,.5); border-radius:.6rem; border:1px solid rgba(100,116,139,.3); }
    .example-btn{ background: rgba(99,102,241,.14); border:1px solid rgba(99,102,241,.35); color:#c7d2fe;
      padding:.35rem .75rem; border-radius:.5rem; cursor:pointer; font-size:.8rem; font-weight:600;
      transition:.2s ease; }
    .example-btn:hover{ background: rgba(99,102,241,.25); transform: translateY(-1px); }

    .chat-messages{ flex:1; overflow-y:auto; padding:1rem; background: rgba(2,6,23,.3); border-radius:.8rem;
      border:1px solid rgba(100,116,139,.3); margin-bottom:1rem; }
    .chat-messages::-webkit-scrollbar{ width:8px; }
    .chat-messages::-webkit-scrollbar-track{ background: rgba(100,116,139,.1); border-radius:4px; }
    .chat-messages::-webkit-scrollbar-thumb{ background: rgba(99,102,241,.4); border-radius:4px; }
    .chat-messages::-webkit-scrollbar-thumb:hover{ background: rgba(99,102,241,.6); }

    .chat-message{ margin-bottom:1.25rem; padding:.75rem 1rem; border-radius:.8rem; animation: fadeInScale 0.3s ease-out; }
    .chat-message.user{ background: rgba(79,70,229,.15); border:1px solid rgba(79,70,229,.3); margin-left:2rem; }
    .chat-message.assistant{ background: rgba(30,27,75,.35); border:1px solid rgba(100,116,139,.25); margin-right:2rem; }

    .message-header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:.5rem;
      font-size:.8rem; }
    .message-role{ font-weight:700; color:#a5b4fc; }
    .message-time{ color:var(--text-muted); font-size:.75rem; }
    .message-content{ color:var(--text); line-height:1.6; white-space:pre-wrap; word-wrap:break-word; }

    .chat-input-form{ display:flex; gap:.5rem; align-items:center; }
    .chat-input{ flex:1; background:#0f1836; border:1px solid rgba(148,163,184,.35); color:var(--text);
      padding:.75rem 1rem; border-radius:.6rem; outline:none; transition: all 0.2s ease; }
    .chat-input:focus{ border-color:#818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,.25); }
    .chat-input:disabled{ opacity:.6; cursor:not-allowed; }

    .chat-submit-btn{ background: linear-gradient(90deg, #4f46e5, #7c3aed); color:#fff; border:none;
      padding:.75rem 1.5rem; border-radius:.6rem; cursor:pointer; font-weight:700; font-size:1.2rem;
      transition:.2s ease; box-shadow: 0 6px 18px rgba(79,70,229,.25); min-width:60px; }
    .chat-submit-btn:hover:not(:disabled){ filter: brightness(1.1); transform: translateY(-1px); }
    .chat-submit-btn:disabled{ opacity:.5; cursor:not-allowed; }

    .clear-chat-btn{ background: rgba(239,68,68,.14); border:1px solid rgba(239,68,68,.35); color:#fca5a5;
      padding:.75rem 1rem; border-radius:.6rem; cursor:pointer; font-weight:600; transition:.2s ease; }
    .clear-chat-btn:hover{ background: rgba(239,68,68,.25); }

    @media (max-width: 640px) {
      .sports-matchup-container{ height:500px; }
      .chat-message.user{ margin-left:.5rem; }
      .chat-message.assistant{ margin-right:.5rem; }
      .quick-examples{ font-size:.75rem; }
    }
  `}</style>
);

/* =============================== App Constants ============================= */
const CONSTANTS = {
  TABS: { KELLY: 'kelly', ESTIMATOR: 'estimator', UNIT: 'unit', MATCHUP: 'matchup' },
  SPORTS: { FOOTBALL: 'football', BASKETBALL: 'basketball' },
};

/* ========================= API helper (Kelly insight) ====================== */
async function fetchFromApi(prompt: string, systemInstruction: string) {
  const response = await fetch(`${BACKEND_URL}/api/calculate`, {  // ← Fixed: ( ) instead of `
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
  const Z = (predictedMargin + spread) / sigma; // cover threshold = -spread
  const p = normCdf(Z);
  return Math.max(0.1, Math.min(99.9, p * 100));
}

/* ========================== Sport-specific margin math ===================== */
function predictedMarginFootball(stats: any): number {
  const teamNetPoints = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const opponentNetPoints = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
  const teamNetYards = parseFloat(stats.teamOffYards) - parseFloat(stats.teamDefYards);
  const opponentNetYards = parseFloat(stats.opponentOffYards) - parseFloat(stats.opponentDefYards);
  const teamTO = parseFloat(stats.teamTurnoverDiff);
  const oppTO = parseFloat(stats.opponentTurnoverDiff);
  const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.5;
  const yardsComponent = ((teamNetYards - opponentNetYards) / 100) * 0.3;
  const turnoverComponent = (teamTO - oppTO) * 4 * 0.2;
  return pointsComponent + yardsComponent + turnoverComponent;
}
function predictedMarginBasketball(stats: any): number {
  const teamNetPoints = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const opponentNetPoints = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
  const fgT = parseFloat(stats.teamFgPct), fgO = parseFloat(stats.opponentFgPct);
  const rebT = parseFloat(stats.teamReboundMargin), rebO = parseFloat(stats.opponentReboundMargin);
  const tovT = parseFloat(stats.teamTurnoverMargin), tovO = parseFloat(stats.opponentTurnoverMargin);
  const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.4;
  const fgComponent = (fgT - fgO) * 2 * 0.3;
  const reboundComponent = (rebT - rebO) * 0.2;
  const turnoverComponent = (tovT - tovO) * 0.1;
  return pointsComponent + fgComponent + reboundComponent + turnoverComponent;
}

/* ================================= Utilities ============================== */
const formatCurrency = (v: any) => isNaN(Number(v)) ? '$0.00' :
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));

/* local state shapes for controlled forms */
export const initialFootballState = {
  teamPointsFor: '', opponentPointsFor: '',
  teamPointsAgainst: '', opponentPointsAgainst: '',
  teamOffYards: '', opponentOffYards: '',
  teamDefYards: '', opponentDefYards: '',
  teamTurnoverDiff: '', opponentTurnoverDiff: '',
};
export const initialBasketballState = {
  teamPointsFor: '', opponentPointsFor: '',
  teamPointsAgainst: '', opponentPointsAgainst: '',
  teamFgPct: '', opponentFgPct: '',
  teamReboundMargin: '', opponentReboundMargin: '',
  teamTurnoverMargin: '', opponentTurnoverMargin: '',
};

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
  setExpectedDiff
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
}) {

  const isFormValid = useMemo(() => {
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    const ok = Object.values(current).every(v => v !== '');
    return ok && pointSpread !== '';
  }, [activeSport, footballStats, basketballStats, pointSpread]);

  const progress = useMemo(() => {
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    const filledFields = Object.values(current).filter(v => v !== '').length;
    const totalFields = Object.keys(current).length;
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
        teamTurnoverDiff: '8', opponentTurnoverDiff: '-3'
      });
      setPointSpread('-6.5');
    } else {
      setBasketballStats({
        teamPointsFor: '112.5', opponentPointsFor: '108.3',
        teamPointsAgainst: '106.2', opponentPointsAgainst: '110.8',
        teamFgPct: '47.8', opponentFgPct: '45.2',
        teamReboundMargin: '4.2', opponentReboundMargin: '-1.5',
        teamTurnoverMargin: '2.8', opponentTurnoverMargin: '-1.2'
      });
      setPointSpread('-4.5');
    }
  };

  const handleCalculate = () => {
    try {
      const spread = parseFloat(pointSpread);
      if (Number.isNaN(spread)) throw new Error('Invalid spread');
      const m = activeSport === CONSTANTS.SPORTS.FOOTBALL
        ? predictedMarginFootball(footballStats)
        : predictedMarginBasketball(basketballStats);
      const sigma = activeSport === CONSTANTS.SPORTS.FOOTBALL ? 13.5 : 12.0;
      const p = coverProbabilityFromMargin(m, spread, sigma);
      setCalculatedProb(p);
      setExpectedDiff(m);
    } catch (e) {
      console.error(e);
      setCalculatedProb(null);
      setExpectedDiff(null);
    }
  };

  const handleApplyAndSwitch = (prob:number) => {
    setProbability(prob.toFixed(2));
    setActiveTab(CONSTANTS.TABS.KELLY);
  };

  const handleSwap = () => {
    // Swap team and opponent stats
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
      });
    }

    // Flip the point spread sign (favorite becomes underdog and vice versa)
    if (pointSpread !== '') {
      const currentSpread = parseFloat(pointSpread);
      if (!isNaN(currentSpread)) {
        setPointSpread((-currentSpread).toString());
      }
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

      {/* Progress indicators */}
      <div className="progress-container">
        <div className={`progress-step ${progress.spread ? 'completed' : progress.stats === 0 ? 'active' : ''}`}>
          {progress.spread ? '✓' : '1'} Point Spread
        </div>
        <div className={`progress-step ${progress.allComplete ? 'completed' : progress.spread ? 'active' : ''}`}>
          {progress.allComplete ? '✓' : progress.stats}/{progress.totalStats} Team Stats
        </div>
      </div>

      {/* Empty state with example */}
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

      {/* Use your committed components as controlled forms */}
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
            <button className="btn-secondary" onClick={()=>handleApplyAndSwitch(calculatedProb!)}>Use in Kelly Calculator</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================== Kelly Calculator =========================== */
type HistoryEntry = { bankroll:string; odds:string; probability:string; stake:number; timestamp:number };

function KellyCalculator({ probability, setProbability }: { probability:string; setProbability:(v:string)=>void }) {
  const [bankroll, setBankroll] = useState('1000');
  const [odds, setOdds] = useState('150');
  const [fraction, setFraction] = useState('1');
  const [explanation, setExplanation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Validation
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

  // Track calculation history
  useEffect(() => {
    if (hasValue && stake > 0) {
      const newEntry: HistoryEntry = {
        bankroll, odds, probability, stake, timestamp: Date.now()
      };
      setHistory(prev => [newEntry, ...prev.slice(0, 4)]); // Keep last 5
    }
  }, [stake, hasValue, bankroll, odds, probability]);

  useEffect(() => {
    if (!probability) return;
    const getExplanation = async () => {
      setIsGenerating(true); setExplanation('');
      try {
        const systemInstruction =
          "You are a seasoned betting analyst. Provide brief (1-2 sentences), insightful, and varied explanations for Kelly Criterion recommendations. Your tone should be responsible and clear. Never repeat the same explanation. Focus on the core reason for the recommendation.";
        const userPrompt = hasValue
          ? `A user's inputs (Bankroll: ${formatCurrency(bankroll)}, Odds: ${odds}, Win Probability: ${probability}%) result in a recommended stake of ${formatCurrency(stake)} (${stakePercentage.toFixed(2)}%). Provide a concise, 1-2 sentence explanation for why this is a good bet according to the Kelly Criterion.`
          : `A user's inputs (Bankroll: ${formatCurrency(bankroll)}, Odds: ${odds}, Win Probability: ${probability}%) indicate a "No Value" bet. Provide a concise, 1-2 sentence explanation emphasizing bankroll protection.`;
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
            <span className="tooltiptext">Negative = favorite (e.g., -110), Positive = underdog (e.g., +150). Must be ≤-100 or ≥100</span>
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
            <span className="tooltiptext">Your estimated probability of winning (0-100%). Use the Probability Estimator to calculate this.</span>
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
            <span className="tooltiptext">Fraction of Kelly recommendation to bet. Half Kelly (0.5x) reduces volatility. Quarter Kelly (0.25x) is very conservative.</span>
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
        </div>
      ) : (
        <div className="results no-value"><h2>No Value - Do Not Bet</h2></div>
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

/* =========================== Unit Betting Calculator ======================= */
function UnitBettingCalculator() {
  const [bankroll, setBankroll] = useState('1000');
  const [unitSize, setUnitSize] = useState('1');
  const [unitsToWager, setUnitsToWager] = useState('1');

  const { recommendedStake, calculatedUnitSize } = useMemo(() => {
    const b = parseFloat(bankroll);
    const u = parseFloat(unitSize) / 100;
    const n = parseFloat(unitsToWager);

    if (isNaN(b) || b <= 0 || isNaN(u) || u < 0 || isNaN(n) || n < 0) {
      return { recommendedStake: 0, calculatedUnitSize: 0 };
    }

    const unit = b * u;
    return { recommendedStake: unit * n, calculatedUnitSize: unit };
  }, [bankroll, unitSize, unitsToWager]);

  return (
    <div className="panel">
      <div className="input-group">
        <label htmlFor="unit-bankroll">Bankroll</label>
        <input id="unit-bankroll" type="number" className="input-field" value={bankroll} onChange={(e)=>setBankroll(e.target.value)} placeholder="e.g., 1000" />
      </div>
      <div className="input-group">
        <label htmlFor="unit-size">Unit Size (% of Bankroll)</label>
        <div className="slider-group">
          <input id="unit-size" type="number" className="input-field" value={unitSize} onChange={(e)=>setUnitSize(e.target.value)} min="0" max="5" step="0.1" />
          <input type="range" min="0" max="5" step="0.1" value={unitSize} className="slider" onChange={(e)=>setUnitSize(e.target.value)} />
        </div>
      </div>
      <div className="input-group">
        <label htmlFor="units-wager">Units to Wager</label>
        <input id="units-wager" type="number" step="0.1" className="input-field" value={unitsToWager} onChange={(e)=>setUnitsToWager(e.target.value)} placeholder="e.g., 1" />
      </div>
      <div className="results">
        <p>Recommended Stake</p>
        <h2>{formatCurrency(recommendedStake)}</h2>
        <div className="results-details"><span>Unit Size: {formatCurrency(calculatedUnitSize)}</span></div>
      </div>
    </div>
  );
}

/* ================================== App =================================== */
function App() {
  const [activeTab, setActiveTab] = useState(CONSTANTS.TABS.KELLY);
  const [probability, setProbability] = useState('50');

  // Lift probability estimator state to App level to prevent data loss on tab switches
  const [activeSport, setActiveSport] = useState(CONSTANTS.SPORTS.FOOTBALL);
  const [footballStats, setFootballStats] = useState(initialFootballState);
  const [basketballStats, setBasketballStats] = useState(initialBasketballState);
  const [pointSpread, setPointSpread] = useState<string>('');
  const [calculatedProb, setCalculatedProb] = useState<number|null>(null);
  const [expectedDiff, setExpectedDiff] = useState<number|null>(null);

  // Handler to transfer matchup data to Basketball Estimator
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
    });
    setActiveSport(CONSTANTS.SPORTS.BASKETBALL);
    setActiveTab(CONSTANTS.TABS.ESTIMATOR);
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

        <div className="page-wrap">
          <header className="header">
            <h1 className="title">Kelly's Criterion Bet Calculator</h1>
            <p className="subtitle">To apply Kelly's Criterion, first estimate your win probability—then size the stake to maximize long-term growth.</p>
            <ThemeSwitcher />
          </header>

          <div className="panel" style={{maxWidth:900}}>
            <div className="tabs" role="tablist">
              {[
                { key: CONSTANTS.TABS.KELLY, label: 'Kelly Criterion' },
                { key: CONSTANTS.TABS.ESTIMATOR, label: 'Probability Estimator' },
                { key: CONSTANTS.TABS.UNIT, label: 'Unit Betting' },
                { key: CONSTANTS.TABS.MATCHUP, label: '🏀 NBA Matchup' },
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
            <KellyCalculator probability={probability} setProbability={setProbability} />
          )}
          {activeTab === CONSTANTS.TABS.UNIT && <UnitBettingCalculator />}
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
        </div>
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


