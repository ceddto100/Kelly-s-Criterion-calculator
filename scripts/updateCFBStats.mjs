#!/usr/bin/env node
/**
 * scripts/updateCFBStats.mjs
 * ==========================
 * Refreshes the college football CSVs the Walters Protocol tab and the
 * Today's Games CFB cards read, from the CollegeFootballData.com API.
 * All logic lives in scripts/lib/cfbUpdate.mjs; this file is the network
 * client and the command line.
 *
 * Needs Node 24+ (it imports the TypeScript Walters engine directly) and a
 * free API key from https://collegefootballdata.com/key in CFBD_API_KEY. In
 * GitHub Actions that is the repository secret of the same name.
 *
 * Usage: node scripts/updateCFBStats.mjs [--out <dir>] [--cache <dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCfbUpdate } from './lib/cfbUpdate.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_BASE = 'https://api.collegefootballdata.com/';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : fallback;
};
const outDir = arg('--out', path.join(ROOT, 'frontend', 'public', 'stats', 'cfb'));
const cacheDir = arg('--cache', path.join(ROOT, '.cache', 'cfbd'));

function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');
}

const key = (process.env.CFBD_API_KEY || '').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(endpoint, params = {}) {
  const url = new URL(endpoint.replace(/^\//, ''), API_BASE);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } });
    if (res.ok) return res.json();
    if (res.status === 401 || res.status === 403) {
      throw new Error(`CFBD rejected the API key (HTTP ${res.status}) on ${endpoint}`);
    }
    if (res.status === 429) throw new Error(`CFBD call quota reached (HTTP 429) on ${endpoint}`);
    if (res.status < 500 || attempt === 3) throw new Error(`CFBD HTTP ${res.status} on ${endpoint}`);
    await sleep(2000 * attempt);
  }
}

console.log('=== Betgistics college football update ===');
if (!key) {
  // A missing key is a setup step, not an outage: warn instead of failing the
  // whole stats workflow. The app shows a "not generated yet" message.
  const msg =
    'CFBD_API_KEY is not set, so college football data was not refreshed. Get a free key at ' +
    'https://collegefootballdata.com/key and add it as a repository secret named CFBD_API_KEY.';
  console.log(`::warning::${msg}`);
  summary(`### College football\n${msg}`);
} else {
  try {
    const result = await runCfbUpdate({ api, outDir, cacheDir });
    if (result.status === 'ok') {
      summary(
        `### College football — ${result.seasonType} week ${result.week}\n` +
          `${result.games} games, ${result.fbsGamesWithLines}/${result.fbsGames} FBS matchups with lines, ` +
          `${result.ratedTeams} rated teams, ${result.apiCalls} API calls. ` +
          `Picks: ${result.snapshots} logged, ${result.settled} graded, ${result.picksPending} pending.`,
      );
    } else {
      summary('### College football\nOffseason — nothing to refresh.');
    }
  } catch (e) {
    console.error(`::error::College football update failed: ${e.message}`);
    summary(`### College football\nUpdate failed: ${e.message}`);
    // exitCode, not exit(): exiting while fetch's keep-alive socket is still
    // open crashes Node on Windows and reports the wrong status.
    process.exitCode = 1;
  }
}
