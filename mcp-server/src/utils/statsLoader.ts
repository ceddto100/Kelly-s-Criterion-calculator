/**
 * Stats Loader Utility
 *
 * Loads team statistics from CSV files in the frontend/public/stats directory.
 * Provides caching and lookup functions for NBA and NFL team stats.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ============================================================================
// TYPES
// ============================================================================

export interface NBATeamStats {
  team: string;
  abbreviation: string;
  ppg: number;
  pointsAllowed: number;
  fgPct: number;
  reboundMargin: number;
  turnoverMargin: number;
  pace: number;
  threePct: number;
  threeRate: number;
  offRtg: number;
  defRtg: number;
  netRtg: number;
}

export interface NFLTeamStats {
  team: string;
  abbreviation: string;
  ppg: number;
  pointsAllowed: number;
  offensiveYards: number;
  defensiveYards: number;
  turnoverDiff: number;
}

/**
 * NHL team stats — the 7 metrics the hockey projection engine consumes.
 * Field names match the engine's NHLTeamStats so they can be passed straight in.
 */
export interface NHLTeamStats {
  team: string;
  abbreviation: string;
  xGF60: number;                  // expected goals for / 60
  xGA60: number;                  // expected goals against / 60
  GSAx60: number;                 // goalie goals saved above expected / 60
  HDCF60: number;                 // high-danger chances for / 60 (pace)
  PP: number;                     // power-play %
  PK: number;                     // penalty-kill %
  timesShorthandedPerGame: number;
}

export interface TeamStatsResult {
  success: boolean;
  sport: 'NBA' | 'NFL';
  team: string;
  abbreviation: string;
  stats: NBATeamStats | NFLTeamStats;
}

// ============================================================================
// TEAM ALIASES - Comprehensive lookup for flexible matching
// ============================================================================

const NBA_TEAM_ALIASES: Record<string, string[]> = {
  'ATL': ['hawks', 'atlanta', 'atlanta hawks', 'atl', 'hawks'],
  'BOS': ['celtics', 'boston', 'boston celtics', 'bos'],
  'BKN': ['nets', 'brooklyn', 'brooklyn nets', 'bkn'],
  'CHA': ['hornets', 'charlotte', 'charlotte hornets', 'cha'],
  'CHI': ['bulls', 'chicago', 'chicago bulls', 'chi'],
  'CLE': ['cavaliers', 'cavs', 'cleveland', 'cleveland cavaliers', 'cle'],
  'DAL': ['mavericks', 'mavs', 'dallas', 'dallas mavericks', 'dal'],
  'DEN': ['nuggets', 'denver', 'denver nuggets', 'den'],
  'DET': ['pistons', 'detroit', 'detroit pistons', 'det'],
  'GS': ['warriors', 'golden state', 'golden state warriors', 'gsw', 'gs', 'dubs'],
  'HOU': ['rockets', 'houston', 'houston rockets', 'hou'],
  'IND': ['pacers', 'indiana', 'indiana pacers', 'ind'],
  'LAC': ['clippers', 'la clippers', 'los angeles clippers', 'lac'],
  'LAL': ['lakers', 'la lakers', 'los angeles lakers', 'lal'],
  'MEM': ['grizzlies', 'memphis', 'memphis grizzlies', 'mem', 'grizz'],
  'MIA': ['heat', 'miami', 'miami heat', 'mia'],
  'MIL': ['bucks', 'milwaukee', 'milwaukee bucks', 'mil'],
  'MIN': ['timberwolves', 'wolves', 'minnesota', 'minnesota timberwolves', 'min', 'twolves'],
  'NO': ['pelicans', 'new orleans', 'new orleans pelicans', 'nop', 'no', 'pels'],
  'NY': ['knicks', 'new york', 'new york knicks', 'nyk', 'ny'],
  'OKC': ['thunder', 'oklahoma city', 'oklahoma city thunder', 'okc'],
  'ORL': ['magic', 'orlando', 'orlando magic', 'orl'],
  'PHI': ['sixers', '76ers', 'philadelphia', 'philadelphia 76ers', 'phi', 'philly'],
  'PHX': ['suns', 'phoenix', 'phoenix suns', 'phx'],
  'POR': ['trail blazers', 'blazers', 'portland', 'portland trail blazers', 'por'],
  'SAC': ['kings', 'sacramento', 'sacramento kings', 'sac'],
  'SA': ['spurs', 'san antonio', 'san antonio spurs', 'sas', 'sa'],
  'TOR': ['raptors', 'toronto', 'toronto raptors', 'tor'],
  'UTA': ['jazz', 'utah', 'utah jazz', 'uta'],
  'WSH': ['wizards', 'washington', 'washington wizards', 'was', 'wsh', 'dc']
};

const NFL_TEAM_ALIASES: Record<string, string[]> = {
  'ARI': ['cardinals', 'arizona', 'arizona cardinals', 'ari', 'cards'],
  'ATL': ['falcons', 'atlanta', 'atlanta falcons', 'atl'],
  'BAL': ['ravens', 'baltimore', 'baltimore ravens', 'bal'],
  'BUF': ['bills', 'buffalo', 'buffalo bills', 'buf'],
  'CAR': ['panthers', 'carolina', 'carolina panthers', 'car'],
  'CHI': ['bears', 'chicago', 'chicago bears', 'chi'],
  'CIN': ['bengals', 'cincinnati', 'cincinnati bengals', 'cin'],
  'CLE': ['browns', 'cleveland', 'cleveland browns', 'cle'],
  'DAL': ['cowboys', 'dallas', 'dallas cowboys', 'dal'],
  'DEN': ['broncos', 'denver', 'denver broncos', 'den'],
  'DET': ['lions', 'detroit', 'detroit lions', 'det'],
  'GB': ['packers', 'green bay', 'green bay packers', 'gb', 'pack'],
  'HOU': ['texans', 'houston', 'houston texans', 'hou'],
  'IND': ['colts', 'indianapolis', 'indianapolis colts', 'ind'],
  'JAX': ['jaguars', 'jacksonville', 'jacksonville jaguars', 'jax', 'jags'],
  'KC': ['chiefs', 'kansas city', 'kansas city chiefs', 'kc'],
  'LAC': ['chargers', 'la chargers', 'los angeles chargers', 'lac'],
  'LAR': ['rams', 'la rams', 'los angeles rams', 'lar'],
  'LV': ['raiders', 'las vegas', 'las vegas raiders', 'lv', 'vegas'],
  'MIA': ['dolphins', 'miami', 'miami dolphins', 'mia', 'fins'],
  'MIN': ['vikings', 'minnesota', 'minnesota vikings', 'min', 'vikes'],
  'NE': ['patriots', 'new england', 'new england patriots', 'ne', 'pats'],
  'NO': ['saints', 'new orleans', 'new orleans saints', 'no'],
  'NYG': ['giants', 'new york giants', 'nyg', 'ny giants'],
  'NYJ': ['jets', 'new york jets', 'nyj', 'ny jets'],
  'PHI': ['eagles', 'philadelphia', 'philadelphia eagles', 'phi', 'philly'],
  'PIT': ['steelers', 'pittsburgh', 'pittsburgh steelers', 'pit'],
  'SEA': ['seahawks', 'seattle', 'seattle seahawks', 'sea', 'hawks'],
  'SF': ['49ers', 'san francisco', 'san francisco 49ers', 'sf', 'niners', 'forty niners'],
  'TB': ['buccaneers', 'tampa bay', 'tampa bay buccaneers', 'tb', 'bucs', 'tampa'],
  'TEN': ['titans', 'tennessee', 'tennessee titans', 'ten'],
  'WSH': ['commanders', 'washington', 'washington commanders', 'was', 'wsh', 'dc']
};

// NHL aliases keyed by the abbreviation used in the stats CSVs. ESPN's NHL
// abbreviations differ from the CSV for a few teams (e.g. ESPN uses TB/NJ/SJ/LA),
// so those ESPN forms are included as aliases to keep daily-calc lookups robust.
const NHL_TEAM_ALIASES: Record<string, string[]> = {
  'ANA': ['ducks', 'anaheim', 'anaheim ducks', 'ana'],
  'BOS': ['bruins', 'boston', 'boston bruins', 'bos'],
  'BUF': ['sabres', 'buffalo', 'buffalo sabres', 'buf'],
  'CGY': ['flames', 'calgary', 'calgary flames', 'cgy'],
  'CAR': ['hurricanes', 'canes', 'carolina', 'carolina hurricanes', 'car'],
  'CHI': ['blackhawks', 'chicago', 'chicago blackhawks', 'chi'],
  'COL': ['avalanche', 'avs', 'colorado', 'colorado avalanche', 'col'],
  'CBJ': ['blue jackets', 'columbus', 'columbus blue jackets', 'cbj'],
  'DAL': ['stars', 'dallas', 'dallas stars', 'dal'],
  'DET': ['red wings', 'detroit', 'detroit red wings', 'det'],
  'EDM': ['oilers', 'edmonton', 'edmonton oilers', 'edm'],
  'FLA': ['panthers', 'florida', 'florida panthers', 'fla'],
  'LAK': ['kings', 'los angeles kings', 'la kings', 'lak', 'la'],
  'MIN': ['wild', 'minnesota', 'minnesota wild', 'min'],
  'MTL': ['canadiens', 'habs', 'montreal', 'montreal canadiens', 'mtl'],
  'NSH': ['predators', 'preds', 'nashville', 'nashville predators', 'nsh'],
  'NJD': ['devils', 'new jersey', 'new jersey devils', 'njd', 'nj'],
  'NYI': ['islanders', 'isles', 'new york islanders', 'nyi'],
  'NYR': ['rangers', 'new york rangers', 'nyr'],
  'OTT': ['senators', 'sens', 'ottawa', 'ottawa senators', 'ott'],
  'PHI': ['flyers', 'philadelphia', 'philadelphia flyers', 'phi'],
  'PIT': ['penguins', 'pens', 'pittsburgh', 'pittsburgh penguins', 'pit'],
  'SJS': ['sharks', 'san jose', 'san jose sharks', 'sjs', 'sj'],
  'SEA': ['kraken', 'seattle', 'seattle kraken', 'sea'],
  'STL': ['blues', 'st louis', 'st. louis', 'st. louis blues', 'stl'],
  'TBL': ['lightning', 'bolts', 'tampa', 'tampa bay', 'tampa bay lightning', 'tbl', 'tb'],
  'TOR': ['maple leafs', 'leafs', 'toronto', 'toronto maple leafs', 'tor'],
  'UTA': ['mammoth', 'utah', 'utah mammoth', 'utah hockey club', 'uta'],
  'VAN': ['canucks', 'vancouver', 'vancouver canucks', 'van'],
  'VGK': ['golden knights', 'knights', 'vegas', 'vegas golden knights', 'vgk'],
  'WPG': ['jets', 'winnipeg', 'winnipeg jets', 'wpg'],
  'WSH': ['capitals', 'caps', 'washington capitals', 'wsh']
};

// ============================================================================
// STATS CACHE
// ============================================================================

let nbaStatsCache: Map<string, NBATeamStats> | null = null;
let nflStatsCache: Map<string, NFLTeamStats> | null = null;
let nhlStatsCache: Map<string, NHLTeamStats> | null = null;
let statsBasePath: string | null = null;

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

// ============================================================================
// FILE PATH RESOLUTION
// ============================================================================

function getStatsBasePath(): string {
  if (statsBasePath) {
    return statsBasePath;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Multiple possible paths depending on how server is run
  const possiblePaths = [
    // From compiled dist folder
    resolve(__dirname, '../../../frontend/public/stats'),
    resolve(__dirname, '../../../../frontend/public/stats'),
    // From source folder
    resolve(__dirname, '../../../frontend/public/stats'),
    // From project root
    resolve(process.cwd(), 'frontend/public/stats'),
    resolve(process.cwd(), '../frontend/public/stats'),
    // Absolute fallback
    '/home/user/Kelly-s-Criterion-calculator/frontend/public/stats'
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      console.log(`[StatsLoader] Found stats at: ${path}`);
      statsBasePath = path;
      return path;
    }
  }

  const error = `Could not find stats directory. Tried paths:\n${possiblePaths.map(p => `  - ${p}`).join('\n')}`;
  console.error(`[StatsLoader] ${error}`);
  throw new Error(error);
}

function loadCSVFile(filePath: string): Record<string, string>[] {
  if (!existsSync(filePath)) {
    console.warn(`[StatsLoader] File not found: ${filePath}`);
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return parseCSV(content);
  } catch (error) {
    console.error(`[StatsLoader] Error reading ${filePath}:`, error);
    return [];
  }
}

// ============================================================================
// NBA STATS LOADING
// ============================================================================

function loadNBAStats(): Map<string, NBATeamStats> {
  if (nbaStatsCache) {
    return nbaStatsCache;
  }

  try {
    const basePath = getStatsBasePath();
    const nbaPath = resolve(basePath, 'nba');
    const cache = new Map<string, NBATeamStats>();

    const ppgData = loadCSVFile(resolve(nbaPath, 'ppg.csv'));
    const allowedData = loadCSVFile(resolve(nbaPath, 'allowed.csv'));
    const fgData = loadCSVFile(resolve(nbaPath, 'fieldgoal.csv'));
    const reboundData = loadCSVFile(resolve(nbaPath, 'rebound_margin.csv'));
    const turnoverData = loadCSVFile(resolve(nbaPath, 'turnover_margin.csv'));
    const paceData = loadCSVFile(resolve(nbaPath, 'pace.csv'));
    const threePctData = loadCSVFile(resolve(nbaPath, 'three_pct.csv'));
    const threeRateData = loadCSVFile(resolve(nbaPath, 'three_rate.csv'));
    const offRtgData = loadCSVFile(resolve(nbaPath, 'off_rtg.csv'));
    const defRtgData = loadCSVFile(resolve(nbaPath, 'def_rtg.csv'));
    const netRtgData = loadCSVFile(resolve(nbaPath, 'net_rtg.csv'));

    if (ppgData.length === 0) {
      console.error('[StatsLoader] No NBA PPG data loaded');
      return cache;
    }

    console.log(`[StatsLoader] Loaded ${ppgData.length} NBA teams`);

    // Create lookup maps by abbreviation
    const ppgMap = new Map(ppgData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const allowedMap = new Map(allowedData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const fgMap = new Map(fgData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const reboundMap = new Map(reboundData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const turnoverMap = new Map(turnoverData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const paceMap = new Map(paceData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const threePctMap = new Map(threePctData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const threeRateMap = new Map(threeRateData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const offRtgMap = new Map(offRtgData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const defRtgMap = new Map(defRtgData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const netRtgMap = new Map(netRtgData.map(r => [r.abbreviation?.toUpperCase(), r]));

    // Combine all stats for each team
    for (const [abbr, ppgRow] of ppgMap) {
      if (!abbr) continue;

      const teamStats: NBATeamStats = {
        team: ppgRow.team || '',
        abbreviation: abbr,
        ppg: parseFloat(ppgRow.ppg) || 0,
        pointsAllowed: parseFloat(allowedMap.get(abbr)?.allowed || '0'),
        fgPct: parseFloat(fgMap.get(abbr)?.fg_pct || '0'),
        reboundMargin: parseFloat(reboundMap.get(abbr)?.rebound_margin || '0'),
        turnoverMargin: parseFloat(turnoverMap.get(abbr)?.turnover_margin || '0'),
        pace: parseFloat(paceMap.get(abbr)?.pace || '0'),
        threePct: parseFloat(threePctMap.get(abbr)?.three_pct || '0'),
        threeRate: parseFloat(threeRateMap.get(abbr)?.three_rate || '0'),
        offRtg: parseFloat(offRtgMap.get(abbr)?.off_rtg || '0'),
        defRtg: parseFloat(defRtgMap.get(abbr)?.def_rtg || '0'),
        netRtg: parseFloat(netRtgMap.get(abbr)?.net_rtg || '0'),
      };

      // Store by CSV abbreviation
      cache.set(abbr, teamStats);
    }

    nbaStatsCache = cache;
    console.log(`[StatsLoader] NBA cache populated with ${cache.size} entries`);
    return cache;
  } catch (error) {
    console.error('[StatsLoader] Failed to load NBA stats:', error);
    return new Map();
  }
}

// ============================================================================
// NFL STATS LOADING
// ============================================================================

function loadNFLStats(): Map<string, NFLTeamStats> {
  if (nflStatsCache) {
    return nflStatsCache;
  }

  try {
    const basePath = getStatsBasePath();
    const nflPath = resolve(basePath, 'nfl');
    const cache = new Map<string, NFLTeamStats>();

    const ppgData = loadCSVFile(resolve(nflPath, 'nfl_ppg.csv'));
    const allowedData = loadCSVFile(resolve(nflPath, 'nfl_allowed.csv'));
    const offYardsData = loadCSVFile(resolve(nflPath, 'nfl_off_yards.csv'));
    const defYardsData = loadCSVFile(resolve(nflPath, 'nfl_def_yards.csv'));
    const turnoverData = loadCSVFile(resolve(nflPath, 'nfl_turnover_diff.csv'));

    if (ppgData.length === 0) {
      console.error('[StatsLoader] No NFL PPG data loaded');
      return cache;
    }

    console.log(`[StatsLoader] Loaded ${ppgData.length} NFL teams`);

    const ppgMap = new Map(ppgData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const allowedMap = new Map(allowedData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const offYardsMap = new Map(offYardsData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const defYardsMap = new Map(defYardsData.map(r => [r.abbreviation?.toUpperCase(), r]));
    const turnoverMap = new Map(turnoverData.map(r => [r.abbreviation?.toUpperCase(), r]));

    for (const [abbr, ppgRow] of ppgMap) {
      if (!abbr) continue;

      const teamStats: NFLTeamStats = {
        team: ppgRow.team || '',
        abbreviation: abbr,
        ppg: parseFloat(ppgRow.ppg) || 0,
        pointsAllowed: parseFloat(allowedMap.get(abbr)?.allowed || '0'),
        offensiveYards: parseFloat(offYardsMap.get(abbr)?.off_yards || '0'),
        defensiveYards: parseFloat(defYardsMap.get(abbr)?.def_yards || '0'),
        turnoverDiff: parseFloat(turnoverMap.get(abbr)?.turnover_diff || '0')
      };

      cache.set(abbr, teamStats);
    }

    nflStatsCache = cache;
    console.log(`[StatsLoader] NFL cache populated with ${cache.size} entries`);
    return cache;
  } catch (error) {
    console.error('[StatsLoader] Failed to load NFL stats:', error);
    return new Map();
  }
}

// ============================================================================
// NHL STATS LOADING
// ============================================================================

function loadNHLStats(): Map<string, NHLTeamStats> {
  if (nhlStatsCache) {
    return nhlStatsCache;
  }

  try {
    const basePath = getStatsBasePath();
    const nhlPath = resolve(basePath, 'nhl');
    const cache = new Map<string, NHLTeamStats>();

    const xgfData = loadCSVFile(resolve(nhlPath, 'nhl_xgf60.csv'));
    const xgaData = loadCSVFile(resolve(nhlPath, 'nhl_xga60.csv'));
    const gsaxData = loadCSVFile(resolve(nhlPath, 'nhl_gsax60.csv'));
    const hdcfData = loadCSVFile(resolve(nhlPath, 'nhl_hdcf60.csv'));
    const ppData = loadCSVFile(resolve(nhlPath, 'nhl_pp.csv'));
    const pkData = loadCSVFile(resolve(nhlPath, 'nhl_pk.csv'));
    const tshData = loadCSVFile(resolve(nhlPath, 'nhl_times_shorthanded.csv'));

    if (xgfData.length === 0) {
      console.error('[StatsLoader] No NHL xGF data loaded');
      return cache;
    }

    console.log(`[StatsLoader] Loaded ${xgfData.length} NHL teams`);

    const byAbbr = (rows: Record<string, string>[]) =>
      new Map(rows.map(r => [r.abbreviation?.toUpperCase(), r]));
    const xgaMap = byAbbr(xgaData);
    const gsaxMap = byAbbr(gsaxData);
    const hdcfMap = byAbbr(hdcfData);
    const ppMap = byAbbr(ppData);
    const pkMap = byAbbr(pkData);
    const tshMap = byAbbr(tshData);

    for (const xgfRow of xgfData) {
      const abbr = xgfRow.abbreviation?.toUpperCase();
      if (!abbr) continue;

      const teamStats: NHLTeamStats = {
        team: xgfRow.team || '',
        abbreviation: abbr,
        xGF60: parseFloat(xgfRow.xgf60) || 0,
        xGA60: parseFloat(xgaMap.get(abbr)?.xga60 || '0'),
        GSAx60: parseFloat(gsaxMap.get(abbr)?.gsax60 || '0'),
        HDCF60: parseFloat(hdcfMap.get(abbr)?.hdcf60 || '0'),
        PP: parseFloat(ppMap.get(abbr)?.pp || '0'),
        PK: parseFloat(pkMap.get(abbr)?.pk || '0'),
        timesShorthandedPerGame: parseFloat(tshMap.get(abbr)?.times_shorthanded || '0'),
      };

      cache.set(abbr, teamStats);
    }

    nhlStatsCache = cache;
    console.log(`[StatsLoader] NHL cache populated with ${cache.size} entries`);
    return cache;
  } catch (error) {
    console.error('[StatsLoader] Failed to load NHL stats:', error);
    return new Map();
  }
}

// ============================================================================
// FLEXIBLE TEAM LOOKUP
// ============================================================================

/**
 * Find NBA team abbreviation from any input (name, city, nickname, abbreviation)
 */
function findNBATeamAbbreviation(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // First pass: exact matches only (most reliable)
  for (const [abbr, aliases] of Object.entries(NBA_TEAM_ALIASES)) {
    if (aliases.includes(normalized)) {
      return abbr;
    }
  }

  // Second pass: find best partial match (prefer longer matching aliases)
  let bestMatch: { abbr: string; matchLength: number } | null = null;

  for (const [abbr, aliases] of Object.entries(NBA_TEAM_ALIASES)) {
    for (const alias of aliases) {
      // Check if input contains alias or alias contains input
      if (alias.includes(normalized) || normalized.includes(alias)) {
        const matchLength = Math.min(alias.length, normalized.length);
        if (!bestMatch || matchLength > bestMatch.matchLength) {
          bestMatch = { abbr, matchLength };
        }
      }
    }
  }

  return bestMatch?.abbr || null;
}

/**
 * Find NFL team abbreviation from any input (name, city, nickname, abbreviation)
 */
function findNFLTeamAbbreviation(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // First pass: exact matches only (most reliable)
  for (const [abbr, aliases] of Object.entries(NFL_TEAM_ALIASES)) {
    if (aliases.includes(normalized)) {
      return abbr;
    }
  }

  // Second pass: find best partial match (prefer longer matching aliases)
  let bestMatch: { abbr: string; matchLength: number } | null = null;

  for (const [abbr, aliases] of Object.entries(NFL_TEAM_ALIASES)) {
    for (const alias of aliases) {
      // Check if input contains alias or alias contains input
      if (alias.includes(normalized) || normalized.includes(alias)) {
        const matchLength = Math.min(alias.length, normalized.length);
        if (!bestMatch || matchLength > bestMatch.matchLength) {
          bestMatch = { abbr, matchLength };
        }
      }
    }
  }

  return bestMatch?.abbr || null;
}

/**
 * Find NHL team abbreviation from any input (name, city, nickname, abbreviation)
 */
function findNHLTeamAbbreviation(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  for (const [abbr, aliases] of Object.entries(NHL_TEAM_ALIASES)) {
    if (aliases.includes(normalized)) {
      return abbr;
    }
  }

  let bestMatch: { abbr: string; matchLength: number } | null = null;
  for (const [abbr, aliases] of Object.entries(NHL_TEAM_ALIASES)) {
    for (const alias of aliases) {
      if (alias.includes(normalized) || normalized.includes(alias)) {
        const matchLength = Math.min(alias.length, normalized.length);
        if (!bestMatch || matchLength > bestMatch.matchLength) {
          bestMatch = { abbr, matchLength };
        }
      }
    }
  }

  return bestMatch?.abbr || null;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get NBA team stats by any identifier (abbreviation, city, nickname, full name)
 */
export function getNBATeamStats(teamIdentifier: string): NBATeamStats | null {
  const cache = loadNBAStats();

  if (cache.size === 0) {
    console.error('[StatsLoader] NBA cache is empty - stats not loaded');
    return null;
  }

  // Try direct lookup first
  const upperInput = teamIdentifier.toUpperCase().trim();
  if (cache.has(upperInput)) {
    return cache.get(upperInput)!;
  }

  // Find abbreviation via aliases
  const abbr = findNBATeamAbbreviation(teamIdentifier);
  if (abbr && cache.has(abbr)) {
    return cache.get(abbr)!;
  }

  // Log failure for debugging
  console.warn(`[StatsLoader] Could not find NBA team: "${teamIdentifier}"`);
  console.warn(`[StatsLoader] Available teams: ${Array.from(cache.keys()).join(', ')}`);

  return null;
}

/**
 * Get NFL team stats by any identifier (abbreviation, city, nickname, full name)
 */
export function getNFLTeamStats(teamIdentifier: string): NFLTeamStats | null {
  const cache = loadNFLStats();

  if (cache.size === 0) {
    console.error('[StatsLoader] NFL cache is empty - stats not loaded');
    return null;
  }

  // Try direct lookup first
  const upperInput = teamIdentifier.toUpperCase().trim();
  if (cache.has(upperInput)) {
    return cache.get(upperInput)!;
  }

  // Find abbreviation via aliases
  const abbr = findNFLTeamAbbreviation(teamIdentifier);
  if (abbr && cache.has(abbr)) {
    return cache.get(abbr)!;
  }

  // Log failure for debugging
  console.warn(`[StatsLoader] Could not find NFL team: "${teamIdentifier}"`);
  console.warn(`[StatsLoader] Available teams: ${Array.from(cache.keys()).join(', ')}`);

  return null;
}

/**
 * Get NHL team stats by any identifier (abbreviation, city, nickname, full name)
 */
export function getNHLTeamStats(teamIdentifier: string): NHLTeamStats | null {
  const cache = loadNHLStats();

  if (cache.size === 0) {
    console.error('[StatsLoader] NHL cache is empty - stats not loaded');
    return null;
  }

  const upperInput = teamIdentifier.toUpperCase().trim();
  if (cache.has(upperInput)) {
    return cache.get(upperInput)!;
  }

  const abbr = findNHLTeamAbbreviation(teamIdentifier);
  if (abbr && cache.has(abbr)) {
    return cache.get(abbr)!;
  }

  console.warn(`[StatsLoader] Could not find NHL team: "${teamIdentifier}"`);
  console.warn(`[StatsLoader] Available teams: ${Array.from(cache.keys()).join(', ')}`);

  return null;
}

/**
 * Get team stats for any sport.
 * Overloaded so callers get a precise return type: NHL yields NHLTeamStats,
 * while the point-based sports yield NBATeamStats | NFLTeamStats (preserving the
 * types existing callers already rely on).
 */
export function getTeamStats(
  teamIdentifier: string,
  sport: 'NHL'
): NHLTeamStats | null;
export function getTeamStats(
  teamIdentifier: string,
  sport: 'NBA' | 'NFL' | 'CBB' | 'CFB'
): NBATeamStats | NFLTeamStats | null;
export function getTeamStats(
  teamIdentifier: string,
  sport: 'NBA' | 'NFL' | 'CBB' | 'CFB' | 'NHL'
): NBATeamStats | NFLTeamStats | NHLTeamStats | null {
  if (sport === 'NBA' || sport === 'CBB') {
    return getNBATeamStats(teamIdentifier);
  } else if (sport === 'NHL') {
    return getNHLTeamStats(teamIdentifier);
  } else {
    return getNFLTeamStats(teamIdentifier);
  }
}

/**
 * Get all available NBA teams
 */
export function getAllNBATeams(): NBATeamStats[] {
  const cache = loadNBAStats();
  return Array.from(cache.values());
}

/**
 * Get all available NFL teams
 */
export function getAllNFLTeams(): NFLTeamStats[] {
  const cache = loadNFLStats();
  return Array.from(cache.values());
}

/**
 * Get all available NHL teams
 */
export function getAllNHLTeams(): NHLTeamStats[] {
  const cache = loadNHLStats();
  return Array.from(cache.values());
}

/**
 * Clear the stats cache (useful for testing or reloading)
 */
export function clearStatsCache(): void {
  nbaStatsCache = null;
  nflStatsCache = null;
  nhlStatsCache = null;
  statsBasePath = null;
}

/**
 * Check if stats are available
 */
export function areStatsAvailable(): { nba: boolean; nfl: boolean; nhl: boolean; path: string | null } {
  try {
    const basePath = getStatsBasePath();
    const nbaPath = resolve(basePath, 'nba');
    return {
      nba: existsSync(resolve(nbaPath, 'ppg.csv')),
      nfl: existsSync(resolve(basePath, 'nfl/nfl_ppg.csv')),
      nhl: existsSync(resolve(basePath, 'nhl/nhl_xgf60.csv')),
      path: basePath
    };
  } catch {
    return { nba: false, nfl: false, nhl: false, path: null };
  }
}

/**
 * Debug function to list all available teams
 */
export function debugListTeams(): { nba: string[]; nfl: string[]; nhl: string[] } {
  return {
    nba: Array.from(loadNBAStats().keys()),
    nfl: Array.from(loadNFLStats().keys()),
    nhl: Array.from(loadNHLStats().keys())
  };
}
