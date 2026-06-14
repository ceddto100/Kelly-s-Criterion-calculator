// scripts/checkStatsFreshness.js
// =============================================================================
// Fails (exit 1) if the committed stats manifest shows any NBA/NFL/NHL CSVs
// older than a threshold. Run by .github/workflows/check_stats_freshness.yml on
// a daily schedule so a silently-stalled updater produces a failed run (and the
// repo owner gets GitHub's automatic failure email) instead of going unnoticed.
//
// Threshold (hours): --hours=<n> arg, or STATS_MAX_AGE_HOURS env, default 48.
// =============================================================================
const fs = require('fs');
const path = require('path');

const MANIFEST = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'last_updated.json');

const argHours = process.argv.find((a) => a.startsWith('--hours='));
const THRESHOLD_HOURS = Number(
  (argHours && argHours.split('=')[1]) || process.env.STATS_MAX_AGE_HOURS || 48,
);

function ageHours(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 36e5;
}

function main() {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  } catch (e) {
    console.error(`❌ Cannot read stats manifest (${MANIFEST}): ${e.message}`);
    process.exit(1);
  }

  // Per-sport content-change times are informational only: in the offseason a
  // sport's CSVs legitimately don't change for days, so they are NOT a health
  // signal on their own.
  const sports = manifest.sports || {};
  for (const key of ['NBA', 'NFL', 'NHL']) {
    const ts = sports[key];
    const label = ts ? `${ageHours(ts).toFixed(1)}h since last change` : 'never updated';
    console.log(`${key.padEnd(4)} ${label}`);
  }

  // The real health signal: did the "Update Sports Stats" workflow actually RUN
  // recently? writeStatsManifest.js stamps lastCheckedAt every run regardless of
  // whether data changed, so this catches a stalled/disabled updater without
  // false-alarming when stats are simply static (offseason).
  const heartbeat = manifest.lastCheckedAt || manifest.updatedAt;
  const heartbeatAge = heartbeat ? ageHours(heartbeat) : Infinity;
  console.log(
    `\nUpdater last ran: ${heartbeat ? `${heartbeatAge.toFixed(1)}h ago` : 'unknown'} ` +
      `(threshold ${THRESHOLD_HOURS}h)`,
  );

  if (heartbeatAge > THRESHOLD_HOURS) {
    console.error(
      `\n❌ The "Update Sports Stats" workflow has not run in over ${THRESHOLD_HOURS}h.`,
    );
    console.error(
      'It may be disabled or failing. Open the Actions tab and re-enable / re-run it.',
    );
    process.exit(1);
  }

  console.log(`\n✅ Updater ran within ${THRESHOLD_HOURS}h.`);
}

main();
