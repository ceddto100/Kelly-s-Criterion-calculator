/**
 * Stats Updater Tool
 *
 * Fetches live sports statistics from free public APIs and writes them to CSV files.
 * This is a TypeScript port of the scripts/update*Stats.js scripts, now living inside
 * the MCP server so stats can be fetched on-demand or on a schedule without relying
 * on GitHub Actions to run Node scripts directly.
 *
 * Sources:
 *   NBA: NBA.com stats API (primary) + ESPN (fallback)
 *   NFL: ESPN public API
 *   NHL: MoneyPuck free CSV (advanced) + ESPN (special teams)
 *
 * TOOL: update_stats
 * Triggers a live stats refresh for one or all sports. Writes updated CSVs to disk
 * and returns the CSV content so GitHub Actions can commit the files to git.
 */

import { writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { clearStatsCache } from '../utils/statsLoader.js';

// ============================================================================
// PATH RESOLUTION
// ============================================================================

function getProjectRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const candidates = [
    resolve(__dirname, '../../../'),           // from dist/tools/
    resolve(__dirname, '../../../../'),         // one deeper
    resolve(process.cwd()),                    // cwd is project root on Render
    resolve(process.cwd(), '..'),
  ];

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'frontend/public/stats'))) {
      return candidate;
    }
  }

  // Fallback: use cwd and create the directory
  return process.cwd();
}

function getStatsDir(sport: 'nba' | 'nfl' | 'nhl'): string {
  const root = getProjectRoot();
  return resolve(root, 'frontend/public/stats', sport);
}

function getLegacyDir(): string {
  const root = getProjectRoot();
  return resolve(root, 'stats');
}

// ============================================================================
// UTILITIES
// ============================================================================

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function round1(val: number | null | undefined): number {
  return Math.round((val || 0) * 10) / 10;
}

function round2(val: number | null | undefined): number {
  return Math.round((val || 0) * 100) / 100;
}

/**
 * Generate CSV string from field names and row objects.
 * No external dependency needed.
 */
function generateCSV(fields: string[], rows: Record<string, unknown>[]): string {
  const escape = (val: unknown): string => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const header = fields.join(',');
  const body = rows.map((row) => fields.map((f) => escape(row[f])).join(',')).join('\n');
  return `${header}\n${body}`;
}

/**
 * Fetch with retry using native fetch (Node 18+).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retries = 3
): Promise<unknown> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
        return await res.text();
      }
      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [Fetch] Attempt ${i + 1} failed for ${url}: ${message}`);
      if (i < retries - 1) await delay(2000 * (i + 1));
    }
  }
  return null;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export interface SportUpdateResult {
  success: boolean;
  sport: string;
  teamsUpdated: number;
  filesWritten: string[];
  csvData: Record<string, string>;
  error?: string;
}

export interface AllStatsUpdateResult {
  success: boolean;
  updatedAt: string;
  sports: {
    NBA?: SportUpdateResult;
    NFL?: SportUpdateResult;
    NHL?: SportUpdateResult;
  };
}

// ============================================================================
// NBA STATS
// ============================================================================

const NBA_HEADERS = {
  'Host': 'stats.nba.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.5',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com',
};

const ESPN_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };

const NBA_ABBR_MAP: Record<string, string> = {
  'PHX': 'PHX', 'GSW': 'GS', 'NOP': 'NO', 'NYK': 'NY', 'SAS': 'SA',
  'UTA': 'UTAH', 'WAS': 'WSH',
};

function normalizeNBAAbbr(nbaAbbr: string): string {
  return NBA_ABBR_MAP[nbaAbbr] || nbaAbbr;
}

function getNBASeasonString(): string {
  const now = new Date();
  const season = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  const startYear = season - 1;
  const endYear = String(season).slice(2);
  return `${startYear}-${endYear}`;
}

function getESPNNBASeasonYear(): number {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

interface NBARecord {
  team: string;
  abbreviation: string;
  ppg: number;
  fg_pct: number;
  allowed?: number;
  rebound_margin?: number;
  turnover_margin?: number;
  pace?: number;
  three_pct?: number;
  three_rate?: number;
  off_rtg?: number;
  def_rtg?: number;
  net_rtg?: number;
  reb?: number;
  tov?: number;
}

async function fetchNBAComStats(): Promise<Record<string, NBARecord> | null> {
  const season = getNBASeasonString();
  console.log(`[StatsUpdater] Fetching NBA.com stats (season: ${season})...`);

  const base = `https://stats.nba.com/stats/leaguedashteamstats?Conference=&DateFrom=&DateTo=&Division=&GameScope=&GameSegment=&Height=&ISTRound=&LastNGames=0&LeagueID=00&Location=&MeasureType=Base&Month=0&OpponentTeamID=0&Outcome=&PORound=0&PaceAdjust=N&PerMode=PerGame&Period=0&PlayerExperience=&PlayerPosition=&PlusMinus=N&Rank=N&Season=${season}&SeasonSegment=&SeasonType=Regular+Season&ShotClockRange=&StarterBench=&TeamID=0&TwoWay=0&VsConference=&VsDivision=`;
  const adv = base.replace('MeasureType=Base', 'MeasureType=Advanced');
  const opp = base.replace('MeasureType=Base', 'MeasureType=Opponent');

  const [baseData, advData, oppData] = await Promise.all([
    fetchWithRetry(base, { headers: NBA_HEADERS }),
    fetchWithRetry(adv, { headers: NBA_HEADERS }),
    fetchWithRetry(opp, { headers: NBA_HEADERS }),
  ]) as [any, any, any];

  if (!baseData?.resultSets?.[0]) return null;

  const idx = (headers: string[], name: string) => headers.indexOf(name);
  const teamStats: Record<string, NBARecord> = {};

  const baseHeaders = baseData.resultSets[0].headers as string[];
  for (const row of baseData.resultSets[0].rowSet as unknown[][]) {
    const abbr = normalizeNBAAbbr(row[idx(baseHeaders, 'TEAM_ABBREVIATION')] as string);
    teamStats[abbr] = {
      team: row[idx(baseHeaders, 'TEAM_NAME')] as string,
      abbreviation: abbr,
      ppg: round1(row[idx(baseHeaders, 'PTS')] as number),
      fg_pct: round1((row[idx(baseHeaders, 'FG_PCT')] as number) * 100),
      reb: round1(row[idx(baseHeaders, 'REB')] as number),
      tov: round1(row[idx(baseHeaders, 'TOV')] as number),
      three_pct: round1((row[idx(baseHeaders, 'FG3_PCT')] as number) * 100),
      three_rate: round2(
        (row[idx(baseHeaders, 'FG3A')] as number) / ((row[idx(baseHeaders, 'FGA')] as number) || 1)
      ),
    };
  }

  if (oppData?.resultSets?.[0]) {
    const oppHeaders = oppData.resultSets[0].headers as string[];
    for (const row of oppData.resultSets[0].rowSet as unknown[][]) {
      const abbr = normalizeNBAAbbr(row[idx(oppHeaders, 'TEAM_ABBREVIATION')] as string);
      if (!teamStats[abbr]) continue;
      const oppPts = round1((row[idx(oppHeaders, 'OPP_PTS')] || row[idx(oppHeaders, 'PTS')]) as number);
      const oppReb = round1((row[idx(oppHeaders, 'OPP_REB')] || row[idx(oppHeaders, 'REB')]) as number);
      const oppTov = round1((row[idx(oppHeaders, 'OPP_TOV')] || row[idx(oppHeaders, 'TOV')]) as number);
      teamStats[abbr].allowed = oppPts;
      teamStats[abbr].rebound_margin = round1((teamStats[abbr].reb || 0) - oppReb);
      teamStats[abbr].turnover_margin = round1(oppTov - (teamStats[abbr].tov || 0));
    }
  }

  if (advData?.resultSets?.[0]) {
    const advHeaders = advData.resultSets[0].headers as string[];
    for (const row of advData.resultSets[0].rowSet as unknown[][]) {
      const abbr = normalizeNBAAbbr(row[idx(advHeaders, 'TEAM_ABBREVIATION')] as string);
      if (!teamStats[abbr]) continue;
      teamStats[abbr].pace = round1(row[idx(advHeaders, 'PACE')] as number);
      teamStats[abbr].off_rtg = round1(row[idx(advHeaders, 'OFF_RATING')] as number);
      teamStats[abbr].def_rtg = round1(row[idx(advHeaders, 'DEF_RATING')] as number);
      teamStats[abbr].net_rtg = round1(row[idx(advHeaders, 'NET_RATING')] as number);
    }
  }

  const validTeams = Object.keys(teamStats).length;
  console.log(`[StatsUpdater] NBA.com returned ${validTeams} teams`);
  return validTeams >= 20 ? teamStats : null;
}

function normalizeStatKey(val: unknown): string {
  return String(val || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildStatMap(categories: any[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const cat of categories) {
    for (const stat of cat.stats || []) {
      const numeric = parseFloat(stat.value ?? stat.displayValue ?? '');
      if (Number.isNaN(numeric)) continue;
      for (const key of [stat.name, stat.displayName, stat.shortDisplayName, stat.abbreviation]) {
        const norm = normalizeStatKey(key);
        if (norm && !map.has(norm)) map.set(norm, numeric);
      }
    }
  }
  return map;
}

function getStat(map: Map<string, number>, aliases: string[], fallback = 0): number {
  for (const alias of aliases) {
    const norm = normalizeStatKey(alias);
    if (map.has(norm)) return map.get(norm)!;
  }
  return fallback;
}

async function fetchNBAESPNFallback(): Promise<Record<string, NBARecord> | null> {
  console.log('[StatsUpdater] NBA.com failed — trying ESPN fallback...');
  const ESPN_NBA = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
  const ESPN_NBA_CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';

  const teamsData = await fetchWithRetry(`${ESPN_NBA}/teams`, { headers: ESPN_HEADERS }) as any;
  if (!teamsData) return null;

  const teams = teamsData.sports[0].leagues[0].teams;
  const season = getESPNNBASeasonYear();
  const teamStats: Record<string, NBARecord> = {};

  for (const { team } of teams) {
    const url = `${ESPN_NBA_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics`;
    const data = await fetchWithRetry(url, { headers: ESPN_HEADERS }) as any;
    let categories: any[] = [];
    if (data?.splits?.categories) categories = data.splits.categories;
    else if (data?.statistics) categories = data.statistics;

    const statMap = buildStatMap(categories);
    const gp = getStat(statMap, ['gamesPlayed', 'gp']);
    const points = getStat(statMap, ['points', 'pts']);
    const ppg = getStat(statMap, ['avgPoints', 'pointsPerGame', 'ppg']) || (gp > 0 ? points / gp : 0);
    const allowed = getStat(statMap, ['avgPointsAgainst', 'pointsAgainstPerGame', 'oppPointsPerGame']);
    const fgPct = getStat(statMap, ['fieldGoalPct', 'fgPct', 'fieldGoalPercentage']);
    const fgPctNorm = fgPct <= 1 ? fgPct * 100 : fgPct;
    const threePct = getStat(statMap, ['threePointFieldGoalPct', 'threePointPct', '3ptPct']);
    const threePctNorm = threePct <= 1 ? threePct * 100 : threePct;
    const threeAttempts = getStat(statMap, ['avgThreePointFieldGoalsAttempted', 'threePointFieldGoalsAttemptedPerGame']);
    const fga = getStat(statMap, ['avgFieldGoalsAttempted', 'fieldGoalsAttemptedPerGame']);
    const threeRate = fga > 0 ? threeAttempts / fga : 0;
    const rebMargin = getStat(statMap, ['reboundDifferential', 'reboundMargin']);
    const tovMargin = getStat(statMap, ['turnoverDifferential', 'turnoverMargin']);
    const pace = getStat(statMap, ['pace', 'possessionsPerGame', 'avgPossessions']);
    const offRtg = getStat(statMap, ['offensiveRating', 'offRating', 'ortg']) || (pace > 0 ? (100 * ppg) / pace : 0);
    const defRtg = getStat(statMap, ['defensiveRating', 'defRating', 'drtg']) || (pace > 0 ? (100 * allowed) / pace : 0);
    const netRtg = getStat(statMap, ['netRating', 'ratingDifferential']) || (offRtg - defRtg);

    teamStats[team.abbreviation] = {
      team: team.displayName,
      abbreviation: team.abbreviation,
      ppg: round1(ppg),
      fg_pct: round1(fgPctNorm),
      allowed: round1(allowed),
      rebound_margin: round1(rebMargin),
      turnover_margin: round1(tovMargin),
      pace: round1(pace),
      three_pct: round1(threePctNorm),
      three_rate: round2(threeRate),
      off_rtg: round1(offRtg),
      def_rtg: round1(defRtg),
      net_rtg: round1(netRtg),
    };

    await delay(300);
  }

  return Object.keys(teamStats).length >= 20 ? teamStats : null;
}

export async function updateNBAStats(): Promise<SportUpdateResult> {
  console.log('[StatsUpdater] === NBA Stats Update ===');
  const result: SportUpdateResult = { success: false, sport: 'NBA', teamsUpdated: 0, filesWritten: [], csvData: {} };

  try {
    let teamStats = await fetchNBAComStats();
    if (!teamStats) teamStats = await fetchNBAESPNFallback();
    if (!teamStats) throw new Error('All NBA data sources failed');

    const allStats = Object.values(teamStats);
    result.teamsUpdated = allStats.length;

    const csvFiles = [
      { name: 'ppg.csv', fields: ['team', 'abbreviation', 'ppg'], sort: 'ppg', asc: false },
      { name: 'allowed.csv', fields: ['team', 'abbreviation', 'allowed'], sort: 'allowed', asc: true },
      { name: 'fieldgoal.csv', fields: ['team', 'abbreviation', 'fg_pct'], sort: 'fg_pct', asc: false },
      { name: 'rebound_margin.csv', fields: ['team', 'abbreviation', 'rebound_margin'], sort: 'rebound_margin', asc: false },
      { name: 'turnover_margin.csv', fields: ['team', 'abbreviation', 'turnover_margin'], sort: 'turnover_margin', asc: false },
      { name: 'pace.csv', fields: ['team', 'abbreviation', 'pace'], sort: 'pace', asc: false },
      { name: 'three_pct.csv', fields: ['team', 'abbreviation', 'three_pct'], sort: 'three_pct', asc: false },
      { name: 'three_rate.csv', fields: ['team', 'abbreviation', 'three_rate'], sort: 'three_rate', asc: false },
      { name: 'off_rtg.csv', fields: ['team', 'abbreviation', 'off_rtg'], sort: 'off_rtg', asc: false },
      { name: 'def_rtg.csv', fields: ['team', 'abbreviation', 'def_rtg'], sort: 'def_rtg', asc: true },
      { name: 'net_rtg.csv', fields: ['team', 'abbreviation', 'net_rtg'], sort: 'net_rtg', asc: false },
    ];

    const statsDir = getStatsDir('nba');
    mkdirSync(statsDir, { recursive: true });

    for (const file of csvFiles) {
      const sorted = [...allStats].sort((a, b) => {
        const av = (a as any)[file.sort] || 0;
        const bv = (b as any)[file.sort] || 0;
        return file.asc ? av - bv : bv - av;
      });
      const rows = sorted.map((row) => {
        const out: Record<string, unknown> = {};
        for (const f of file.fields) out[f] = (row as any)[f] ?? 0;
        return out;
      });
      const csv = generateCSV(file.fields, rows);
      writeFileSync(resolve(statsDir, file.name), csv);
      result.filesWritten.push(file.name);
      result.csvData[file.name] = csv;
      console.log(`[StatsUpdater]   Saved ${file.name} (${rows.length} teams)`);
    }

    // Copy to legacy stats/ dir
    const legacyDir = getLegacyDir();
    mkdirSync(legacyDir, { recursive: true });
    for (const file of csvFiles) {
      copyFileSync(resolve(statsDir, file.name), resolve(legacyDir, file.name));
    }

    result.success = true;
    console.log(`[StatsUpdater] NBA complete: ${allStats.length} teams, ${result.filesWritten.length} files`);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    console.error(`[StatsUpdater] NBA failed: ${result.error}`);
  }

  return result;
}

// ============================================================================
// NFL STATS
// ============================================================================

const ESPN_NFL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const ESPN_NFL_CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

function getNFLSeason(): number {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

interface NFLRecord {
  team: string;
  abbreviation: string;
  ppg: number;
  allowed: number;
  off_yards: number;
  def_yards: number;
  turnover_diff: number;
}

function findNFLStat(statsArray: any[], ...names: string[]): number {
  for (const name of names) {
    const stat = statsArray.find((s: any) =>
      s.name === name || s.shortDisplayName === name || s.abbreviation === name
    );
    if (stat) {
      const val = parseFloat(stat.displayValue || stat.value);
      if (!isNaN(val)) return val;
    }
  }
  return 0;
}

function parseNFLStatsData(data: any, teamAbbr: string): NFLRecord | null {
  let catMap: Record<string, any[]> = {};

  if (data.stats?.splits?.categories?.length) {
    for (const cat of data.stats.splits.categories) catMap[cat.name] = cat.stats || [];
  } else if (data.results?.[0]?.stats?.splits?.categories?.length) {
    for (const cat of data.results[0].stats.splits.categories) catMap[cat.name] = cat.stats || [];
  } else if (data.splits?.categories?.length) {
    for (const cat of data.splits.categories) catMap[cat.name] = cat.stats || [];
  } else if (data.categories?.length) {
    for (const cat of data.categories) catMap[cat.name] = cat.stats || [];
  } else if (data.statistics?.length) {
    for (const cat of data.statistics) catMap[cat.name] = cat.stats || [];
  } else {
    return null;
  }

  const passing = catMap['passing'] || [];
  const rushing = catMap['rushing'] || [];
  const scoring = catMap['scoring'] || [];
  const defensive = catMap['defensive'] || [];
  const general = catMap['general'] || [];
  const misc = catMap['miscellaneous'] || [];

  const ppg = findNFLStat(scoring, 'totalPointsPerGame', 'avgPointsPerGame', 'pointsPerGame')
    || findNFLStat(general, 'avgPointsPerGame', 'pointsPerGame');
  const allowed = findNFLStat(defensive, 'avgPointsAgainst', 'avgPointsAllowed', 'pointsAgainst')
    || findNFLStat(general, 'avgPointsAgainst');
  const passYards = findNFLStat(passing, 'netPassingYardsPerGame', 'passingYardsPerGame', 'netPassingYards')
    || findNFLStat(general, 'netPassingYardsPerGame');
  const rushYards = findNFLStat(rushing, 'rushingYardsPerGame', 'avgRushingYards')
    || findNFLStat(general, 'rushingYardsPerGame');
  const defYards = findNFLStat(defensive, 'yardsAllowedPerGame', 'totalYardsPerGame')
    || findNFLStat(general, 'yardsAllowedPerGame');
  const turnover = findNFLStat(misc, 'turnoverDifferential', 'turnoverMargin', 'turnoverDiff')
    || findNFLStat(general, 'turnoverDifferential');

  if (ppg === 0 && allowed === 0) return null;

  return {
    team: teamAbbr,
    abbreviation: teamAbbr,
    ppg,
    allowed,
    off_yards: Math.round((passYards + rushYards) * 10) / 10,
    def_yards: defYards,
    turnover_diff: turnover,
  };
}

export async function updateNFLStats(): Promise<SportUpdateResult> {
  console.log('[StatsUpdater] === NFL Stats Update ===');
  const result: SportUpdateResult = { success: false, sport: 'NFL', teamsUpdated: 0, filesWritten: [], csvData: {} };

  try {
    const teamsData = await fetchWithRetry(`${ESPN_NFL}/teams`, { headers: ESPN_HEADERS }) as any;
    if (!teamsData) throw new Error('Failed to fetch NFL teams');

    const teams = teamsData.sports[0].leagues[0].teams.map(({ team }: any) => ({
      id: team.id,
      name: team.displayName,
      abbr: team.abbreviation,
    }));

    const season = getNFLSeason();
    const allStats: NFLRecord[] = [];

    for (const team of teams) {
      const urls = [
        `${ESPN_NFL_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics`,
        `${ESPN_NFL_CORE}/seasons/${season}/types/3/teams/${team.id}/statistics`,
        `${ESPN_NFL}/teams/${team.id}/statistics`,
      ];

      let teamResult: NFLRecord | null = null;
      for (const url of urls) {
        const data = await fetchWithRetry(url, { headers: ESPN_HEADERS }, 2) as any;
        if (!data) continue;
        let statsData = data;
        if (data.team?.statistics) statsData = { statistics: data.team.statistics };
        const parsed = parseNFLStatsData(statsData, team.abbr);
        if (parsed && (parsed.ppg > 0 || parsed.allowed > 0)) {
          parsed.team = team.name;
          teamResult = parsed;
          break;
        }
      }

      if (teamResult) allStats.push(teamResult);
      await delay(300);
    }

    if (allStats.length < 20) throw new Error(`Only got ${allStats.length} NFL teams`);
    result.teamsUpdated = allStats.length;

    const csvFiles = [
      { name: 'nfl_ppg.csv', fields: ['team', 'abbreviation', 'ppg'], sort: 'ppg', asc: false },
      { name: 'nfl_allowed.csv', fields: ['team', 'abbreviation', 'allowed'], sort: 'allowed', asc: true },
      { name: 'nfl_off_yards.csv', fields: ['team', 'abbreviation', 'off_yards'], sort: 'off_yards', asc: false },
      { name: 'nfl_def_yards.csv', fields: ['team', 'abbreviation', 'def_yards'], sort: 'def_yards', asc: true },
      { name: 'nfl_turnover_diff.csv', fields: ['team', 'abbreviation', 'turnover_diff'], sort: 'turnover_diff', asc: false },
    ];

    const statsDir = getStatsDir('nfl');
    mkdirSync(statsDir, { recursive: true });

    for (const file of csvFiles) {
      const sorted = [...allStats].sort((a, b) => {
        const av = (a as any)[file.sort] || 0;
        const bv = (b as any)[file.sort] || 0;
        return file.asc ? av - bv : bv - av;
      });
      const rows = sorted.map((row) => {
        const out: Record<string, unknown> = {};
        for (const f of file.fields) out[f] = (row as any)[f] ?? 0;
        return out;
      });
      const csv = generateCSV(file.fields, rows);
      writeFileSync(resolve(statsDir, file.name), csv);
      result.filesWritten.push(file.name);
      result.csvData[file.name] = csv;
      console.log(`[StatsUpdater]   Saved ${file.name} (${rows.length} teams)`);
    }

    result.success = true;
    console.log(`[StatsUpdater] NFL complete: ${allStats.length} teams, ${result.filesWritten.length} files`);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    console.error(`[StatsUpdater] NFL failed: ${result.error}`);
  }

  return result;
}

// ============================================================================
// NHL STATS
// ============================================================================

const NHL_TEAM_MAP: Record<string, { name: string; abbr: string }> = {
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

interface NHLRecord {
  team: string;
  abbreviation: string;
  xgf60: number;
  xga60: number;
  gsax60: number;
  hdcf60: number;
  times_shorthanded: number;
  pp?: number;
  pk?: number;
}

function parseMoneyPuckCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/"/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  });
}

async function fetchMoneyPuckStats(): Promise<Record<string, NHLRecord> | null> {
  const now = new Date();
  const seasonYear = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const url = `https://moneypuck.com/moneypuck/playerData/seasonSummary/${seasonYear}/regular/teams.csv`;
  console.log(`[StatsUpdater] Fetching MoneyPuck: ${url}`);

  const csvText = await fetchWithRetry(url, { headers: ESPN_HEADERS }) as string | null;
  if (!csvText || typeof csvText !== 'string') return null;

  const rows = parseMoneyPuckCSV(csvText);
  const allRows = rows.filter((r) => r.situation === 'all');
  const fiveOnFive = rows.filter((r) => r.situation === '5on5');
  const useRows = allRows.length >= 20 ? allRows : fiveOnFive;
  if (useRows.length < 20) return null;

  const teamStats: Record<string, NHLRecord> = {};

  for (const row of useRows) {
    const mapped = NHL_TEAM_MAP[row.team];
    if (!mapped) continue;

    const gamesPlayed = parseFloat(row.games_played || '1');
    const iceTime = parseFloat(row.iceTime || row.icetime || '1');
    const iceTimeHours = iceTime / 3600;
    const xGoalsFor = parseFloat(row.xGoalsFor || '0');
    const xGoalsAgainst = parseFloat(row.xGoalsAgainst || '0');
    const goalsAgainst = parseFloat(row.goalsAgainst || '0');
    const hdcf = parseFloat(row.highDangerShotsFor || row.highDangerxGoalsFor || '0');

    const xgf60 = iceTimeHours > 0 ? round2(xGoalsFor / iceTimeHours) : 0;
    const xga60 = iceTimeHours > 0 ? round2(xGoalsAgainst / iceTimeHours) : 0;
    const gsax60 = iceTimeHours > 0 ? round2((xGoalsAgainst - goalsAgainst) / iceTimeHours) : 0;
    const hdcf60 = iceTimeHours > 0 ? round2(hdcf / iceTimeHours) : 0;

    const penaltiesTaken = parseFloat(
      row.penaltiesAgainst || row.penalitiesAgainst || row.penaltyMinutesAgainst || '0'
    );
    const penaltiesFor = parseFloat(row.penaltiesFor || row.penalitiesFor || '0');
    const effectivePenalties = penaltiesTaken || penaltiesFor;
    const timesShorthanded = gamesPlayed > 0 ? round2(effectivePenalties / gamesPlayed) : 0;

    teamStats[mapped.abbr] = {
      team: mapped.name,
      abbreviation: mapped.abbr,
      xgf60,
      xga60,
      gsax60,
      hdcf60,
      times_shorthanded: timesShorthanded,
    };
  }

  return Object.keys(teamStats).length >= 20 ? teamStats : null;
}

async function fetchNHLESPNSpecialTeams(): Promise<Record<string, { pp: number; pk: number }> | null> {
  const ESPN_NHL = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl';
  const ESPN_NHL_CORE = 'https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl';
  const now = new Date();
  const season = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();

  const teamsData = await fetchWithRetry(`${ESPN_NHL}/teams`, { headers: ESPN_HEADERS }) as any;
  if (!teamsData) return null;

  const teams = teamsData.sports[0].leagues[0].teams;
  const specialTeams: Record<string, { pp: number; pk: number }> = {};

  for (const { team } of teams) {
    const urls = [
      `${ESPN_NHL_CORE}/seasons/${season}/types/2/teams/${team.id}/statistics`,
      `${ESPN_NHL}/teams/${team.id}/statistics`,
    ];

    let categories: any[] = [];
    for (const url of urls) {
      const data = await fetchWithRetry(url, { headers: ESPN_HEADERS }, 2) as any;
      if (!data) continue;
      let statsData = data;
      if (data.team?.statistics) statsData = { statistics: data.team.statistics };
      if (statsData.stats?.splits?.categories?.length) categories = statsData.stats.splits.categories;
      else if (statsData.splits?.categories?.length) categories = statsData.splits.categories;
      else if (statsData.statistics?.length) categories = statsData.statistics;
      if (categories.length > 0) break;
    }

    let ppPct = 0;
    let pkPct = 0;
    for (const cat of categories) {
      for (const s of cat.stats || []) {
        const name = (s.name || '').toLowerCase();
        const val = parseFloat(s.displayValue || s.value || '0');
        if ((name.includes('powerplay') && name.includes('pct')) || name === 'powerplaypct') ppPct = val;
        if ((name.includes('penaltykill') && name.includes('pct')) || name === 'penaltykillpct') pkPct = val;
      }
    }

    const abbrMap: Record<string, string> = { 'LA': 'LAK', 'NJ': 'NJD', 'SJ': 'SJS', 'TB': 'TBL' };
    const abbr = abbrMap[team.abbreviation] || team.abbreviation;
    specialTeams[abbr] = { pp: round2(ppPct), pk: round2(pkPct) };
    await delay(300);
  }

  return Object.keys(specialTeams).length >= 20 ? specialTeams : null;
}

export async function updateNHLStats(): Promise<SportUpdateResult> {
  console.log('[StatsUpdater] === NHL Stats Update ===');
  const result: SportUpdateResult = { success: false, sport: 'NHL', teamsUpdated: 0, filesWritten: [], csvData: {} };

  try {
    const [moneyPuck, espnSpecial] = await Promise.all([
      fetchMoneyPuckStats(),
      fetchNHLESPNSpecialTeams(),
    ]);

    const statsDir = getStatsDir('nhl');
    mkdirSync(statsDir, { recursive: true });

    if (moneyPuck && Object.keys(moneyPuck).length >= 20) {
      const teams = Object.values(moneyPuck);
      result.teamsUpdated = teams.length;

      // Merge special teams data
      if (espnSpecial) {
        for (const [abbr, st] of Object.entries(espnSpecial)) {
          if (moneyPuck[abbr]) {
            moneyPuck[abbr].pp = st.pp;
            moneyPuck[abbr].pk = st.pk;
          }
        }
      }

      const advancedFiles = [
        { name: 'nhl_xgf60.csv', fields: ['team', 'abbreviation', 'xgf60'], sort: 'xgf60', asc: false },
        { name: 'nhl_xga60.csv', fields: ['team', 'abbreviation', 'xga60'], sort: 'xga60', asc: true },
        { name: 'nhl_gsax60.csv', fields: ['team', 'abbreviation', 'gsax60'], sort: 'gsax60', asc: false },
        { name: 'nhl_hdcf60.csv', fields: ['team', 'abbreviation', 'hdcf60'], sort: 'hdcf60', asc: false },
        { name: 'nhl_times_shorthanded.csv', fields: ['team', 'abbreviation', 'times_shorthanded'], sort: 'times_shorthanded', asc: true },
      ];

      if (espnSpecial) {
        advancedFiles.push(
          { name: 'nhl_pp.csv', fields: ['team', 'abbreviation', 'pp'], sort: 'pp', asc: false },
          { name: 'nhl_pk.csv', fields: ['team', 'abbreviation', 'pk'], sort: 'pk', asc: false }
        );
      }

      for (const file of advancedFiles) {
        const sorted = [...teams].sort((a, b) => {
          const av = (a as any)[file.sort] || 0;
          const bv = (b as any)[file.sort] || 0;
          return file.asc ? av - bv : bv - av;
        });
        const rows = sorted.map((row) => {
          const out: Record<string, unknown> = {};
          for (const f of file.fields) out[f] = (row as any)[f] ?? 0;
          return out;
        });
        const csv = generateCSV(file.fields, rows);
        writeFileSync(resolve(statsDir, file.name), csv);
        result.filesWritten.push(file.name);
        result.csvData[file.name] = csv;
        console.log(`[StatsUpdater]   Saved ${file.name} (${rows.length} teams)`);
      }
    } else {
      console.warn('[StatsUpdater] MoneyPuck data unavailable');
    }

    // Copy to legacy dir
    const legacyDir = getLegacyDir();
    mkdirSync(legacyDir, { recursive: true });
    if (existsSync(statsDir)) {
      for (const file of readdirSync(statsDir).filter((f) => f.endsWith('.csv'))) {
        copyFileSync(resolve(statsDir, file), resolve(legacyDir, file));
      }
    }

    result.success = result.filesWritten.length > 0;
    console.log(`[StatsUpdater] NHL complete: ${result.filesWritten.length} files`);
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    console.error(`[StatsUpdater] NHL failed: ${result.error}`);
  }

  return result;
}

// ============================================================================
// UPDATE ALL STATS
// ============================================================================

export async function updateAllStats(sport: 'NBA' | 'NFL' | 'NHL' | 'ALL' = 'ALL'): Promise<AllStatsUpdateResult> {
  console.log(`[StatsUpdater] Starting stats update: ${sport}`);
  const result: AllStatsUpdateResult = {
    success: false,
    updatedAt: new Date().toISOString(),
    sports: {},
  };

  const tasks: Promise<void>[] = [];

  if (sport === 'NBA' || sport === 'ALL') {
    tasks.push(updateNBAStats().then((r) => { result.sports.NBA = r; }));
  }
  if (sport === 'NFL' || sport === 'ALL') {
    tasks.push(updateNFLStats().then((r) => { result.sports.NFL = r; }));
  }
  if (sport === 'NHL' || sport === 'ALL') {
    tasks.push(updateNHLStats().then((r) => { result.sports.NHL = r; }));
  }

  await Promise.all(tasks);

  // Clear the stats loader cache so fresh CSVs are used
  clearStatsCache();

  const anySuccess = Object.values(result.sports).some((s) => s?.success);
  result.success = anySuccess;

  console.log(`[StatsUpdater] Done. Success: ${result.success}`);
  return result;
}

// ============================================================================
// MCP TOOL
// ============================================================================

export const updateStatsToolDefinition = {
  name: 'update_stats',
  description: 'Fetch and refresh live sports statistics from NBA.com, ESPN, and MoneyPuck. Updates the CSV files used for probability calculations. Use this to get the latest team stats before running calculations.',
};

export const updateStatsInputSchema = z.object({
  sport: z
    .enum(['NBA', 'NFL', 'NHL', 'ALL'])
    .default('ALL')
    .describe('Which sport stats to update. Defaults to ALL.'),
});

export async function handleUpdateStats(
  params: z.infer<typeof updateStatsInputSchema>
): Promise<AllStatsUpdateResult> {
  const sport = (params.sport || 'ALL') as 'NBA' | 'NFL' | 'NHL' | 'ALL';
  return updateAllStats(sport);
}
