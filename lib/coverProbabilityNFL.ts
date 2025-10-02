// /lib/coverProbabilityNFL.ts
// Deterministic cover-probability model for FOOTBALL (NFL/CFB-compatible).

function normCdf(x: number): number {
  // Abramowitz–Stegun approximation of standard normal CDF
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
        a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * z);
  const y = 1 - (((((a5*t + a4)*t) + a3)*t + a2)*t + a1)*t*Math.exp(-z*z);
  return 0.5 * (1 + sign * y);
}

export type NFLInputs = {
  teamPF: number;   // your team points per game
  teamPA: number;   // your team points allowed per game
  oppPF: number;    // opponent points per game
  oppPA: number;    // opponent points allowed per game
  spread: number;   // line for YOUR team (fav = negative, e.g., -3.5)
  homeField?: number; // default 0 (NFL typical ~+1.5 if home)
  sigma?: number;     // margin std dev (NFL ~13.5)
};

export function coverProbabilityNFL({
  teamPF, teamPA, oppPF, oppPA, spread,
  homeField = 0, sigma = 13.5
}: NFLInputs) {
  if ([teamPF, teamPA, oppPF, oppPA, spread].some(v => Number.isNaN(v))) {
    throw new Error("Invalid NFL inputs");
  }

  const teamDiff = teamPF - teamPA;
  const oppDiff  = oppPF  - oppPA;

  // Predict margin for YOUR team using blended point differential + home field
  const predMargin = (teamDiff - oppDiff) / 2 + homeField;

  // To cover -3.5 you must win by > 3.5 → compare to -spread
  const Z = (predMargin + spread) / sigma;
  const probCover = normCdf(Z);

  return { teamDiff, oppDiff, predMargin, Z, probCover };
}
