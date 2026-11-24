/**
 * How much of the model's disagreement with the market turns into results.
 *
 * Shared by the weekly calibration (scripts/backtest/calibrate.ts) and the live
 * tracker (graded projections). Each graded game contributes a log-likelihood
 * as a function of the trust weight w:
 *   spreads: P(home covers) = fairHome + Φ(w × disagreement / σ) − ½
 *   totals:  P(over)        = fairOver + w × (modelOver − fairOver)
 * w = 0 means the market already knew everything the model knew; w = 1 means
 * the model alone was right. The maximum-likelihood w and its standard error
 * come from a grid search and the curvature at the optimum.
 */
import { normCdf } from './calculations.js';

/** Log-likelihood contribution of one game at trust weight w. */
export type TrustObs = (w: number) => number;

export interface TrustFit {
  weight: number;
  se: number;
  games: number;
}

const logP = (p: number) => Math.log(Math.min(1 - 1e-9, Math.max(1e-9, p)));
const round = (v: number) => Math.round(v * 1000) / 1000;

/** One graded spread game. z = disagreement / σ; fairHome in [0, 1]. */
export function spreadObs(z: number, homeCovered: boolean, fairHome = 0.5): TrustObs {
  return (w) => {
    const q = Math.min(0.999, Math.max(0.001, fairHome + normCdf(w * z) - 0.5));
    return logP(homeCovered ? q : 1 - q);
  };
}

/** One graded total. modelOver and fairOver are push-free, in [0, 1]. */
export function totalObs(modelOver: number, fairOver: number, wentOver: boolean): TrustObs {
  return (w) => {
    const q = fairOver + w * (modelOver - fairOver);
    return logP(wentOver ? q : 1 - q);
  };
}

/** Maximum-likelihood trust weight over w ∈ [−1, 1.5]. */
export function fitTrust(obs: TrustObs[]): TrustFit {
  if (obs.length === 0) return { weight: 0, se: Infinity, games: 0 };
  const f = (w: number) => obs.reduce((s, o) => s + o(w), 0);
  let wHat = 0, llMax = -Infinity;
  for (let i = 0; i <= 500; i++) {
    const w = -1 + i * 0.005;
    const ll = f(w);
    if (ll > llMax) { llMax = ll; wHat = w; }
  }
  const h = 0.02;
  const d2 = (f(wHat + h) - 2 * llMax + f(wHat - h)) / (h * h);
  const se = d2 < 0 ? Math.sqrt(-1 / d2) : Infinity;
  return { weight: round(wHat), se: Number.isFinite(se) ? round(se) : se, games: obs.length };
}
