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
  teamAName?: string;
  teamBName?: string;
};

type Props = {
  stats: FootballStats;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function FootballEstimator({ stats, onChange }: Props) {
  const InputWithTeamLabel = ({
    name,
    value,
    placeholder,
    teamName,
    step = "0.1"
  }: {
    name: string;
    value: string;
    placeholder: string;
    teamName?: string;
    step?: string;
  }) => (
    <div style={{ position: 'relative' }}>
      <input
        name={name}
        type="number"
        step={step}
        className="input-field"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={teamName ? { paddingTop: '1.5rem' } : {}}
      />
      {teamName && (
        <span className="team-name-label">
          {teamName}
        </span>
      )}
    </div>
  );

  return (
    <div className="stats-grid">
      <h4 className="grid-header">Metric</h4>
      <h4 className="grid-header">Your Team</h4>
      <h4 className="grid-header">Opponent</h4>

      <span>Points Per Game (Your team always first)</span>
      <InputWithTeamLabel
        name="teamPointsFor"
        value={stats.teamPointsFor}
        placeholder="26.1"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentPointsFor"
        value={stats.opponentPointsFor}
        placeholder="22.5"
        teamName={stats.teamBName}
      />

      <span>Points Allowed</span>
      <InputWithTeamLabel
        name="teamPointsAgainst"
        value={stats.teamPointsAgainst}
        placeholder="20.8"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentPointsAgainst"
        value={stats.opponentPointsAgainst}
        placeholder="23.1"
        teamName={stats.teamBName}
      />

      <span>Offensive Yards</span>
      <InputWithTeamLabel
        name="teamOffYards"
        value={stats.teamOffYards}
        placeholder="385.2"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentOffYards"
        value={stats.opponentOffYards}
        placeholder="350.7"
        teamName={stats.teamBName}
      />

      <span>Defensive Yards</span>
      <InputWithTeamLabel
        name="teamDefYards"
        value={stats.teamDefYards}
        placeholder="330.1"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentDefYards"
        value={stats.opponentDefYards}
        placeholder="365.4"
        teamName={stats.teamBName}
      />

      <span>Turnover Diff.</span>
      <InputWithTeamLabel
        name="teamTurnoverDiff"
        value={stats.teamTurnoverDiff}
        placeholder="7"
        teamName={stats.teamAName}
        step="1"
      />
      <InputWithTeamLabel
        name="opponentTurnoverDiff"
        value={stats.opponentTurnoverDiff}
        placeholder="-2"
        teamName={stats.teamBName}
        step="1"
      />
    </div>
  );
}
