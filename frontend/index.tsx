/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

/* Components */
import FootballEstimator from "./forms/FootballEstimator";
import BasketballEstimator from "./forms/BasketballEstimator";
import SportsMatchup from "./forms/SportsMatchup";
import NFLMatchup from "./forms/NFLMatchup";
import { LogBetButton, BetHistory, BetLoggerStyles } from './components/BetLogger';

/* Assets / Config */
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "";

/* Constants */
const CONSTANTS = {
  TABS: {
    KELLY: 'kelly',
    ESTIMATOR: 'estimator',
    MATCHUP: 'matchup',
    NFL_MATCHUP: 'nfl_matchup',
    BET_HISTORY: 'bet_history'
  },
  SPORTS: { FOOTBALL: 'football', BASKETBALL: 'basketball' },
};

/* ========================================================================
   HELPER FUNCTIONS (Logic Unchanged)
   ======================================================================== */
async function fetchFromApi(prompt: string, systemInstruction: string) {
  const response = await fetch(`${BACKEND_URL}/api/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemInstruction }),
  });
  if (!response.ok) throw new Error('API Request Failed');
  return response.json();
}

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

function predictedMarginFootball(stats: any, isHome: boolean | null = null): number {
  // Logic unchanged from original file...
  const teamAPointDiff = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const teamBPointDiff = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
  const pointDiffComponent = (teamAPointDiff - teamBPointDiff) * 0.4;
  const teamAYardDiff = parseFloat(stats.teamOffYards) - parseFloat(stats.teamDefYards);
  const teamBYardDiff = parseFloat(stats.opponentOffYards) - parseFloat(stats.opponentDefYards);
  const yardDiffComponent = ((teamAYardDiff - teamBYardDiff) / 25) * 0.25;
  let teamTO = parseFloat(stats.teamTurnoverDiff) || 0;
  let oppTO = parseFloat(stats.opponentTurnoverDiff) || 0;
  const turnoverComponent = (teamTO - oppTO) * 4 * 0.5 * 0.2;
  const homeFieldAdvantage = isHome === null ? 0 : (isHome ? 2.5 : -2.5);
  return pointDiffComponent + yardDiffComponent + turnoverComponent + homeFieldAdvantage;
}

function predictedMarginBasketball(stats: any, isHome: boolean | null = null): number {
  // Logic unchanged...
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

const formatCurrency = (v: any) => isNaN(Number(v)) ? '$0.00' :
  new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v));

/* Initial States (Unchanged) */
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

/* Types */
interface MatchupData { sport: 'football'|'basketball'; teamA: any; teamB: any; venue: 'home'|'away'|'neutral'; }
interface EstimationData { pointSpread: number; calculatedProbability: number; expectedMargin?: number; }

/* ========================================================================
   COMPONENTS
   ======================================================================== */

/* 1. Sidebar Navigation Component */
const Sidebar = ({ activeTab, setActiveTab, authUser }: any) => (
  <nav className="app-sidebar">
    <div className="app-logo">
      <span>⚡</span> KELLY.CALC
    </div>

    <div className="nav-menu">
      <button className={`nav-item ${activeTab === CONSTANTS.TABS.KELLY ? 'active' : ''}`}
              onClick={() => setActiveTab(CONSTANTS.TABS.KELLY)}>
        💰 Kelly Calculator
      </button>
      <button className={`nav-item ${activeTab === CONSTANTS.TABS.ESTIMATOR ? 'active' : ''}`}
              onClick={() => setActiveTab(CONSTANTS.TABS.ESTIMATOR)}>
        📈 Prob. Estimator
      </button>
      <button className={`nav-item ${activeTab === CONSTANTS.TABS.MATCHUP ? 'active' : ''}`}
              onClick={() => setActiveTab(CONSTANTS.TABS.MATCHUP)}>
        🏀 NBA Analysis
      </button>
      <button className={`nav-item ${activeTab === CONSTANTS.TABS.NFL_MATCHUP ? 'active' : ''}`}
              onClick={() => setActiveTab(CONSTANTS.TABS.NFL_MATCHUP)}>
        🏈 NFL Analysis
      </button>
      <button className={`nav-item ${activeTab === CONSTANTS.TABS.BET_HISTORY ? 'active' : ''}`}
              onClick={() => setActiveTab(CONSTANTS.TABS.BET_HISTORY)}>
        📊 History
      </button>
    </div>

    <div style={{ marginTop: 'auto' }}>
      {authUser ? (
        <div className="panel" style={{ padding: '0.75rem', display:'flex', alignItems:'center', gap:'0.5rem' }}>
          <img src={authUser.avatar} style={{width:24, height:24, borderRadius:'50%'}} />
          <div style={{fontSize:'0.8rem', overflow:'hidden', textOverflow:'ellipsis'}}>{authUser.name}</div>
        </div>
      ) : (
        <a href={`${BACKEND_URL}/auth/google`} className="btn-primary" style={{fontSize:'0.9rem'}}>Sign In</a>
      )}
    </div>
  </nav>
);

/* 2. Probability Estimator Component */
function ProbabilityEstimator({
  setProbability, setActiveTab, activeSport, setActiveSport,
  footballStats, setFootballStats, basketballStats, setBasketballStats,
  pointSpread, setPointSpread, calculatedProb, setCalculatedProb,
  expectedDiff, setExpectedDiff, isTeamAHome, setIsTeamAHome,
  setCurrentMatchup, setCurrentEstimation
}: any) {

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
    } catch (e) { setCalculatedProb(null); }
  };

  const handleApply = (prob: number) => {
    setProbability(prob.toFixed(2));
    const stats = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    const matchupData = {
        sport: activeSport,
        teamA: { name: stats.teamAName || 'Team A', stats: {} },
        teamB: { name: stats.teamBName || 'Team B', stats: {} },
        venue: isTeamAHome === null ? 'neutral' : isTeamAHome ? 'home' : 'away'
    };
    const estData = { pointSpread: parseFloat(pointSpread), calculatedProbability: prob, expectedMargin: expectedDiff };
    setCurrentMatchup(matchupData);
    setCurrentEstimation(estData);
    setActiveTab(CONSTANTS.TABS.KELLY);
  };

  return (
    <div className="content-width">
      <div style={{display:'flex', gap:'1rem', marginBottom:'1.5rem'}}>
        <button className={`btn-secondary ${activeSport === CONSTANTS.SPORTS.FOOTBALL ? 'active' : ''}`}
                style={{borderColor: activeSport === CONSTANTS.SPORTS.FOOTBALL ? 'var(--primary)' : ''}}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.FOOTBALL)}>🏈 Football</button>
        <button className={`btn-secondary ${activeSport === CONSTANTS.SPORTS.BASKETBALL ? 'active' : ''}`}
                style={{borderColor: activeSport === CONSTANTS.SPORTS.BASKETBALL ? 'var(--primary)' : ''}}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.BASKETBALL)}>🏀 Basketball</button>
      </div>

      <div style={{display:'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap:'2rem'}}>
        <div className="panel">
          <div className="input-group">
            <label>Spread (Negative = Favorite)</label>
            <input type="number" className="input-field" value={pointSpread}
                   onChange={(e)=>setPointSpread(e.target.value)} placeholder="-6.5" />
          </div>
          <div className="input-group">
            <label>Venue</label>
            <select className="input-field"
                    value={isTeamAHome === null ? 'neutral' : isTeamAHome ? 'home' : 'away'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setIsTeamAHome(val === 'neutral' ? null : val === 'home');
                    }}>
              <option value="neutral">Neutral Site</option>
              <option value="home">Team A Home</option>
              <option value="away">Team A Away</option>
            </select>
          </div>

          {activeSport === CONSTANTS.SPORTS.FOOTBALL ? (
            <FootballEstimator stats={footballStats} onChange={(e:any) => setFootballStats({ ...footballStats, [e.target.name]: e.target.value })} />
          ) : (
            <BasketballEstimator stats={basketballStats} onChange={(e:any) => setBasketballStats({ ...basketballStats, [e.target.name]: e.target.value })} />
          )}

          <button className="btn-primary mt-4" onClick={handleCalculate}>Run Simulation</button>
        </div>

        {/* Results HUD */}
        <div>
          {calculatedProb !== null ? (
            <div className="results" style={{borderTop:'none'}}>
              <div className="results-header" style={{background: 'var(--primary)', color:'white', border:'none'}}>
                <h3>Simulation Result</h3>
              </div>
              <div className="results-body">
                <div style={{fontSize:'4rem', fontWeight:'800', color:'var(--bg-app)'}}>
                  {calculatedProb.toFixed(1)}%
                </div>
                <div style={{color:'#64748b', marginBottom:'1.5rem'}}>Win Probability</div>

                <div style={{display:'flex', justifyContent:'center', gap:'1rem', fontSize:'0.9rem', color:'#334155'}}>
                  <div>Expected Margin: <strong>{expectedDiff?.toFixed(1)} pts</strong></div>
                </div>

                <button className="btn-primary mt-4"
                        style={{background:'var(--bg-app)', color:'white'}}
                        onClick={()=>handleApply(calculatedProb!)}>
                  Transfer to Kelly Calc ➔
                </button>
              </div>
            </div>
          ) : (
            <div className="panel" style={{height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-secondary)'}}>
              Enter stats to see probability
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* 3. Kelly Calculator Component (Refined Visuals) */
function KellyCalculator({ probability, setProbability, isAuthenticated, matchupData, estimationData, onLoginRequired }: any) {
  const [bankroll, setBankroll] = useState('1000');
  const [odds, setOdds] = useState('-110');
  const [fraction, setFraction] = useState('1');
  const [explanation, setExplanation] = useState('');

  const calculateImpliedProbability = (americanOdds: string) => {
    const o = parseFloat(americanOdds);
    if (isNaN(o)) return null;
    return o < 0 ? (-o)/(-o+100)*100 : 100/(o+100)*100;
  };

  const { stake, stakePercentage, hasValue } = useMemo(() => {
    const b = parseFloat(bankroll), o = parseFloat(odds), p = parseFloat(probability)/100, f = parseFloat(fraction);
    if(isNaN(b) || b<=0 || isNaN(o) || (o>-100 && o<100) || isNaN(p) || p<=0 || p>=1) return {stake:0,stakePercentage:0,hasValue:false};
    const dec = o>0?(o/100)+1:(100/Math.abs(o))+1;
    const k = ((dec-1)*p - (1-p))/(dec-1);
    return k<=0 ? {stake:0,stakePercentage:0,hasValue:false} : {stake:b*k*f, stakePercentage:k*100*f, hasValue:true};
  }, [bankroll, odds, probability, fraction]);

  const implied = calculateImpliedProbability(odds);
  const edge = implied ? parseFloat(probability) - implied : null;

  useEffect(() => {
    if (!hasValue) { setExplanation(''); return; }
    const t = setTimeout(async () => {
       try {
         const prompt = `Bankroll: $${bankroll}, Odds: ${odds}, Win Prob: ${probability}%. Result: Stake $${stake.toFixed(2)}. Explain concisely.`;
         const res = await fetchFromApi(prompt, "You are a betting analyst. Be brief.");
         setExplanation(res.text);
       } catch(e){}
    }, 1000);
    return () => clearTimeout(t);
  }, [stake, hasValue]);

  return (
    <div className="content-width">
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:'2rem'}}>

        {/* Inputs Panel */}
        <div className="panel">
          <h2 style={{fontSize:'1.5rem', marginBottom:'1.5rem'}}>Parameters</h2>

          <div className="input-group">
            <label>Total Bankroll ($)</label>
            <input type="number" className="input-field" value={bankroll} onChange={(e)=>setBankroll(e.target.value)} />
          </div>

          <div className="input-group">
            <label>American Odds</label>
            <input type="number" className="input-field" value={odds} onChange={(e)=>setOdds(e.target.value)} />
          </div>

          <div className="input-group">
            <label>Win Probability: <span style={{color:'var(--primary)'}}>{probability}%</span></label>
            <div className="slider-group">
              <input type="number" className="input-field" value={probability} onChange={(e)=>setProbability(e.target.value)} style={{width:'80px'}} />
              <input type="range" min="1" max="99" step="0.1" className="slider" value={probability} onChange={(e)=>setProbability(e.target.value)} />
            </div>
          </div>

          <div className="input-group">
            <label>Kelly Strategy</label>
            <select className="input-field" value={fraction} onChange={(e)=>setFraction(e.target.value)}>
              <option value="1">Full Kelly (Aggressive)</option>
              <option value="0.5">Half Kelly (Standard)</option>
              <option value="0.25">Quarter Kelly (Conservative)</option>
            </select>
          </div>
        </div>

        {/* Ticket Panel */}
        <div>
          <div className={`results ${hasValue ? '' : 'no-value'}`}>
            <div className="results-header">
              <h3>Recommended Wager</h3>
              <span>{new Date().toLocaleDateString()}</span>
            </div>

            <div className="results-body">
              {hasValue ? (
                <>
                  <h2>{formatCurrency(stake)}</h2>
                  <div className="ticket-meta">
                    <span>{stakePercentage.toFixed(2)}% of Bankroll</span>
                  </div>

                  <div style={{marginTop:'2rem', padding:'1rem', background:'#f8fafc', borderRadius:'0.5rem', textAlign:'left'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'0.5rem'}}>
                      <span style={{color:'#64748b', fontSize:'0.85rem'}}>Implied Probability</span>
                      <span style={{fontWeight:'600', color:'#0f172a'}}>{implied?.toFixed(1)}%</span>
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between'}}>
                      <span style={{color:'#64748b', fontSize:'0.85rem'}}>Your Edge</span>
                      <span style={{fontWeight:'600', color: (edge||0) > 0 ? '#10b981' : '#ef4444'}}>
                        {(edge||0) > 0 ? '+' : ''}{edge?.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Log Bet Button */}
                  {matchupData && estimationData && (
                    <div style={{marginTop:'1.5rem'}}>
                      <LogBetButton
                        sport={matchupData.sport} teamA={matchupData.teamA} teamB={matchupData.teamB} venue={matchupData.venue}
                        pointSpread={estimationData.pointSpread} calculatedProbability={estimationData.calculatedProbability}
                        expectedMargin={estimationData.expectedMargin} impliedProbability={implied||undefined} edge={edge||undefined}
                        bankroll={parseFloat(bankroll)} americanOdds={parseFloat(odds)} kellyFraction={parseFloat(fraction)}
                        recommendedStake={stake} stakePercentage={stakePercentage} isAuthenticated={isAuthenticated} onLoginRequired={onLoginRequired}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h2 style={{color:'var(--danger)'}}>NO BET</h2>
                  <p style={{color:'#64748b'}}>Negative expected value. Save your money.</p>
                </>
              )}
            </div>
          </div>

          {explanation && (
            <div className="panel" style={{marginTop:'1.5rem', fontSize:'0.9rem', lineHeight:'1.5', color:'var(--text-secondary)'}}>
              <strong style={{color:'var(--primary)', display:'block', marginBottom:'0.5rem'}}>Analyst Note:</strong>
              {explanation}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ========================================================================
   MAIN APP SHELL
   ======================================================================== */
function App() {
  const [activeTab, setActiveTab] = useState(CONSTANTS.TABS.KELLY);
  const [probability, setProbability] = useState('55');

  // States for Estimators
  const [activeSport, setActiveSport] = useState(CONSTANTS.SPORTS.FOOTBALL);
  const [footballStats, setFootballStats] = useState(initialFootballState);
  const [basketballStats, setBasketballStats] = useState(initialBasketballState);
  const [pointSpread, setPointSpread] = useState('');
  const [calculatedProb, setCalculatedProb] = useState<number|null>(null);
  const [expectedDiff, setExpectedDiff] = useState<number|null>(null);
  const [isTeamAHome, setIsTeamAHome] = useState<boolean|null>(null);

  // Auth & Data passing
  const [authUser, setAuthUser] = useState<{name:string, email:string, avatar:string}|null>(null);
  const [currentMatchup, setCurrentMatchup] = useState<MatchupData|null>(null);
  const [currentEstimation, setCurrentEstimation] = useState<EstimationData|null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/auth/status`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if(d?.authenticated) setAuthUser(d.user); })
      .catch(console.error);
  }, []);

  // Handlers for "Transfer to Estimator"
  const handleTransferNBA = (data: any) => {
    setBasketballStats({
      teamPointsFor: data.teamA.points_per_game?.toString(), opponentPointsFor: data.teamB.points_per_game?.toString(),
      teamPointsAgainst: data.teamA.points_allowed?.toString(), opponentPointsAgainst: data.teamB.points_allowed?.toString(),
      teamFgPct: data.teamA.field_goal_pct?.toString(), opponentFgPct: data.teamB.field_goal_pct?.toString(),
      teamReboundMargin: data.teamA.rebound_margin?.toString(), opponentReboundMargin: data.teamB.rebound_margin?.toString(),
      teamTurnoverMargin: data.teamA.turnover_margin?.toString(), opponentTurnoverMargin: data.teamB.turnover_margin?.toString(),
      teamAName: data.teamA.team?.split(' ').pop(), teamBName: data.teamB.team?.split(' ').pop()
    });
    setActiveSport(CONSTANTS.SPORTS.BASKETBALL);
    setActiveTab(CONSTANTS.TABS.ESTIMATOR);
  };

  const handleTransferNFL = (data: any) => {
    setFootballStats(data);
    setActiveSport(CONSTANTS.SPORTS.FOOTBALL);
    setActiveTab(CONSTANTS.TABS.ESTIMATOR);
  };

  return (
    <>
      <style>{BetLoggerStyles}</style>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} authUser={authUser} />

      <main className="app-main">
        {activeTab === CONSTANTS.TABS.KELLY && (
          <KellyCalculator
            probability={probability} setProbability={setProbability}
            isAuthenticated={!!authUser} matchupData={currentMatchup} estimationData={currentEstimation}
            onLoginRequired={() => window.location.href=`${BACKEND_URL}/auth/google`}
          />
        )}

        {activeTab === CONSTANTS.TABS.ESTIMATOR && (
          <ProbabilityEstimator
            {...{setProbability, setActiveTab, activeSport, setActiveSport, footballStats, setFootballStats,
                 basketballStats, setBasketballStats, pointSpread, setPointSpread, calculatedProb, setCalculatedProb,
                 expectedDiff, setExpectedDiff, isTeamAHome, setIsTeamAHome, setCurrentMatchup, setCurrentEstimation}}
          />
        )}

        {activeTab === CONSTANTS.TABS.MATCHUP && (
          <div className="content-width">
            <SportsMatchup backendUrl={BACKEND_URL} onTransferToEstimator={handleTransferNBA} />
          </div>
        )}

        {activeTab === CONSTANTS.TABS.NFL_MATCHUP && (
          <div className="content-width">
            <NFLMatchup onTransferToEstimator={handleTransferNFL} />
          </div>
        )}

        {activeTab === CONSTANTS.TABS.BET_HISTORY && (
          <div className="content-width">
            <BetHistory isAuthenticated={!!authUser} />
          </div>
        )}
      </main>
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
