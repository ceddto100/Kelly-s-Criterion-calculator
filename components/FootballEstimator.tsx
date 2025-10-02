import React, { useMemo, useState } from "react";

type Props = {
  /** Called when user clicks “Use in Kelly Calculator” */
  onUseInKelly?: (probabilityPercent: number) => void;
  /** Override the default NFL single-game margin σ (13.5) */
  sigma?: number;
};

const initial = {
  teamPointsFor: "", opponentPointsFor: "",
  teamPointsAgainst: "", opponentPointsAgainst: "",
  teamOffYards: "", opponentOffYards: "",
  teamDefYards: "", opponentDefYards: "",
  teamTurnoverDiff: "", opponentTurnoverDiff: "",
};

function normCdf(x: number) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1, z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + p * z);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z);
  return 0.5 * (1 + sign * y);
}
function coverProb(margin: number, spread: number, sigma: number) {
  const Z = (margin + spread) / sigma; // cover threshold = -spread
  const p = normCdf(Z);
  return Math.max(0.1, Math.min(99.9, p * 100));
}
function predictedMargin(stats: typeof initial) {
  const teamNetPoints = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const opponentNetPoints = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);
  const teamNetYards = parseFloat(stats.teamOffYards) - parseFloat(stats.teamDefYards);
  const opponentNetYards = parseFloat(stats.opponentOffYards) - parseFloat(stats.opponentDefYards);
  const teamTO = parseFloat(stats.teamTurnoverDiff);
  const oppTO  = parseFloat(stats.opponentTurnoverDiff);

  const pointsComponent = (teamNetPoints - opponentNetPoints) * 0.5;
  const yardsComponent  = ((teamNetYards - opponentNetYards) / 100) * 0.3;
  const toComponent     = (teamTO - oppTO) * 4 * 0.2;

  return pointsComponent + yardsComponent + toComponent;
}

export default function FootballEstimator({ onUseInKelly, sigma = 13.5 }: Props) {
  const [stats, setStats] = useState(initial);
  const [spread, setSpread] = useState("");
  const [prob, setProb] = useState<number | null>(null);
  const [margin, setMargin] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setStats({ ...stats, [e.target.name]: e.target.value });

  const valid = useMemo(() => Object.values(stats).every(v => v !== "") && spread !== "", [stats, spread]);

  const calc = () => {
    const s = parseFloat(spread);
    if (Number.isNaN(s)) return;
    const m = predictedMargin(stats);
    const p = coverProb(m, s, sigma);
    setProb(p);
    setMargin(m);
  };

  return (
    <div className="panel panel-strong">
      <div className="input-group">
        <label htmlFor="football-spread">Point Spread (Your Team)</label>
        <input
          id="football-spread" type="number" className="input-field"
          value={spread} onChange={e => setSpread(e.target.value)} placeholder="e.g., -3.5 or 4"
        />
        <p style={{ fontSize: ".8rem", color: "var(--text-muted)" }}>
          Negative = your team favored, Positive = your team underdog
        </p>
      </div>

      <div className="stats-grid">
        <h4 className="grid-header">Metric</h4>
        <h4 className="grid-header">Your Team</h4>
        <h4 className="grid-header">Opponent</h4>

        <span>Points Per Game (Your team always first)</span>
        <input name="teamPointsFor" type="number" className="input-field" value={stats.teamPointsFor} onChange={handleChange} placeholder="26.1" />
        <input name="opponentPointsFor" type="number" className="input-field" value={stats.opponentPointsFor} onChange={handleChange} placeholder="22.5" />

        <span>Points Allowed</span>
        <input name="teamPointsAgainst" type="number" className="input-field" value={stats.teamPointsAgainst} onChange={handleChange} placeholder="20.8" />
        <input name="opponentPointsAgainst" type="number" className="input-field" value={stats.opponentPointsAgainst} onChange={handleChange} placeholder="23.1" />

        <span>Offensive Yards</span>
        <input name="teamOffYards" type="number" className="input-field" value={stats.teamOffYards} onChange={handleChange} placeholder="385.2" />
        <input name="opponentOffYards" type="number" className="input-field" value={stats.opponentOffYards} onChange={handleChange} placeholder="350.7" />

        <span>Defensive Yards</span>
        <input name="teamDefYards" type="number" className="input-field" value={stats.teamDefYards} onChange={handleChange} placeholder="330.1" />
        <input name="opponentDefYards" type="number" className="input-field" value={stats.opponentDefYards} onChange={handleChange} placeholder="365.4" />

        <span>Turnover Diff.</span>
        <input name="teamTurnoverDiff" type="number" className="input-field" value={stats.teamTurnoverDiff} onChange={handleChange} placeholder="7" />
        <input name="opponentTurnoverDiff" type="number" className="input-field" value={stats.opponentTurnoverDiff} onChange={handleChange} placeholder="-2" />
      </div>

      <button className="btn-primary" onClick={calc} disabled={!valid}>Calculate Probability</button>

      {prob !== null && (
        <div className="results">
          <p>Estimated Cover Probability</p>
          <h2>{prob.toFixed(2)}%</h2>
          {margin !== null && <div className="results-details">Predicted Margin: {margin > 0 ? "+" : ""}{margin.toFixed(1)} pts</div>}
          {onUseInKelly && (
            <div style={{ marginTop: ".6rem" }}>
              <button className="btn-secondary" onClick={() => onUseInKelly(prob!)}>Use in Kelly Calculator</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
