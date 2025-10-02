// /lib/coverProbabilityNBA.ts
// Deterministic models for BASKETBALL: Base (point diff) + Hybrid (adds FG%, REB, TOV)

function normCdf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z);
  return 0.5 * (1 + sign * y);
}

/** Optional: let σ scale gently with market total (NBA). */
export function sigmaFromNBATotal(total: number) {
  // e.g., Total 228.5 → σ ≈ 8.5 + 0.015*228.5 ≈ 11.9
  return 8.5 + 0.015 * total;
}

export type NBABaseInputs = {
  teamPPG: number;
  teamPAPG: number;
  oppPPG: number;
  oppPAPG: number;
  spread: number;       // your team’s line (fav = negative)
  homeCourt?: number;   // default 0 (NBA typical ~+2.0)
  sigma?: number;       // default 12.0 (11–12.5 typical)
};

export function coverProbabilityNBA_Base({
  teamPPG, teamPAPG, oppPPG, oppPAPG, spread,
  homeCourt = 0, sigma = 12.0
}: NBABaseInputs) {
  if ([teamPPG, teamPAPG, oppPPG, oppPAPG, spread].some(v => Number.isNaN(v))) {
    throw new Error("Invalid NBA inputs (base)");
  }

  const teamDiff = teamPPG - teamPAPG;
  const oppDiff  = oppPPG - oppPAPG;
  const predMargin = (teamDiff - oppDiff) / 2 + homeCourt;

  const Z = (predMargin + spread) / sigma;
  const probCover = normCdf(Z);

  return { teamDiff, oppDiff, predMargin, Z, probCover };
}

/* ---------------- Hybrid model (FG%, Rebounds, Turnovers) ---------------- */

export type NBAHybridInputs = NBABaseInputs & {
  teamFGPct: number;       // e.g., 48.7
  oppFGPct: number;        // e.g., 46.5
  teamRebMargin: number;   // boards per game (+/-)
  oppRebMargin: number;
  teamTovMargin: number;   // turnovers per game (+/-)
  oppTovMargin: number;
  wFgPct?: number;         // default 0.9 pts per 1% FG
  wReb?: number;           // default 0.35 pts per rebound
  wTov?: number;           // default 0.6 pts per turnover
};

export function coverProbabilityNBA_Hybrid({
  teamPPG, teamPAPG, oppPPG, oppPAPG, spread,
  homeCourt = 2.0, sigma = 12.0,
  teamFGPct, oppFGPct,
  teamRebMargin, oppRebMargin,
  teamTovMargin, oppTovMargin,
  wFgPct = 0.9, wReb = 0.35, wTov = 0.6
}: NBAHybridInputs) {
  const base = coverProbabilityNBA_Base({
    teamPPG, teamPAPG, oppPPG, oppPAPG, spread, homeCourt, sigma
  });

  const fgPctDiff = (teamFGPct - oppFGPct);
  const rebDiff   = (teamRebMargin - oppRebMargin);
  const tovDiff   = (teamTovMargin - oppTovMargin);

  const tilt = wFgPct * fgPctDiff + wReb * rebDiff + wTov * tovDiff;

  const predMargin = base.predMargin + tilt;
  const Z = (predMargin + spread) / sigma;
  const probCover = normCdf(Z);

  return { ...base, fgPctDiff, rebDiff, tovDiff, tilt, predMargin, Z, probCover };
}
