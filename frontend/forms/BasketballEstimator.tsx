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
  teamAName?: string;
  teamBName?: string;
};

type Props = {
  stats: BasketballStats;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function BasketballEstimator({ stats, onChange }: Props) {
  const InputWithTeamLabel = ({
    name,
    value,
    placeholder,
    teamName
  }: {
    name: string;
    value: string;
    placeholder: string;
    teamName?: string;
  }) => (
    <div style={{ position: 'relative' }}>
      <input
        name={name}
        type="number"
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
        placeholder="115.3"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentPointsFor"
        value={stats.opponentPointsFor}
        placeholder="112.1"
        teamName={stats.teamBName}
      />

      <span>Points Allowed</span>
      <InputWithTeamLabel
        name="teamPointsAgainst"
        value={stats.teamPointsAgainst}
        placeholder="110.8"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentPointsAgainst"
        value={stats.opponentPointsAgainst}
        placeholder="114.5"
        teamName={stats.teamBName}
      />

      <span>Field Goal %</span>
      <InputWithTeamLabel
        name="teamFgPct"
        value={stats.teamFgPct}
        placeholder="48.7"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentFgPct"
        value={stats.opponentFgPct}
        placeholder="46.5"
        teamName={stats.teamBName}
      />

      <span>Rebound Margin</span>
      <InputWithTeamLabel
        name="teamReboundMargin"
        value={stats.teamReboundMargin}
        placeholder="3.5"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentReboundMargin"
        value={stats.opponentReboundMargin}
        placeholder="-1.2"
        teamName={stats.teamBName}
      />

      <span>Turnover Margin</span>
      <InputWithTeamLabel
        name="teamTurnoverMargin"
        value={stats.teamTurnoverMargin}
        placeholder="2.1"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentTurnoverMargin"
        value={stats.opponentTurnoverMargin}
        placeholder="-0.8"
        teamName={stats.teamBName}
      />
    </div>
  );
}

