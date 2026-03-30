/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UPDATED: With Bet Logging Integration + Performance Optimizations + SEO
*/
import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';

/* === Native Bridge for Android (Capacitor) === */
import {
  initializeNativeBridge,
  isNative,
  hapticLight,
  hapticSuccess,
  hapticError,
  getNetworkStatus,
  onNetworkChange,
  onBackButton,
  showToast,
} from './native-bridge';

/* === Lazy load tab components for better performance === */
const FootballEstimator = lazy(() => import("./forms/FootballEstimator"));
const BasketballEstimator = lazy(() => import("./forms/BasketballEstimator"));
const HockeyEstimator = lazy(() => import("./forms/HockeyEstimator"));
const ConsolidatedSportsMatchup = lazy(() => import("./forms/ConsolidatedSportsMatchup"));
const WaltersEstimator = lazy(() => import("./forms/WaltersEstimator"));

/* === NEW: Import Bet Logger components (eager for now, used in Kelly calc) === */
import { LogBetButton, BetHistory } from './components/BetLogger';

/* === Audio Orb Component === */
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

/* =============================== (GlobalStyle removed — using Tailwind CSS) =============================== */
/* (GlobalStyle deleted) */

/* =============================== App Constants ============================= */
const CONSTANTS = {
  TABS: {
    KELLY: 'kelly',
    ESTIMATOR: 'estimator',
    WALTERS: 'walters',
    SPORTS_MATCHUP: 'sports_matchup',  // Consolidated NBA/NFL/NHL matchup
    BET_HISTORY: 'bet_history',  // Bet tracking
    STATS: 'stats',  // NBA/NFL/NHL statistics
    ACCOUNT: 'account',  // Account settings
    PROMO: 'promo'  // Promotional links
  },
  SPORTS: { FOOTBALL: 'football', BASKETBALL: 'basketball', HOCKEY: 'hockey' },
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
  // 7 marquee weighted components (100% total weight):
  // PPG (15%), points allowed (15%), FG% (25%), rebounds (17%), turnovers (13%), 3PT% (8%), 3PT rate (7%)
  // Pace remains a tempo multiplier (not a weighted skill edge component).
  const teamAPointsFor = parseFloat(stats.teamPointsFor) || 0;
  const teamBPointsFor = parseFloat(stats.opponentPointsFor) || 0;
  const ppgComponent = (teamAPointsFor - teamBPointsFor) * 0.15;

  const teamAPointsAllowed = parseFloat(stats.teamPointsAgainst) || 0;
  const teamBPointsAllowed = parseFloat(stats.opponentPointsAgainst) || 0;
  // Lower points allowed is better, so invert the differential.
  const pointsAllowedComponent = (teamBPointsAllowed - teamAPointsAllowed) * 0.15;

  // FG% with realistic scaling: 1% FG diff ≈ 2 points per game
  const teamAFg = parseFloat(stats.teamFgPct) || 0;
  const teamBFg = parseFloat(stats.opponentFgPct) || 0;
  const fgDiffComponent = (teamAFg - teamBFg) * 2.0 * 0.25;

  // 3-point shooting split into accuracy + volume components.
  let threePointPctComponent = 0;
  let threePointRateComponent = 0;
  const teamA3PPct = parseFloat(stats.team3PPct) || 0;
  const teamB3PPct = parseFloat(stats.opponent3PPct) || 0;
  if (teamA3PPct > 0 || teamB3PPct > 0) {
    const pctDiff = (teamA3PPct - teamB3PPct) * 1.0;
    threePointPctComponent = pctDiff * 0.08;

    const teamA3PRate = parseFloat(stats.team3PRate) || 0;
    const teamB3PRate = parseFloat(stats.opponent3PRate) || 0;
    const rateDiff = (teamA3PRate - teamB3PRate) * 15;
    threePointRateComponent = rateDiff * 0.07;
  }

  const teamAReb = parseFloat(stats.teamReboundMargin) || 0;
  const teamBReb = parseFloat(stats.opponentReboundMargin) || 0;
  const reboundComponent = (teamAReb - teamBReb) * 0.5 * 0.17;

  // Turnovers: positive margin = team forces more TOs than it commits (good)
  const teamATov = parseFloat(stats.teamTurnoverMargin) || 0;
  const teamBTov = parseFloat(stats.opponentTurnoverMargin) || 0;
  const turnoverComponent = (teamATov - teamBTov) * 1.0 * 0.13;

  let margin =
    ppgComponent +
    pointsAllowedComponent +
    fgDiffComponent +
    reboundComponent +
    turnoverComponent +
    threePointPctComponent +
    threePointRateComponent;

  // Pace multiplier applied BEFORE home court (pace should scale stats-based margin only,
  // not the home court advantage which is a fixed constant)
  const teamAPace = parseFloat(stats.teamPace) || 0;
  const teamBPace = parseFloat(stats.opponentPace) || 0;
  if (teamAPace > 0 && teamBPace > 0) {
    const expectedPace = (teamAPace + teamBPace) / 2;
    const paceFactor = expectedPace / 100; // 100 = league average possessions
    margin *= paceFactor;
  }

  // Home court added AFTER pace so it remains a fixed 1.5-point advantage
  const homeCourtAdvantage = isHome === null ? 0 : (isHome ? 1.5 : -1.5);
  margin += homeCourtAdvantage;

  return margin;
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
  teamPace: '', opponentPace: '',
  team3PRate: '', opponent3PRate: '',
  team3PPct: '', opponent3PPct: '',
  teamAName: '', teamBName: '',
};

export const initialHockeyState = {
  // Home team stats
  homeXgf60: '',      // Expected Goals For per 60
  homeXga60: '',      // Expected Goals Against per 60
  homeGsax60: '',     // Goalie Goals Saved Above Expected per 60
  homeHdcf60: '',     // High Danger Chances For per 60
  homePP: '',         // Power Play Percentage
  homePK: '',         // Penalty Kill Percentage
  homeTimesShorthanded: '',  // Times Shorthanded Per Game
  // Away team stats
  awayXgf60: '',
  awayXga60: '',
  awayGsax60: '',
  awayHdcf60: '',
  awayPP: '',         // Power Play Percentage
  awayPK: '',         // Penalty Kill Percentage
  awayTimesShorthanded: '',  // Times Shorthanded Per Game
  // Team names
  teamAName: '', teamBName: '',
};

/* ======================== NEW: Types for Bet Logging ======================= */
interface MatchupData {
  sport: 'football' | 'basketball' | 'hockey';
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
  hockeyStats,
  setHockeyStats,
  pointSpread,
  setPointSpread,
  totalGoalsLine,
  setTotalGoalsLine,
  calculatedProb,
  setCalculatedProb,
  expectedDiff,
  setExpectedDiff,
  isTeamAHome,
  setIsTeamAHome,
  isAuthenticated,
  onLoginRequired,
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
  hockeyStats: any;
  setHockeyStats: (v:any)=>void;
  pointSpread: string;
  setPointSpread: (v:string)=>void;
  totalGoalsLine: string;
  setTotalGoalsLine: (v:string)=>void;
  calculatedProb: number|null;
  setCalculatedProb: (v:number|null)=>void;
  expectedDiff: number|null;
  setExpectedDiff: (v:number|null)=>void;
  isTeamAHome: boolean|null;
  setIsTeamAHome: (v:boolean|null)=>void;
  isAuthenticated: boolean;
  onLoginRequired: () => void;
  // NEW props
  setCurrentMatchup: (v: MatchupData | null) => void;
  setCurrentEstimation: (v: EstimationData | null) => void;
}) {
  const [showFreeCalcModal, setShowFreeCalcModal] = useState(false);
  const [freeCalculationsLeft, setFreeCalculationsLeft] = useState<number | null>(null);
  const [isUpgradeLoading, setIsUpgradeLoading] = useState(false);
  const [isOverBet, setIsOverBet] = useState(true); // true = Over, false = Under
  const resultsRef = React.useRef<HTMLDivElement | null>(null);
  const modalRef = React.useRef<HTMLDivElement | null>(null);

  const isFormValid = useMemo(() => {
    const isHockey = activeSport === CONSTANTS.SPORTS.HOCKEY;
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL
      ? footballStats
      : activeSport === CONSTANTS.SPORTS.BASKETBALL
        ? basketballStats
        : hockeyStats;
    const requiredFields = Object.entries(current)
      .filter(([key]) => key !== 'teamAName' && key !== 'teamBName')
      .map(([, value]) => value);
    const ok = requiredFields.every(v => v !== '');
    // Hockey uses totalGoalsLine, others use pointSpread
    const hasLine = isHockey ? totalGoalsLine !== '' : pointSpread !== '';
    return ok && hasLine;
  }, [activeSport, footballStats, basketballStats, hockeyStats, pointSpread, totalGoalsLine]);

  const progress = useMemo(() => {
    const isHockey = activeSport === CONSTANTS.SPORTS.HOCKEY;
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL
      ? footballStats
      : activeSport === CONSTANTS.SPORTS.BASKETBALL
        ? basketballStats
        : hockeyStats;
    const statEntries = Object.entries(current).filter(([key]) => key !== 'teamAName' && key !== 'teamBName');
    const filledFields = statEntries.filter(([, v]) => v !== '').length;
    const totalFields = statEntries.length;
    const hasLine = isHockey ? totalGoalsLine !== '' : pointSpread !== '';
    return {
      stats: filledFields,
      totalStats: totalFields,
      spread: hasLine,
      allComplete: filledFields === totalFields && hasLine
    };
  }, [activeSport, footballStats, basketballStats, hockeyStats, pointSpread, totalGoalsLine]);

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
    } else if (activeSport === CONSTANTS.SPORTS.BASKETBALL) {
      setBasketballStats({
        teamPointsFor: '112.5', opponentPointsFor: '108.3',
        teamPointsAgainst: '106.2', opponentPointsAgainst: '110.8',
        teamFgPct: '47.8', opponentFgPct: '45.2',
        teamReboundMargin: '4.2', opponentReboundMargin: '-1.5',
        teamTurnoverMargin: '2.8', opponentTurnoverMargin: '-1.2',
        teamAName: 'Lakers', teamBName: 'Warriors'
      });
      setPointSpread('-4.5');
    } else {
      // Hockey
      setHockeyStats({
        homeXgf60: '2.95', homeXga60: '2.55', homeGsax60: '0.12', homeHdcf60: '12.8',
        homePP: '26.8', homePK: '81.3', homeTimesShorthanded: '2.9',
        awayXgf60: '2.78', awayXga60: '2.72', awayGsax60: '-0.05', awayHdcf60: '11.5',
        awayPP: '28.5', awayPK: '79.8', awayTimesShorthanded: '3.2',
        teamAName: 'COL', teamBName: 'EDM'
      });
      setTotalGoalsLine('5.5');
    }
  };

  const handleCalculate = async () => {
    if (!isAuthenticated) {
      onLoginRequired();
      return;
    }

    try {
      const accessResponse = await fetch(`${BACKEND_URL}/api/stripe/calculation-access`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (accessResponse.status === 401) {
        onLoginRequired();
        return;
      }

      if (!accessResponse.ok) {
        throw new Error('Unable to verify calculation access');
      }

      const accessData = await accessResponse.json();

      if (!accessData.allowed) {
        if (accessData.url) {
          window.location.assign(accessData.url);
          return;
        }
        throw new Error(accessData.reason || 'Subscription required');
      }

      if (accessData.showPopup) {
        setFreeCalculationsLeft(accessData.remainingCalculations);
        setShowFreeCalcModal(true);
      }

      if (activeSport === CONSTANTS.SPORTS.HOCKEY) {
        // NHL Over/Under calculation using complete 4-step algorithm
        const line = parseFloat(totalGoalsLine);
        if (Number.isNaN(line)) throw new Error('Invalid total goals line');

        // Parse all hockey stats (14 total: 7 per team)
        // Core stats
        const H_xGF = parseFloat(hockeyStats.homeXgf60) || 0;
        const H_xGA = parseFloat(hockeyStats.homeXga60) || 0;
        const A_xGF = parseFloat(hockeyStats.awayXgf60) || 0;
        const A_xGA = parseFloat(hockeyStats.awayXga60) || 0;
        const H_GSAx = parseFloat(hockeyStats.homeGsax60) || 0;
        const A_GSAx = parseFloat(hockeyStats.awayGsax60) || 0;
        const H_HDCF = parseFloat(hockeyStats.homeHdcf60) || 0;
        const A_HDCF = parseFloat(hockeyStats.awayHdcf60) || 0;
        // Special teams stats
        const H_PP = parseFloat(hockeyStats.homePP) || 0;
        const H_PK = parseFloat(hockeyStats.homePK) || 0;
        const H_TimesShorthanded = parseFloat(hockeyStats.homeTimesShorthanded) || 0;
        const A_PP = parseFloat(hockeyStats.awayPP) || 0;
        const A_PK = parseFloat(hockeyStats.awayPK) || 0;
        const A_TimesShorthanded = parseFloat(hockeyStats.awayTimesShorthanded) || 0;

        // Step 1: Calculate Projected Home Goals
        // Home_Score = ((Home_xGF + Away_xGA) / 2) - Away_Goalie_GSAx
        const projectedHomeGoals = (H_xGF + A_xGA) / 2 - A_GSAx;

        // Step 2: Calculate Projected Away Goals
        // Away_Score = ((Away_xGF + Home_xGA) / 2) - Home_Goalie_GSAx
        const projectedAwayGoals = (A_xGF + H_xGA) / 2 - H_GSAx;

        // Step 3: Pace Adjustment based on combined HDCF
        const HDC_sum = H_HDCF + A_HDCF;
        const paceAdjustment = HDC_sum > 25 ? 0.25 : 0;

        // Step 4: Special Teams Mismatch Adjustment
        // Home Advantage: IF (Home_PP + (100 - Away_PK)) * Away_Times_Shorthanded > 150
        // Away Advantage: IF (Away_PP + (100 - Home_PK)) * Home_Times_Shorthanded > 150
        let specialTeamsAdjustment = 0;
        const homeSpecialTeamsScore = (H_PP + (100 - A_PK)) * A_TimesShorthanded;
        if (homeSpecialTeamsScore > 150) {
          specialTeamsAdjustment += 0.35;
        }
        const awaySpecialTeamsScore = (A_PP + (100 - H_PK)) * H_TimesShorthanded;
        if (awaySpecialTeamsScore > 150) {
          specialTeamsAdjustment += 0.35;
        }

        // Step 5: Final Total
        const projectedTotal = Math.max(0, projectedHomeGoals + projectedAwayGoals + paceAdjustment + specialTeamsAdjustment);

        // Calculate over probability using normal CDF
        // Standard deviation based on sqrt of projected total (Poisson-like variance)
        const sigma = Math.sqrt(projectedTotal);
        const z = (projectedTotal - line) / sigma;
        // CDF gives probability of going OVER when projected > line
        const overProb = normCdf(z) * 100;

        // Calculate final probability based on user's Over/Under selection
        const finalProb = isOverBet ? overProb : (100 - overProb);

        setCalculatedProb(finalProb);
        setExpectedDiff(projectedTotal);
      } else {
        // Football/Basketball spread calculation
        const spread = parseFloat(pointSpread);
        if (Number.isNaN(spread)) throw new Error('Invalid spread');

        const m = activeSport === CONSTANTS.SPORTS.FOOTBALL
          ? predictedMarginFootball(footballStats, isTeamAHome)
          : predictedMarginBasketball(basketballStats, isTeamAHome);

        const sigma = activeSport === CONSTANTS.SPORTS.FOOTBALL ? 13.5 : 12.0;
        const p = coverProbabilityFromMargin(m, spread, sigma);

        setCalculatedProb(p);
        setExpectedDiff(m);
      }
    } catch (e) {
      console.error(e);
      setCalculatedProb(null);
      setExpectedDiff(null);
    }
  };

  useEffect(() => {
    if (calculatedProb === null || !resultsRef.current) return;
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [calculatedProb]);

  useEffect(() => {
    if (!showFreeCalcModal || !modalRef.current) return;
    requestAnimationFrame(() => {
      modalRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      modalRef.current?.focus();
    });
  }, [showFreeCalcModal]);

  const handleUpgrade = async () => {
    setIsUpgradeLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/stripe/create-checkout-session`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Unable to start checkout');
      }

      const data = await response.json();

      if (data.url) {
        window.location.assign(data.url);
        return;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpgradeLoading(false);
    }
  };

  const selectedTeamName = useMemo(() => {
    if (activeSport === CONSTANTS.SPORTS.HOCKEY) {
      const home = hockeyStats.teamAName?.trim() || 'Home';
      const away = hockeyStats.teamBName?.trim() || 'Away';
      return `${away} @ ${home}`;
    }
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    return current.teamAName?.trim() || 'Your Team';
  }, [activeSport, basketballStats, footballStats, hockeyStats]);

  const formattedPredictedSpread = useMemo(() => {
    if (expectedDiff === null) return null;
    // Predicted spread = negated predicted margin
    // If algorithm says Team A loses by 4.5 (margin = -4.5), predicted spread = +4.5
    // If algorithm says Team A wins by 7 (margin = +7), predicted spread = -7.0
    const predictedSpread = -expectedDiff;
    return `${predictedSpread > 0 ? '+' : ''}${predictedSpread.toFixed(1)}`;
  }, [expectedDiff]);

  // UPDATED: Store matchup data when applying to Kelly
  const handleApplyAndSwitch = (prob: number) => {
    setProbability(prob.toFixed(2));

    // Build matchup data for bet logging
    let matchupData: MatchupData;

    if (activeSport === CONSTANTS.SPORTS.HOCKEY) {
      matchupData = {
        sport: 'hockey',
        teamA: {
          name: hockeyStats.teamAName || 'Home Team',
          abbreviation: hockeyStats.teamAName || undefined,
          stats: {
            xgf60: parseFloat(hockeyStats.homeXgf60) || 0,
            xga60: parseFloat(hockeyStats.homeXga60) || 0,
            gsax60: parseFloat(hockeyStats.homeGsax60) || 0,
            hdcf60: parseFloat(hockeyStats.homeHdcf60) || 0
          }
        },
        teamB: {
          name: hockeyStats.teamBName || 'Away Team',
          abbreviation: hockeyStats.teamBName || undefined,
          stats: {
            xgf60: parseFloat(hockeyStats.awayXgf60) || 0,
            xga60: parseFloat(hockeyStats.awayXga60) || 0,
            gsax60: parseFloat(hockeyStats.awayGsax60) || 0,
            hdcf60: parseFloat(hockeyStats.awayHdcf60) || 0
          }
        },
        venue: 'home' // Hockey always shows home/away
      };
    } else {
      const stats = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
      matchupData = {
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
    }

    const estimationData: EstimationData = {
      pointSpread: activeSport === CONSTANTS.SPORTS.HOCKEY ? parseFloat(totalGoalsLine) : parseFloat(pointSpread),
      calculatedProbability: prob,
      expectedMargin: expectedDiff || undefined
    };

    setCurrentMatchup(matchupData);
    setCurrentEstimation(estimationData);
    setActiveTab(CONSTANTS.TABS.KELLY);
  };

  const handleSwap = () => {
    if (activeSport === CONSTANTS.SPORTS.HOCKEY) {
      // For hockey, swap home and away teams
      setHockeyStats({
        homeXgf60: hockeyStats.awayXgf60,
        homeXga60: hockeyStats.awayXga60,
        homeGsax60: hockeyStats.awayGsax60,
        homeHdcf60: hockeyStats.awayHdcf60,
        homePP: hockeyStats.awayPP,
        homePK: hockeyStats.awayPK,
        homeTimesShorthanded: hockeyStats.awayTimesShorthanded,
        awayXgf60: hockeyStats.homeXgf60,
        awayXga60: hockeyStats.homeXga60,
        awayGsax60: hockeyStats.homeGsax60,
        awayHdcf60: hockeyStats.homeHdcf60,
        awayPP: hockeyStats.homePP,
        awayPK: hockeyStats.homePK,
        awayTimesShorthanded: hockeyStats.homeTimesShorthanded,
        teamAName: hockeyStats.teamBName,
        teamBName: hockeyStats.teamAName,
      });
    } else if (activeSport === CONSTANTS.SPORTS.FOOTBALL) {
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
        teamPace: basketballStats.opponentPace,
        opponentPace: basketballStats.teamPace,
        team3PRate: basketballStats.opponent3PRate,
        opponent3PRate: basketballStats.team3PRate,
        team3PPct: basketballStats.opponent3PPct,
        opponent3PPct: basketballStats.team3PPct,
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

    // Auto-flip the result: complement probability and negate margin
    if (calculatedProb !== null) {
      setCalculatedProb(Math.max(1, Math.min(99, 100 - calculatedProb)));
    }
    if (expectedDiff !== null) {
      setExpectedDiff(-expectedDiff);
    }
  };

  return (
    <div className="glass-card p-5 md:p-6 max-w-[900px] mx-auto animate-fade-in space-y-5">
      {/* Sport Tabs */}
      <div className="flex gap-2 justify-center" role="tablist" aria-label="Sport selector">
        {[
          { key: CONSTANTS.SPORTS.FOOTBALL, label: 'Football' },
          { key: CONSTANTS.SPORTS.BASKETBALL, label: 'Basketball' },
          { key: CONSTANTS.SPORTS.HOCKEY, label: 'NHL' },
        ].map(s => (
          <button
            key={s.key}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSport === s.key
                ? 'bg-[var(--accent-gradient)] text-white shadow-[var(--accent-glow)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
            }`}
            onClick={() => setActiveSport(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Progress Steps */}
      <div className="flex gap-3 justify-center text-xs font-semibold">
        <span className={`px-3 py-1.5 rounded-full border ${
          progress.spread ? 'border-[var(--success)] text-[var(--success)] bg-[var(--success-muted)]' : 'border-[var(--border-default)] text-[var(--text-muted)]'
        }`}>
          {progress.spread ? '✓' : '1'} {activeSport === CONSTANTS.SPORTS.HOCKEY ? 'Total Goals Line' : 'Point Spread'}
        </span>
        <span className={`px-3 py-1.5 rounded-full border ${
          progress.allComplete ? 'border-[var(--success)] text-[var(--success)] bg-[var(--success-muted)]' : 'border-[var(--border-default)] text-[var(--text-muted)]'
        }`}>
          {progress.allComplete ? '✓' : progress.stats}/{progress.totalStats} Team Stats
        </span>
      </div>

      {/* Empty State */}
      {progress.stats === 0 && (activeSport === CONSTANTS.SPORTS.HOCKEY ? !totalGoalsLine : !pointSpread) && (
        <div className="text-center py-8 space-y-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Get Started</h3>
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto">
            Enter team statistics and {activeSport === CONSTANTS.SPORTS.HOCKEY ? 'total goals line to calculate over/under probability' : 'point spread to calculate win probability'}
          </p>
          <button className="btn-ghost text-sm" onClick={loadExample}>
            Try Example Data
          </button>
        </div>
      )}

      {/* Spread / Total Goals Input */}
      {activeSport === CONSTANTS.SPORTS.HOCKEY ? (
        <div className="space-y-1.5">
          <label htmlFor="totalGoalsLine" className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1">
            Total Goals (Over/Under)
            <span className="tooltip">
              <span className="help-icon">?</span>
              <span className="tooltiptext">The sportsbook's total goals line for the game (e.g., 5.5, 6.0)</span>
            </span>
          </label>
          <input id="totalGoalsLine" type="number" name="totalGoalsLine" value={totalGoalsLine}
                 onChange={(e) => setTotalGoalsLine(e.target.value)} className="input-field" placeholder="e.g., 5.5 or 6" step="0.5" />
          <p className="text-xs text-[var(--text-muted)]">Positive = Over, Negative = Under</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <label htmlFor="pointSpread" className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1">
              Point Spread (Your Team)
              <span className="tooltip">
                <span className="help-icon">?</span>
                <span className="tooltiptext">Negative = your team favored (e.g., -6.5 means your team must win by more than 6.5). Positive = underdog</span>
              </span>
            </label>
            <input id="pointSpread" type="number" name="pointSpread" value={pointSpread}
                   onChange={(e) => setPointSpread(e.target.value)} className="input-field" placeholder="e.g., -6.5 or 3" step="0.5" />
            <p className="text-xs text-[var(--text-muted)]">Negative = your team favored, Positive = your team underdog</p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="venue" className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1">
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
        </>
      )}

      {/* Sport-Specific Form */}
      <Suspense fallback={<div className="py-8 text-center text-sm text-[var(--text-muted)]">Loading...</div>}>
        {activeSport === CONSTANTS.SPORTS.FOOTBALL ? (
          <FootballEstimator
            stats={footballStats}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFootballStats({ ...footballStats, [e.target.name]: e.target.value })}
          />
        ) : activeSport === CONSTANTS.SPORTS.BASKETBALL ? (
          <BasketballEstimator
            stats={basketballStats}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setBasketballStats({ ...basketballStats, [e.target.name]: e.target.value })}
          />
        ) : (
          <HockeyEstimator
            stats={hockeyStats}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setHockeyStats({ ...hockeyStats, [e.target.name]: e.target.value })}
          />
        )}
      </Suspense>

      {/* Over/Under Toggle for NHL */}
      {activeSport === CONSTANTS.SPORTS.HOCKEY && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setIsOverBet(true)}
            className={`flex-1 max-w-[140px] py-3 px-5 text-sm font-bold rounded-xl transition-all border-none cursor-pointer ${
              isOverBet
                ? 'bg-[var(--accent-gradient)] text-white shadow-[var(--accent-glow)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            OVER
          </button>
          <span className="text-sm font-semibold text-[var(--text-muted)]">OR</span>
          <button
            type="button"
            onClick={() => setIsOverBet(false)}
            className={`flex-1 max-w-[140px] py-3 px-5 text-sm font-bold rounded-xl transition-all border-none cursor-pointer ${
              !isOverBet
                ? 'bg-[var(--accent-gradient)] text-white shadow-[var(--accent-glow)]'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)]'
            }`}
          >
            UNDER
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 flex-wrap">
        <button className="btn-accent flex-1" onClick={handleCalculate} disabled={!isFormValid}>
          Calculate Probability
        </button>
        {activeSport !== CONSTANTS.SPORTS.HOCKEY && (
          <button
            className="btn-ghost min-w-[150px]"
            onClick={handleSwap}
            title="Swap team and opponent values to see probability from the other perspective"
          >
            Swap Teams
          </button>
        )}
      </div>

      {/* Results */}
      {calculatedProb !== null && (
        <div ref={resultsRef} className="glass-card-strong p-5 text-center space-y-2 animate-fade-in" role="status" aria-live="polite">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">
            {activeSport === CONSTANTS.SPORTS.HOCKEY ? `Estimated ${isOverBet ? 'Over' : 'Under'} Probability` : 'Estimated Cover Probability'}
          </p>
          <h2 className="text-base font-semibold text-[var(--text-secondary)]">{selectedTeamName}</h2>
          <div className="text-4xl font-bold font-mono accent-gradient-text py-1">
            {calculatedProb.toFixed(2)}%
          </div>
          {formattedPredictedSpread !== null && (
            <p className="text-sm text-[var(--text-muted)]">
              {activeSport === CONSTANTS.SPORTS.HOCKEY
                ? `Projected Total: ${expectedDiff?.toFixed(2)} goals`
                : `Predicted Spread: ${formattedPredictedSpread} pts`}
            </p>
          )}
          <div className="pt-2">
            <button className="btn-accent text-sm" onClick={() => handleApplyAndSwitch(calculatedProb!)}>
              Use in Kelly Calculator &rarr;
            </button>
          </div>
        </div>
      )}

      {/* Free Calc Modal */}
      {showFreeCalcModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 z-50" role="dialog" aria-live="polite">
          <div className="max-w-[420px] w-full bg-gradient-to-br from-slate-900/95 to-slate-800/95 rounded-2xl p-7 border border-slate-600/20 shadow-2xl text-center" tabIndex={-1} ref={modalRef}>
            <span className="inline-flex px-3 py-1 rounded-full bg-blue-500/20 text-blue-200 text-xs font-semibold mb-4">Free Core Preview</span>
            <h3 className="text-xl font-bold text-white mb-3">You have {freeCalculationsLeft ?? 0} free probability checks left</h3>
            <p className="text-sm text-slate-300/80 mb-5 leading-relaxed">
              Upgrade to Core Access for unlimited calculations, premium insights, and uninterrupted flow.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                type="button"
                onClick={() => setShowFreeCalcModal(false)}
                className="btn-ghost text-sm"
              >
                Continue free
              </button>
              <button
                type="button"
                onClick={handleUpgrade}
                className="btn-accent text-sm"
                disabled={isUpgradeLoading}
              >
                {isUpgradeLoading ? 'Redirecting...' : 'Upgrade to Core Access'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* (styles object removed — using Tailwind classes) */

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
    <div className="glass-card p-5 md:p-6 max-w-[900px] mx-auto animate-fade-in space-y-5">
      {/* Bankroll */}
      <div className="space-y-1.5">
        <label htmlFor="bankroll" className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1">
          Bankroll
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Total amount of money available for betting</span>
          </span>
        </label>
        <div className="flex gap-2 items-start">
          <input
            id="bankroll"
            type="text"
            className={`input-field flex-1 ${getValidationClass(validation.bankroll)}`}
            value={bankroll}
            onChange={(e) => handleBankrollChange(e.target.value)}
            placeholder="e.g., 1000"
            inputMode="decimal"
          />
          {isAuthenticated && hasBankrollChanged && (
            <button
              onClick={handleSaveBankroll}
              disabled={isSavingBankroll || validation.bankroll === false}
              className="btn-accent text-sm py-2 px-4 whitespace-nowrap"
            >
              {isSavingBankroll ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
        {validation.bankroll === false && <p className="text-xs text-[var(--danger)]">Bankroll must be positive</p>}
        {isAuthenticated && hasBankrollChanged && validation.bankroll !== false && (
          <p className="text-xs text-[var(--text-muted)]">Click "Save" to update your bankroll</p>
        )}
        {!isAuthenticated && (
          <p className="text-xs text-[var(--text-muted)]">Default bankroll is set to $1,000. Sign in with Google to save your preferred bankroll size.</p>
        )}
      </div>

      {/* American Odds */}
      <div className="space-y-1.5">
        <label htmlFor="odds" className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1">
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
          onChange={(e) => setOdds(e.target.value)}
          placeholder="e.g., -110 or 150"
        />
        {validation.odds === false && <p className="text-xs text-[var(--danger)]">Odds must be &le;-100 or &ge;100</p>}
      </div>

      {/* Win Probability */}
      <div className="space-y-1.5">
        <label htmlFor="probability" className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1">
          Win Probability (%)
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Your estimated probability of winning (0-100%)</span>
          </span>
        </label>
        <div className="space-y-2">
          <input
            id="probability"
            type="number"
            className={`input-field ${getValidationClass(validation.probability)}`}
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
            min="0"
            max="100"
            step="0.1"
          />
          <input type="range" min="0" max="100" value={probability} step="0.1" className="w-full" onChange={(e) => setProbability(e.target.value)} />
        </div>
        {validation.probability === false && <p className="text-xs text-[var(--danger)]">Probability must be between 0 and 100</p>}
      </div>

      {/* Kelly Fraction */}
      <div className="space-y-1.5">
        <label htmlFor="fraction" className="text-sm font-medium text-[var(--text-secondary)] flex items-center gap-1">
          Kelly Fraction
          <span className="tooltip">
            <span className="help-icon">?</span>
            <span className="tooltiptext">Half Kelly (0.5x) reduces volatility</span>
          </span>
        </label>
        <select id="fraction" className="input-field" value={fraction} onChange={(e) => setFraction(e.target.value)}>
          <option value="1">Full Kelly (1x)</option>
          <option value="0.5">Half Kelly (0.5x)</option>
          <option value="0.25">Quarter Kelly (0.25x)</option>
        </select>
      </div>

      {/* Results */}
      {hasValue ? (
        <div className="glass-card-strong p-5 text-center space-y-3 animate-fade-in">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Recommended Stake</p>
          <h2 className="text-4xl font-bold font-mono accent-gradient-text">{formatCurrency(stake)}</h2>
          <p className="text-sm text-[var(--text-secondary)]">{stakePercentage.toFixed(2)}% of Bankroll</p>

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

          {!canLogBet && hasValue && (
            <div className="mt-3 p-3 bg-[var(--accent-muted)] rounded-lg text-center">
              {!isAuthenticated ? (
                <button className="btn-ghost text-sm opacity-80" onClick={onLoginRequired}>
                  Sign in to Log Bets
                </button>
              ) : (
                <p className="text-sm text-[var(--text-muted)] m-0">
                  Use the Probability Estimator first to enable bet logging with full matchup data
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card-strong p-5 text-center">
          <h2 className="text-xl font-bold text-[var(--danger)]">No Value - Do Not Bet</h2>
        </div>
      )}

      {/* Implied Prob / Edge */}
      {impliedProb !== null && edge !== null && (
        <div className="flex justify-between items-center p-3 rounded-xl bg-slate-900/60 border border-slate-600/20 text-sm">
          <div>
            <span className="block text-xs text-[var(--text-muted)]">Implied Win %</span>
            <strong className="font-mono">{impliedProb.toFixed(1)}%</strong>
          </div>
          <div className="text-right">
            <span className="block text-xs text-[var(--text-muted)]">Your Edge</span>
            <strong className="font-mono" style={{ color: edgeColor }}>
              {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
            </strong>
          </div>
        </div>
      )}

      {/* Analyst Insight */}
      <div className="glass-card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Analyst's Insight</h3>
        {isGenerating && (
          <p className="flex items-center text-sm text-[var(--text-muted)]">
            <span className="loading-spinner"></span>
            Analyst is analyzing your bet...
          </p>
        )}
        {!isGenerating && explanation && <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{explanation}</p>}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="glass-card p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Recent Calculations</h3>
            <button
              className="btn-ghost text-xs py-1 px-3"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide' : 'Show'}
            </button>
          </div>
          {showHistory && history.map((item) => (
            <div key={item.timestamp} className="flex justify-between items-center p-3 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors border border-[var(--border-default)]" onClick={() => loadHistoryItem(item)}>
              <div>
                <strong className="font-mono text-sm">{formatCurrency(item.stake)}</strong>
                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                  Bankroll: {formatCurrency(item.bankroll)} | Odds: {item.odds} | Prob: {item.probability}%
                </div>
              </div>
              <span className="text-xs text-[var(--accent)] font-medium">Load</span>
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
  const [hockeyStats, setHockeyStats] = useState(initialHockeyState);
  const [pointSpread, setPointSpread] = useState<string>('');
  const [totalGoalsLine, setTotalGoalsLine] = useState<string>('');
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

  const activeTabContentRef = React.useRef<HTMLElement | null>(null);

  // Scroll to the updated content area when switching tabs
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      activeTabContentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  // Initialize native bridge for Android app
  useEffect(() => {
    initializeNativeBridge();

    // Handle Android back button
    const backHandler = onBackButton(() => {
      if (activeTab !== CONSTANTS.TABS.KELLY) {
        setActiveTab(CONSTANTS.TABS.KELLY);
      }
    });

    // Monitor network connectivity
    const networkHandler = onNetworkChange((status) => {
      if (!status.connected) {
        showToast('No internet connection. Some features may be unavailable.', 'long');
      }
    });

    return () => {
      backHandler.remove();
      networkHandler.remove();
    };
  }, [activeTab]);

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
      ...initialBasketballState,
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
      teamPace: matchupData.teamA.pace?.toFixed(1) || '',
      opponentPace: matchupData.teamB.pace?.toFixed(1) || '',
      team3PRate: matchupData.teamA.three_rate?.toFixed(1) || '',
      opponent3PRate: matchupData.teamB.three_rate?.toFixed(1) || '',
      team3PPct: matchupData.teamA.three_pct?.toFixed(1) || '',
      opponent3PPct: matchupData.teamB.three_pct?.toFixed(1) || '',
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

  // Handler to transfer NHL matchup data to Hockey Estimator
  const handleNHLTransferToEstimator = (matchupData: any) => {
    setHockeyStats({
      homeXgf60: matchupData.homeXgf60?.toFixed(2) || '',
      homeXga60: matchupData.homeXga60?.toFixed(2) || '',
      homeGsax60: matchupData.homeGsax60?.toFixed(2) || '',
      homeHdcf60: matchupData.homeHdcf60?.toFixed(1) || '',
      homePP: matchupData.homePP?.toFixed(1) || '',
      homePK: matchupData.homePK?.toFixed(1) || '',
      homeTimesShorthanded: matchupData.homeTimesShorthanded?.toFixed(1) || '',
      awayXgf60: matchupData.awayXgf60?.toFixed(2) || '',
      awayXga60: matchupData.awayXga60?.toFixed(2) || '',
      awayGsax60: matchupData.awayGsax60?.toFixed(2) || '',
      awayHdcf60: matchupData.awayHdcf60?.toFixed(1) || '',
      awayPP: matchupData.awayPP?.toFixed(1) || '',
      awayPK: matchupData.awayPK?.toFixed(1) || '',
      awayTimesShorthanded: matchupData.awayTimesShorthanded?.toFixed(1) || '',
      teamAName: matchupData.homeTeamName || '',
      teamBName: matchupData.awayTeamName || '',
    });
    setActiveSport(CONSTANTS.SPORTS.HOCKEY);
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
      case CONSTANTS.TABS.SPORTS_MATCHUP:
        return SEO_CONFIG.sports_matchup;
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
      <SEO {...currentSEO} />

      <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] relative">
        {/* Background Ambience */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute -top-1/2 -left-1/4 w-[600px] h-[600px] rounded-full bg-[var(--accent)]/5 blur-3xl" />
          <div className="absolute -bottom-1/3 -right-1/4 w-[500px] h-[500px] rounded-full bg-[var(--accent-secondary,#8b5cf6)]/5 blur-3xl" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 pt-6 pb-28 md:pb-8 space-y-5">
          {/* Header */}
          <header className="glass-card p-5 md:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/betgistics.png"
                alt="Betgistics Logo"
                className="w-14 h-14 rounded-full border-2 border-[var(--accent)]/30 shadow-lg"
                title="Betgistics - Point Spread Betting Analytics"
                loading="eager"
                fetchPriority="high"
                width="56"
                height="56"
              />
              <div>
                <p className="text-xs uppercase tracking-wider text-[var(--accent)] font-semibold mb-0.5">Smart betting workspace</p>
                <h1 className="text-xl md:text-2xl font-bold accent-gradient-text leading-tight">Betgistics</h1>
                <p className="text-xs text-[var(--text-muted)] mt-0.5 hidden sm:block">Compare team data, model probabilities, and size bets.</p>
              </div>
            </div>

            <div className="flex-shrink-0">
              {authLoading ? (
                <span className="text-sm text-[var(--text-muted)]">Loading...</span>
              ) : authUser ? (
                <div className="flex items-center gap-3 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl p-2.5 backdrop-blur-sm">
                  {authUser.avatar && <img src={authUser.avatar} alt={authUser.name} className="w-8 h-8 rounded-full border border-[var(--accent)]/30" />}
                  <div className="hidden sm:block">
                    <div className="text-sm font-semibold leading-tight">{authUser.name}</div>
                    <div className="text-xs text-[var(--text-muted)] leading-tight">{authUser.email}</div>
                  </div>
                  <a href={`${BACKEND_URL}/auth/logout`} className="btn-danger text-xs py-1.5 px-3 ml-1 no-underline">Logout</a>
                </div>
              ) : (
                <div>
                  <a href={`${BACKEND_URL}/auth/google`} className="btn-accent inline-flex items-center gap-2 text-sm no-underline">
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                  </a>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5 max-w-[280px]">
                    By signing in, you agree to our{' '}
                    <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] no-underline hover:underline">Privacy Policy</a>
                    {' '}and{' '}
                    <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] no-underline hover:underline">Terms of Service</a>
                  </p>
                </div>
              )}
            </div>
          </header>

          {/* Workflow + Audio Orbs */}
          <section className="glass-card p-5 md:p-6 space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--accent)] font-semibold mb-1">Workflow</p>
              <h2 className="text-lg font-bold m-0">From matchup &rarr; probability &rarr; stake sizing</h2>
              <p className="text-sm text-[var(--text-muted)] mt-1">Use the tabs below like a pipeline. Each tool is purpose-built and connected.</p>
            </div>
            <SwipeableAudioOrbs
              orbs={[
                { audioSrc: '/intro.mp3', label: 'Introduction', icon: '🎙️' },
                { audioSrc: '/mission_statement.mp3', label: 'Mission Statement', icon: '🎯' },
                { audioSrc: '/quick_guide.mp3', label: 'Quick Start Guide', icon: '🎧' },
                { audioSrc: '/math_stats.mp3', label: 'Magnify Stats', icon: '🔍' },
              ]}
            />
          </section>

          {/* Tab Navigation */}
          <div className="glass-card p-3 max-w-[1100px] mx-auto">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" role="tablist">
              {[
                { key: CONSTANTS.TABS.KELLY, label: 'Kelly Criterion', blurb: 'Size your stake' },
                { key: CONSTANTS.TABS.ESTIMATOR, label: 'Prob. Estimator', blurb: 'Stats to probability' },
                { key: CONSTANTS.TABS.WALTERS, label: 'Walters Protocol', blurb: 'Edge + line value' },
                { key: CONSTANTS.TABS.SPORTS_MATCHUP, label: 'Sports Matchups', blurb: 'Compare teams' },
                { key: CONSTANTS.TABS.BET_HISTORY, label: 'Bet History', blurb: 'Track results' },
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`flex flex-col items-center justify-center text-center p-3 rounded-xl transition-all text-xs sm:text-sm font-semibold min-h-[72px] ${
                    activeTab === tab.key
                      ? 'bg-[var(--accent-gradient)] text-white shadow-[var(--accent-glow)]'
                      : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                  }`}
                  onClick={() => handleTabChange(tab.key)}
                  aria-selected={activeTab === tab.key}
                  role="tab"
                >
                  <span>{tab.label}</span>
                  <small className="text-[10px] opacity-70 mt-0.5 font-normal hidden sm:block">{tab.blurb}</small>
                </button>
              ))}
            </div>
          </div>

          {/* Active Tab Content */}
          <section ref={activeTabContentRef} aria-live="polite">
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
                hockeyStats={hockeyStats}
                setHockeyStats={setHockeyStats}
                pointSpread={pointSpread}
                setPointSpread={setPointSpread}
                totalGoalsLine={totalGoalsLine}
                setTotalGoalsLine={setTotalGoalsLine}
                calculatedProb={calculatedProb}
                setCalculatedProb={setCalculatedProb}
                expectedDiff={expectedDiff}
                setExpectedDiff={setExpectedDiff}
                isTeamAHome={isTeamAHome}
                setIsTeamAHome={setIsTeamAHome}
                isAuthenticated={!!authUser}
                onLoginRequired={handleLoginRequired}
                setCurrentMatchup={setCurrentMatchup}
                setCurrentEstimation={setCurrentEstimation}
              />
            )}
            {activeTab === CONSTANTS.TABS.WALTERS && (
              <div className="glass-card p-5 md:p-6 max-w-[900px] mx-auto">
                <Suspense fallback={<div className="py-8 text-center text-sm text-[var(--text-muted)]">Loading Walters Protocol...</div>}>
                  <WaltersEstimator onApplyToKelly={handleWaltersApplyToKelly} />
                </Suspense>
              </div>
            )}
            {activeTab === CONSTANTS.TABS.SPORTS_MATCHUP && (
              <div className="glass-card p-5 md:p-6 max-w-[900px] mx-auto">
                <Suspense fallback={<div className="py-8 text-center text-sm text-[var(--text-muted)]">Loading matchup data...</div>}>
                  <ConsolidatedSportsMatchup
                    onTransferToNBAEstimator={handleTransferToEstimator}
                    onTransferToNFLEstimator={handleNFLTransferToEstimator}
                    onTransferToNHLEstimator={handleNHLTransferToEstimator}
                  />
                </Suspense>
              </div>
            )}
            {activeTab === CONSTANTS.TABS.BET_HISTORY && (
              <div className="glass-card p-5 md:p-6 max-w-[900px] mx-auto">
                <BetHistory
                  isAuthenticated={!!authUser}
                  onBankrollUpdate={() => setBankrollRefreshTrigger(prev => prev + 1)}
                />
              </div>
            )}
            {activeTab === CONSTANTS.TABS.STATS && (
              <StatsPage />
            )}
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
            {activeTab === CONSTANTS.TABS.PROMO && (
              <PromoPage user={authUser} />
            )}
          </section>

          {/* Documentation Panel */}
          <div
            className={`max-w-[1100px] mx-auto transition-all duration-300 overflow-hidden ${
              isDocOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
            }`}
            id="app-documentation"
            aria-hidden={!isDocOpen}
          >
            <div className="glass-card p-5 md:p-6 relative">
              <button className="btn-ghost text-xs py-1.5 px-3 absolute top-4 right-4" type="button" onClick={() => setIsDocOpen(false)} aria-label="Close documentation">
                Close
              </button>
              <h2 className="text-lg font-bold mt-0 mb-2">How this app works</h2>
              <p className="text-sm text-[var(--text-muted)] mt-0">
                Follow these steps to move from matchup stats to a fully logged bet:
              </p>
              <ol className="pl-5 text-sm text-[var(--text-muted)] leading-relaxed space-y-1 mt-3">
                <li>Start in <strong className="text-[var(--text-secondary)]">Sports Matchups</strong> to load team stats and compare both sides of the game.</li>
                <li>Move to <strong className="text-[var(--text-secondary)]">Probability Estimator</strong>, enter your point spread and hit <strong className="text-[var(--text-secondary)]">Calculate Probability</strong>.</li>
                <li>Switch to <strong className="text-[var(--text-secondary)]">Kelly Criterion</strong>, enter your bankroll and odds to calculate your optimal bet size.</li>
                <li>Finally, use <strong className="text-[var(--text-secondary)]">Log Bet</strong> to save the wager and track your results over time.</li>
              </ol>
              <h3 className="text-sm font-semibold mt-4 mb-1 text-[var(--text-primary)]">Feature guide</h3>
              <ul className="pl-5 text-sm text-[var(--text-muted)] leading-relaxed space-y-1">
                <li><strong className="text-[var(--text-secondary)]">Kelly Criterion</strong>: Optimal stake based on bankroll, odds, and win probability.</li>
                <li><strong className="text-[var(--text-secondary)]">Probability Estimator</strong>: Converts matchup stats into cover probability.</li>
                <li><strong className="text-[var(--text-secondary)]">Sports Matchups</strong>: Pulls NBA, NFL, or NHL data and pre-fills estimator.</li>
                <li><strong className="text-[var(--text-secondary)]">Bet History</strong>: Stores your bets and tracks performance (sign-in required).</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 pb-24 md:pb-8 px-4 relative z-10">
          <div className="glass-card max-w-[820px] mx-auto p-4 space-y-3">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 bg-transparent border-none text-[var(--text-secondary)] font-semibold text-sm cursor-pointer py-2 rounded-lg transition-colors hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              onClick={() => setIsDocOpen((open) => !open)}
              aria-expanded={isDocOpen}
              aria-controls="app-documentation"
            >
              <span>{isDocOpen ? 'Hide documentation & workflow guide' : 'Show documentation & workflow guide'}</span>
              <span className={`transition-transform duration-200 ${isDocOpen ? 'rotate-180' : ''}`}>&#9662;</span>
            </button>
            <p className="text-xs text-[var(--text-muted)]">
              {isDocOpen ? 'Click to tuck the instructions away.' : 'Open the drop-up to review the workflow.'}
            </p>

            <div className="text-center">
              <button id="demoPopoverBtn" className="btn-ghost text-sm py-2 px-4" type="button">
                Watch Demo
              </button>
            </div>

            <div className="pt-3 border-t border-white/10">
              <p className="text-xs text-[var(--text-muted)] flex gap-6 justify-center">
                <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] no-underline hover:underline">Privacy Policy</a>
                <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] no-underline hover:underline">Terms of Service</a>
              </p>
            </div>
          </div>
        </footer>

        {/* Demo Popover */}
        <div id="demoPopover" className="absolute hidden mt-2.5 w-[min(420px,calc(100vw-24px))] rounded-2xl border border-white/12 bg-[rgba(10,12,18,0.92)] shadow-2xl p-2.5 z-[9999] backdrop-blur-xl" role="dialog" aria-hidden="true" aria-label="Demo video popover">
          <div className="flex items-center justify-between px-1.5 pb-2.5">
            <span className="text-sm text-[var(--text-primary)] font-semibold opacity-90">Demo</span>
            <button id="demoPopoverClose" className="w-8 h-8 rounded-lg border border-white/14 bg-white/8 text-[var(--text-primary)] cursor-pointer text-lg flex items-center justify-center transition-colors hover:bg-white/14" type="button" aria-label="Close">&#10005;</button>
          </div>
          <div className="w-full aspect-[9/16] rounded-xl overflow-hidden bg-black">
            <iframe
              id="demoPopoverIframe"
              src=""
              title="Demo video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
          </div>
        </div>

        {/* Bottom Navigation */}
        <BottomNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
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
    <App />
  </HelmetProvider>
);
