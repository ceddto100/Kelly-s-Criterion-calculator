import React, { useMemo, useState } from "react";
import { projectMLBGame, type MLBProjectionInput, type WindDirection } from "../utils/mlbProjection";
import ProjectionResultCard from "../components/ProjectionResultCard";

/**
 * MLBEstimator
 * Self-contained MLB over/under + moneyline projector. Holds its own form
 * state, runs the explainable run-projection engine client-side, and renders a
 * modern result card. Kept separate from the football/basketball/hockey flow so
 * baseball's richer inputs (pitching, bullpen, park, weather, lineup) don't
 * complicate the other sports.
 *
 * Inputs follow the engine's "manual inputs + sensible defaults" contract: only
 * a couple of fields are required to get a projection; anything omitted falls
 * back to neutral and lowers the confidence score.
 */

type Props = {
  onUseInKelly?: (probabilityPercent: number, label: string) => void;
};

type FieldState = Record<string, string>;

const num = (v: string): number | undefined => {
  if (v === undefined || v.trim() === "") return undefined;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

const EXAMPLE: FieldState = {
  homeName: "Dodgers",
  awayName: "Rockies",
  bookTotal: "9.5",
  homeMoneyline: "-160",
  awayMoneyline: "140",
  homeWrc: "112",
  awayWrc: "94",
  homeOps: "0.760",
  awayOps: "0.700",
  homeRecentRpg: "5.1",
  awayRecentRpg: "3.9",
  homeSierra: "3.40",
  homeFip: "3.55",
  awaySierra: "4.70",
  awayFip: "4.85",
  homeStarterConfirmed: "yes",
  awayStarterConfirmed: "yes",
  homeBpFip: "3.70",
  awayBpFip: "4.40",
  homeBpIp1: "1.0",
  awayBpIp1: "3.5",
  homeCloser: "yes",
  awayCloser: "yes",
  parkFactor: "104",
  temperatureF: "78",
  windSpeedMph: "8",
  windDirection: "out",
  roofClosed: "no",
  homeLineupConfirmed: "yes",
  awayLineupConfirmed: "yes",
  homeStarsOut: "0",
  awayStarsOut: "0",
};

export default function MLBEstimator({ onUseInKelly }: Props) {
  const [f, setF] = useState<FieldState>({ windDirection: "out" });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof projectMLBGame> | null>(null);

  const set = (name: string, value: string) => setF((prev) => ({ ...prev, [name]: value }));
  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    set(e.target.name, e.target.value);

  const yes = (v?: string) => (v === undefined ? undefined : v === "yes");

  const canCalculate = useMemo(() => {
    // Need at least one offense signal per team and the book total to lean.
    const homeOff = num(f.homeWrc) ?? num(f.homeOps) ?? num(f.homeRecentRpg);
    const awayOff = num(f.awayWrc) ?? num(f.awayOps) ?? num(f.awayRecentRpg);
    return homeOff !== undefined && awayOff !== undefined;
  }, [f]);

  const handleCalculate = () => {
    const input: MLBProjectionInput = {
      home: {
        name: f.homeName?.trim() || "Home",
        offense: {
          wrcPlus: num(f.homeWrc),
          ops: num(f.homeOps),
          recentRunsPerGame: num(f.homeRecentRpg),
        },
        starter: {
          siera: num(f.homeSierra),
          fip: num(f.homeFip),
          confirmed: yes(f.homeStarterConfirmed),
        },
        bullpen: {
          fip: num(f.homeBpFip),
          inningsLast1d: num(f.homeBpIp1),
          inningsLast3d: num(f.homeBpIp3),
          closerAvailable: yes(f.homeCloser),
        },
        lineup: {
          confirmed: yes(f.homeLineupConfirmed),
          starsOut: num(f.homeStarsOut),
          platoonAdvantage: yes(f.homePlatoon),
        },
      },
      away: {
        name: f.awayName?.trim() || "Away",
        offense: {
          wrcPlus: num(f.awayWrc),
          ops: num(f.awayOps),
          recentRunsPerGame: num(f.awayRecentRpg),
        },
        starter: {
          siera: num(f.awaySierra),
          fip: num(f.awayFip),
          confirmed: yes(f.awayStarterConfirmed),
        },
        bullpen: {
          fip: num(f.awayBpFip),
          inningsLast1d: num(f.awayBpIp1),
          inningsLast3d: num(f.awayBpIp3),
          closerAvailable: yes(f.awayCloser),
        },
        lineup: {
          confirmed: yes(f.awayLineupConfirmed),
          starsOut: num(f.awayStarsOut),
          platoonAdvantage: yes(f.awayPlatoon),
        },
      },
      environment: {
        parkFactor: num(f.parkFactor),
        temperatureF: num(f.temperatureF),
        windSpeedMph: num(f.windSpeedMph),
        windDirection: (f.windDirection as WindDirection) || undefined,
        roofClosed: yes(f.roofClosed),
      },
      line: {
        total: num(f.bookTotal),
        homeMoneyline: num(f.homeMoneyline),
        awayMoneyline: num(f.awayMoneyline),
      },
    };
    setResult(projectMLBGame(input));
  };

  return (
    <div className="mlb-estimator">
      {/* Matchup + line */}
      <div className="stats-grid" style={{ marginBottom: "1rem" }}>
        <h4 className="grid-header">Matchup</h4>
        <h4 className="grid-header">Home</h4>
        <h4 className="grid-header">Away</h4>

        <span>Team name</span>
        <input className="input-field" name="homeName" value={f.homeName || ""} onChange={onChange} placeholder="Home" />
        <input className="input-field" name="awayName" value={f.awayName || ""} onChange={onChange} placeholder="Away" />
      </div>

      <div className="spread-input-section">
        <label className="spread-label">{f.bookTotal ? "✓" : "1"} Sportsbook Total (Over/Under)</label>
        <input
          type="number"
          step="0.5"
          className="input-field spread-field"
          name="bookTotal"
          value={f.bookTotal || ""}
          onChange={onChange}
          placeholder="e.g., 8.5"
        />
      </div>

      <div style={{ textAlign: "center", margin: "0.75rem 0 1rem" }}>
        <button className="btn-ghost btn-sm" onClick={() => { setF({ ...EXAMPLE }); setResult(null); }}>
          ⚡ Load Example Matchup
        </button>
      </div>

      {/* Core: offense + starter */}
      <SectionLabel>Offense (wRC+ best; 100 = avg)</SectionLabel>
      <div className="stats-grid">
        <h4 className="grid-header">Metric</h4>
        <h4 className="grid-header">Home</h4>
        <h4 className="grid-header">Away</h4>

        <span>wRC+ (100 = avg)</span>
        <input className="input-field" type="number" name="homeWrc" value={f.homeWrc || ""} onChange={onChange} placeholder="105" />
        <input className="input-field" type="number" name="awayWrc" value={f.awayWrc || ""} onChange={onChange} placeholder="98" />

        <span>OPS (optional)</span>
        <input className="input-field" type="number" step="0.001" name="homeOps" value={f.homeOps || ""} onChange={onChange} placeholder="0.740" />
        <input className="input-field" type="number" step="0.001" name="awayOps" value={f.awayOps || ""} onChange={onChange} placeholder="0.710" />

        <span>Recent R/G (last ~15)</span>
        <input className="input-field" type="number" step="0.1" name="homeRecentRpg" value={f.homeRecentRpg || ""} onChange={onChange} placeholder="4.8" />
        <input className="input-field" type="number" step="0.1" name="awayRecentRpg" value={f.awayRecentRpg || ""} onChange={onChange} placeholder="4.1" />
      </div>

      <SectionLabel>Starting Pitcher (FIP/SIERA preferred over ERA)</SectionLabel>
      <div className="stats-grid">
        <h4 className="grid-header">Metric</h4>
        <h4 className="grid-header">Home SP</h4>
        <h4 className="grid-header">Away SP</h4>

        <span>SIERA</span>
        <input className="input-field" type="number" step="0.01" name="homeSierra" value={f.homeSierra || ""} onChange={onChange} placeholder="3.80" />
        <input className="input-field" type="number" step="0.01" name="awaySierra" value={f.awaySierra || ""} onChange={onChange} placeholder="4.20" />

        <span>FIP</span>
        <input className="input-field" type="number" step="0.01" name="homeFip" value={f.homeFip || ""} onChange={onChange} placeholder="3.90" />
        <input className="input-field" type="number" step="0.01" name="awayFip" value={f.awayFip || ""} onChange={onChange} placeholder="4.30" />

        <span>Confirmed starter?</span>
        <YesNo name="homeStarterConfirmed" value={f.homeStarterConfirmed} onChange={onChange} />
        <YesNo name="awayStarterConfirmed" value={f.awayStarterConfirmed} onChange={onChange} />
      </div>

      <button
        className="btn-ghost btn-sm"
        style={{ width: "100%", margin: "1rem 0" }}
        onClick={() => setShowAdvanced((s) => !s)}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? "▲ Hide bullpen, ballpark, weather & lineup" : "▼ Add bullpen, ballpark, weather & lineup (recommended)"}
      </button>

      {showAdvanced && (
        <>
          <SectionLabel>Bullpen (quality + recent usage)</SectionLabel>
          <div className="stats-grid">
            <h4 className="grid-header">Metric</h4>
            <h4 className="grid-header">Home</h4>
            <h4 className="grid-header">Away</h4>

            <span>Bullpen FIP</span>
            <input className="input-field" type="number" step="0.01" name="homeBpFip" value={f.homeBpFip || ""} onChange={onChange} placeholder="3.95" />
            <input className="input-field" type="number" step="0.01" name="awayBpFip" value={f.awayBpFip || ""} onChange={onChange} placeholder="4.10" />

            <span>Relief IP last 1 day</span>
            <input className="input-field" type="number" step="0.1" name="homeBpIp1" value={f.homeBpIp1 || ""} onChange={onChange} placeholder="1.0" />
            <input className="input-field" type="number" step="0.1" name="awayBpIp1" value={f.awayBpIp1 || ""} onChange={onChange} placeholder="3.0" />

            <span>Relief IP last 3 days</span>
            <input className="input-field" type="number" step="0.1" name="homeBpIp3" value={f.homeBpIp3 || ""} onChange={onChange} placeholder="6.0" />
            <input className="input-field" type="number" step="0.1" name="awayBpIp3" value={f.awayBpIp3 || ""} onChange={onChange} placeholder="10.0" />

            <span>Closer available?</span>
            <YesNo name="homeCloser" value={f.homeCloser} onChange={onChange} />
            <YesNo name="awayCloser" value={f.awayCloser} onChange={onChange} />
          </div>

          <SectionLabel>Ballpark & Weather (applies to both teams)</SectionLabel>
          <div className="stats-grid">
            <h4 className="grid-header">Metric</h4>
            <h4 className="grid-header">Value</h4>
            <h4 className="grid-header">&nbsp;</h4>

            <span>Run park factor (100 = neutral)</span>
            <input className="input-field" type="number" name="parkFactor" value={f.parkFactor || ""} onChange={onChange} placeholder="100" />
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", alignSelf: "center" }}>Coors ~112</span>

            <span>Temperature (°F)</span>
            <input className="input-field" type="number" name="temperatureF" value={f.temperatureF || ""} onChange={onChange} placeholder="70" />
            <span>&nbsp;</span>

            <span>Wind speed (mph)</span>
            <input className="input-field" type="number" name="windSpeedMph" value={f.windSpeedMph || ""} onChange={onChange} placeholder="8" />
            <span>&nbsp;</span>

            <span>Wind direction</span>
            <select className="input-field" name="windDirection" value={f.windDirection || "out"} onChange={onChange}>
              <option value="out">Blowing out</option>
              <option value="in">Blowing in</option>
              <option value="crosswind">Crosswind</option>
              <option value="none">None / calm</option>
            </select>
            <span>&nbsp;</span>

            <span>Roof closed / dome?</span>
            <YesNo name="roofClosed" value={f.roofClosed} onChange={onChange} />
            <span>&nbsp;</span>
          </div>

          <SectionLabel>Lineup</SectionLabel>
          <div className="stats-grid">
            <h4 className="grid-header">Metric</h4>
            <h4 className="grid-header">Home</h4>
            <h4 className="grid-header">Away</h4>

            <span>Lineup confirmed?</span>
            <YesNo name="homeLineupConfirmed" value={f.homeLineupConfirmed} onChange={onChange} />
            <YesNo name="awayLineupConfirmed" value={f.awayLineupConfirmed} onChange={onChange} />

            <span>Star hitters resting/out</span>
            <input className="input-field" type="number" name="homeStarsOut" value={f.homeStarsOut || ""} onChange={onChange} placeholder="0" />
            <input className="input-field" type="number" name="awayStarsOut" value={f.awayStarsOut || ""} onChange={onChange} placeholder="0" />
          </div>

          <SectionLabel>Moneyline (optional — enables ML lean)</SectionLabel>
          <div className="stats-grid">
            <h4 className="grid-header">Metric</h4>
            <h4 className="grid-header">Home</h4>
            <h4 className="grid-header">Away</h4>

            <span>Moneyline (American)</span>
            <input className="input-field" type="number" name="homeMoneyline" value={f.homeMoneyline || ""} onChange={onChange} placeholder="-140" />
            <input className="input-field" type="number" name="awayMoneyline" value={f.awayMoneyline || ""} onChange={onChange} placeholder="+120" />
          </div>
        </>
      )}

      {!canCalculate && (
        <p style={{ textAlign: "center", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", marginTop: "1rem" }}>
          Enter at least one offense stat (wRC+, OPS, or recent R/G) for each team to project.
        </p>
      )}

      <button className="btn-primary btn-calculate" onClick={handleCalculate} disabled={!canCalculate}>
        Run Projection
      </button>

      {result && <ProjectionResultCard result={result} onUseInKelly={onUseInKelly} />}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        margin: "1.25rem 0 0.6rem",
        fontSize: "0.78rem",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "rgba(255,255,255,0.55)",
      }}
    >
      {children}
    </h4>
  );
}

function YesNo({
  name,
  value,
  onChange,
}: {
  name: string;
  value?: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select className="input-field" name={name} value={value || ""} onChange={onChange}>
      <option value="">Unknown</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );
}
