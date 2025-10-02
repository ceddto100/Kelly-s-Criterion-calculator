import React, { useMemo, useState } from "react";

type Props = {
  onUseInKelly?: (probabilityPercent: number) => void;
  /** Default NBA σ ≈ 12.0 */
  sigma?: number;
};

const initial = {
  teamPointsFor: "", opponentPointsFor: "",
  teamPointsAgainst: "", opponentPointsAgainst: "",
  teamFgPct: "", opponentFgPct: "",
  teamReboundMargin: "", opponentReboundMargin: "",
  teamTurnoverMargin: "", opponentTurnoverMargin: "",
};

function normCdf(x: number) {
  const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;
  const sign = x < 0 ? -1 : 1, z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + p * z);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z);
  return 0.5 * (1 + sign * y);
}
function coverProb(margin: number, spread: number, sigma: number) {
  const Z = (margin + spread) / sigma;
  const p = normCdf(Z);
  return Math.max(0.1, Math.min(99.9, p * 100));
}
function predictedMargin(stats: typeof initial) {
  const teamNetPoints = parseFloat(stats.teamPointsFor) - parseFloat(stats.teamPointsAgainst);
  const opponentNetPoints = parseFloat(stats.opponentPointsFor) - parseFloat(stats.opponentPointsAgainst);

  const teamFg = parseFloat(stats.teamFgPct);
  const oppFg  = parseFloat(stats.opponentFgPct);

  const teamReb = parseFloat(stats.teamReboundMargin);
  const oppReb  = parseFloat(stats.opponentReboundMargin);

  const teamTov = parseFloat(stats.teamTurnoverMargin);
  const oppTov  = parseFloat(stats.opponentTurnoverMargin);

  const pointsComponent   = (teamNetPoints - opponentNetPoints) * 0.4;
  const fgComponent       = (teamFg - oppFg) * 2 * 0.3;   // ~2 pts per 1% FG
  const reboundComponent  = (teamReb - oppReb) * 0.2;
  const turnoverComponent = (teamTov - oppTov) * 0.1;

  return pointsComponent + fgComponent + reboundComponent + turnoverComponent;
}

export default function BasketballEstimator({ onUseInKelly, sigma = 12.0 }: Props) {
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
        <label htmlFor="basketball-spread">Point Spread (Your Team)</label>
        <input
          id="basketball-spread" type="number" className="input-field"
          value={spread} onChange={e => setSpread(e.target.value)} placeholder="e.g., -6.5 or 3"
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
        <input name="teamPointsFor" type="number" className="input-field" value={stats.teamPointsFor} onChange={handleChange} placeholder="115.3" />
        <input name="opponentPointsFor" type="number" className="input-field" value={stats.opponentPointsFor} onChange={handleChange} placeholder="112.1" />

        <span>Points Allowed</span>
        <input name="teamPointsAgainst" type="number" className="input-field" value={stats.teamPointsAgainst} onChange={handleChange} placeholder="110.8" />
        <input name="opponentPointsAgainst" type="number" className="input-field" value={stats.opponentPointsAgainst} onChange={handleChange} placeholder="114.5" />

        <span>Field Goal %</span>
        <input name="teamFgPct" type="number" className="input-field" value={stats.teamFgPct} onChange={handleChange} placeholder="48.7" />
        <input name="opponentFgPct" type="number" className="input-field" value={stats.opponentFgPct} onChange={handleChange} placeholder="46.5" />

        <span>Rebound Margin</span>
        <input name="teamReboundMargin" type="number" className="input-field" value={stats.teamReboundMargin} onChange={handleChange} placeholder="3.5" />
        <input name="opponentReboundMargin" type="number" className="input-field" value={stats.opponentReboundMargin} onChange={handleChange} placeholder="-1.2" />

        <span>Turnover Margin</span>
        <input name="teamTurnoverMargin" type="number" className="input-field" value={stats.teamTurnoverMargin} onChange={handleChange} placeholder="2.1" />
        <input name="opponentTurnoverMargin" type="number" className="input-field" value={stats.opponentTurnoverMargin} onChange={handleChange} placeholder="-0.8" />
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
