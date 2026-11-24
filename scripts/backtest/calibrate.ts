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
 * The graded bet log (betlog_evidence.json, from betlog_evidence.py) is a second
 * source: how often the module's own stated probabilities came true. Its fitted
 * weight is combined with the backtest fit and the prior by precision, so a
 * sport with few bets barely moves. The bet-log games overlap the backtest
 * window (different module version), so the combination is mildly optimistic;
 * the clamp and step limit bound the effect.
 *
 * The live tracking record (tracking_evidence.json, fetched from the server's
 * /api/projections/tracking-evidence by the weekly workflow) is the third
 * source: the model's own lean on every game with a real line since tracking
 * began, graded whether or not it was bet. It is out of sample by construction
 * and grows by a few hundred games a month.
 *
 * Usage: cd mcp-server && npx tsx ../scripts/backtest/calibrate.ts ../scripts/backtest/.cache/backtest.json [--write]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { estimateBasketballProbability, estimateFootballProbability } from '../../mcp-server/src/utils/calculations.ts';
import { fitTrust, spreadObs as spreadGame, totalObs, type TrustObs } from '../../mcp-server/src/utils/trustFit.ts';
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

type Obs = TrustObs; // log-likelihood contribution of one game at weight w
function fit(obs: Obs[]) {
  const { weight, se, games } = fitTrust(obs);
  const postVar = 1 / (1 / PRIOR_SD ** 2 + 1 / se ** 2);
  return { weight, se, posterior: round(postVar * (weight / se ** 2)), games };
}
const round = (v: number) => Math.round(v * 1000) / 1000;

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
    out.push(spreadGame((r.disagreement ?? 0) / r.sigma, cover > 0));
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
    out.push(totalObs(model, fairImpliedPct(g.overOdds, g.underOdds) / 100, g.total > g.line));
  }
  return out;
}

const fits = {
  NFL: fit(spreadObs('NFL', data.nfl.filter((g: any) => g.season >= NFL_FROM))),
  NBA: fit(spreadObs('NBA', data.nba.filter((g: any) => g.season >= NBA_FROM))),
  NHL: fit(nhlObs(data.nhl)),
};
type Evidence = { weight: number; se: number; bets?: number; games?: number; wins?: number; losses?: number };
const readEvidence = (file: string): Record<string, Evidence> => {
  const path = new URL(file, import.meta.url);
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).sports ?? {} : {};
};
const betlog = readEvidence('./betlog_evidence.json');
const tracking = readEvidence('./tracking_evidence.json');
const usable = (e?: Evidence): e is Evidence => !!e && Number.isFinite(e.se) && e.se > 0;
const next: Record<string, number> = {};
const combined: Record<string, number> = {};
for (const [sport, f] of Object.entries(fits)) {
  const b = betlog[sport], t = tracking[sport];
  let precision = 1 / PRIOR_SD ** 2 + 1 / f.se ** 2, sum = f.weight / f.se ** 2;
  for (const e of [b, t]) if (usable(e)) { precision += 1 / e.se ** 2; sum += e.weight / e.se ** 2; }
  combined[sport] = round(sum / precision);
  const current = (CALIBRATION as any)[sport]?.marketTrust ?? 0;
  const target = Math.min(MAX_TRUST, Math.max(0, combined[sport]));
  next[sport] = round(Math.min(current + MAX_STEP, Math.max(current - MAX_STEP, target)));
  console.log(`${sport}: backtest ${f.weight} ± ${f.se} (${f.games} games)` +
    (b ? `, bet log ${b.weight} ± ${b.se} (${b.bets} bets)` : ', no bet log') +
    (usable(t) ? `, tracked ${t.weight} ± ${t.se} (${t.games} games, ${t.wins}-${t.losses})` : ', no tracked games yet') +
    ` -> combined ${combined[sport]} -> marketTrust ${current} => ${next[sport]}`);
}

if (write) {
  const out = {
    fittedAt: new Date().toISOString().slice(0, 10),
    method: `precision-weighted: prior N(0, ${PRIOR_SD}^2) + backtest fit + graded bet log + live tracked leans; clamped to [0, ${MAX_TRUST}], step <= ${MAX_STEP} per run`,
    NFL: { marketTrust: next.NFL, combined: combined.NFL, fit: { ...fits.NFL, window: `${NFL_FROM}-present` }, betlog: betlog.NFL ?? null, tracking: tracking.NFL ?? null },
    NBA: { marketTrust: next.NBA, combined: combined.NBA, fit: { ...fits.NBA, window: `${NBA_FROM - 1}-${String(NBA_FROM).slice(2)} season to present` }, betlog: betlog.NBA ?? null, tracking: tracking.NBA ?? null },
    NHL: { marketTrust: next.NHL, combined: combined.NHL, fit: { ...fits.NHL, window: 'games with a fresh pre-game snapshot and an ESPN closing price' }, betlog: betlog.NHL ?? null, tracking: tracking.NHL ?? null },
  };
  writeFileSync(new URL('../../mcp-server/src/config/calibration.generated.ts', import.meta.url),
    `// Generated by scripts/backtest/calibrate.ts — do not edit by hand.\n// Learned from history: see scripts/backtest/README.md.\nexport const CALIBRATION = ${JSON.stringify(out, null, 2)} as const;\n`);
  console.log('wrote mcp-server/src/config/calibration.generated.ts');
}
