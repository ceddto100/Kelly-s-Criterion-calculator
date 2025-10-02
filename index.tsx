/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useMemo, useEffect } from 'react';
import ReactDOM from 'react-dom/client';

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

// Helper function for the new API call (only used for Kelly explanation)
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

/**
 * Calculate win probability based on point differential and point spread
 * Uses logistic function to convert point differential to probability
 * 
 * @param expectedDifferential - Expected point margin (positive = your team favored)
 * @param pointSpread - The point spread for your team (negative = favored)
 * @param standardDeviation - Sport-specific standard deviation
 * @returns Win probability as a percentage (0-100)
 */
function calculateWinProbability(expectedDifferential: number, pointSpread: number, standardDeviation: number): number {
    // Adjust the expected differential by the point spread
    // If your team is favored by 7 (spread = -7) and expected to win by 10,
    // the net advantage is 10 - (-7) = 17 points
    // If your team is underdog by 3 (spread = +3) and expected to win by 5,
    // the net advantage is 5 - 3 = 2 points
    const netAdvantage = expectedDifferential - pointSpread;
    
    // Use logistic function to convert point differential to probability
    // P = 1 / (1 + e^(-netAdvantage / (standardDeviation * sqrt(2/π))))
    // The factor accounts for the distribution of final score differences
    const scaleFactor = standardDeviation * Math.sqrt(2 / Math.PI);
    const probability = 1 / (1 + Math.exp(-netAdvantage / scaleFactor));
    
    // Return as percentage, clamped between 0.1% and 99.9%
    return Math.max(0.1, Math.min(99.9, probability * 100));
}

/**
 * Calculate expected point differential for football
 */
function calculateFootballDifferential(stats: any): number {
    const teamNetPoints = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
    const opponentNetPoints = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
    
    const teamNetYards = parseFloat(stats.teamOffYards) - parseFloat(stats.teamDefYards);
    const opponentNetYards = parseFloat(stats.opponentOffYards) - parseFloat(stats.opponentDefYards);
    
    const teamTurnoverDiff = parseFloat(stats.teamTurnoverDiff);
    const opponentTurnoverDiff = parseFloat(stats.opponentTurnoverDiff);
    
    // Weighted formula based on football analytics
    // Points differential is most important (50% weight)
    // Yards differential accounts for 30%
    // Turnovers account for 20% (each turnover worth ~4 points)
    const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.5;
    const yardsComponent = ((teamNetYards - opponentNetYards) / 100) * 0.3;
    const turnoverComponent = (teamTurnoverDiff - opponentTurnoverDiff) * 4 * 0.2;
    
    return pointsComponent + yardsComponent + turnoverComponent;
}

/**
 * Calculate expected point differential for basketball
 */
function calculateBasketballDifferential(stats: any): number {
    const teamNetPoints = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
    const opponentNetPoints = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
    
    const teamFgPct = parseFloat(stats.teamFgPct);
    const opponentFgPct = parseFloat(stats.opponentFgPct);
    
    const teamReboundMargin = parseFloat(stats.teamReboundMargin);
    const opponentReboundMargin = parseFloat(stats.opponentReboundMargin);
    
    const teamTurnoverMargin = parseFloat(stats.teamTurnoverMargin);
    const opponentTurnoverMargin = parseFloat(stats.opponentTurnoverMargin);
    
    // Weighted formula based on basketball analytics
    // Points differential is most important (40% weight)
    // FG% differential accounts for 30% (each 1% worth ~2 points)
    // Rebound margin accounts for 20%
    // Turnover margin accounts for 10%
    const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.4;
    const fgComponent = (teamFgPct - opponentFgPct) * 2 * 0.3;
    const reboundComponent = (teamReboundMargin - opponentReboundMargin) * 0.2;
    const turnoverComponent = (teamTurnoverMargin - opponentTurnoverMargin) * 0.1;
    
    return pointsComponent + fgComponent + reboundComponent + turnoverComponent;
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
    const [calculatedProb, setCalculatedProb] = useState(null);
    const [expectedDiff, setExpectedDiff] = useState(null);

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

    const handleCalculate = () => {
        try {
            const spread = parseFloat(pointSpread);
            
            let expectedDifferential: number;
            let standardDeviation: number;
            
            if (activeSport === CONSTANTS.SPORTS.FOOTBALL) {
                expectedDifferential = calculateFootballDifferential(footballStats);
                standardDeviation = 13.5; // NFL standard deviation
            } else {
                expectedDifferential = calculateBasketballDifferential(basketballStats);
                standardDeviation = 12.0; // NBA standard deviation
            }
            
            const probability = calculateWinProbability(expectedDifferential, spread, standardDeviation);
            
            setCalculatedProb(probability);
            setExpectedDiff(expectedDifferential);

        } catch (error) {
            console.error("Error calculating probability:", error);
            setCalculatedProb(null);
            setExpectedDiff(null);
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
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    Negative = your team favored, Positive = your team underdog
                </p>
            </div>
            {activeSport === CONSTANTS.SPORTS.FOOTBALL ? <FootballStatsForm stats={footballStats} onChange={handleFootballChange} /> : <BasketballStatsForm stats={basketballStats} onChange={handleBasketballChange} />}
            <button onClick={handleCalculate} className="btn-primary" disabled={!isFormValid}>
                Calculate Probability
            </button>
            {calculatedProb !== null && (
                 <div className="results">
                    <p>Estimated Win Probability</p>
                    <h2>{calculatedProb.toFixed(2)}%</h2>
                    {expectedDiff !== null && (
                        <div className="results-details">
                            <span>Expected Margin: {expectedDiff > 0 ? '+' : ''}{expectedDiff.toFixed(1)} pts</span>
                        </div>
                    )}
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
