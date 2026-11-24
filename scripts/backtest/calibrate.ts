/* Learn each sport's market trust from history.
 *
 * For every completed game in backtest.json (built by build_datasets.py) this
 * grades the production model against the closing market and fits how much of
 * the model's disagreement with the market actually turned into results:
 *   spreads (NFL, NBA): P(home covers) = Φ(w × disagreement / σ)
 *   totals (NHL):       P(over) = fair + w × (model − fair), fair = de-vigged close
 * The raw fit is noisy, so it is shrunk toward 0 by a skeptical prior
 * N(0, PRIOR_SD²) and clamped to [0, MAX_TRUST]. A sport therefore earns trust
 * (and picks) only as its history keeps showing an edge, and loses it if the
 * edge fades. Each run moves a value at most MAX_STEP from the current one.
 *
 * Usage: cd mcp-server && npx tsx ../scripts/backtest/calibrate.ts ../scripts/backtest/.cache/backtest.json [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { estimateBasketballProbability, estimateFootballProbability, normCdf } from '../../mcp-server/src/utils/calculations.ts';
import { calculateNHLProjection } from '../../mcp-server/src/utils/nhl.ts';
import { fairImpliedPct, noPushProbability } from '../../mcp-server/src/utils/decision.ts';
import { CALIBRATION } from '../../mcp-server/src/config/calibration.generated.ts';

const PRIOR_SD = 0.3;   // before evidence: a stats model is usually worth between −0.6 and +0.6 of its disagreement
const MAX_TRUST = 0.6;  // never let the model outweigh the market
const MAX_STEP = 0.1;   // per run, so one hot or cold week cannot swing stakes
const NFL_FROM = 2018, NBA_FROM = 2026;

const args = process.argv.slice(2);
const data = JSON.parse(readFileSync(args.find(a => !a.startsWith('--')) ?? 'scripts/backtest/.cache/backtest.json', 'utf8'));
const write = args.includes('--write');

type Obs = (w: number) => number; // log-likelihood contribution of one game at weight w
function fit(obs: Obs[]) {
  const grid: [number, number][] = [];
  for (let i = 0; i <= 500; i++) { const w = -1 + i * 0.005; grid.push([w, obs.reduce((s, f) => s + f(w), 0)]); }
  const [wHat, llMax] = grid.reduce((b, x) => (x[1] > b[1] ? x : b));
  // curvature at the optimum -> standard error
  const h = 0.02, f = (w: number) => obs.reduce((s, o) => s + o(w), 0);
  const d2 = (f(wHat + h) - 2 * llMax + f(wHat - h)) / (h * h);
  const se = d2 < 0 ? Math.sqrt(-1 / d2) : Infinity;
  const postVar = 1 / (1 / PRIOR_SD ** 2 + 1 / se ** 2);
  const posterior = postVar * (wHat / se ** 2);
  return { weight: round(wHat), se: round(se), posterior: round(posterior), games: obs.length };
}
const round = (v: number) => Math.round(v * 1000) / 1000;
const logP = (p: number) => Math.log(Math.min(1 - 1e-9, Math.max(1e-9, p)));

function spreadObs(sport: 'NFL' | 'NBA', rows: any[]): Obs[] {
  const out: Obs[] = [];
  for (const g of rows) {
    const cover = g.result + g.spread; if (cover === 0) continue;
    const venue = g.neutral ? 'neutral' : 'home';
    const stats: any = { teamPPG: g.h.ppg, teamAllowed: g.h.allowed, opponentPPG: g.a.ppg, opponentAllowed: g.a.allowed };
    let r;
    if (sport === 'NBA') {
      Object.assign(stats, { teamPace: g.h.pace, opponentPace: g.a.pace });
      r = estimateBasketballProbability(stats, g.spread, venue, true, { gamesPlayed: g.n });
    } else {
      if (g.h.off !== undefined && g.a.off !== undefined) Object.assign(stats, { teamOffYards: g.h.off, teamDefYards: g.h.dfn, opponentOffYards: g.a.off, opponentDefYards: g.a.dfn });
      r = estimateFootballProbability(stats, g.spread, venue, true, { gamesPlayed: g.n });
    }
    const z = (r.disagreement ?? 0) / r.sigma, y = cover > 0;
    out.push(w => logP(y ? normCdf(w * z) : 1 - normCdf(w * z)));
  }
  return out;
}

function nhlObs(rows: any[]): Obs[] {
  const conv = (s: any) => ({ xGF60: s.xgf60, xGA60: s.xga60, GSAx60: s.gsax60, HDCF60: 0, PP: 0, PK: 0, timesShorthandedPerGame: 0 });
  const out: Obs[] = [];
  for (const g of rows) {
    if (g.line == null || g.overOdds == null || g.underOdds == null || g.total === g.line) continue;
    const p = calculateNHLProjection(conv(g.h), conv(g.a), g.line);
    const model = noPushProbability(p.overProbability, p.underProbability) / 100;
    const fair = fairImpliedPct(g.overOdds, g.underOdds) / 100, y = g.total > g.line;
    out.push(w => { const q = fair + w * (model - fair); return logP(y ? q : 1 - q); });
  }
  return out;
}

const fits = {
  NFL: fit(spreadObs('NFL', data.nfl.filter((g: any) => g.season >= NFL_FROM))),
  NBA: fit(spreadObs('NBA', data.nba.filter((g: any) => g.season >= NBA_FROM))),
  NHL: fit(nhlObs(data.nhl)),
};
const next: Record<string, number> = {};
for (const [sport, f] of Object.entries(fits)) {
  const current = (CALIBRATION as any)[sport]?.marketTrust ?? 0;
  const target = Math.min(MAX_TRUST, Math.max(0, f.posterior));
  next[sport] = round(Math.min(current + MAX_STEP, Math.max(current - MAX_STEP, target)));
  console.log(`${sport}: fitted weight ${f.weight} ± ${f.se} over ${f.games} games -> shrunk ${f.posterior} -> marketTrust ${current} => ${next[sport]}`);
}

if (write) {
  const out = {
    fittedAt: new Date().toISOString().slice(0, 10),
    method: `posterior mean under N(0, ${PRIOR_SD}^2), clamped to [0, ${MAX_TRUST}], step <= ${MAX_STEP} per run`,
    NFL: { marketTrust: next.NFL, fit: { ...fits.NFL, window: `${NFL_FROM}-present` } },
    NBA: { marketTrust: next.NBA, fit: { ...fits.NBA, window: `${NBA_FROM - 1}-${String(NBA_FROM).slice(2)} season to present` } },
    NHL: { marketTrust: next.NHL, fit: { ...fits.NHL, window: 'games with a fresh pre-game snapshot and an ESPN closing price' } },
  };
  writeFileSync(new URL('../../mcp-server/src/config/calibration.generated.ts', import.meta.url),
    `// Generated by scripts/backtest/calibrate.ts — do not edit by hand.\n// Learned from history: see scripts/backtest/README.md.\nexport const CALIBRATION = ${JSON.stringify(out, null, 2)} as const;\n`);
  console.log('wrote mcp-server/src/config/calibration.generated.ts');
}
