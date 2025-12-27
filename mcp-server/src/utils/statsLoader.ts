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
// STATS CACHE
// ============================================================================

let nbaStatsCache: Map<string, NBATeamStats> | null = null;
let nflStatsCache: Map<string, NFLTeamStats> | null = null;

// ============================================================================
// CSV PARSING
// ============================================================================

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Parse data rows
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
  // Try to resolve from the MCP server location to the frontend stats
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // Navigate from mcp-server/src/utils to frontend/public/stats
  const possiblePaths = [
    resolve(__dirname, '../../../frontend/public/stats'),
    resolve(__dirname, '../../../../frontend/public/stats'),
    resolve(process.cwd(), 'frontend/public/stats'),
    resolve(process.cwd(), '../frontend/public/stats'),
    '/home/user/Kelly-s-Criterion-calculator/frontend/public/stats'
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error('Could not find stats directory. Tried: ' + possiblePaths.join(', '));
}

// ============================================================================
// NBA STATS LOADING
// ============================================================================

function loadNBAStats(): Map<string, NBATeamStats> {
  if (nbaStatsCache) {
    return nbaStatsCache;
  }

  const basePath = getStatsBasePath();
  const cache = new Map<string, NBATeamStats>();

  // Load all NBA stat files
  const ppgData = loadCSVFile(resolve(basePath, 'ppg.csv'));
  const allowedData = loadCSVFile(resolve(basePath, 'allowed.csv'));
  const fgData = loadCSVFile(resolve(basePath, 'fieldgoal.csv'));
  const reboundData = loadCSVFile(resolve(basePath, 'rebound_margin.csv'));
  const turnoverData = loadCSVFile(resolve(basePath, 'turnover_margin.csv'));

  // Create lookup maps by abbreviation
  const ppgMap = new Map(ppgData.map(r => [r.abbreviation, r]));
  const allowedMap = new Map(allowedData.map(r => [r.abbreviation, r]));
  const fgMap = new Map(fgData.map(r => [r.abbreviation, r]));
  const reboundMap = new Map(reboundData.map(r => [r.abbreviation, r]));
  const turnoverMap = new Map(turnoverData.map(r => [r.abbreviation, r]));

  // Combine all stats for each team
  for (const [abbr, ppgRow] of ppgMap) {
    const teamStats: NBATeamStats = {
      team: ppgRow.team,
      abbreviation: abbr,
      ppg: parseFloat(ppgRow.ppg) || 0,
      pointsAllowed: parseFloat(allowedMap.get(abbr)?.allowed || '0'),
      fgPct: parseFloat(fgMap.get(abbr)?.fg_pct || '0'),
      reboundMargin: parseFloat(reboundMap.get(abbr)?.rebound_margin || '0'),
      turnoverMargin: parseFloat(turnoverMap.get(abbr)?.turnover_margin || '0')
    };

    // Store by abbreviation (normalized)
    cache.set(abbr.toUpperCase(), teamStats);
    // Also store by team name (normalized)
    cache.set(normalizeTeamName(teamStats.team), teamStats);
  }

  nbaStatsCache = cache;
  return cache;
}

function loadCSVFile(filePath: string): Record<string, string>[] {
  if (!existsSync(filePath)) {
    console.warn(`Stats file not found: ${filePath}`);
    return [];
  }

  const content = readFileSync(filePath, 'utf-8');
  return parseCSV(content);
}

// ============================================================================
// NFL STATS LOADING
// ============================================================================

function loadNFLStats(): Map<string, NFLTeamStats> {
  if (nflStatsCache) {
    return nflStatsCache;
  }

  const basePath = getStatsBasePath();
  const nflPath = resolve(basePath, 'nfl');
  const cache = new Map<string, NFLTeamStats>();

  // Load all NFL stat files
  const ppgData = loadCSVFile(resolve(nflPath, 'nfl_ppg.csv'));
  const allowedData = loadCSVFile(resolve(nflPath, 'nfl_allowed.csv'));
  const offYardsData = loadCSVFile(resolve(nflPath, 'nfl_off_yards.csv'));
  const defYardsData = loadCSVFile(resolve(nflPath, 'nfl_def_yards.csv'));
  const turnoverData = loadCSVFile(resolve(nflPath, 'nfl_turnover_diff.csv'));

  // Create lookup maps by abbreviation
  const ppgMap = new Map(ppgData.map(r => [r.abbreviation, r]));
  const allowedMap = new Map(allowedData.map(r => [r.abbreviation, r]));
  const offYardsMap = new Map(offYardsData.map(r => [r.abbreviation, r]));
  const defYardsMap = new Map(defYardsData.map(r => [r.abbreviation, r]));
  const turnoverMap = new Map(turnoverData.map(r => [r.abbreviation, r]));

  // Combine all stats for each team
  for (const [abbr, ppgRow] of ppgMap) {
    const teamStats: NFLTeamStats = {
      team: ppgRow.team,
      abbreviation: abbr,
      ppg: parseFloat(ppgRow.ppg) || 0,
      pointsAllowed: parseFloat(allowedMap.get(abbr)?.allowed || '0'),
      offensiveYards: parseFloat(offYardsMap.get(abbr)?.off_yards || '0'),
      defensiveYards: parseFloat(defYardsMap.get(abbr)?.def_yards || '0'),
      turnoverDiff: parseFloat(turnoverMap.get(abbr)?.turnover_diff || '0')
    };

    // Store by abbreviation (normalized)
    cache.set(abbr.toUpperCase(), teamStats);
    // Also store by team name (normalized)
    cache.set(normalizeTeamName(teamStats.team), teamStats);
  }

  nflStatsCache = cache;
  return cache;
}

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

function normalizeTeamName(name: string): string {
  return name.toLowerCase().trim();
}

// Mapping from our teamData abbreviations to stats file abbreviations
const NBA_ABBREV_MAP: Record<string, string> = {
  'BOS': 'BOS',
  'BKN': 'BKN',
  'NYK': 'NY',
  'PHI': 'PHI',
  'TOR': 'TOR',
  'CHI': 'CHI',
  'CLE': 'CLE',
  'DET': 'DET',
  'IND': 'IND',
  'MIL': 'MIL',
  'ATL': 'ATL',
  'CHA': 'CHA',
  'MIA': 'MIA',
  'ORL': 'ORL',
  'WAS': 'WSH',
  'DEN': 'DEN',
  'MIN': 'MIN',
  'OKC': 'OKC',
  'POR': 'POR',
  'UTA': 'UTA',
  'GSW': 'GS',
  'LAC': 'LAC',
  'LAL': 'LAL',
  'PHX': 'PHX',
  'SAC': 'SAC',
  'DAL': 'DAL',
  'HOU': 'HOU',
  'MEM': 'MEM',
  'NOP': 'NO',
  'SAS': 'SA'
};

const NFL_ABBREV_MAP: Record<string, string> = {
  'ARI': 'ARI',
  'ATL': 'ATL',
  'BAL': 'BAL',
  'BUF': 'BUF',
  'CAR': 'CAR',
  'CHI': 'CHI',
  'CIN': 'CIN',
  'CLE': 'CLE',
  'DAL': 'DAL',
  'DEN': 'DEN',
  'DET': 'DET',
  'GB': 'GB',
  'HOU': 'HOU',
  'IND': 'IND',
  'JAX': 'JAX',
  'KC': 'KC',
  'LAC': 'LAC',
  'LAR': 'LAR',
  'LV': 'LV',
  'MIA': 'MIA',
  'MIN': 'MIN',
  'NE': 'NE',
  'NO': 'NO',
  'NYG': 'NYG',
  'NYJ': 'NYJ',
  'PHI': 'PHI',
  'PIT': 'PIT',
  'SEA': 'SEA',
  'SF': 'SF',
  'TB': 'TB',
  'TEN': 'TEN',
  'WAS': 'WSH'
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get NBA team stats by abbreviation or team name
 */
export function getNBATeamStats(teamIdentifier: string): NBATeamStats | null {
  const cache = loadNBAStats();

  // Try direct abbreviation lookup
  const upperAbbr = teamIdentifier.toUpperCase();
  if (cache.has(upperAbbr)) {
    return cache.get(upperAbbr)!;
  }

  // Try mapped abbreviation
  const mappedAbbr = NBA_ABBREV_MAP[upperAbbr];
  if (mappedAbbr && cache.has(mappedAbbr)) {
    return cache.get(mappedAbbr)!;
  }

  // Try team name lookup
  const normalizedName = normalizeTeamName(teamIdentifier);
  if (cache.has(normalizedName)) {
    return cache.get(normalizedName)!;
  }

  // Try partial match on team name
  for (const [key, stats] of cache) {
    if (key.includes(normalizedName) || normalizedName.includes(key)) {
      return stats;
    }
    // Also check if the search term is in the team name
    if (stats.team.toLowerCase().includes(normalizedName)) {
      return stats;
    }
  }

  return null;
}

/**
 * Get NFL team stats by abbreviation or team name
 */
export function getNFLTeamStats(teamIdentifier: string): NFLTeamStats | null {
  const cache = loadNFLStats();

  // Try direct abbreviation lookup
  const upperAbbr = teamIdentifier.toUpperCase();
  if (cache.has(upperAbbr)) {
    return cache.get(upperAbbr)!;
  }

  // Try mapped abbreviation
  const mappedAbbr = NFL_ABBREV_MAP[upperAbbr];
  if (mappedAbbr && cache.has(mappedAbbr)) {
    return cache.get(mappedAbbr)!;
  }

  // Try team name lookup
  const normalizedName = normalizeTeamName(teamIdentifier);
  if (cache.has(normalizedName)) {
    return cache.get(normalizedName)!;
  }

  // Try partial match on team name
  for (const [key, stats] of cache) {
    if (key.includes(normalizedName) || normalizedName.includes(key)) {
      return stats;
    }
    // Also check if the search term is in the team name
    if (stats.team.toLowerCase().includes(normalizedName)) {
      return stats;
    }
  }

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
  const teams: NBATeamStats[] = [];
  const seen = new Set<string>();

  for (const stats of cache.values()) {
    if (!seen.has(stats.abbreviation)) {
      seen.add(stats.abbreviation);
      teams.push(stats);
    }
  }

  return teams;
}

/**
 * Get all available NFL teams
 */
export function getAllNFLTeams(): NFLTeamStats[] {
  const cache = loadNFLStats();
  const teams: NFLTeamStats[] = [];
  const seen = new Set<string>();

  for (const stats of cache.values()) {
    if (!seen.has(stats.abbreviation)) {
      seen.add(stats.abbreviation);
      teams.push(stats);
    }
  }

  return teams;
}

/**
 * Clear the stats cache (useful for testing or reloading)
 */
export function clearStatsCache(): void {
  nbaStatsCache = null;
  nflStatsCache = null;
}

/**
 * Check if stats are available
 */
export function areStatsAvailable(): { nba: boolean; nfl: boolean } {
  try {
    const basePath = getStatsBasePath();
    return {
      nba: existsSync(resolve(basePath, 'ppg.csv')),
      nfl: existsSync(resolve(basePath, 'nfl/nfl_ppg.csv'))
    };
  } catch {
    return { nba: false, nfl: false };
  }
}
