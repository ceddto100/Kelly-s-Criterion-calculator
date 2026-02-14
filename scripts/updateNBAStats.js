// scripts/updateNBAStats.js
// Fetches LIVE NBA stats from multiple free sources:
//   - Primary: NBA.com stats API (free, no key required - includes pace, 3PT%, differentials)
//   - Fallback: ESPN public API for basic stats + standings for PA
// Outputs CSVs to frontend/public/stats/nba/
const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');

const STATS_DIR = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'nba');
const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';
const TIMEOUT = 20000;

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, headers, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, { headers, timeout: TIMEOUT });
      return res.data;
    } catch (err) {
      console.error(`  Attempt ${i + 1} failed for ${url}: ${err.message}`);
      if (i < retries - 1) await delay(2000 * (i + 1));
    }
  }
  return null;
}

function getCurrentSeason() {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

function getNBASeasonString() {
  // NBA.com uses format like "2025-26"
  const season = getCurrentSeason();
  const startYear = season - 1;
  const endYear = String(season).slice(2);
  return `${startYear}-${endYear}`;
}

// ── NBA.com Stats API ──────────────────────────────────────────
// Free, no API key. Returns ALL team stats in one call.
// Requires specific headers to mimic browser request.

const NBA_HEADERS = {
  'Host': 'stats.nba.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Connection': 'keep-alive',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
};

// NBA team abbreviation mapping (NBA.com uses slightly different abbreviations than ESPN)
const NBA_ABBR_MAP = {
  'PHX': 'PHX', 'GSW': 'GS', 'NOP': 'NO', 'NYK': 'NY', 'SAS': 'SA',
  'UTA': 'UTAH', 'WAS': 'WSH',
};

function normalizeAbbr(nbaAbbr) {
  return NBA_ABBR_MAP[nbaAbbr] || nbaAbbr;
}

async function fetchNBAComStats() {
  const season = getNBASeasonString();
  console.log(`Fetching team stats from NBA.com (season: ${season})...`);

  // Base stats (PPG, FG%, rebounds, turnovers, 3PT)
  const baseUrl = `https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`;

  // Advanced stats (Pace, OffRtg, DefRtg, NetRtg)
  const advUrl = `https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Advanced&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`;

  // Opponent stats (opponent PPG = points allowed, opponent rebounds, opponent turnovers)
  const oppUrl = `https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Opponent&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`;

  const [baseData, advData, oppData] = await Promise.all([
    fetchWithRetry(baseUrl, NBA_HEADERS, 3),
    fetchWithRetry(advUrl, NBA_HEADERS, 3),
    fetchWithRetry(oppUrl, NBA_HEADERS, 3),
  ]);

  if (!baseData?.resultSets?.[0]) {
    console.error('  Failed to fetch base stats from NBA.com');
    return null;
  }

  const teamStats = {};

  // Parse base stats
  const baseHeaders = baseData.resultSets[0].headers;
  const baseRows = baseData.resultSets[0].rowSet;
  console.log(`  NBA.com base stats: ${baseRows.length} teams, headers: ${baseHeaders.length} columns`);

  const idx = (headers, name) => headers.indexOf(name);

  for (const row of baseRows) {
    const teamName = row[idx(baseHeaders, 'TEAM_NAME')];
    const teamAbbr = normalizeAbbr(row[idx(baseHeaders, 'TEAM_ABBREVIATION')]);

    teamStats[teamAbbr] = {
      team: teamName,
      abbreviation: teamAbbr,
      ppg: round1(row[idx(baseHeaders, 'PTS')]),           // Points per game
      fg_pct: round1(row[idx(baseHeaders, 'FG_PCT')] * 100), // FG% (NBA.com returns 0.xx)
      reb: round1(row[idx(baseHeaders, 'REB')]),            // Team rebounds per game
      tov: round1(row[idx(baseHeaders, 'TOV')]),            // Team turnovers per game
      three_pct: round1(row[idx(baseHeaders, 'FG3_PCT')] * 100), // 3PT%
      three_rate: round2(row[idx(baseHeaders, 'FG3A')] / row[idx(baseHeaders, 'FGA')]), // 3PT attempt rate
    };
  }

  // Parse opponent stats (gives us points allowed, opp rebounds, opp turnovers)
  if (oppData?.resultSets?.[0]) {
    const oppHeaders = oppData.resultSets[0].headers;
    const oppRows = oppData.resultSets[0].rowSet;
    console.log(`  NBA.com opponent stats: ${oppRows.length} teams`);

    for (const row of oppRows) {
      const teamAbbr = normalizeAbbr(row[idx(oppHeaders, 'TEAM_ABBREVIATION')]);
      if (!teamStats[teamAbbr]) continue;

      const oppPts = round1(row[idx(oppHeaders, 'OPP_PTS')] || row[idx(oppHeaders, 'PTS')]);
      const oppReb = round1(row[idx(oppHeaders, 'OPP_REB')] || row[idx(oppHeaders, 'REB')]);
      const oppTov = round1(row[idx(oppHeaders, 'OPP_TOV')] || row[idx(oppHeaders, 'TOV')]);

      teamStats[teamAbbr].allowed = oppPts;
      teamStats[teamAbbr].opp_reb = oppReb;
      teamStats[teamAbbr].opp_tov = oppTov;
      teamStats[teamAbbr].rebound_margin = round1(teamStats[teamAbbr].reb - oppReb);
      teamStats[teamAbbr].turnover_margin = round1(oppTov - teamStats[teamAbbr].tov);
    }
  } else {
    console.warn('  WARNING: Could not fetch opponent stats from NBA.com');
  }

  // Parse advanced stats (pace, off/def rating)
  if (advData?.resultSets?.[0]) {
    const advHeaders = advData.resultSets[0].headers;
    const advRows = advData.resultSets[0].rowSet;
    console.log(`  NBA.com advanced stats: ${advRows.length} teams`);

    for (const row of advRows) {
      const teamAbbr = normalizeAbbr(row[idx(advHeaders, 'TEAM_ABBREVIATION')]);
      if (!teamStats[teamAbbr]) continue;

      teamStats[teamAbbr].pace = round1(row[idx(advHeaders, 'PACE')]);
      teamStats[teamAbbr].off_rtg = round1(row[idx(advHeaders, 'OFF_RATING')]);
      teamStats[teamAbbr].def_rtg = round1(row[idx(advHeaders, 'DEF_RATING')]);
      teamStats[teamAbbr].net_rtg = round1(row[idx(advHeaders, 'NET_RATING')]);
    }
  } else {
    console.warn('  WARNING: Could not fetch advanced stats from NBA.com');
  }

  // Log a sample team
  const sample = Object.values(teamStats)[0];
  if (sample) {
    console.log(`\n  Sample: ${sample.team} (${sample.abbreviation}):`);
    console.log(`    PPG=${sample.ppg}, PA=${sample.allowed}, FG%=${sample.fg_pct}`);
    console.log(`    REB diff=${sample.rebound_margin}, TO diff=${sample.turnover_margin}`);
    console.log(`    Pace=${sample.pace}, 3PT%=${sample.three_pct}, 3PT rate=${sample.three_rate}`);
  }

  return teamStats;
}

// ── ESPN Fallback ──────────────────────────────────────────────

const ESPN_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };

function findStat(statsArray, ...statNames) {
  for (const statName of statNames) {
    const stat = statsArray.find((s) => s.name === statName || s.shortDisplayName === statName || s.abbreviation === statName);
    if (stat) {
      const val = parseFloat(stat.displayValue || stat.value);
      if (!isNaN(val)) return val;
    }
  }
  return 0;
}

async function fetchESPNFallback() {
  console.log('\nNBA.com failed - trying ESPN fallback...');

  // Get team list
  const teamsData = await fetchWithRetry(`${ESPN_SITE}/teams`, ESPN_HEADERS, 2);
  if (!teamsData) throw new Error('Failed to fetch NBA teams from ESPN');

  const teams = teamsData.sports[0].leagues[0].teams;
  console.log(`  Found ${teams.length} teams`);

  const season = getCurrentSeason();
  const teamStats = {};

  // Get per-team stats from core API
  for (const { team } of teams) {
    const url = `${ESPN_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics`;
    const data = await fetchWithRetry(url, ESPN_HEADERS, 2);

    let categories = [];
    if (data?.splits?.categories) categories = data.splits.categories;
    else if (data?.statistics) categories = data.statistics;

    const catMap = {};
    for (const cat of categories) {
      catMap[cat.name] = cat.stats || [];
    }

    // Log categories for first team
    if (Object.keys(teamStats).length === 0) {
      console.log(`  [${team.abbreviation}] Categories: ${Object.keys(catMap).join(', ')}`);
      for (const [catName, stats] of Object.entries(catMap)) {
        console.log(`    ${catName}: ${stats.map(s => s.name).join(', ')}`);
      }
    }

    const off = catMap['offensive'] || [];
    const def = catMap['defensive'] || [];
    const gen = catMap['general'] || [];
    const all = [...off, ...def, ...gen];

    // Use displayValue (per-game) not value (may be season total)
    const ppg = findStat(off, 'avgPoints') || findStat(gen, 'avgPoints') || findStat(all, 'avgPoints');
    const fgPct = findStat(off, 'fieldGoalPct') || findStat(gen, 'fieldGoalPct') || findStat(all, 'fieldGoalPct');

    teamStats[team.abbreviation] = {
      team: team.displayName,
      abbreviation: team.abbreviation,
      ppg: round1(ppg),
      fg_pct: round1(fgPct),
      allowed: 0,          // Will fill from standings
      rebound_margin: 0,   // Can't compute without opponent stats
      turnover_margin: 0,
      pace: 0,             // ESPN doesn't have pace
      three_pct: 0,
      three_rate: 0,
    };

    await delay(300);
  }

  // Get PA from standings
  const standingsUrl = `${ESPN_SITE}/standings?season=${season}`;
  const standings = await fetchWithRetry(standingsUrl, ESPN_HEADERS, 2);

  if (standings?.children) {
    for (const conf of standings.children) {
      for (const entry of (conf.standings?.entries || [])) {
        const td = entry.team;
        if (!td || !teamStats[td.abbreviation]) continue;

        const stats = entry.stats || [];
        let pa = 0, gp = 0;

        // Log first team's stat names for debugging
        if (pa === 0 && gp === 0 && Object.values(teamStats).filter(t => t.allowed > 0).length === 0) {
          console.log(`  [${td.abbreviation}] Standings stats: ${stats.map(s => `${s.name}=${s.displayValue || s.value}`).join(', ')}`);
        }

        for (const s of stats) {
          const name = (s.name || '').toLowerCase();
          const abbr = (s.abbreviation || '').toLowerCase();
          const val = parseFloat(s.value || 0);

          if (name === 'pointsagainst' || abbr === 'pa') pa = val;
          if (name === 'gamesplayed' || abbr === 'gp') gp = val;
        }

        // Derive GP from overall record if not found
        if (gp === 0) {
          for (const s of stats) {
            if ((s.name || '').toLowerCase() === 'overall') {
              const parts = (s.displayValue || '').split('-');
              if (parts.length >= 2) gp = parts.reduce((sum, v) => sum + parseInt(v || 0), 0);
            }
          }
        }

        if (pa > 0 && gp > 0) {
          teamStats[td.abbreviation].allowed = round1(pa / gp);
          console.log(`  ${td.displayName}: ${round1(pa / gp)} PA/G (${pa} total / ${gp} games)`);
        }
      }
    }
  }

  return teamStats;
}

// ── Utilities ──────────────────────────────────────────────────

function round1(val) { return Math.round((val || 0) * 10) / 10; }
function round2(val) { return Math.round((val || 0) * 100) / 100; }

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log('=== Betgistics NBA Stats Update ===');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Season: ${getNBASeasonString()}\n`);

  // Try NBA.com first (best source - has everything in 3 API calls)
  let teamStats = await fetchNBAComStats();

  // Fallback to ESPN if NBA.com fails
  if (!teamStats || Object.keys(teamStats).length < 20) {
    console.warn('\nNBA.com returned insufficient data, falling back to ESPN...');
    teamStats = await fetchESPNFallback();
  }

  if (!teamStats || Object.keys(teamStats).length < 20) {
    console.error(`\nOnly got ${Object.keys(teamStats || {}).length} teams. Aborting.`);
    process.exit(1);
  }

  const allStats = Object.values(teamStats);
  console.log(`\nTotal: ${allStats.length} teams with stats`);

  // Sanity check - warn if critical stats are still 0
  const zeroPPG = allStats.filter(s => s.ppg === 0).length;
  const zeroPA = allStats.filter(s => (s.allowed || 0) === 0).length;
  const zeroPace = allStats.filter(s => (s.pace || 0) === 0).length;
  if (zeroPPG > 0) console.warn(`  WARNING: ${zeroPPG} teams have 0 PPG`);
  if (zeroPA > 0) console.warn(`  WARNING: ${zeroPA} teams have 0 PA`);
  if (zeroPace > 0) console.warn(`  WARNING: ${zeroPace} teams have 0 Pace`);

  if (zeroPPG === allStats.length) {
    console.error('\nAll teams have 0 PPG - data source is broken. Aborting.');
    process.exit(1);
  }

  // Write CSV files
  fs.mkdirSync(STATS_DIR, { recursive: true });

  const csvFiles = [
    { name: 'ppg.csv', fields: ['team', 'abbreviation', 'ppg'], sort: 'ppg' },
    { name: 'allowed.csv', fields: ['team', 'abbreviation', 'allowed'], sort: 'allowed', asc: true },
    { name: 'fieldgoal.csv', fields: ['team', 'abbreviation', 'fg_pct'], sort: 'fg_pct' },
    { name: 'rebound_margin.csv', fields: ['team', 'abbreviation', 'rebound_margin'], sort: 'rebound_margin' },
    { name: 'turnover_margin.csv', fields: ['team', 'abbreviation', 'turnover_margin'], sort: 'turnover_margin' },
    { name: 'pace.csv', fields: ['team', 'abbreviation', 'pace'], sort: 'pace' },
    { name: 'three_pct.csv', fields: ['team', 'abbreviation', 'three_pct'], sort: 'three_pct' },
    { name: 'three_rate.csv', fields: ['team', 'abbreviation', 'three_rate'], sort: 'three_rate' },
    { name: 'off_rtg.csv', fields: ['team', 'abbreviation', 'off_rtg'], sort: 'off_rtg' },
    { name: 'def_rtg.csv', fields: ['team', 'abbreviation', 'def_rtg'], sort: 'def_rtg', asc: true },
    { name: 'net_rtg.csv', fields: ['team', 'abbreviation', 'net_rtg'], sort: 'net_rtg' },
  ];

  for (const file of csvFiles) {
    const sortKey = file.sort;
    const sorted = [...allStats].sort((a, b) =>
      file.asc ? (a[sortKey] || 0) - (b[sortKey] || 0) : (b[sortKey] || 0) - (a[sortKey] || 0)
    );
    const rows = sorted.map((row) => {
      const out = {};
      for (const f of file.fields) out[f] = row[f] || 0;
      return out;
    });

    const parser = new Parser({ fields: file.fields });
    const csv = parser.parse(rows);
    fs.writeFileSync(path.join(STATS_DIR, file.name), csv);
    console.log(`Saved ${file.name} (${rows.length} teams)`);
  }

  // Copy to legacy stats/ directory for backward compatibility
  const legacyDir = path.join(__dirname, '..', 'stats');
  fs.mkdirSync(legacyDir, { recursive: true });
  for (const file of csvFiles) {
    fs.copyFileSync(path.join(STATS_DIR, file.name), path.join(legacyDir, file.name));
  }
  console.log('Copied to stats/ for backward compatibility');

  console.log(`\nDone! Updated at ${new Date().toISOString()}`);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
