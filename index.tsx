/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
// No longer need to import GoogleGenerativeAI on the client
// import { GoogleGenAI, Type } from '@google/genai'; 

const CONSTANTS = {
    TABS: {
        KELLY: 'kelly',
        ESTIMATOR: 'estimator',
        UNIT: 'unit',
    },
    SPORTS: {
        FOOTBALL: 'football',
        BASKETBALL: 'basketball',
    }
};

// Helper function for the new API call
async function fetchFromApi(prompt, systemInstruction) {
    const response = await fetch('/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction }),
    });

    if (!response.ok) {
        const errorBody = await response.json();
        throw new Error(errorBody.message || 'API request failed');
    }

    return response.json();
}


const formatCurrency = (value) => {
    const numValue = Number(value);
    if (isNaN(numValue)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(numValue);
};

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

function FootballStatsForm({ stats, onChange }) {
    return (
        <div className="stats-grid">
            <h4 className="grid-header">Metric</h4>
            <h4 className="grid-header">Your Team</h4>
            <h4 className="grid-header">Opponent</h4>
            
            <span>Points Per Game
            (Your team always first)</span>
            <input type="number" name="teamPointsFor" value={stats.teamPointsFor} onChange={onChange} className="input-field" placeholder="26.1" />
            <input type="number" name="opponentPointsFor" value={stats.opponentPointsFor} onChange={onChange} className="input-field" placeholder="22.5" />
            
            <span>Points Allowed</span>
            <input type="number" name="teamPointsAgainst" value={stats.teamPointsAgainst} onChange={onChange} className="input-field" placeholder="20.8" />
            <input type="number" name="opponentPointsAgainst" value={stats.opponentPointsAgainst} onChange={onChange} className="input-field" placeholder="23.1" />
            
            <span>Offensive Yards</span>
            <input type="number" name="teamOffYards" value={stats.teamOffYards} onChange={onChange} className="input-field" placeholder="385.2" />
            <input type="number" name="opponentOffYards" value={stats.opponentOffYards} onChange={onChange} className="input-field" placeholder="350.7" />

            <span>Defensive Yards</span>
            <input type="number" name="teamDefYards" value={stats.teamDefYards} onChange={onChange} className="input-field" placeholder="330.1" />
            <input type="number" name="opponentDefYards" value={stats.opponentDefYards} onChange={onChange} className="input-field" placeholder="365.4" />
            
            <span>Turnover Diff.</span>
            <input type="number" name="teamTurnoverDiff" value={stats.teamTurnoverDiff} onChange={onChange} className="input-field" placeholder="7" />
            <input type="number" name="opponentTurnoverDiff" value={stats.opponentTurnoverDiff} onChange={onChange} className="input-field" placeholder="-2" />
        </div>
    );
}

function BasketballStatsForm({ stats, onChange }) {
    return (
        <div className="stats-grid">
            <h4 className="grid-header">Metric</h4>
            <h4 className="grid-header">Your Team</h4>
            <h4 className="grid-header">Opponent</h4>
            
            <span>Points Per Game
            (Your team always first)</span>
            <input type="number" name="teamPointsFor" value={stats.teamPointsFor} onChange={onChange} className="input-field" placeholder="115.3" />
            <input type="number" name="opponentPointsFor" value={stats.opponentPointsFor} onChange={onChange} className="input-field" placeholder="112.1" />
            
            <span>Points Allowed</span>
            <input type="number" name="teamPointsAgainst" value={stats.teamPointsAgainst} onChange={onChange} className="input-field" placeholder="110.8" />
            <input type="number" name="opponentPointsAgainst" value={stats.opponentPointsAgainst} onChange={onChange} className="input-field" placeholder="114.5" />
            
            <span>Field Goal %</span>
            <input type="number" name="teamFgPct" value={stats.teamFgPct} onChange={onChange} className="input-field" placeholder="48.7" />
            <input type="number" name="opponentFgPct" value={stats.opponentFgPct} onChange={onChange} className="input-field" placeholder="46.5" />

            <span>Rebound Margin</span>
            <input type="number" name="teamReboundMargin" value={stats.teamReboundMargin} onChange={onChange} className="input-field" placeholder="3.5" />
            <input type="number" name="opponentReboundMargin" value={stats.opponentReboundMargin} onChange={onChange} className="input-field" placeholder="-1.2" />
            
            <span>Turnover Margin</span>
            <input type="number" name="teamTurnoverMargin" value={stats.teamTurnoverMargin} onChange={onChange} className="input-field" placeholder="2.1" />
            <input type="number" name="opponentTurnoverMargin" value={stats.opponentTurnoverMargin} onChange={onChange} className="input-field" placeholder="-0.8" />
        </div>
    );
}

function ProbabilityEstimator({ setProbability, setActiveTab }) {
    const [activeSport, setActiveSport] = useState(CONSTANTS.SPORTS.FOOTBALL);
    const [footballStats, setFootballStats] = useState(initialFootballState);
    const [basketballStats, setBasketballStats] = useState(initialBasketballState);
    const [pointSpread, setPointSpread] = useState('');
    const [isCalculating, setIsCalculating] = useState(false);
    const [calculatedProb, setCalculatedProb] = useState(null);
    const [error, setError] = useState('');

    const handleFootballChange = (e) => setFootballStats({ ...footballStats, [e.target.name]: e.target.value });
    const handleBasketballChange = (e) => setBasketballStats({ ...basketballStats, [e.target.name]: e.target.value });
    
    const handleApplyAndSwitch = (prob) => {
        setProbability(prob.toString());
        setActiveTab(CONSTANTS.TABS.KELLY);
    };

    const isFormValid = useMemo(() => {
        const currentStats = activeSport === CONSTANTS.SPORTS.FOOTBALL ? footballStats : basketballStats;
        return Object.values(currentStats).every(val => val !== '') && pointSpread !== '';
    }, [activeSport, footballStats, basketballStats, pointSpread]);

    const handleCalculate = async () => {
        setIsCalculating(true);
        setCalculatedProb(null);
        setError('');

        try {
            const systemInstruction = `You are a sports data analyst. Based on the provided team statistics and point spread, calculate the win probability for 'Your Team'. Provide a JSON response with a single key "probability" (e.g., { "probability": 55.4 }). Do not include any other text or explanations.`;
            
            let promptLines = [
                `Calculate the win probability for a ${activeSport} team.`,
                `Point Spread for Your Team: ${pointSpread}`,
            ];
            
            if (activeSport === CONSTANTS.SPORTS.FOOTBALL) {
                promptLines.push(
                    `- Your Team Points/Game: ${footballStats.teamPointsFor}`,
                    `- Opponent Points/Game: ${footballStats.opponentPointsFor}`,
                    `- Your Team Points Allowed/Game: ${footballStats.teamPointsAgainst}`,
                    `- Opponent Points Allowed/Game: ${footballStats.opponentPointsAgainst}`,
                    `- Your Team Offensive Yards/Game: ${footballStats.teamOffYards}`,
                    `- Opponent Offensive Yards/Game: ${footballStats.opponentOffYards}`,
                    `- Your Team Defensive Yards/Game: ${footballStats.teamDefYards}`,
                    `- Opponent Defensive Yards/Game: ${footballStats.opponentDefYards}`,
                    `- Your Team Turnover Differential: ${footballStats.teamTurnoverDiff}`,
                    `- Opponent Turnover Differential: ${footballStats.opponentTurnoverDiff}`
                );
            } else {
                 promptLines.push(
                    `- Your Team Points/Game: ${basketballStats.teamPointsFor}`,
                    `- Opponent Points/Game: ${basketballStats.opponentPointsFor}`,
                    `- Your Team Points Allowed/Game: ${basketballStats.teamPointsAgainst}`,
                    `- Opponent Points Allowed/Game: ${basketballStats.opponentPointsAgainst}`,
                    `- Your Team Field Goal %%: ${basketballStats.teamFgPct}`,
                    `- Opponent Field Goal %%: ${basketballStats.opponentFgPct}`,
                    `- Your Team Rebound Margin: ${basketballStats.teamReboundMargin}`,
                    `- Opponent Rebound Margin: ${basketballStats.opponentReboundMargin}`,
                    `- Your Team Turnover Margin: ${basketballStats.teamTurnoverMargin}`,
                    `- Opponent Turnover Margin: ${basketballStats.opponentTurnoverMargin}`
                );
            }

            const response = await fetchFromApi(promptLines.join('\n'), systemInstruction);
            const result = JSON.parse(response.text);
            const probability = result.probability;

            if (probability !== undefined && !isNaN(probability)) {
                setCalculatedProb(probability);
            } else {
                setError("Could not parse a valid probability from the response.");
            }

        } catch (error) {
            console.error("Error calculating probability:", error);
            setError(error.message || "An error occurred during calculation. Please try again.");
        } finally {
            setIsCalculating(false);
        }
    };
    
    return (
        <div className="calculator-body">
            <div className="tabs nested-tabs">
                <button className={`tab ${activeSport === CONSTANTS.SPORTS.FOOTBALL ? 'active' : ''}`} onClick={() => setActiveSport(CONSTANTS.SPORTS.FOOTBALL)}>Football</button>
                <button className={`tab ${activeSport === CONSTANTS.SPORTS.BASKETBALL ? 'active' : ''}`} onClick={() => setActiveSport(CONSTANTS.SPORTS.BASKETBALL)}>Basketball</button>
            </div>
            <div className="input-group">
                <label htmlFor="pointSpread">Point Spread (Your Team)</label>
                <input id="pointSpread" type="number" name="pointSpread" value={pointSpread} onChange={(e) => setPointSpread(e.target.value)} className="input-field" placeholder="e.g., -6.5 or 3" />
            </div>
            {activeSport === CONSTANTS.SPORTS.FOOTBALL ? <FootballStatsForm stats={footballStats} onChange={handleFootballChange} /> : <BasketballStatsForm stats={basketballStats} onChange={handleBasketballChange} />}
            <button onClick={handleCalculate} className="btn-primary" disabled={isCalculating || !isFormValid}>
                {isCalculating ? 'Calculating...' : 'Calculate Probability'}
            </button>
            {error && <div className="error-message">{error}</div>}
            {calculatedProb !== null && (
                 <div className="results">
                    <p>Estimated Win Probability for Your Team</p>
                    <h2>{calculatedProb.toFixed(2)}%</h2>
                    <button className="btn-secondary" onClick={() => handleApplyAndSwitch(calculatedProb.toFixed(2))}>
                        Use in Kelly Calculator
                    </button>
                </div>
            )}
        </div>
    );
}


function KellyCalculator({ probability, setProbability }) {
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

        if (isNaN(numBankroll) || numBankroll <= 0 || isNaN(americanOdds) || (americanOdds > -100 && americanOdds < 100) || isNaN(numProbability) || numProbability <= 0 || numProbability >= 1) {
            return { stake: 0, stakePercentage: 0, hasValue: false };
        }
        
        const decimalOdds = americanOdds > 0 ? (americanOdds / 100) + 1 : (100 / Math.abs(americanOdds)) + 1;
        const b = decimalOdds - 1; 
        const kellyFraction = ((b * numProbability) - (1 - numProbability)) / b;

        if (kellyFraction <= 0) {
            return { stake: 0, stakePercentage: 0, hasValue: false };
        }
        
        const stakePercentage = kellyFraction * 100 * numFraction;
        const stake = numBankroll * kellyFraction * numFraction;

        return { stake, stakePercentage, hasValue: true };
    }, [bankroll, odds, probability, fraction]);

    useEffect(() => {
        if (!probability) return;

        const getExplanation = async () => {
            setIsGenerating(true);
            setExplanation(''); 

            try {
                const systemInstruction = "You are a seasoned betting analyst. Provide brief (1-2 sentences), insightful, and varied explanations for Kelly Criterion recommendations. Your tone should be responsible and clear. Never repeat the same explanation. Focus on the core reason for the recommendation.";

                const userPrompt = hasValue
                    ? `A user's inputs (Bankroll: ${formatCurrency(bankroll)}, Odds: ${odds}, Win Probability: ${probability}%) result in a recommended stake of ${formatCurrency(stake)} (${stakePercentage.toFixed(2)}%). Provide a concise, 1-2 sentence explanation for why this is a good bet according to the Kelly Criterion. Focus on the value identified.`
                    : `A user's inputs (Bankroll: ${formatCurrency(bankroll)}, Odds: ${odds}, Win Probability: ${probability}%) indicate a "No Value" bet. Provide a concise, 1-2 sentence explanation for why the model recommends not betting. Emphasize bankroll protection.`;
                
                const response = await fetchFromApi(userPrompt, systemInstruction);
                // The proxy returns a simple JSON { text: "..." }, no need for complex parsing
                setExplanation(response.text);

            } catch (error) {
                console.error("Error generating explanation:", error);
                setExplanation(error.message || "Could not generate an analysis at this time.");
            } finally {
                setIsGenerating(false);
            }
        };

        const debounce = setTimeout(getExplanation, 500);
        return () => clearTimeout(debounce);
    }, [stake, stakePercentage, hasValue, bankroll, odds, probability]);

    return (
        <div className="calculator-body">
            <div className="input-group">
                <label htmlFor="bankroll">Bankroll</label>
                <input id="bankroll" type="number" className="input-field" value={bankroll} onChange={(e) => setBankroll(e.target.value)} placeholder="e.g., 1000" />
            </div>
            <div className="input-group">
                <label htmlFor="odds">American Odds</label>
                <input id="odds" type="number" className="input-field" value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="e.g., -110 or 150" />
            </div>
            <div className="input-group">
                <label htmlFor="probability">Win Probability (%)</label>
                <div className="slider-group">
                    <input id="probability" type="number" className="input-field" value={probability} onChange={(e) => setProbability(e.target.value)} min="0" max="100" step="0.1" />
                    <input type="range" min="0" max="100" value={probability} step="0.1" className="slider" onChange={(e) => setProbability(e.target.value)} />
                </div>
            </div>
            <div className="input-group">
                <label htmlFor="fraction">Kelly Fraction</label>
                <select id="fraction" className="input-field" value={fraction} onChange={(e) => setFraction(e.target.value)}>
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
                <div className="results no-value">
                    <h2>No Value - Do Not Bet</h2>
                </div>
            )}
            <div className="analyst-insight">
                <h3>Analyst's Insight</h3>
                {isGenerating && <p className="loading-text">Analyst is thinking...</p>}
                {explanation && <p>{explanation}</p>}
            </div>
        </div>
    );
}

function UnitBettingCalculator() {
    const [bankroll, setBankroll] = useState('1000');
    const [unitSize, setUnitSize] = useState('1');
    const [unitsToWager, setUnitsToWager] = useState('1');

    const { recommendedStake, calculatedUnitSize } = useMemo(() => {
        const numBankroll = parseFloat(bankroll);
        const numUnitSize = parseFloat(unitSize) / 100;
        const numUnitsToWager = parseFloat(unitsToWager);

        if (isNaN(numBankroll) || numBankroll <= 0 || isNaN(numUnitSize) || numUnitSize < 0 || isNaN(numUnitsToWager) || numUnitsToWager < 0) {
            return { recommendedStake: 0, calculatedUnitSize: 0 };
        }
        
        const calculatedUnitSize = numBankroll * numUnitSize;
        const recommendedStake = calculatedUnitSize * numUnitsToWager;

        return { recommendedStake, calculatedUnitSize };
    }, [bankroll, unitSize, unitsToWager]);

    return (
        <div className="calculator-body">
            <div className="input-group">
                <label htmlFor="unit-bankroll">Bankroll</label>
                <input id="unit-bankroll" type="number" className="input-field" value={bankroll} onChange={(e) => setBankroll(e.target.value)} placeholder="e.g., 1000" />
            </div>
            <div className="input-group">
                <label htmlFor="unit-size">Unit Size (% of Bankroll)</label>
                 <div className="slider-group">
                    <input id="unit-size" type="number" className="input-field" value={unitSize} onChange={(e) => setUnitSize(e.target.value)} min="0" max="5" step="0.1" />
                    <input type="range" min="0" max="5" step="0.1" value={unitSize} className="slider" onChange={(e) => setUnitSize(e.target.value)} />
                </div>
            </div>
            <div className="input-group">
                <label htmlFor="units-wager">Units to Wager</label>
                <input id="units-wager" type="number" step="0.1" className="input-field" value={unitsToWager} onChange={(e) => setUnitsToWager(e.target.value)} placeholder="e.g., 1" />
            </div>
            <div className="results">
                <p>Recommended Stake</p>
                <h2>{formatCurrency(recommendedStake)}</h2>
                <div className="results-details">
                    <span>Unit Size: {formatCurrency(calculatedUnitSize)}</span>
                </div>
            </div>
        </div>
    );
}


function App() {
    const [activeTab, setActiveTab] = useState(CONSTANTS.TABS.KELLY);
    const [probability, setProbability] = useState('50');

    return (
        <div className="container">
            <header className="header">
                <h1>Betting Strategy Calculator</h1>
                <p>Manage your bankroll with proven staking methods.</p>
            </header>
            <div className="tabs">
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
            {activeTab === CONSTANTS.TABS.KELLY && <KellyCalculator probability={probability} setProbability={setProbability} />}
            {activeTab === CONSTANTS.TABS.UNIT && <UnitBettingCalculator />}
            {activeTab === CONSTANTS.TABS.ESTIMATOR && <ProbabilityEstimator setProbability={setProbability} setActiveTab={setActiveTab} />}
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
