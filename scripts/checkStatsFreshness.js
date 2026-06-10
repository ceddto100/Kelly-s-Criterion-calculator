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

  const sports = manifest.sports || {};
  const stale = [];
  for (const key of ['NBA', 'NFL', 'NHL']) {
    const ts = sports[key];
    const age = ts ? ageHours(ts) : Infinity;
    const label = ts ? `${age.toFixed(1)}h old` : 'never updated';
    const flag = age > THRESHOLD_HOURS ? 'STALE' : 'ok';
    console.log(`${key.padEnd(4)} ${label.padEnd(16)} [${flag}]`);
    if (age > THRESHOLD_HOURS) stale.push(key);
  }

  if (stale.length) {
    console.error(`\n❌ Stale stats (> ${THRESHOLD_HOURS}h): ${stale.join(', ')}`);
    console.error(
      'The "Update Sports Stats" workflow may be disabled or failing. ' +
        'Open the Actions tab and re-enable / re-run it.',
    );
    process.exit(1);
  }

  console.log(`\n✅ All sports refreshed within ${THRESHOLD_HOURS}h.`);
}

main();
