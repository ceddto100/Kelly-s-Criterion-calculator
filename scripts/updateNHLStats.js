// scripts/updateNHLStats.js
// Fetches LIVE NHL stats from two free sources:
//   - MoneyPuck (free CSV) for advanced stats: xGF/60, xGA/60, GSAx/60, HDCF/60
//   - ESPN public API for special teams: PP%, PK%, times shorthanded per game
// Outputs CSVs to frontend/public/stats/nhl/
const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'nhl');
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 20000;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// MoneyPuck team abbreviation → full name + standard abbreviation mapping
const TEAM_MAP = {
  'ANA': { name: 'Anaheim Ducks', abbr: 'ANA' },
  'BOS': { name: 'Boston Bruins', abbr: 'BOS' },
  'BUF': { name: 'Buffalo Sabres', abbr: 'BUF' },
  'CAR': { name: 'Carolina Hurricanes', abbr: 'CAR' },
  'CBJ': { name: 'Columbus Blue Jackets', abbr: 'CBJ' },
  'CGY': { name: 'Calgary Flames', abbr: 'CGY' },
  'CHI': { name: 'Chicago Blackhawks', abbr: 'CHI' },
  'COL': { name: 'Colorado Avalanche', abbr: 'COL' },
  'DAL': { name: 'Dallas Stars', abbr: 'DAL' },
  'DET': { name: 'Detroit Red Wings', abbr: 'DET' },
  'EDM': { name: 'Edmonton Oilers', abbr: 'EDM' },
  'FLA': { name: 'Florida Panthers', abbr: 'FLA' },
  'LAK': { name: 'Los Angeles Kings', abbr: 'LAK' },
  'L.A': { name: 'Los Angeles Kings', abbr: 'LAK' },
  'MIN': { name: 'Minnesota Wild', abbr: 'MIN' },
  'MTL': { name: 'Montreal Canadiens', abbr: 'MTL' },
  'NJD': { name: 'New Jersey Devils', abbr: 'NJD' },
  'N.J': { name: 'New Jersey Devils', abbr: 'NJD' },
  'NSH': { name: 'Nashville Predators', abbr: 'NSH' },
  'NYI': { name: 'New York Islanders', abbr: 'NYI' },
  'NYR': { name: 'New York Rangers', abbr: 'NYR' },
  'OTT': { name: 'Ottawa Senators', abbr: 'OTT' },
  'PHI': { name: 'Philadelphia Flyers', abbr: 'PHI' },
  'PIT': { name: 'Pittsburgh Penguins', abbr: 'PIT' },
  'SJS': { name: 'San Jose Sharks', abbr: 'SJS' },
  'S.J': { name: 'San Jose Sharks', abbr: 'SJS' },
  'SEA': { name: 'Seattle Kraken', abbr: 'SEA' },
  'STL': { name: 'St. Louis Blues', abbr: 'STL' },
  'TBL': { name: 'Tampa Bay Lightning', abbr: 'TBL' },
  'T.B': { name: 'Tampa Bay Lightning', abbr: 'TBL' },
  'TOR': { name: 'Toronto Maple Leafs', abbr: 'TOR' },
  'UTA': { name: 'Utah Hockey Club', abbr: 'UTA' },
  'VAN': { name: 'Vancouver Canucks', abbr: 'VAN' },
  'VGK': { name: 'Vegas Golden Knights', abbr: 'VGK' },
  'WPG': { name: 'Winnipeg Jets', abbr: 'WPG' },
  'WSH': { name: 'Washington Capitals', abbr: 'WSH' },
};

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
      return res.data;
    } catch (err) {
      console.error(`  Attempt ${i + 1} failed for ${url}: ${err.message}`);
      if (i < retries - 1) await delay(2000 * (i + 1));
    }
  }
  return null;
}

// ── MoneyPuck: Advanced stats ───────────────────────────────────

function parseMoneyPuckCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i]; });
    return row;
  });
}

async function fetchMoneyPuckStats() {
  // MoneyPuck provides free team-level CSV data
  // URL pattern: https://moneypuck.com/moneypuck/playerData/seasonSummary/<season>/regular/teams.csv
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  // NHL season spans Oct-Jun: if before October, use previous year as season start
  const seasonYear = currentMonth >= 9 ? currentYear : currentYear - 1;

  const url = `https://moneypuck.com/moneypuck/playerData/seasonSummary/${seasonYear}/regular/teams.csv`;
  console.log(`Fetching MoneyPuck advanced stats: ${url}`);

  const csvText = await fetchWithRetry(url);
  if (!csvText || typeof csvText !== 'string') {
    console.error('Failed to fetch MoneyPuck data');
    return null;
  }

  const rows = parseMoneyPuckCSV(csvText);
  console.log(`  Parsed ${rows.length} rows from MoneyPuck\n`);

  // MoneyPuck has one row per team with situation='all' for 5v5/overall
  // Filter to situation='all' for overall team stats
  const teamRows = rows.filter((r) => r.situation === 'all' || r.situation === '5on5');

  // Prefer 'all' situation, fallback to '5on5'
  const allSituation = rows.filter((r) => r.situation === 'all');
  const fiveOnFive = rows.filter((r) => r.situation === '5on5');
  const useRows = allSituation.length >= 20 ? allSituation : fiveOnFive;

  // Log available columns for debugging (from first data row)
  if (useRows.length > 0) {
    const sampleRow = useRows[0];
    const penaltyColumns = Object.keys(sampleRow).filter(k =>
      k.toLowerCase().includes('penal') || k.toLowerCase().includes('minor') || k.toLowerCase().includes('short')
    );
    console.log(`  MoneyPuck penalty-related columns: ${penaltyColumns.join(', ') || 'NONE FOUND'}`);
    if (penaltyColumns.length > 0) {
      console.log(`  Sample values: ${penaltyColumns.map(k => k + '=' + sampleRow[k]).join(', ')}`);
    }
  }

  const teamStats = {};

  for (const row of useRows) {
    const teamCode = row.team;
    const mapped = TEAM_MAP[teamCode];
    if (!mapped) {
      console.log(`  Unknown team code: ${teamCode}, skipping`);
      continue;
    }

    const gamesPlayed = parseFloat(row.games_played || row.gamesPlayed || 1);
    const iceTime = parseFloat(row.iceTime || row.icetime || 1);
    const iceTimeHours = iceTime / 3600;
    const sixtyMinFactor = iceTimeHours > 0 ? 1 / iceTimeHours : 0;

    // Expected goals for/against per 60 minutes
    const xGoalsFor = parseFloat(row.xGoalsFor || row.xGF || 0);
    const xGoalsAgainst = parseFloat(row.xGoalsAgainst || row.xGA || 0);
    const goalsFor = parseFloat(row.goalsFor || row.GF || 0);
    const goalsAgainst = parseFloat(row.goalsAgainst || row.GA || 0);
    const hdcf = parseFloat(row.highDangerShotsFor || row.highDangerxGoalsFor || 0);

    const xgf60 = iceTimeHours > 0 ? Math.round((xGoalsFor / iceTimeHours) * 100) / 100 : 0;
    const xga60 = iceTimeHours > 0 ? Math.round((xGoalsAgainst / iceTimeHours) * 100) / 100 : 0;
    const hdcf60 = iceTimeHours > 0 ? Math.round((hdcf / iceTimeHours) * 100) / 100 : 0;

    // GSAx/60: (expected goals against - actual goals against) / hours * per-60
    const gsax = xGoalsAgainst - goalsAgainst;
    const gsax60 = iceTimeHours > 0 ? Math.round((gsax / iceTimeHours) * 100) / 100 : 0;

    // Penalties taken (times shorthanded) per game from MoneyPuck
    // In MoneyPuck's perspective: "For" = team drew the penalty (opponent shorthanded)
    //                             "Against" = team took the penalty (team shorthanded)
    // "Times shorthanded" = penalties taken BY the team = penaltiesAgainst
    // Note: MoneyPuck has known typos (penality vs penalty) and inconsistent naming
    // Try all possible column name variants
    const penaltiesTaken = parseFloat(
      row.penaltiesAgainst || row.penalitiesAgainst
      || row.penaltiesTakenFor || row.penalitiesTakenFor
      || row.penaltyMinutesAgainst || row.penalityMinutesAgainst
      || 0
    );
    // If penaltiesAgainst looks like minutes (high values like 200+), try penaltiesFor instead
    // MoneyPuck naming can be confusing - "penaltiesFor" sometimes means penalties the team TOOK
    const penaltiesForVal = parseFloat(row.penaltiesFor || row.penalitiesFor || 0);
    // Use whichever makes more sense: a reasonable per-game value should be 2-6 range
    let effectivePenalties = penaltiesTaken;
    if (effectivePenalties === 0 && penaltiesForVal > 0) {
      effectivePenalties = penaltiesForVal; // fallback to penaltiesFor
    }
    const timesShorthandedPerGame = gamesPlayed > 0
      ? Math.round((effectivePenalties / gamesPlayed) * 100) / 100
      : 0;

    teamStats[mapped.abbr] = {
      team: mapped.name,
      abbreviation: mapped.abbr,
      xgf60,
      xga60,
      gsax60,
      hdcf60,
      times_shorthanded: timesShorthandedPerGame,
    };

    console.log(`  ${mapped.name}: xGF/60=${xgf60}, xGA/60=${xga60}, GSAx/60=${gsax60}, HDCF/60=${hdcf60}, SH/G=${timesShorthandedPerGame}`);
  }

  return teamStats;
}

// ── ESPN: Special teams stats (PP%, PK%, penalties) ─────────────

function extractCategoriesFromResponse(data) {
  // Try multiple known ESPN API response structures
  if (data.stats?.splits?.categories?.length) return data.stats.splits.categories;
  if (data.results?.[0]?.stats?.splits?.categories?.length) return data.results[0].stats.splits.categories;
  if (data.splits?.categories?.length) return data.splits.categories;
  if (data.categories?.length) return data.categories;
  if (data.statistics?.length) return data.statistics;
  return [];
}

async function fetchESPNSpecialTeams() {
  const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl';
  const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl';
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const season = currentMonth >= 9 ? currentYear + 1 : currentYear;

  console.log('\nFetching NHL team list from ESPN...');
  const teamsData = await fetchWithRetry(`${ESPN_SITE}/teams`);
  if (!teamsData) {
    console.error('Failed to fetch ESPN NHL teams');
    return null;
  }

  const teams = teamsData.sports[0].leagues[0].teams;
  console.log(`Found ${teams.length} NHL teams\n`);

  const specialTeams = {};

  for (const { team } of teams) {
    // Try core API first, then site API
    const urls = [
      `${ESPN_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics`,
      `${ESPN_SITE}/teams/${team.id}/statistics`,
    ];

    let categories = [];
    for (const url of urls) {
      const data = await fetchWithRetry(url, 2);
      if (!data) continue;

      let statsData = data;
      if (data.team?.statistics) {
        statsData = { statistics: data.team.statistics };
      }

      categories = extractCategoriesFromResponse(statsData);
      if (categories.length > 0) {
        console.log(`  [${team.abbreviation}] Found ${categories.length} stat categories`);
        break;
      }
    }

    if (categories.length === 0) {
      console.error(`  SKIP: ${team.displayName} - no stats found from any endpoint`);
      await delay(300);
      continue;
    }

    // Find special teams stats - search across all categories
    let ppPct = 0;
    let pkPct = 0;

    for (const cat of categories) {
      const stats = cat.stats || [];
      for (const s of stats) {
        const name = (s.name || '').toLowerCase();
        const val = parseFloat(s.displayValue || s.value || 0);

        if (name.includes('powerplay') && name.includes('pct') || name === 'powerplaypct') {
          ppPct = val;
        } else if (name.includes('penaltykill') && name.includes('pct') || name === 'penaltykillpct') {
          pkPct = val;
        }
      }
    }

    // Map ESPN team names to our abbreviations
    const abbr = team.abbreviation;
    const normalizedAbbr = {
      'LA': 'LAK', 'NJ': 'NJD', 'SJ': 'SJS', 'TB': 'TBL', 'WSH': 'WSH',
    }[abbr] || abbr;

    const mappedTeam = Object.values(TEAM_MAP).find((t) => t.abbr === normalizedAbbr);
    const teamName = mappedTeam ? mappedTeam.name : team.displayName;

    specialTeams[normalizedAbbr] = {
      team: teamName,
      abbreviation: normalizedAbbr,
      pp: Math.round(ppPct * 100) / 100,
      pk: Math.round(pkPct * 100) / 100,
    };

    console.log(`  ${teamName}: PP=${ppPct}%, PK=${pkPct}%`);
    await delay(300);
  }

  return specialTeams;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  console.log('=== Betgistics NHL Stats Update ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Sources: MoneyPuck (advanced stats) + ESPN (special teams)\n`);

  // Fetch from both sources
  const [moneyPuckStats, espnStats] = await Promise.all([
    fetchMoneyPuckStats(),
    fetchESPNSpecialTeams(),
  ]);

  fs.mkdirSync(STATS_DIR, { recursive: true });

  // ── Advanced stats from MoneyPuck ──
  if (moneyPuckStats && Object.keys(moneyPuckStats).length >= 20) {
    const teams = Object.values(moneyPuckStats);

    const advancedFiles = [
      { name: 'nhl_xgf60.csv', fields: ['team', 'abbreviation', 'xgf60'], sort: 'xgf60' },
      { name: 'nhl_xga60.csv', fields: ['team', 'abbreviation', 'xga60'], sort: 'xga60', asc: true },
      { name: 'nhl_gsax60.csv', fields: ['team', 'abbreviation', 'gsax60'], sort: 'gsax60' },
      { name: 'nhl_hdcf60.csv', fields: ['team', 'abbreviation', 'hdcf60'], sort: 'hdcf60' },
      { name: 'nhl_times_shorthanded.csv', fields: ['team', 'abbreviation', 'times_shorthanded'], sort: 'times_shorthanded', asc: true },
    ];

    for (const file of advancedFiles) {
      const sorted = [...teams].sort((a, b) =>
        file.asc ? a[file.sort] - b[file.sort] : b[file.sort] - a[file.sort]
      );
      const rows = sorted.map((row) => {
        const out = {};
        for (const f of file.fields) out[f] = row[f];
        return out;
      });
      const parser = new Parser({ fields: file.fields });
      fs.writeFileSync(path.join(STATS_DIR, file.name), parser.parse(rows));
      console.log(`\nSaved ${file.name} (${rows.length} teams)`);
    }
  } else {
    console.error('\nMoneyPuck data unavailable or incomplete - advanced stats NOT updated');
    console.log('This may happen during the offseason or early in the season');
  }

  // ── Special teams from ESPN ──
  if (espnStats && Object.keys(espnStats).length >= 20) {
    const teams = Object.values(espnStats);

    const specialFiles = [
      { name: 'nhl_pp.csv', fields: ['team', 'abbreviation', 'pp'], sort: 'pp' },
      { name: 'nhl_pk.csv', fields: ['team', 'abbreviation', 'pk'], sort: 'pk' },
    ];

    for (const file of specialFiles) {
      const sorted = [...teams].sort((a, b) =>
        file.asc ? a[file.sort] - b[file.sort] : b[file.sort] - a[file.sort]
      );
      const rows = sorted.map((row) => {
        const out = {};
        for (const f of file.fields) out[f] = row[f];
        return out;
      });
      const parser = new Parser({ fields: file.fields });
      fs.writeFileSync(path.join(STATS_DIR, file.name), parser.parse(rows));
      console.log(`Saved ${file.name} (${rows.length} teams)`);
    }
  } else {
    console.error('\nESPN NHL data unavailable - special teams stats NOT updated');
  }

  // Copy NHL stats to legacy stats/ directory for backward compatibility
  const legacyDir = path.join(__dirname, '..', 'stats');
  fs.mkdirSync(legacyDir, { recursive: true });
  const nhlFiles = fs.readdirSync(STATS_DIR).filter((f) => f.endsWith('.csv'));
  for (const file of nhlFiles) {
    fs.copyFileSync(path.join(STATS_DIR, file), path.join(legacyDir, file));
  }
  if (nhlFiles.length > 0) {
    console.log(`Copied ${nhlFiles.length} NHL files to stats/ for backward compatibility`);
  }

  // Fail if both sources returned no data
  const moneyPuckOk = moneyPuckStats && Object.keys(moneyPuckStats).length >= 20;
  const espnOk = espnStats && Object.keys(espnStats).length >= 20;
  if (!moneyPuckOk && !espnOk) {
    console.error('\nBoth MoneyPuck and ESPN data sources failed - exiting with error');
    process.exit(1);
  }

  console.log(`\nDone! Updated at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
