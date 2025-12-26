/**
 * Team Data and Recognition Utilities
 *
 * Comprehensive database of team names, aliases, abbreviations, and home venues
 * for NFL, NBA, CFB, and CBB. Used for natural language parsing of betting requests.
 */

export type Sport = 'NFL' | 'NBA' | 'CFB' | 'CBB';
export type SportCategory = 'football' | 'basketball';

export interface TeamInfo {
  name: string;           // Official team name
  city: string;           // City/location
  abbreviation: string;   // Standard abbreviation
  aliases: string[];      // Common nicknames and variations
  homeVenue: string;      // Stadium/arena name
  homeCity: string;       // City where home games are played
  conference?: string;    // Conference (for college)
}

// ============================================================================
// NFL TEAMS
// ============================================================================

export const NFL_TEAMS: TeamInfo[] = [
  // AFC East
  { name: 'Bills', city: 'Buffalo', abbreviation: 'BUF', aliases: ['buffalo', 'bills', 'buf'], homeVenue: 'Highmark Stadium', homeCity: 'Buffalo' },
  { name: 'Dolphins', city: 'Miami', abbreviation: 'MIA', aliases: ['miami', 'dolphins', 'fins', 'mia'], homeVenue: 'Hard Rock Stadium', homeCity: 'Miami' },
  { name: 'Patriots', city: 'New England', abbreviation: 'NE', aliases: ['new england', 'patriots', 'pats', 'ne', 'boston'], homeVenue: 'Gillette Stadium', homeCity: 'Foxborough' },
  { name: 'Jets', city: 'New York', abbreviation: 'NYJ', aliases: ['jets', 'nyj', 'ny jets', 'new york jets'], homeVenue: 'MetLife Stadium', homeCity: 'East Rutherford' },

  // AFC North
  { name: 'Ravens', city: 'Baltimore', abbreviation: 'BAL', aliases: ['baltimore', 'ravens', 'bal'], homeVenue: 'M&T Bank Stadium', homeCity: 'Baltimore' },
  { name: 'Bengals', city: 'Cincinnati', abbreviation: 'CIN', aliases: ['cincinnati', 'bengals', 'cincy', 'cin'], homeVenue: 'Paycor Stadium', homeCity: 'Cincinnati' },
  { name: 'Browns', city: 'Cleveland', abbreviation: 'CLE', aliases: ['cleveland', 'browns', 'cle'], homeVenue: 'Cleveland Browns Stadium', homeCity: 'Cleveland' },
  { name: 'Steelers', city: 'Pittsburgh', abbreviation: 'PIT', aliases: ['pittsburgh', 'steelers', 'pit'], homeVenue: 'Acrisure Stadium', homeCity: 'Pittsburgh' },

  // AFC South
  { name: 'Texans', city: 'Houston', abbreviation: 'HOU', aliases: ['houston', 'texans', 'hou'], homeVenue: 'NRG Stadium', homeCity: 'Houston' },
  { name: 'Colts', city: 'Indianapolis', abbreviation: 'IND', aliases: ['indianapolis', 'colts', 'indy', 'ind'], homeVenue: 'Lucas Oil Stadium', homeCity: 'Indianapolis' },
  { name: 'Jaguars', city: 'Jacksonville', abbreviation: 'JAX', aliases: ['jacksonville', 'jaguars', 'jags', 'jax'], homeVenue: 'EverBank Stadium', homeCity: 'Jacksonville' },
  { name: 'Titans', city: 'Tennessee', abbreviation: 'TEN', aliases: ['tennessee', 'titans', 'ten', 'nashville'], homeVenue: 'Nissan Stadium', homeCity: 'Nashville' },

  // AFC West
  { name: 'Broncos', city: 'Denver', abbreviation: 'DEN', aliases: ['denver', 'broncos', 'den'], homeVenue: 'Empower Field', homeCity: 'Denver' },
  { name: 'Chiefs', city: 'Kansas City', abbreviation: 'KC', aliases: ['kansas city', 'chiefs', 'kc'], homeVenue: 'Arrowhead Stadium', homeCity: 'Kansas City' },
  { name: 'Raiders', city: 'Las Vegas', abbreviation: 'LV', aliases: ['las vegas', 'raiders', 'lv', 'vegas'], homeVenue: 'Allegiant Stadium', homeCity: 'Las Vegas' },
  { name: 'Chargers', city: 'Los Angeles', abbreviation: 'LAC', aliases: ['chargers', 'lac', 'la chargers', 'los angeles chargers', 'san diego'], homeVenue: 'SoFi Stadium', homeCity: 'Los Angeles' },

  // NFC East
  { name: 'Cowboys', city: 'Dallas', abbreviation: 'DAL', aliases: ['dallas', 'cowboys', 'dal', 'boys'], homeVenue: 'AT&T Stadium', homeCity: 'Arlington' },
  { name: 'Giants', city: 'New York', abbreviation: 'NYG', aliases: ['giants', 'nyg', 'ny giants', 'new york giants'], homeVenue: 'MetLife Stadium', homeCity: 'East Rutherford' },
  { name: 'Eagles', city: 'Philadelphia', abbreviation: 'PHI', aliases: ['philadelphia', 'eagles', 'phi', 'philly'], homeVenue: 'Lincoln Financial Field', homeCity: 'Philadelphia' },
  { name: 'Commanders', city: 'Washington', abbreviation: 'WAS', aliases: ['washington', 'commanders', 'was', 'skins', 'redskins'], homeVenue: 'Commanders Field', homeCity: 'Landover' },

  // NFC North
  { name: 'Bears', city: 'Chicago', abbreviation: 'CHI', aliases: ['chicago', 'bears', 'chi'], homeVenue: 'Soldier Field', homeCity: 'Chicago' },
  { name: 'Lions', city: 'Detroit', abbreviation: 'DET', aliases: ['detroit', 'lions', 'det'], homeVenue: 'Ford Field', homeCity: 'Detroit' },
  { name: 'Packers', city: 'Green Bay', abbreviation: 'GB', aliases: ['green bay', 'packers', 'gb', 'pack'], homeVenue: 'Lambeau Field', homeCity: 'Green Bay' },
  { name: 'Vikings', city: 'Minnesota', abbreviation: 'MIN', aliases: ['minnesota', 'vikings', 'min', 'vikes'], homeVenue: 'U.S. Bank Stadium', homeCity: 'Minneapolis' },

  // NFC South
  { name: 'Falcons', city: 'Atlanta', abbreviation: 'ATL', aliases: ['atlanta', 'falcons', 'atl'], homeVenue: 'Mercedes-Benz Stadium', homeCity: 'Atlanta' },
  { name: 'Panthers', city: 'Carolina', abbreviation: 'CAR', aliases: ['carolina', 'panthers', 'car', 'charlotte'], homeVenue: 'Bank of America Stadium', homeCity: 'Charlotte' },
  { name: 'Saints', city: 'New Orleans', abbreviation: 'NO', aliases: ['new orleans', 'saints', 'no', 'nola'], homeVenue: 'Caesars Superdome', homeCity: 'New Orleans' },
  { name: 'Buccaneers', city: 'Tampa Bay', abbreviation: 'TB', aliases: ['tampa bay', 'buccaneers', 'bucs', 'tb', 'tampa'], homeVenue: 'Raymond James Stadium', homeCity: 'Tampa' },

  // NFC West
  { name: 'Cardinals', city: 'Arizona', abbreviation: 'ARI', aliases: ['arizona', 'cardinals', 'ari', 'cards', 'phoenix'], homeVenue: 'State Farm Stadium', homeCity: 'Glendale' },
  { name: 'Rams', city: 'Los Angeles', abbreviation: 'LAR', aliases: ['rams', 'lar', 'la rams', 'los angeles rams'], homeVenue: 'SoFi Stadium', homeCity: 'Los Angeles' },
  { name: '49ers', city: 'San Francisco', abbreviation: 'SF', aliases: ['san francisco', '49ers', 'niners', 'sf'], homeVenue: "Levi's Stadium", homeCity: 'Santa Clara' },
  { name: 'Seahawks', city: 'Seattle', abbreviation: 'SEA', aliases: ['seattle', 'seahawks', 'sea', 'hawks'], homeVenue: 'Lumen Field', homeCity: 'Seattle' }
];

// ============================================================================
// NBA TEAMS
// ============================================================================

export const NBA_TEAMS: TeamInfo[] = [
  // Atlantic
  { name: 'Celtics', city: 'Boston', abbreviation: 'BOS', aliases: ['boston', 'celtics', 'bos'], homeVenue: 'TD Garden', homeCity: 'Boston' },
  { name: 'Nets', city: 'Brooklyn', abbreviation: 'BKN', aliases: ['brooklyn', 'nets', 'bkn'], homeVenue: 'Barclays Center', homeCity: 'Brooklyn' },
  { name: 'Knicks', city: 'New York', abbreviation: 'NYK', aliases: ['new york', 'knicks', 'nyk'], homeVenue: 'Madison Square Garden', homeCity: 'New York' },
  { name: '76ers', city: 'Philadelphia', abbreviation: 'PHI', aliases: ['philadelphia', '76ers', 'sixers', 'phi', 'philly'], homeVenue: 'Wells Fargo Center', homeCity: 'Philadelphia' },
  { name: 'Raptors', city: 'Toronto', abbreviation: 'TOR', aliases: ['toronto', 'raptors', 'tor'], homeVenue: 'Scotiabank Arena', homeCity: 'Toronto' },

  // Central
  { name: 'Bulls', city: 'Chicago', abbreviation: 'CHI', aliases: ['chicago', 'bulls', 'chi'], homeVenue: 'United Center', homeCity: 'Chicago' },
  { name: 'Cavaliers', city: 'Cleveland', abbreviation: 'CLE', aliases: ['cleveland', 'cavaliers', 'cavs', 'cle'], homeVenue: 'Rocket Mortgage FieldHouse', homeCity: 'Cleveland' },
  { name: 'Pistons', city: 'Detroit', abbreviation: 'DET', aliases: ['detroit', 'pistons', 'det'], homeVenue: 'Little Caesars Arena', homeCity: 'Detroit' },
  { name: 'Pacers', city: 'Indiana', abbreviation: 'IND', aliases: ['indiana', 'pacers', 'ind', 'indianapolis'], homeVenue: 'Gainbridge Fieldhouse', homeCity: 'Indianapolis' },
  { name: 'Bucks', city: 'Milwaukee', abbreviation: 'MIL', aliases: ['milwaukee', 'bucks', 'mil'], homeVenue: 'Fiserv Forum', homeCity: 'Milwaukee' },

  // Southeast
  { name: 'Hawks', city: 'Atlanta', abbreviation: 'ATL', aliases: ['atlanta', 'hawks', 'atl'], homeVenue: 'State Farm Arena', homeCity: 'Atlanta' },
  { name: 'Hornets', city: 'Charlotte', abbreviation: 'CHA', aliases: ['charlotte', 'hornets', 'cha'], homeVenue: 'Spectrum Center', homeCity: 'Charlotte' },
  { name: 'Heat', city: 'Miami', abbreviation: 'MIA', aliases: ['miami', 'heat', 'mia'], homeVenue: 'Kaseya Center', homeCity: 'Miami' },
  { name: 'Magic', city: 'Orlando', abbreviation: 'ORL', aliases: ['orlando', 'magic', 'orl'], homeVenue: 'Amway Center', homeCity: 'Orlando' },
  { name: 'Wizards', city: 'Washington', abbreviation: 'WAS', aliases: ['washington', 'wizards', 'was'], homeVenue: 'Capital One Arena', homeCity: 'Washington' },

  // Northwest
  { name: 'Nuggets', city: 'Denver', abbreviation: 'DEN', aliases: ['denver', 'nuggets', 'den'], homeVenue: 'Ball Arena', homeCity: 'Denver' },
  { name: 'Timberwolves', city: 'Minnesota', abbreviation: 'MIN', aliases: ['minnesota', 'timberwolves', 'wolves', 'min', 'twolves'], homeVenue: 'Target Center', homeCity: 'Minneapolis' },
  { name: 'Thunder', city: 'Oklahoma City', abbreviation: 'OKC', aliases: ['oklahoma city', 'thunder', 'okc'], homeVenue: 'Paycom Center', homeCity: 'Oklahoma City' },
  { name: 'Trail Blazers', city: 'Portland', abbreviation: 'POR', aliases: ['portland', 'trail blazers', 'blazers', 'por'], homeVenue: 'Moda Center', homeCity: 'Portland' },
  { name: 'Jazz', city: 'Utah', abbreviation: 'UTA', aliases: ['utah', 'jazz', 'uta', 'salt lake'], homeVenue: 'Delta Center', homeCity: 'Salt Lake City' },

  // Pacific
  { name: 'Warriors', city: 'Golden State', abbreviation: 'GSW', aliases: ['golden state', 'warriors', 'gsw', 'gs', 'dubs', 'san francisco'], homeVenue: 'Chase Center', homeCity: 'San Francisco' },
  { name: 'Clippers', city: 'Los Angeles', abbreviation: 'LAC', aliases: ['clippers', 'lac', 'la clippers'], homeVenue: 'Intuit Dome', homeCity: 'Inglewood' },
  { name: 'Lakers', city: 'Los Angeles', abbreviation: 'LAL', aliases: ['lakers', 'lal', 'la lakers'], homeVenue: 'Crypto.com Arena', homeCity: 'Los Angeles' },
  { name: 'Suns', city: 'Phoenix', abbreviation: 'PHX', aliases: ['phoenix', 'suns', 'phx'], homeVenue: 'Footprint Center', homeCity: 'Phoenix' },
  { name: 'Kings', city: 'Sacramento', abbreviation: 'SAC', aliases: ['sacramento', 'kings', 'sac'], homeVenue: 'Golden 1 Center', homeCity: 'Sacramento' },

  // Southwest
  { name: 'Mavericks', city: 'Dallas', abbreviation: 'DAL', aliases: ['dallas', 'mavericks', 'mavs', 'dal'], homeVenue: 'American Airlines Center', homeCity: 'Dallas' },
  { name: 'Rockets', city: 'Houston', abbreviation: 'HOU', aliases: ['houston', 'rockets', 'hou'], homeVenue: 'Toyota Center', homeCity: 'Houston' },
  { name: 'Grizzlies', city: 'Memphis', abbreviation: 'MEM', aliases: ['memphis', 'grizzlies', 'grizz', 'mem'], homeVenue: 'FedExForum', homeCity: 'Memphis' },
  { name: 'Pelicans', city: 'New Orleans', abbreviation: 'NOP', aliases: ['new orleans', 'pelicans', 'pels', 'nop', 'nola'], homeVenue: 'Smoothie King Center', homeCity: 'New Orleans' },
  { name: 'Spurs', city: 'San Antonio', abbreviation: 'SAS', aliases: ['san antonio', 'spurs', 'sas'], homeVenue: 'Frost Bank Center', homeCity: 'San Antonio' }
];

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Find a team by any of its aliases, name, city, or abbreviation
 */
export function findTeam(query: string, sport?: Sport): { team: TeamInfo; sport: Sport } | null {
  const normalizedQuery = query.toLowerCase().trim();

  const searchIn = (teams: TeamInfo[], sportType: Sport): { team: TeamInfo; sport: Sport } | null => {
    // First pass: exact matches only (most reliable)
    for (const team of teams) {
      // Check abbreviation (case-insensitive)
      if (team.abbreviation.toLowerCase() === normalizedQuery) {
        return { team, sport: sportType };
      }

      // Check name
      if (team.name.toLowerCase() === normalizedQuery) {
        return { team, sport: sportType };
      }

      // Check city
      if (team.city.toLowerCase() === normalizedQuery) {
        return { team, sport: sportType };
      }

      // Check aliases (exact match only)
      for (const alias of team.aliases) {
        if (alias.toLowerCase() === normalizedQuery) {
          return { team, sport: sportType };
        }
      }
    }

    // Second pass: contained aliases (but query must contain the whole alias)
    for (const team of teams) {
      for (const alias of team.aliases) {
        // Only match if the alias is a distinct word/phrase in the query
        const aliasLower = alias.toLowerCase();
        if (aliasLower.length >= 3 && normalizedQuery.includes(aliasLower)) {
          // Make sure it's not a partial word match
          const idx = normalizedQuery.indexOf(aliasLower);
          const before = idx > 0 ? normalizedQuery[idx - 1] : ' ';
          const after = idx + aliasLower.length < normalizedQuery.length
            ? normalizedQuery[idx + aliasLower.length]
            : ' ';
          // Check if surrounded by word boundaries
          if (/\W/.test(before) || before === ' ' || idx === 0) {
            if (/\W/.test(after) || after === ' ' || idx + aliasLower.length === normalizedQuery.length) {
              return { team, sport: sportType };
            }
          }
        }
      }
    }
    return null;
  };

  // If sport is specified, search only in that league
  if (sport === 'NFL' || sport === 'CFB') {
    return searchIn(NFL_TEAMS, sport);
  }
  if (sport === 'NBA' || sport === 'CBB') {
    return searchIn(NBA_TEAMS, sport);
  }

  // Search all leagues - NBA first for ATL since it's more commonly NBA Hawks
  const nbaResult = searchIn(NBA_TEAMS, 'NBA');
  if (nbaResult) return nbaResult;

  const nflResult = searchIn(NFL_TEAMS, 'NFL');
  if (nflResult) return nflResult;

  return null;
}

/**
 * Find both teams from a matchup string like "Heat vs Hawks"
 */
export function findMatchupTeams(
  text: string,
  sport?: Sport
): { teamA: TeamInfo; teamB: TeamInfo; sport: Sport } | null {
  const normalizedText = text.toLowerCase();

  // Try to find two teams
  const teams = sport
    ? (sport === 'NFL' || sport === 'CFB' ? NFL_TEAMS : NBA_TEAMS)
    : [...NFL_TEAMS, ...NBA_TEAMS];

  const foundTeams: { team: TeamInfo; index: number; sport: Sport }[] = [];

  for (const team of teams) {
    const sportType = NFL_TEAMS.includes(team)
      ? (sport === 'CFB' ? 'CFB' : 'NFL')
      : (sport === 'CBB' ? 'CBB' : 'NBA');

    // Check all aliases and the team name
    const searchTerms = [...team.aliases, team.name.toLowerCase(), team.city.toLowerCase()];

    for (const term of searchTerms) {
      const index = normalizedText.indexOf(term);
      if (index !== -1) {
        // Avoid duplicates
        if (!foundTeams.some(f => f.team.abbreviation === team.abbreviation)) {
          foundTeams.push({ team, index, sport: sportType });
        }
        break;
      }
    }
  }

  if (foundTeams.length >= 2) {
    // Sort by order of appearance in the text
    foundTeams.sort((a, b) => a.index - b.index);
    return {
      teamA: foundTeams[0].team,
      teamB: foundTeams[1].team,
      sport: foundTeams[0].sport
    };
  }

  return null;
}

/**
 * Determine if a city/venue is the home of a team
 */
export function isHomeVenue(venueText: string, team: TeamInfo): boolean {
  const normalizedVenue = venueText.toLowerCase().trim();
  const homeTerms = [
    team.homeCity.toLowerCase(),
    team.homeVenue.toLowerCase(),
    team.city.toLowerCase()
  ];

  return homeTerms.some(term =>
    normalizedVenue.includes(term) || term.includes(normalizedVenue)
  );
}

/**
 * Detect sport from text
 */
export function detectSport(text: string): Sport | null {
  const normalizedText = text.toLowerCase();

  // Explicit sport mentions
  if (/\bnfl\b/.test(normalizedText)) return 'NFL';
  if (/\bnba\b/.test(normalizedText)) return 'NBA';
  if (/\bcfb\b|\bcollege football\b|\bncaa football\b/.test(normalizedText)) return 'CFB';
  if (/\bcbb\b|\bcollege basketball\b|\bncaa basketball\b|\bmarch madness\b/.test(normalizedText)) return 'CBB';

  // Check for team names
  for (const team of NFL_TEAMS) {
    for (const alias of team.aliases) {
      if (normalizedText.includes(alias)) return 'NFL';
    }
  }

  for (const team of NBA_TEAMS) {
    for (const alias of team.aliases) {
      if (normalizedText.includes(alias)) return 'NBA';
    }
  }

  return null;
}

/**
 * Get sport category (football or basketball)
 */
export function getSportCategory(sport: Sport): SportCategory {
  return (sport === 'NFL' || sport === 'CFB') ? 'football' : 'basketball';
}
