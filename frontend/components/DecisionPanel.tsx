import React from "react";
import type { DecisionResult } from "../utils/decision";

/**
 * DecisionPanel
 * Compact, glanceable view of the shared decision layer for spread/total
 * results: the lean (bet/pass/no-bet), edge vs the fair line, a confidence
 * meter, and a plain-language summary. Mirrors the discipline shown on the MLB
 * result card so every sport reads consistently.
 */

const REC_STYLES: Record<DecisionResult["recommendation"], { label: string; bg: string; fg: string }> = {
  bet: { label: "POSSIBLE EDGE", bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  pass: { label: "PASS", bg: "rgba(245,158,11,0.15)", fg: "#f59e0b" },
  "no-bet": { label: "NO-BET", bg: "rgba(148,163,184,0.15)", fg: "#94a3b8" },
};

const CONF_COLORS = { high: "#22c55e", medium: "#f59e0b", low: "#94a3b8" };

export default function DecisionPanel({
  decision,
  riskFactors = [],
}: {
  decision: DecisionResult;
  riskFactors?: string[];
}) {
  const [showRisks, setShowRisks] = React.useState(false);
  const rec = REC_STYLES[decision.recommendation];
  const confColor = CONF_COLORS[decision.confidenceLabel];

  return (
    <div
      style={{
        marginTop: "0.9rem",
        padding: "0.9rem",
        borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        textAlign: "left",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span
          style={{
            padding: "0.25rem 0.7rem",
            borderRadius: 999,
            background: rec.bg,
            color: rec.fg,
            fontWeight: 700,
            fontSize: "0.8rem",
            letterSpacing: "0.04em",
          }}
        >
          {rec.label}
        </span>
        <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", fontVariantNumeric: "tabular-nums" }}>
          Edge vs fair line:&nbsp;
          <strong style={{ color: decision.edgePct > 0 ? "#22c55e" : "#94a3b8" }}>
            {decision.edgePct > 0 ? "+" : ""}{decision.edgePct.toFixed(1)}%
          </strong>
        </span>
      </div>

      {/* Confidence meter */}
      <div style={{ marginTop: "0.7rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>
          <span>Confidence</span>
          <span style={{ color: confColor, fontWeight: 700, textTransform: "uppercase" }}>{decision.confidenceLabel}</span>
        </div>
        <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{ width: `${Math.max(4, decision.confidence)}%`, height: "100%", background: confColor, transition: "width 0.4s ease" }} />
        </div>
      </div>

      <p style={{ margin: "0.7rem 0 0", fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
        {decision.summary}
      </p>

      {riskFactors.length > 0 && (
        <>
          <button
            onClick={() => setShowRisks((s) => !s)}
            className="btn-ghost btn-sm"
            style={{ marginTop: "0.6rem", fontSize: "0.8rem" }}
            aria-expanded={showRisks}
          >
            {showRisks ? "▲ Hide risk factors" : `▼ Risk factors (${riskFactors.length})`}
          </button>
          {showRisks && (
            <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0, display: "grid", gap: "0.4rem", fontSize: "0.82rem", color: "rgba(255,255,255,0.75)" }}>
              {riskFactors.map((r, i) => (
                <li key={i}>⚠️ {r}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
