import React, { useState } from "react";
import type { MLBProjectionResult, Lean } from "../utils/mlbProjection";

/**
 * ProjectionResultCard
 * A modern, glanceable result card for a Betgistics projection. Designed so a
 * user understands the result in under 10 seconds: matchup, book line,
 * projection, edge, lean, confidence — with drivers and risk factors tucked
 * behind an expandable details panel. Advanced numbers are not dumped up front.
 *
 * Currently renders MLB results (totals + moneyline). The shape is generic
 * enough to extend to other sports later.
 */

type Props = {
  result: MLBProjectionResult;
  onUseInKelly?: (probabilityPercent: number, label: string) => void;
};

const LEAN_STYLES: Record<Lean, { label: string; bg: string; fg: string }> = {
  over: { label: "OVER", bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  under: { label: "UNDER", bg: "rgba(59,130,246,0.15)", fg: "#3b82f6" },
  home: { label: "HOME ML", bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  away: { label: "AWAY ML", bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  "no-bet": { label: "NO-BET", bg: "rgba(148,163,184,0.15)", fg: "#94a3b8" },
};

const CONFIDENCE_COLORS = {
  high: "#22c55e",
  medium: "#f59e0b",
  low: "#94a3b8",
};

function LeanBadge({ lean }: { lean: Lean }) {
  const s = LEAN_STYLES[lean];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.25rem 0.7rem",
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        fontWeight: 700,
        fontSize: "0.8rem",
        letterSpacing: "0.04em",
      }}
    >
      {s.label}
    </span>
  );
}

function ConfidenceMeter({ score, label }: { score: number; label: "low" | "medium" | "high" }) {
  const color = CONFIDENCE_COLORS[label];
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
        <span>Confidence</span>
        <span style={{ color, fontWeight: 700, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${Math.max(4, score)}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

export default function ProjectionResultCard({ result, onUseInKelly }: Props) {
  const [market, setMarket] = useState<"total" | "moneyline">("total");
  const [showDetails, setShowDetails] = useState(false);

  const { totals, moneyline } = result;
  const isTotal = market === "total";
  const lean: Lean = isTotal ? totals.lean : moneyline.lean;
  const confidence = isTotal ? totals.confidence : moneyline.confidence;
  const confLabel = isTotal ? totals.confidenceLabel : moneyline.confidenceLabel;
  const isNoBet = lean === "no-bet";

  const handleUseInKelly = () => {
    if (!onUseInKelly) return;
    if (isTotal) {
      const prob = lean === "under" ? totals.underProbability : totals.overProbability;
      onUseInKelly(prob, `${result.matchup} — ${lean === "under" ? "Under" : "Over"} ${totals.bookTotal ?? totals.projectedTotal}`);
    } else {
      const prob = lean === "away" ? moneyline.awayWinProbability : moneyline.homeWinProbability;
      const side = lean === "away" ? result.awayTeam : result.homeTeam;
      onUseInKelly(prob, `${result.matchup} — ${side} ML`);
    }
  };

  return (
    <div
      className="projection-card"
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "1.25rem",
        marginTop: "1.25rem",
        boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
      }}
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", color: "#3b82f6", background: "rgba(59,130,246,0.12)", padding: "0.15rem 0.5rem", borderRadius: 6 }}>
              MLB
            </span>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.55)" }}>
              {isTotal ? "Total (Over/Under)" : "Moneyline"}
            </span>
          </div>
          <h3 style={{ margin: "0.4rem 0 0", fontSize: "1.15rem", fontWeight: 700 }}>{result.matchup}</h3>
        </div>
        <ConfidenceMeter score={confidence} label={confLabel} />
      </div>

      {/* Market toggle */}
      <div style={{ display: "flex", gap: 8, margin: "1rem 0" }}>
        {(["total", "moneyline"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            className={`btn-toggle ${market === m ? "active" : ""}`}
            style={{ flex: 1, padding: "0.5rem", borderRadius: 10, fontSize: "0.85rem" }}
          >
            {m === "total" ? "Total" : "Moneyline"}
          </button>
        ))}
      </div>

      {/* No-bet banner */}
      {isNoBet && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(148,163,184,0.1)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 12,
            padding: "0.7rem 0.9rem",
            marginBottom: "1rem",
            fontSize: "0.85rem",
            color: "rgba(255,255,255,0.8)",
          }}
        >
          🛑 <strong>No-bet.</strong>&nbsp;The projection is too close to the line (or data is too thin) to claim an edge. A disciplined pass is a smart result.
        </div>
      )}

      {/* Hero: projection vs line */}
      {isTotal ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "center" }}>
          <HeroStat label="Betgistics Total" value={totals.projectedTotal.toFixed(1)} accent />
          <HeroStat label="Sportsbook" value={totals.bookTotal !== null ? totals.bookTotal.toFixed(1) : "—"} />
          <HeroStat
            label="Edge"
            value={totals.edgeRuns !== null ? `${totals.edgeRuns > 0 ? "+" : ""}${totals.edgeRuns.toFixed(1)}` : "—"}
            badge={<LeanBadge lean={totals.lean} />}
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, textAlign: "center" }}>
          <HeroStat label={`${result.awayTeam} win`} value={`${moneyline.awayWinProbability.toFixed(0)}%`} />
          <HeroStat label={`${result.homeTeam} win`} value={`${moneyline.homeWinProbability.toFixed(0)}%`} accent />
          <HeroStat
            label="Best edge"
            value={
              moneyline.homeEdge !== null && moneyline.awayEdge !== null
                ? `${Math.max(moneyline.homeEdge, moneyline.awayEdge) > 0 ? "+" : ""}${Math.max(moneyline.homeEdge, moneyline.awayEdge).toFixed(1)}%`
                : "—"
            }
            badge={<LeanBadge lean={moneyline.lean} />}
          />
        </div>
      )}

      {/* Projected score line */}
      <div style={{ textAlign: "center", marginTop: "0.9rem", fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
        Projected score:&nbsp;
        <strong style={{ color: "#fff" }}>
          {result.awayTeam} {totals.projectedAwayRuns.toFixed(1)} — {totals.projectedHomeRuns.toFixed(1)} {result.homeTeam}
        </strong>
      </div>

      {/* Use in Kelly */}
      {!isNoBet && onUseInKelly && (
        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <button className="btn-primary" onClick={handleUseInKelly}>
            Use in Kelly Calculator →
          </button>
        </div>
      )}

      {/* Details toggle */}
      <button
        onClick={() => setShowDetails((s) => !s)}
        className="btn-ghost btn-sm"
        style={{ width: "100%", marginTop: "1rem", fontSize: "0.85rem" }}
        aria-expanded={showDetails}
      >
        {showDetails ? "▲ Hide reasons & risks" : "▼ Why this projection? (drivers & risks)"}
      </button>

      {showDetails && (
        <div style={{ marginTop: "0.9rem", display: "grid", gap: "1rem" }}>
          <DetailSection title="Main drivers" emptyText="No single factor stands out from average.">
            {result.drivers.map((d, i) => (
              <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: "rgba(255,255,255,0.85)" }}>{d.factor}</span>
                <span style={{ color: "rgba(255,255,255,0.6)", fontVariantNumeric: "tabular-nums" }}>{d.detail}</span>
              </li>
            ))}
          </DetailSection>

          <DetailSection title="Risk factors" emptyText="No major risk flags detected from the inputs provided.">
            {result.riskFactors.map((r, i) => (
              <li key={i} style={{ color: "rgba(255,255,255,0.75)" }}>⚠️ {r}</li>
            ))}
          </DetailSection>

          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.45)" }}>
            Data completeness: {(result.dataCompleteness * 100).toFixed(0)}%
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p style={{ marginTop: "1rem", marginBottom: 0, fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", lineHeight: 1.5 }}>
        {result.disclaimer}
      </p>
    </div>
  );
}

function HeroStat({
  label,
  value,
  accent,
  badge,
}: {
  label: string;
  value: string;
  accent?: boolean;
  badge?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: accent ? "rgba(59,130,246,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${accent ? "rgba(59,130,246,0.3)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 14,
        padding: "0.8rem 0.5rem",
      }}
    >
      <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.55)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 800, color: accent ? "#60a5fa" : "#fff", fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      {badge && <div style={{ marginTop: 6 }}>{badge}</div>}
    </div>
  );
}

function DetailSection({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode[];
}) {
  const hasItems = React.Children.toArray(children).length > 0;
  return (
    <div>
      <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "rgba(255,255,255,0.55)" }}>
        {title}
      </h4>
      {hasItems ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.45rem", fontSize: "0.85rem" }}>
          {children}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>{emptyText}</p>
      )}
    </div>
  );
}
