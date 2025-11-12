/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

/* === bring in your committed form input components === */
import FootballEstimator from "./forms/FootballEstimator";
import BasketballEstimator from "./forms/BasketballEstimator";
import ChatKitWidget from "./components/ChatKitWidget";

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

    .input-group{ display:flex; flex-direction:column; gap:.35rem; margin-bottom:1rem; }
    .input-field, select{ background:#0f1836; border:1px solid rgba(148,163,184,.35); color:var(--text);
      padding:.65rem .75rem; border-radius:.6rem; outline:none; width:100%; }
    .input-field:focus, select:focus{ border-color:#818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,.25); }
    .slider-group{ display:grid; grid-template-columns: 1fr; gap:.5rem; }
    .slider{ width:100%; accent-color:#6366f1; }

    .btn-primary, .btn-secondary{ border:none; cursor:pointer; padding:.75rem 1rem; border-radius:.8rem; font-weight:700; transition:.2s ease; width:100%; }
    .btn-primary{ background: linear-gradient(90deg, #4f46e5, #7c3aed); color:#fff; box-shadow: 0 10px 24px rgba(79,70,229,.35); }
    .btn-primary:disabled{ opacity:.5; cursor:not-allowed; }
    .btn-primary:hover{ filter: brightness(1.05); transform: translateY(-1px); }
    .btn-secondary{ background: rgba(99,102,241,.14); color:#c7d2fe; border:1px solid rgba(99,102,241,.35); }
    .btn-secondary:hover{ background: rgba(99,102,241,.22); }

    .results{ margin-top:1rem; padding:1rem; border-radius:.8rem; border:1px solid rgba(99,102,241,.35); background: rgba(30,27,75,.45); }
    .results.no-value{ background: rgba(127,29,29,.25); border-color: rgba(248,113,113,.35); }
    .results-details{ color:#cbd5e1; margin-top:.35rem; }
    .analyst-insight{ margin-top:1rem; padding:1rem; border-radius:.8rem; background: rgba(2,6,23,.5); border:1px solid rgba(100,116,139,.3); }

    .container{ display:flex; flex-direction:column; gap:1rem; }
  `}</style>
);

/* =============================== App Constants ============================= */
const CONSTANTS = {
  TABS: { KELLY: 'kelly', ESTIMATOR: 'estimator', UNIT: 'unit' },
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
const initialFootballState = {
  teamPointsFor: '', opponentPointsFor: '',
  teamPointsAgainst: '', opponentPointsAgainst: '',
  teamOffYards: '', opponentOffYards: '',
  teamDefYards: '', opponentDefYards: '',
  teamTurnoverDiff: '', opponentTurnoverDiff: '',
};
const initialBasketballState = {
  teamPointsFor: '', opponentPointsFor: '',
  teamPointsAgainst: '', opponentPointsAgainst: '',
  teamFgPct: '', opponentFgPct: '',
  teamReboundMargin: '', opponentReboundMargin: '',
  teamTurnoverMargin: '', opponentTurnoverMargin: '',
};

/* ========================= Probability Estimator panel ===================== */
function ProbabilityEstimator({
  setProbability,
  setActiveTab
}: { setProbability:(v:string)=>void; setActiveTab:(t:string)=>void }) {
  const [activeSport, setActiveSport] = useState(CONSTANTS.SPORTS.FOOTBALL);
  const [footballStats, setFootballStats] = useState(initialFootballState);
  const [basketballStats, setBasketballStats] = useState(initialBasketballState);
  const [pointSpread, setPointSpread] = useState<string>('');
  const [calculatedProb, setCalculatedProb] = useState<number|null>(null);
  const [expectedDiff, setExpectedDiff] = useState<number|null>(null);

  const isFormValid = useMemo(() => {
    const current = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
    const ok = Object.values(current).every(v => v !== '');
    return ok && pointSpread !== '';
  }, [activeSport, footballStats, basketballStats, pointSpread]);

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

  return (
    <div className="panel panel-strong">
      <div className="tabs nested-tabs" role="tablist" aria-label="Sport selector">
        <button className={`tab ${activeSport === CONSTANTS.SPORTS.FOOTBALL ? 'active' : ''}`}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.FOOTBALL)}>Football</button>
        <button className={`tab ${activeSport === CONSTANTS.SPORTS.BASKETBALL ? 'active' : ''}`}
                onClick={()=>setActiveSport(CONSTANTS.SPORTS.BASKETBALL)}>Basketball</button>
      </div>

      <div className="input-group">
        <label htmlFor="pointSpread">Point Spread (Your Team)</label>
        <input id="pointSpread" type="number" name="pointSpread" value={pointSpread}
               onChange={(e)=>setPointSpread(e.target.value)} className="input-field" placeholder="e.g., -6.5 or 3" />
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

      <button className="btn-primary" onClick={handleCalculate} disabled={!isFormValid}>
        Calculate Probability
      </button>

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
function KellyCalculator({ probability, setProbability }: { probability:string; setProbability:(v:string)=>void }) {
  const [bankroll, setBankroll] = useState('1000');
  const [odds, setOdds] = useState('150');
  const [fraction, setFraction] = useState('1');
  const [explanation, setExplanation] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

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
    return { stake: numBankroll * k * numFraction, stakePercentage: k*100*numFraction, hasValue:true };
  }, [bankroll, odds, probability, fraction]);

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

  return (
    <div className="panel">
      <div className="input-group">
        <label htmlFor="bankroll">Bankroll</label>
        <input id="bankroll" type="number" className="input-field" value={bankroll} onChange={(e)=>setBankroll(e.target.value)} placeholder="e.g., 1000" />
      </div>
      <div className="input-group">
        <label htmlFor="odds">American Odds</label>
        <input id="odds" type="number" className="input-field" value={odds} onChange={(e)=>setOdds(e.target.value)} placeholder="e.g., -110 or 150" />
      </div>
      <div className="input-group">
        <label htmlFor="probability">Win Probability (%)</label>
        <div className="slider-group">
          <input id="probability" type="number" className="input-field" value={probability} onChange={(e)=>setProbability(e.target.value)} min="0" max="100" step="0.1" />
          <input type="range" min="0" max="100" value={probability} step="0.1" className="slider" onChange={(e)=>setProbability(e.target.value)} />
        </div>
      </div>
      <div className="input-group">
        <label htmlFor="fraction">Kelly Fraction</label>
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
          <div className="results-details"><span>{stakePercentage.toFixed(2)}% of Bankroll</span></div>
        </div>
      ) : (
        <div className="results no-value"><h2>No Value - Do Not Bet</h2></div>
      )}

      <div className="analyst-insight">
        <h3 style={{marginTop:0}}>Analyst's Insight</h3>
        {isGenerating && <p className="loading-text">Analyst is thinking...</p>}
        {explanation && <p>{explanation}</p>}
      </div>
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

  return (
    <div className="site-bg">
      <ChatKitWidget />
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
        </header>

        <div className="panel" style={{maxWidth:900}}>
          <div className="tabs" role="tablist">
            {[
              { key: CONSTANTS.TABS.KELLY, label: 'Kelly Criterion' },
              { key: CONSTANTS.TABS.ESTIMATOR, label: 'Probability Estimator' },
              { key: CONSTANTS.TABS.UNIT, label: 'Unit Betting' },
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
          <ProbabilityEstimator setProbability={setProbability} setActiveTab={setActiveTab} />
        )}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <>
    <GlobalStyle />
    <App />
  </>
);


