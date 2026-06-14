// scripts/writeStatsManifest.js
// =============================================================================
// Writes frontend/public/stats/last_updated.json, recording WHEN each sport's
// CSVs were last refreshed.
//
// A sport's timestamp only advances to "now" if its CSV files actually changed
// in the working tree this run (detected via `git status`), so a partial
// failure (e.g. NHL source down) never falsely marks that sport as fresh.
//
// Run this AFTER the update scripts and BEFORE the commit step in
// .github/workflows/update_stats.yml. The app reads this file to show a
// "Team stats updated: …" line, and scripts/checkStatsFreshness.js reads it to
// alert when the updater has silently stalled.
// =============================================================================
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATS_ROOT = path.join(__dirname, '..', 'frontend', 'public', 'stats');
const MANIFEST = path.join(STATS_ROOT, 'last_updated.json');
const SPORTS = { NBA: 'nba', NFL: 'nfl', NHL: 'nhl' };

function dirChanged(dir) {
  try {
    const out = execSync(`git status --porcelain -- "${dir}"`, { encoding: 'utf8' });
    return out.trim().length > 0;
  } catch (e) {
    console.warn(`  git status failed for ${dir}: ${e.message}`);
    return false;
  }
}

function main() {
  const now = new Date().toISOString();

  let manifest = { updatedAt: null, sports: {} };
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    if (!manifest.sports) manifest.sports = {};
  } catch {
    /* first run — start fresh */
  }

  let anyChanged = false;
  for (const [key, dir] of Object.entries(SPORTS)) {
    if (dirChanged(path.join(STATS_ROOT, dir))) {
      manifest.sports[key] = now;
      anyChanged = true;
      console.log(`${key}: refreshed at ${now}`);
    } else {
      console.log(`${key}: unchanged (keeping ${manifest.sports[key] || 'never'})`);
    }
  }

  // MLB has no CSVs — it is fetched live from MLB StatsAPI on every request.
  manifest.mlb = 'live';
  if (anyChanged || !manifest.updatedAt) manifest.updatedAt = now;

  // Record that the updater actually RAN this time, regardless of whether any
  // source data changed. The freshness watchdog (checkStatsFreshness.js) keys
  // off this so it flags a genuinely stalled/disabled workflow without false-
  // alarming during the offseason, when stats legitimately don't change for
  // days. Because this field changes every run, the manifest is always part of
  // the commit, keeping the heartbeat current.
  manifest.lastCheckedAt = now;

  fs.mkdirSync(STATS_ROOT, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${MANIFEST}`);
}

main();
