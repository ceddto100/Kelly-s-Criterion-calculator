import React from "react";

export type HockeyStats = {
  homeXgf60: string;      // Home Expected Goals For per 60
  homeXga60: string;      // Home Expected Goals Against per 60
  homeGsax60: string;     // Home Goalie GSAx per 60
  homeHdcf60: string;     // Home High Danger Chances For per 60
  homePP: string;         // Home Power Play Percentage
  homePK: string;         // Home Penalty Kill Percentage
  homeTimesShorthanded: string;  // Home Times Shorthanded Per Game
  awayXgf60: string;      // Away Expected Goals For per 60
  awayXga60: string;      // Away Expected Goals Against per 60
  awayGsax60: string;     // Away Goalie GSAx per 60
  awayHdcf60: string;     // Away High Danger Chances For per 60
  awayPP: string;         // Away Power Play Percentage
  awayPK: string;         // Away Penalty Kill Percentage
  awayTimesShorthanded: string;  // Away Times Shorthanded Per Game
  teamAName?: string;
  teamBName?: string;
};

type Props = {
  stats: HockeyStats;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function HockeyEstimator({ stats, onChange }: Props) {
  const InputWithTeamLabel = ({
    name,
    value,
    placeholder,
    teamName,
    step = "0.01"
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
      <h4 className="grid-header">Home Team</h4>
      <h4 className="grid-header">Away Team</h4>

      <span>xGF/60 (Expected Goals For)</span>
      <InputWithTeamLabel
        name="homeXgf60"
        value={stats.homeXgf60}
        placeholder="2.85"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="awayXgf60"
        value={stats.awayXgf60}
        placeholder="2.70"
        teamName={stats.teamBName}
      />

      <span>xGA/60 (Expected Goals Against)</span>
      <InputWithTeamLabel
        name="homeXga60"
        value={stats.homeXga60}
        placeholder="2.55"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="awayXga60"
        value={stats.awayXga60}
        placeholder="2.80"
        teamName={stats.teamBName}
      />

      <span>GSAx/60 (Goalie Saves Above Exp.)</span>
      <InputWithTeamLabel
        name="homeGsax60"
        value={stats.homeGsax60}
        placeholder="0.15"
        teamName={stats.teamAName}
      />
      <InputWithTeamLabel
        name="awayGsax60"
        value={stats.awayGsax60}
        placeholder="-0.05"
        teamName={stats.teamBName}
      />

      <span>HDCF/60 (High Danger Chances)</span>
      <InputWithTeamLabel
        name="homeHdcf60"
        value={stats.homeHdcf60}
        placeholder="12.5"
        teamName={stats.teamAName}
        step="0.1"
      />
      <InputWithTeamLabel
        name="awayHdcf60"
        value={stats.awayHdcf60}
        placeholder="11.8"
        teamName={stats.teamBName}
        step="0.1"
      />

      <span>PP% (Power Play Percentage)</span>
      <InputWithTeamLabel
        name="homePP"
        value={stats.homePP}
        placeholder="22.5"
        teamName={stats.teamAName}
        step="0.1"
      />
      <InputWithTeamLabel
        name="awayPP"
        value={stats.awayPP}
        placeholder="20.0"
        teamName={stats.teamBName}
        step="0.1"
      />

      <span>PK% (Penalty Kill Percentage)</span>
      <InputWithTeamLabel
        name="homePK"
        value={stats.homePK}
        placeholder="80.5"
        teamName={stats.teamAName}
        step="0.1"
      />
      <InputWithTeamLabel
        name="awayPK"
        value={stats.awayPK}
        placeholder="78.0"
        teamName={stats.teamBName}
        step="0.1"
      />

      <span>Times Shorthanded/Game</span>
      <InputWithTeamLabel
        name="homeTimesShorthanded"
        value={stats.homeTimesShorthanded}
        placeholder="3.2"
        teamName={stats.teamAName}
        step="0.1"
      />
      <InputWithTeamLabel
        name="awayTimesShorthanded"
        value={stats.awayTimesShorthanded}
        placeholder="3.0"
        teamName={stats.teamBName}
        step="0.1"
      />
    </div>
  );
}
