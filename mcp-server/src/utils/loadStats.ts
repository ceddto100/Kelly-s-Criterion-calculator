/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Utility functions for loading team statistics from CSV files
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface NBATeamStats {
  team: string;
  pointsPerGame: number | null;
  pointsAllowed: number | null;
  fieldGoalPct: number | null;
  reboundMargin: number | null;
  turnoverMargin: number | null;
}

export interface NFLTeamStats {
  team: string;
  pointsPerGame: number | null;
  pointsAllowed: number | null;
  offensiveYards: number | null;
  defensiveYards: number | null;
  turnoverDiff: number | null;
}

interface CSVRow {
  [key: string]: string;
}

/**
 * Parse CSV content into array of objects
 */
function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  // Remove quotes from headers and convert to lowercase
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    // Remove quotes from values
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: CSVRow = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Try to load a CSV file from multiple possible paths
 */
function loadCSVFile(filename: string, subfolder: string = ''): CSVRow[] {
  const possiblePaths = [
    join(__dirname, '..', '..', '..', 'stats', subfolder, filename),
    join(__dirname, '..', '..', '..', '..', 'stats', subfolder, filename),
    join(process.cwd(), 'stats', subfolder, filename),
    join(process.cwd(), '..', 'stats', subfolder, filename),
  ];

  for (const tryPath of possiblePaths) {
    if (existsSync(tryPath)) {
      try {
        const content = readFileSync(tryPath, 'utf-8');
        return parseCSV(content);
      } catch (error) {
        console.warn(`Failed to read ${tryPath}:`, error);
      }
    }
  }

  console.warn(`CSV file not found: ${subfolder ? subfolder + '/' : ''}${filename}`);
  return [];
}

/**
 * Normalize team name for fuzzy matching
 */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Find a team in CSV data using fuzzy matching
 */
function findTeamInData(data: CSVRow[], searchTerm: string): CSVRow | null {
  const normalized = normalizeTeamName(searchTerm);

  // Try exact match first (team name)
  for (const row of data) {
    const teamName = row.team || row.name || '';
    if (normalizeTeamName(teamName) === normalized) {
      return row;
    }
  }

  // Try exact abbreviation match
  for (const row of data) {
    const abbrev = row.abbreviation || '';
    if (normalizeTeamName(abbrev) === normalized) {
      return row;
    }
  }

  // Try partial match (team name)
  for (const row of data) {
    const teamName = row.team || row.name || '';
    if (normalizeTeamName(teamName).includes(normalized) ||
        normalized.includes(normalizeTeamName(teamName))) {
      return row;
    }
  }

  // Try abbreviation match
  const abbrevMap: Record<string, string[]> = {
    // NBA Teams
    'lakers': ['lal', 'la lakers', 'los angeles lakers'],
    'warriors': ['gsw', 'golden state', 'golden state warriors'],
    'celtics': ['bos', 'boston', 'boston celtics'],
    'heat': ['mia', 'miami', 'miami heat'],
    'bucks': ['mil', 'milwaukee', 'milwaukee bucks'],
    'suns': ['phx', 'phoenix', 'phoenix suns'],
    'nuggets': ['den', 'denver', 'denver nuggets'],
    'clippers': ['lac', 'la clippers', 'los angeles clippers'],
    'mavericks': ['dal', 'dallas', 'dallas mavericks'],
    'nets': ['bkn', 'brooklyn', 'brooklyn nets'],
    '76ers': ['phi', 'philadelphia', 'philadelphia 76ers', 'sixers'],
    'hawks': ['atl', 'atlanta', 'atlanta hawks'],
    'bulls': ['chi', 'chicago', 'chicago bulls'],
    'cavaliers': ['cle', 'cleveland', 'cleveland cavaliers', 'cavs'],
    'pistons': ['det', 'detroit', 'detroit pistons'],
    'pacers': ['ind', 'indiana', 'indiana pacers'],
    'grizzlies': ['mem', 'memphis', 'memphis grizzlies'],
    'hornets': ['cha', 'charlotte', 'charlotte hornets'],
    'knicks': ['nyk', 'new york', 'new york knicks'],
    'magic': ['orl', 'orlando', 'orlando magic'],
    'raptors': ['tor', 'toronto', 'toronto raptors'],
    'wizards': ['was', 'washington', 'washington wizards'],
    'pelicans': ['nop', 'new orleans', 'new orleans pelicans'],
    'rockets': ['hou', 'houston', 'houston rockets'],
    'spurs': ['sas', 'san antonio', 'san antonio spurs'],
    'thunder': ['okc', 'oklahoma city', 'oklahoma city thunder'],
    'timberwolves': ['min', 'minnesota', 'minnesota timberwolves', 'wolves'],
    'trail blazers': ['por', 'portland', 'portland trail blazers', 'blazers'],
    'jazz': ['uta', 'utah', 'utah jazz'],
    'kings': ['sac', 'sacramento', 'sacramento kings'],
  };

  for (const [team, aliases] of Object.entries(abbrevMap)) {
    if (aliases.includes(normalized) || normalized.includes(team)) {
      // Find this team in data
      for (const row of data) {
        const teamName = normalizeTeamName(row.team || row.name || '');
        if (teamName.includes(team) || aliases.some(a => teamName.includes(a))) {
          return row;
        }
      }
    }
  }

  return null;
}

/**
 * Load NBA team stats from CSV files
 */
export function loadNBATeamStats(teamName: string): NBATeamStats | null {
  const ppgData = loadCSVFile('ppg.csv');
  const allowedData = loadCSVFile('allowed.csv');
  const fgData = loadCSVFile('fieldgoal.csv');
  const reboundData = loadCSVFile('rebound_margin.csv');
  const turnoverData = loadCSVFile('turnover_margin.csv');

  const ppgTeam = findTeamInData(ppgData, teamName);
  const allowedTeam = findTeamInData(allowedData, teamName);
  const fgTeam = findTeamInData(fgData, teamName);
  const reboundTeam = findTeamInData(reboundData, teamName);
  const turnoverTeam = findTeamInData(turnoverData, teamName);

  if (!ppgTeam && !allowedTeam && !fgTeam && !reboundTeam && !turnoverTeam) {
    return null;
  }

  return {
    team: ppgTeam?.team || allowedTeam?.team || fgTeam?.team || reboundTeam?.team || turnoverTeam?.team || teamName,
    pointsPerGame: ppgTeam?.ppg ? parseFloat(ppgTeam.ppg) : null,
    pointsAllowed: allowedTeam?.allowed ? parseFloat(allowedTeam.allowed) : null,
    fieldGoalPct: fgTeam?.fg_pct ? parseFloat(fgTeam.fg_pct) / 100 : null, // Convert from percentage to decimal
    reboundMargin: reboundTeam?.rebound_margin ? parseFloat(reboundTeam.rebound_margin) : null,
    turnoverMargin: turnoverTeam?.turnover_margin ? parseFloat(turnoverTeam.turnover_margin) : null,
  };
}

/**
 * Load NFL team stats from CSV files
 */
export function loadNFLTeamStats(teamName: string): NFLTeamStats | null {
  const ppgData = loadCSVFile('nfl_ppg.csv', 'nfl');
  const allowedData = loadCSVFile('nfl_allowed.csv', 'nfl');
  const offYardsData = loadCSVFile('nfl_off_yards.csv', 'nfl');
  const defYardsData = loadCSVFile('nfl_def_yards.csv', 'nfl');
  const turnoverData = loadCSVFile('nfl_turnover_diff.csv', 'nfl');

  const ppgTeam = findTeamInData(ppgData, teamName);
  const allowedTeam = findTeamInData(allowedData, teamName);
  const offYardsTeam = findTeamInData(offYardsData, teamName);
  const defYardsTeam = findTeamInData(defYardsData, teamName);
  const turnoverTeam = findTeamInData(turnoverData, teamName);

  if (!ppgTeam && !allowedTeam && !offYardsTeam && !defYardsTeam && !turnoverTeam) {
    return null;
  }

  return {
    team: ppgTeam?.team || allowedTeam?.team || offYardsTeam?.team || defYardsTeam?.team || turnoverTeam?.team || teamName,
    pointsPerGame: ppgTeam?.ppg ? parseFloat(ppgTeam.ppg) : null,
    pointsAllowed: allowedTeam?.allowed ? parseFloat(allowedTeam.allowed) : null,
    offensiveYards: offYardsTeam?.off_yards ? parseFloat(offYardsTeam.off_yards) : null,
    defensiveYards: defYardsTeam?.def_yards ? parseFloat(defYardsTeam.def_yards) : null,
    turnoverDiff: turnoverTeam?.turnover_diff ? parseFloat(turnoverTeam.turnover_diff) : null,
  };
}

/**
 * Get a matchup comparison between two teams
 */
export function getMatchupStats(teamA: string, teamB: string, sport: 'nba' | 'nfl' = 'nba'): {
  teamA: NBATeamStats | NFLTeamStats | null;
  teamB: NBATeamStats | NFLTeamStats | null;
  dataSource: string;
} {
  if (sport === 'nfl') {
    return {
      teamA: loadNFLTeamStats(teamA),
      teamB: loadNFLTeamStats(teamB),
      dataSource: 'CSV files (NFL stats)',
    };
  }

  return {
    teamA: loadNBATeamStats(teamA),
    teamB: loadNBATeamStats(teamB),
    dataSource: 'CSV files (NBA stats)',
  };
}

/**
 * Get all NBA team names for suggestions
 */
export function getAllNBATeamNames(): string[] {
  const ppgData = loadCSVFile('ppg.csv');
  return ppgData.map(row => row.team).filter(Boolean);
}

/**
 * Get all NFL team names for suggestions
 */
export function getAllNFLTeamNames(): string[] {
  const ppgData = loadCSVFile('nfl_ppg.csv', 'nfl');
  return ppgData.map(row => row.team).filter(Boolean);
}

/**
 * NBA team name patterns for sport detection
 */
const NBA_TEAM_PATTERNS = [
  // Full names
  'atlanta hawks', 'boston celtics', 'brooklyn nets', 'charlotte hornets',
  'chicago bulls', 'cleveland cavaliers', 'dallas mavericks', 'denver nuggets',
  'detroit pistons', 'golden state warriors', 'houston rockets', 'indiana pacers',
  'los angeles clippers', 'los angeles lakers', 'memphis grizzlies', 'miami heat',
  'milwaukee bucks', 'minnesota timberwolves', 'new orleans pelicans', 'new york knicks',
  'oklahoma city thunder', 'orlando magic', 'philadelphia 76ers', 'phoenix suns',
  'portland trail blazers', 'sacramento kings', 'san antonio spurs', 'toronto raptors',
  'utah jazz', 'washington wizards',
  // Short names / nicknames
  'hawks', 'celtics', 'nets', 'hornets', 'bulls', 'cavaliers', 'cavs',
  'mavericks', 'mavs', 'nuggets', 'pistons', 'warriors', 'dubs', 'rockets',
  'pacers', 'clippers', 'lakers', 'grizzlies', 'grizz', 'heat', 'bucks',
  'timberwolves', 'wolves', 'pelicans', 'pels', 'knicks', 'thunder', 'magic',
  '76ers', 'sixers', 'suns', 'trail blazers', 'blazers', 'kings', 'spurs',
  'raptors', 'jazz', 'wizards',
  // Abbreviations
  'atl', 'bos', 'bkn', 'cha', 'chi', 'cle', 'dal', 'den', 'det', 'gsw', 'gs',
  'hou', 'ind', 'lac', 'lal', 'mem', 'mia', 'mil', 'min', 'nop', 'nyk', 'ny',
  'okc', 'orl', 'phi', 'phx', 'por', 'sac', 'sas', 'sa', 'tor', 'uta', 'was', 'wsh'
];

/**
 * NFL team name patterns for sport detection
 */
const NFL_TEAM_PATTERNS = [
  // Full names
  'arizona cardinals', 'atlanta falcons', 'baltimore ravens', 'buffalo bills',
  'carolina panthers', 'chicago bears', 'cincinnati bengals', 'cleveland browns',
  'dallas cowboys', 'denver broncos', 'detroit lions', 'green bay packers',
  'houston texans', 'indianapolis colts', 'jacksonville jaguars', 'kansas city chiefs',
  'las vegas raiders', 'los angeles chargers', 'los angeles rams', 'miami dolphins',
  'minnesota vikings', 'new england patriots', 'new orleans saints', 'new york giants',
  'new york jets', 'philadelphia eagles', 'pittsburgh steelers', 'san francisco 49ers',
  'seattle seahawks', 'tampa bay buccaneers', 'tennessee titans', 'washington commanders',
  // Short names / nicknames
  'cardinals', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals',
  'browns', 'cowboys', 'broncos', 'lions', 'packers', 'texans', 'colts',
  'jaguars', 'jags', 'chiefs', 'raiders', 'chargers', 'rams', 'dolphins', 'phins',
  'vikings', 'vikes', 'patriots', 'pats', 'saints', 'giants', 'jets', 'eagles',
  'steelers', '49ers', 'niners', 'seahawks', 'hawks', 'buccaneers', 'bucs', 'titans', 'commanders',
  // Abbreviations
  'ari', 'atl', 'bal', 'buf', 'car', 'chi', 'cin', 'cle', 'dal', 'den', 'det',
  'gb', 'hou', 'ind', 'jax', 'kc', 'lv', 'lac', 'lar', 'mia', 'min', 'ne',
  'no', 'nyg', 'nyj', 'phi', 'pit', 'sf', 'sea', 'tb', 'ten', 'was', 'wsh'
];

/**
 * Detect sport from team name
 * Returns 'nba', 'nfl', or null if cannot determine
 */
export function detectSportFromTeam(teamName: string): 'nba' | 'nfl' | null {
  const normalized = teamName.toLowerCase().trim();

  // Check for exact matches in NBA patterns
  for (const pattern of NBA_TEAM_PATTERNS) {
    if (normalized === pattern || normalized.includes(pattern) || pattern.includes(normalized)) {
      // Special case: some terms appear in both (like 'hawks', 'hou', 'atl', 'chi', 'cle', 'dal', 'den', 'det', 'ind', 'mia', 'min')
      // For these, we need additional context
      if (['hawks'].includes(normalized)) {
        // Could be Atlanta Hawks (NBA) or Seattle Seahawks (NFL) - check more context
        if (normalized.includes('atlanta') || normalized === 'hawks') {
          // Default to NBA for just 'hawks' since it's more commonly used
          return 'nba';
        }
      }
      return 'nba';
    }
  }

  // Check for exact matches in NFL patterns
  for (const pattern of NFL_TEAM_PATTERNS) {
    if (normalized === pattern || normalized.includes(pattern) || pattern.includes(normalized)) {
      return 'nfl';
    }
  }

  // Try partial matching with stronger indicators
  // NBA-specific terms
  const nbaOnlyTerms = ['rockets', 'celtics', 'lakers', 'warriors', 'nuggets', 'knicks',
    'jazz', 'spurs', 'bucks', 'pelicans', 'suns', 'magic', 'grizzlies', 'pacers',
    '76ers', 'sixers', 'clippers', 'nets', 'pistons', 'blazers', 'raptors', 'wizards',
    'cavaliers', 'cavs', 'mavericks', 'mavs', 'timberwolves', 'hornets', 'heat',
    'thunder', 'kings', 'gsw', 'bkn', 'nyk', 'okc', 'lal', 'lac', 'phx', 'por',
    'sac', 'sas', 'uta', 'tor', 'orl', 'mem', 'mil', 'nop'];

  for (const term of nbaOnlyTerms) {
    if (normalized.includes(term)) {
      return 'nba';
    }
  }

  // NFL-specific terms
  const nflOnlyTerms = ['cowboys', 'patriots', 'chiefs', 'eagles', 'steelers',
    '49ers', 'niners', 'seahawks', 'packers', 'broncos', 'raiders', 'chargers',
    'rams', 'dolphins', 'bills', 'ravens', 'bengals', 'browns', 'titans',
    'jaguars', 'jags', 'colts', 'texans', 'commanders', 'saints', 'falcons',
    'panthers', 'buccaneers', 'bucs', 'cardinals', 'giants', 'jets', 'lions',
    'bears', 'vikings', 'kc', 'ne', 'gb', 'sf', 'tb', 'lv', 'nyg', 'nyj',
    'jax', 'pit', 'buf', 'bal', 'cin', 'ten', 'car', 'sea', 'lar', 'ari'];

  for (const term of nflOnlyTerms) {
    if (normalized.includes(term)) {
      return 'nfl';
    }
  }

  return null;
}
