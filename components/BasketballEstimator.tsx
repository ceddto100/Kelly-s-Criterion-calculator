import React from "react";

export type BasketballStats = {
  teamPointsFor: string;
  opponentPointsFor: string;
  teamPointsAgainst: string;
  opponentPointsAgainst: string;
  teamFgPct: string;
  opponentFgPct: string;
  teamReboundMargin: string;
  opponentReboundMargin: string;
  teamTurnoverMargin: string;
  opponentTurnoverMargin: string;
};

type Props = {
  stats: BasketballStats;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function BasketballEstimator({ stats, onChange }: Props) {
  return (
    <div className="stats-grid">
      <h4 className="grid-header">Metric</h4>
      <h4 className="grid-header">Your Team</h4>
      <h4 className="grid-header">Opponent</h4>

      <span>Points Per Game (Your team always first)</span>
      <input
        name="teamPointsFor" type="number" className="input-field"
        value={stats.teamPointsFor} onChange={onChange} placeholder="115.3"
      />
      <input
        name="opponentPointsFor" type="number" className="input-field"
        value={stats.opponentPointsFor} onChange={onChange} placeholder="112.1"
      />

      <span>Points Allowed</span>
      <input
        name="teamPointsAgainst" type="number" className="input-field"
        value={stats.teamPointsAgainst} onChange={onChange} placeholder="110.8"
      />
      <input
        name="opponentPointsAgainst" type="number" className="input-field"
        value={stats.opponentPointsAgainst} onChange={onChange} placeholder="114.5"
      />

      <span>Field Goal %</span>
      <input
        name="teamFgPct" type="number" className="input-field"
        value={stats.teamFgPct} onChange={onChange} placeholder="48.7"
      />
      <input
        name="opponentFgPct" type="number" className="input-field"
        value={stats.opponentFgPct} onChange={onChange} placeholder="46.5"
      />

      <span>Rebound Margin</span>
      <input
        name="teamReboundMargin" type="number" className="input-field"
        value={stats.teamReboundMargin} onChange={onChange} placeholder="3.5"
      />
      <input
        name="opponentReboundMargin" type="number" className="input-field"
        value={stats.opponentReboundMargin} onChange={onChange} placeholder="-1.2"
      />

      <span>Turnover Margin</span>
      <input
        name="teamTurnoverMargin" type="number" className="input-field"
        value={stats.teamTurnoverMargin} onChange={onChange} placeholder="2.1"
      />
      <input
        name="opponentTurnoverMargin" type="number" className="input-field"
        value={stats.opponentTurnoverMargin} onChange={onChange} placeholder="-0.8"
      />
    </div>
  );
}
