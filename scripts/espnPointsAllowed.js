// scripts/espnPointsAllowed.js
// =============================================================================
// Points-allowed (opponent points per game) from ESPN's standings feed.
//
// Why this exists: ESPN's per-team /statistics endpoint only exposes a team's
// OWN box score — it has no opponent points — so the NBA/NFL updaters were
// writing 0 for "allowed" (and the cascade: def_rtg, net_rtg). The standings
// feed carries avgPointsAgainst per team and, unlike stats.nba.com, is reachable
// from cloud IPs (GitHub Actions / Render). Shared by the NBA and NFL updaters.
// =============================================================================
const axios = require('axios');

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 20000;

// ESPN standings nest team rows under children[].standings.entries[] (grouped by
// conference/division) or a flat standings.entries[]. Collect every entries[].
function collectStandingEntries(node, out = []) {
  if (Array.isArray(node)) {
    for (const x of node) collectStandingEntries(x, out);
    return out;
  }
  if (node && typeof node === 'object') {
    if (Array.isArray(node.entries)) for (const e of node.entries) out.push(e);
    for (const k of Object.keys(node)) {
      if (k !== 'entries') collectStandingEntries(node[k], out);
    }
  }
  return out;
}

function standStat(stats, names) {
  for (const n of names) {
    const s = stats.find((st) => st.name === n || st.abbreviation === n || st.shortDisplayName === n);
    if (s) {
      const v = parseFloat(s.value ?? s.displayValue);
      if (!Number.isNaN(v)) return v;
    }
  }
  return undefined;
}

function parseStandings(data) {
  const map = new Map(); // ESPN abbreviation -> points allowed per game
  for (const e of collectStandingEntries(data)) {
    const abbr = e.team && e.team.abbreviation;
    if (!abbr) continue;
    const stats = e.stats || [];
    // Direct per-game value (NBA standings have avgPointsAgainst).
    let allowed = standStat(stats, ['avgPointsAgainst', 'pointsAgainstPerGame', 'avgPointsAllowed']);
    if (allowed === undefined) {
      // Derive from the season total ÷ games (NFL standings carry the total
      // pointsAgainst + W/L/T, but no per-game average or gamesPlayed).
      const pa = standStat(stats, ['pointsAgainst', 'pointsAllowed']);
      let gp = standStat(stats, ['gamesPlayed']);
      if (gp === undefined) {
        const w = standStat(stats, ['wins']) || 0;
        const l = standStat(stats, ['losses']) || 0;
        const t = standStat(stats, ['ties']) || 0;
        gp = w + l + t || undefined;
      }
      if (pa !== undefined && gp) allowed = pa / gp;
    }
    if (allowed !== undefined) map.set(abbr, Math.round(allowed * 10) / 10);
  }
  return map;
}

/**
 * @param {string} leaguePath e.g. 'basketball/nba' or 'football/nfl'
 * @param {number} season  season start year (e.g. 2025 for 2025-26)
 * @returns {Promise<Map<string, number>>} ESPN abbr -> points allowed per game
 */
async function fetchPointsAllowed(leaguePath, season) {
  const urls = [
    `https://site.api.espn.com/apis/v2/sports/${leaguePath}/standings?season=${season}&type=2&level=3`,
    `https://site.web.api.espn.com/apis/v2/sports/${leaguePath}/standings?region=us&lang=en&season=${season}&seasontype=2&level=3`,
    `https://site.api.espn.com/apis/site/v2/sports/${leaguePath}/standings?season=${season}`,
    `https://site.api.espn.com/apis/v2/sports/${leaguePath}/standings?season=${season}`,
  ];
  for (const url of urls) {
    let data = null;
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
      data = res.data;
    } catch (err) {
      console.error(`  [standings] ${url} failed: ${err.message}`);
      continue;
    }
    const map = parseStandings(data);
    if (map.size >= 20) {
      console.log(`  ESPN standings (${leaguePath}): points-allowed for ${map.size} teams`);
      return map;
    }
    // Diagnostic: entries were returned but unparseable — surface the real field
    // names so the alias list can be corrected without guessing.
    const entries = collectStandingEntries(data);
    const sample = entries.find((e) => (e.stats || []).length) || entries[0];
    console.warn(
      `  [standings] ${url}: ${entries.length} entries, ${map.size} parsed. ` +
        `Sample stat names: ${(sample && (sample.stats || []).map((s) => s.name).join(', ')) || 'none'}`
    );
  }
  console.warn(`  WARNING: ESPN standings (${leaguePath}) did not yield points-allowed`);
  return new Map();
}

module.exports = { fetchPointsAllowed, collectStandingEntries, standStat, parseStandings };
