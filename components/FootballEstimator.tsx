import React from "react";

export type FootballStats = {
  teamPointsFor: string;
  opponentPointsFor: string;
  teamPointsAgainst: string;
  opponentPointsAgainst: string;
  teamOffYards: string;
  opponentOffYards: string;
  teamDefYards: string;
  opponentDefYards: string;
  teamTurnoverDiff: string;
  opponentTurnoverDiff: string;
};

type Props = {
  stats: FootballStats;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function FootballEstimator({ stats, onChange }: Props) {
  return (
    <div className="stats-grid">
      <h4 className="grid-header">Metric</h4>
      <h4 className="grid-header">Your Team</h4>
      <h4 className="grid-header">Opponent</h4>

      <span>Points Per Game (Your team always first)</span>
      <input
        name="teamPointsFor"
        type="number"
        step="0.1"
        className="input-field"
        value={stats.teamPointsFor}
        onChange={onChange}
        placeholder="26.1"
      />
      <input
        name="opponentPointsFor"
        type="number"
        step="0.1"
        className="input-field"
        value={stats.opponentPointsFor}
        onChange={onChange}
        placeholder="22.5"
      />

      <span>Points Allowed</span>
      <input
        name="teamPointsAgainst"
        type="number"
        step="0.1"
        className="input-field"
        value={stats.teamPointsAgainst}
        onChange={onChange}
        placeholder="20.8"
      />
      <input
        name="opponentPointsAgainst"
        type="number"
        step="0.1"
        className="input-field"
        value={stats.opponentPointsAgainst}
        onChange={onChange}
        placeholder="23.1"
      />

      <span>Offensive Yards</span>
      <input
        name="teamOffYards"
        type="number"
        step="0.1"
        className="input-field"
        value={stats.teamOffYards}
        onChange={onChange}
        placeholder="385.2"
      />
      <input
        name="opponentOffYards"
        type="number"
        step="0.1"
        className="input-field"
        value={stats.opponentOffYards}
        onChange={onChange}
        placeholder="350.7"
      />

      <span>Defensive Yards</span>
      <input
        name="teamDefYards"
        type="number"
        step="0.1"
        className="input-field"
        value={stats.teamDefYards}
        onChange={onChange}
        placeholder="330.1"
      />
      <input
        name="opponentDefYards"
        type="number"
        step="0.1"
        className="input-field"
        value={stats.opponentDefYards}
        onChange={onChange}
        placeholder="365.4"
      />

      <span>Turnover Diff.</span>
      <input
        name="teamTurnoverDiff"
        type="number"
        step="1"
        className="input-field"
        value={stats.teamTurnoverDiff}
        onChange={onChange}
        placeholder="7"
      />
      <input
        name="opponentTurnoverDiff"
        type="number"
        step="1"
        className="input-field"
        value={stats.opponentTurnoverDiff}
        onChange={onChange}
        placeholder="-2"
      />
    </div>
  );
}

