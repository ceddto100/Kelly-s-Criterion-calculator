/* Old-vs-new validation of the production math on historical games.
 *
 * Runs the SHIPPED modules (calculations, nhl, marketPricing) over the datasets
 * built by build_datasets.py and prints, per sport:
 *   - bets the daily-picks rule would place (probability above the -110
 *     break-even), their record, units at -110 and underdog/under share;
 *   - Brier score and log-loss of the line probabilities for EVERY game
 *     (a coin flip scores 0.2500 / 0.6931 — lower is better).
 * "OLD" reproduces the pre-November-2026 formulas for comparison.
 *
 * Usage:  cd mcp-server && npx tsx ../scripts/backtest/validate.ts ../scripts/backtest/.cache/backtest.json
 */
import { readFileSync } from 'node:fs';
import { estimateBasketballProbability, estimateFootballProbability, coverProbability, normCdf } from '../../mcp-server/src/utils/calculations.ts';
import { calculateNHLProjection } from '../../mcp-server/src/utils/nhl.ts';
import { priceSpread } from '../../mcp-server/src/utils/marketPricing.ts';

const data = JSON.parse(readFileSync(process.argv[2] ?? 'scripts/backtest/.cache/backtest.json', 'utf8'));
const BREAK_EVEN = 100 * 110 / 210;
type Bet = { win: boolean; dog: boolean; p: number };

function bets(label: string, list: Bet[], games: number) {
  const w = list.filter(b => b.win).length, l = list.length - w;
  const dog = list.filter(b => b.dog).length;
  const p = list.reduce((s, b) => s + b.p, 0) / Math.max(1, list.length);
  console.log(`  ${label.padEnd(30)} bets ${String(list.length).padStart(4)}/${games}  W-L ${w}-${l} (${(100 * w / Math.max(1, w + l)).toFixed(1)}%)  units ${(w * 100 / 110 - l).toFixed(1)}  underdog/under ${(100 * dog / Math.max(1, list.length)).toFixed(0)}%  stated ${p.toFixed(1)}%`);
}
function scores(label: string, probs: number[], ys: number[]) {
  let brier = 0, ll = 0;
  probs.forEach((p, i) => { const q = Math.min(0.999, Math.max(0.001, p / 100)); brier += (q - ys[i]) ** 2; ll -= ys[i] ? Math.log(q) : Math.log(1 - q); });
  console.log(`  ${label.padEnd(30)} Brier ${(brier / probs.length).toFixed(4)}  log-loss ${(ll / probs.length).toFixed(4)}`);
}

function spreads(sport: 'NBA' | 'NFL', rows: any[]) {
  const old: Bet[] = [], neu: Bet[] = [], oldP: number[] = [], newP: number[] = [], ys: number[] = [];
  for (const g of rows) {
    const cover = g.result + g.spread;
    if (cover === 0) continue; // push
    const homeCovered = cover > 0, venue = g.neutral ? 'neutral' : 'home';
    let oldMargin: number, oldSigma: number, r;
    if (sport === 'NBA') {
      const netA = (g.h.ppg - g.h.allowed) * 100 / g.h.pace, netB = (g.a.ppg - g.a.allowed) * 100 / g.a.pace;
      oldMargin = 0.5 * (netA - netB) * (g.h.pace + g.a.pace) / 200 + (g.neutral ? 0 : 2.5); oldSigma = 12;
      r = estimateBasketballProbability({ teamPPG: g.h.ppg, teamAllowed: g.h.allowed, opponentPPG: g.a.ppg, opponentAllowed: g.a.allowed, teamPace: g.h.pace, opponentPace: g.a.pace },
        g.spread, venue, true, { gamesPlayed: g.n });
    } else {
      const yards = g.h.off !== undefined && g.a.off !== undefined;
      const netY = yards ? (g.h.off - g.h.dfn) - (g.a.off - g.a.dfn) : 0;
      oldMargin = 0.5 * ((g.h.ppg - g.h.allowed) - (g.a.ppg - g.a.allowed)) + 0.25 * netY / 15 + (g.neutral ? 0 : 2.5); oldSigma = 13.5;
      const stats: any = { teamPPG: g.h.ppg, teamAllowed: g.h.allowed, opponentPPG: g.a.ppg, opponentAllowed: g.a.allowed };
      if (yards) Object.assign(stats, { teamOffYards: g.h.off, teamDefYards: g.h.dfn, opponentOffYards: g.a.off, opponentDefYards: g.a.dfn });
      r = estimateFootballProbability(stats, g.spread, venue, true, { gamesPlayed: g.n });
    }
    ys.push(homeCovered ? 1 : 0);
    const po = coverProbability(oldMargin, g.spread, oldSigma);
    oldP.push(po);
    if (Math.max(po, 100 - po) > BREAK_EVEN) {
      const home = po >= 50;
      old.push({ win: home === homeCovered, dog: home ? g.spread > 0 : g.spread < 0, p: Math.max(po, 100 - po) });
    }
    newP.push(r.probability);
    const side = priceSpread({}, r.probability, r.modelProbability);
    if (side.probability > side.breakEvenPct) {
      const home = side.pickedSide === 'home';
      neu.push({ win: home === homeCovered, dog: home ? g.spread > 0 : g.spread < 0, p: side.probability });
    }
  }
  bets('OLD', old, ys.length); bets('NEW', neu, ys.length);
  scores('OLD cover probabilities', oldP, ys); scores('NEW cover probabilities', newP, ys);
}

console.log(`Datasets built ${data.builtAt ?? '(unknown)'}`);
console.log(`\nNBA spreads (${data.nba.length} games with a closing line)`);
spreads('NBA', data.nba);
for (const [label, from] of [['2010-present', 0], ['2020-present', 2020]] as const) {
  const rows = data.nfl.filter((g: any) => g.season >= from);
  console.log(`\nNFL spreads ${label} (${rows.length} games; yardage where box scores exist)`);
  spreads('NFL', rows);
}

console.log(`\nNHL totals (${data.nhl.length} finals with a fresh pre-game snapshot)`);
{
  const oldOver = (h: any, a: any, line: number) => { // negative binomial, variance = 1.3225 x mean, GSAx weight 0.5
    const mean = Math.max(0.05, (h.xgf60 + a.xga60) / 2 - 0.5 * a.gsax60 + 0.075) + Math.max(0.05, (a.xgf60 + h.xga60) / 2 - 0.5 * h.gsax60 - 0.075);
    const v = mean * 1.15 ** 2, r = mean ** 2 / (v - mean), p = r / (r + mean);
    let m = p ** r, cdf = 0;
    for (let k = 0; k <= Math.floor(line); k++) { cdf += m; m *= (k + r) / (k + 1) * (1 - p); }
    return 100 * (1 - cdf);
  };
  const conv = (s: any) => ({ xGF60: s.xgf60, xGA60: s.xga60, GSAx60: s.gsax60, HDCF60: s.hdcf60 ?? 0, PP: s.pp ?? 0, PK: s.pk ?? 0, timesShorthandedPerGame: s.times_shorthanded ?? 0 });
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  const totals = data.nhl.map((g: any) => g.total);
  const proj = data.nhl.map((g: any) => calculateNHLProjection(conv(g.h), conv(g.a), 6.5).projectedTotal);
  console.log(`  mean final total: actual ${mean(totals).toFixed(2)}, NEW projection ${mean(proj).toFixed(2)}; odd totals ${(100 * mean(totals.map((t: number) => t % 2))).toFixed(0)}%`);
  for (const line of [5.5, 6.5]) {
    const ys = data.nhl.map((g: any) => (g.total > line ? 1 : 0));
    const oldP = data.nhl.map((g: any) => oldOver(g.h, g.a, line));
    const newP = data.nhl.map((g: any) => calculateNHLProjection(conv(g.h), conv(g.a), line).overProbability);
    console.log(` over ${line}: actual ${(100 * mean(ys)).toFixed(1)}%, OLD mean ${mean(oldP).toFixed(1)}%, NEW mean ${mean(newP).toFixed(1)}%`);
    scores(`OLD over ${line}`, oldP, ys); scores(`NEW over ${line}`, newP, ys);
  }
}

console.log(`\nCFB Walters (${data.cfb.length} graded logged picks)`);
{
  // Logged probabilities were Φ(edge/σ); the anchored version is Φ(trust × edge/σ).
  const inv = (p: number) => { let lo = -8, hi = 8; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (normCdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
  const ys = data.cfb.map((r: any) => (r.win ? 1 : 0));
  scores('OLD stated probabilities', data.cfb.map((r: any) => r.p), ys);
  scores('NEW anchored (trust 0.2)', data.cfb.map((r: any) => 100 * normCdf(0.2 * inv(r.p / 100))), ys);
}
