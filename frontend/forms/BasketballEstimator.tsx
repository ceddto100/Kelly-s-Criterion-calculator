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
  teamPace: string;
  opponentPace: string;
  team3PRate: string;
  opponent3PRate: string;
  team3PPct: string;
  opponent3PPct: string;
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

      <span>Pace (Poss/Game)</span>
      <InputWithTeamLabel
        name="teamPace"
        value={stats.teamPace}
        placeholder="100.5"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponentPace"
        value={stats.opponentPace}
        placeholder="98.2"
        teamName={stats.teamBName}
      />

      <span>3PT %</span>
      <InputWithTeamLabel
        name="team3PPct"
        value={stats.team3PPct}
        placeholder="36.5"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponent3PPct"
        value={stats.opponent3PPct}
        placeholder="35.0"
        teamName={stats.teamBName}
      />

      <span>3PT Rate (3PA/FGA)</span>
      <InputWithTeamLabel
        name="team3PRate"
        value={stats.team3PRate}
        placeholder="0.40"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="opponent3PRate"
        value={stats.opponent3PRate}
        placeholder="0.38"
        teamName={stats.teamBName}
      />
    </div>
  );
}

