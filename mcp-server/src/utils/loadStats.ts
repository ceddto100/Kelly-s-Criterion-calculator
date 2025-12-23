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

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
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

  // Try exact match first
  for (const row of data) {
    const teamName = row.team || row.name || '';
    if (normalizeTeamName(teamName) === normalized) {
      return row;
    }
  }

  // Try partial match
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
    fieldGoalPct: fgTeam?.fg_pct ? parseFloat(fgTeam.fg_pct) : null,
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
