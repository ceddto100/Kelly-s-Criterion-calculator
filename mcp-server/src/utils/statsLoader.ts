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

// ============================================================================
// STATS CACHE
// ============================================================================

let nbaStatsCache: Map<string, NBATeamStats> | null = null;
let nflStatsCache: Map<string, NFLTeamStats> | null = null;
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
    const cache = new Map<string, NBATeamStats>();

    const ppgData = loadCSVFile(resolve(basePath, 'ppg.csv'));
    const allowedData = loadCSVFile(resolve(basePath, 'allowed.csv'));
    const fgData = loadCSVFile(resolve(basePath, 'fieldgoal.csv'));
    const reboundData = loadCSVFile(resolve(basePath, 'rebound_margin.csv'));
    const turnoverData = loadCSVFile(resolve(basePath, 'turnover_margin.csv'));

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
        turnoverMargin: parseFloat(turnoverMap.get(abbr)?.turnover_margin || '0')
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
// FLEXIBLE TEAM LOOKUP
// ============================================================================

/**
 * Find NBA team abbreviation from any input (name, city, nickname, abbreviation)
 */
function findNBATeamAbbreviation(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // Check each team's aliases
  for (const [abbr, aliases] of Object.entries(NBA_TEAM_ALIASES)) {
    if (aliases.includes(normalized)) {
      return abbr;
    }
    // Also check partial matches
    for (const alias of aliases) {
      if (alias.includes(normalized) || normalized.includes(alias)) {
        return abbr;
      }
    }
  }

  return null;
}

/**
 * Find NFL team abbreviation from any input (name, city, nickname, abbreviation)
 */
function findNFLTeamAbbreviation(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // Check each team's aliases
  for (const [abbr, aliases] of Object.entries(NFL_TEAM_ALIASES)) {
    if (aliases.includes(normalized)) {
      return abbr;
    }
    // Also check partial matches
    for (const alias of aliases) {
      if (alias.includes(normalized) || normalized.includes(alias)) {
        return abbr;
      }
    }
  }

  return null;
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
 * Get team stats for any sport
 */
export function getTeamStats(
  teamIdentifier: string,
  sport: 'NBA' | 'NFL' | 'CBB' | 'CFB'
): NBATeamStats | NFLTeamStats | null {
  if (sport === 'NBA' || sport === 'CBB') {
    return getNBATeamStats(teamIdentifier);
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
 * Clear the stats cache (useful for testing or reloading)
 */
export function clearStatsCache(): void {
  nbaStatsCache = null;
  nflStatsCache = null;
  statsBasePath = null;
}

/**
 * Check if stats are available
 */
export function areStatsAvailable(): { nba: boolean; nfl: boolean; path: string | null } {
  try {
    const basePath = getStatsBasePath();
    return {
      nba: existsSync(resolve(basePath, 'ppg.csv')),
      nfl: existsSync(resolve(basePath, 'nfl/nfl_ppg.csv')),
      path: basePath
    };
  } catch {
    return { nba: false, nfl: false, path: null };
  }
}

/**
 * Debug function to list all available teams
 */
export function debugListTeams(): { nba: string[]; nfl: string[] } {
  return {
    nba: Array.from(loadNBAStats().keys()),
    nfl: Array.from(loadNFLStats().keys())
  };
}
