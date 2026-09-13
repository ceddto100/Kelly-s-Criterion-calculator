#!/usr/bin/env node
/**
 * scripts/calibrateCFBWalters.mjs
 * ===============================
 * Checks the college football Walters constants (home field, margin spread,
 * situational factors) against completed seasons, using only pre-game numbers
 * — see scripts/lib/cfbCalibration.mjs for the method and its limits. Fits on
 * every season but the last and scores the last one. Reports; never edits the
 * engine.
 *
 * Usage:
 *   CFBD_API_KEY=... node scripts/calibrateCFBWalters.mjs [--seasons 2022-2025] [--out report.json]
 *
 * Costs about 3 API calls per season plus 1 for venues. Completed seasons are
 * cached in .cache/cfbd/, so re-running is free.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGameRecords, calibrate } from './lib/cfbCalibration.mjs';
import { cfbSeasonYear } from './lib/cfbd.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, '.cache', 'cfbd');
const argValue = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const key = (process.env.CFBD_API_KEY || '').trim();
if (!key) {
  console.error('Set CFBD_API_KEY (free key: https://collegefootballdata.com/key) to run the calibration.');
  process.exitCode = 1;
} else {
  const last = cfbSeasonYear(new Date()) - 1;
  const [from, to] = (argValue('--seasons') ?? `${last - 3}-${last}`).split('-').map(Number);
  if (!(from < to)) {
    console.error('--seasons needs at least two seasons, e.g. 2022-2025 (the last one is held out).');
    process.exitCode = 1;
  } else {
    await run(from, to);
  }
}

async function cached(file, fetcher) {
  const target = path.join(CACHE, file);
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch {
    const data = await fetcher();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(data));
    return data;
  }
}

async function api(endpoint, params = {}) {
  const url = new URL(endpoint.replace(/^\//, ''), 'https://api.collegefootballdata.com/');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`CFBD HTTP ${res.status} on ${endpoint}`);
  return res.json();
}

async function run(from, to) {
  const venues = await cached('venues.json', () => api('/venues'));
  const bySeason = new Map();
  for (let season = from; season <= to; season += 1) {
    const params = { year: season, seasonType: 'regular' };
    const [games, lines, pollWeeks, teams] = await Promise.all([
      cached(`${season}/history-games.json`, () => api('/games', { ...params, classification: 'fbs' })),
      cached(`${season}/history-lines.json`, () => api('/lines', params)),
      cached(`${season}/history-rankings.json`, () => api('/rankings', params)),
      cached(`${season}/teams.json`, () => api('/teams/fbs', { year: season })),
    ]);
    bySeason.set(season, buildGameRecords({ games, lines, teams, venues, pollWeeks }));
  }
  const train = [...bySeason].filter(([s]) => s < to).flatMap(([, r]) => r);
  const validate = bySeason.get(to);
  const trainLabel = from === to - 1 ? String(from) : `${from}-${to - 1}`;
  const report = { seasons: { train: trainLabel, validate: to }, ...calibrate({ train, validate }) };

  const out = argValue('--out');
  if (out) {
    fs.writeFileSync(path.resolve(out), JSON.stringify(report, null, 2) + '\n');
    console.log(`Full report written to ${out}`);
  }
  print(report);
}

function print(r) {
  const n = (v, dp = 1) => (typeof v === 'number' ? `${v > 0 ? '+' : ''}${v.toFixed(dp)}` : '  n/a');
  const est = (e) => `${n(e.estimate)} ± ${typeof e.se === 'number' ? e.se.toFixed(1) : 'n/a'}`;
  const s = r.marginSpread;
  console.log(`\nCollege football Walters calibration — fit ${r.seasons.train} (${r.games.train} games), validate ${r.seasons.validate} (${r.games.validate} games)`);
  console.log(`Home field      current ${n(r.homeField.current)} | final scores ${est(r.homeField.fromFinalScores)} | closing lines price ${est(r.homeField.pricedByClosingLines)}`);
  console.log(`Margin spread   current ${s.current.base} (+${s.current.slopePerPoint}/pt past ${s.current.knee})` +
    (s.fitted ? ` | fitted ${s.fitted.base.toFixed(1)} (+${s.fitted.slopePerPoint.toFixed(2)}/pt)` : ' | too few games to fit'));
  console.log('\nFactor        current   effect on margin (games)   market mispricing   suggested');
  for (const f of r.factors) {
    console.log(
      `${f.name.padEnd(12)}  ${n(f.current).padStart(6)}   ${est(f.effectOnMargin).padEnd(14)} (${String(f.games).padStart(4)})    ` +
        `${est(f.marketMispricing).padEnd(18)}  ${n(f.suggested)}${f.suggested === f.current ? ' (keep)' : ''}`,
    );
  }
  const v = r.validation;
  const line = (label, e) =>
    `  ${label.padEnd(10)} ATS log loss ${e.againstTheSpread.logLoss?.toFixed(4) ?? 'n/a'} · Brier ${e.againstTheSpread.brier?.toFixed(4) ?? 'n/a'} ` +
    `(${e.againstTheSpread.count} picks) | outright-winner log loss ${e.outrightWinnerFromClosingLine.logLoss?.toFixed(4) ?? 'n/a'}`;
  console.log(`\nValidation ${r.seasons.validate} against the closing line (always-50% baseline log loss ${v.baselineLogLoss.toFixed(4)}):`);
  console.log(line('current', v.current));
  console.log(line('suggested', v.suggested));
  console.log(`\n${r.note}`);
}
