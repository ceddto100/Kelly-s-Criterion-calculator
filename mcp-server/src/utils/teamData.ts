/**
 * Team Data and Recognition Utilities
 *
 * Comprehensive database of team names, aliases, abbreviations, and home venues
 * for NFL, NBA, NHL, CFB, and CBB. Used for natural language parsing of betting requests.
 */

export type Sport = 'NFL' | 'NBA' | 'NHL' | 'CFB' | 'CBB';
export type SportCategory = 'football' | 'basketball' | 'hockey';

export interface TeamInfo {
  name: string;           // Official team name
  city: string;           // City/location
  abbreviation: string;   // Standard abbreviation
  aliases: string[];      // Common nicknames and variations
  homeVenue: string;      // Stadium/arena name
  homeCity: string;       // City where home games are played
  conference?: string;    // Conference (for college)
}

export interface ResolvedTeam {
  team: TeamInfo;
  sport: Sport;
  matchedAlias: string;
  confidence: number;
  matchType: 'alias' | 'abbreviation' | 'contains' | 'fuzzy';
}

type ScoredAliasEntry = AliasEntry & {
  score: number;
  matchType: ResolvedTeam['matchType'];
  anchorMatched: boolean;
};

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
// NHL TEAMS
// ============================================================================

export const NHL_TEAMS: TeamInfo[] = [
  { name: 'Ducks', city: 'Anaheim', abbreviation: 'ANA', aliases: ['anaheim', 'ducks', 'ana', 'mighty ducks'], homeVenue: 'Honda Center', homeCity: 'Anaheim' },
  { name: 'Bruins', city: 'Boston', abbreviation: 'BOS', aliases: ['boston', 'bruins', 'bos'], homeVenue: 'TD Garden', homeCity: 'Boston' },
  { name: 'Sabres', city: 'Buffalo', abbreviation: 'BUF', aliases: ['buffalo', 'sabres', 'sabre', 'buf'], homeVenue: 'KeyBank Center', homeCity: 'Buffalo' },
  { name: 'Flames', city: 'Calgary', abbreviation: 'CGY', aliases: ['calgary', 'flames', 'cgy'], homeVenue: 'Scotiabank Saddledome', homeCity: 'Calgary' },
  { name: 'Hurricanes', city: 'Carolina', abbreviation: 'CAR', aliases: ['carolina', 'hurricanes', 'canes', 'car'], homeVenue: 'Lenovo Center', homeCity: 'Raleigh' },
  { name: 'Blackhawks', city: 'Chicago', abbreviation: 'CHI', aliases: ['chicago', 'blackhawks', 'hawks', 'chi'], homeVenue: 'United Center', homeCity: 'Chicago' },
  { name: 'Avalanche', city: 'Colorado', abbreviation: 'COL', aliases: ['colorado', 'avalanche', 'avs', 'col'], homeVenue: 'Ball Arena', homeCity: 'Denver' },
  { name: 'Blue Jackets', city: 'Columbus', abbreviation: 'CBJ', aliases: ['columbus', 'blue jackets', 'jackets', 'cbj'], homeVenue: 'Nationwide Arena', homeCity: 'Columbus' },
  { name: 'Stars', city: 'Dallas', abbreviation: 'DAL', aliases: ['dallas', 'stars', 'dal'], homeVenue: 'American Airlines Center', homeCity: 'Dallas' },
  { name: 'Red Wings', city: 'Detroit', abbreviation: 'DET', aliases: ['detroit', 'red wings', 'wings', 'det'], homeVenue: 'Little Caesars Arena', homeCity: 'Detroit' },
  { name: 'Oilers', city: 'Edmonton', abbreviation: 'EDM', aliases: ['edmonton', 'oilers', 'edm'], homeVenue: 'Rogers Place', homeCity: 'Edmonton' },
  { name: 'Panthers', city: 'Florida', abbreviation: 'FLA', aliases: ['florida', 'panthers', 'cats', 'fla'], homeVenue: 'Amerant Bank Arena', homeCity: 'Sunrise' },
  { name: 'Kings', city: 'Los Angeles', abbreviation: 'LAK', aliases: ['los angeles', 'la kings', 'kings', 'lak'], homeVenue: 'Crypto.com Arena', homeCity: 'Los Angeles' },
  { name: 'Wild', city: 'Minnesota', abbreviation: 'MIN', aliases: ['minnesota', 'wild', 'min'], homeVenue: 'Xcel Energy Center', homeCity: 'St. Paul' },
  { name: 'Canadiens', city: 'Montreal', abbreviation: 'MTL', aliases: ['montreal', 'canadiens', 'habs', 'mtl'], homeVenue: 'Bell Centre', homeCity: 'Montreal' },
  { name: 'Predators', city: 'Nashville', abbreviation: 'NSH', aliases: ['nashville', 'predators', 'preds', 'nsh'], homeVenue: 'Bridgestone Arena', homeCity: 'Nashville' },
  { name: 'Devils', city: 'New Jersey', abbreviation: 'NJD', aliases: ['new jersey', 'devils', 'njd', 'nj'], homeVenue: 'Prudential Center', homeCity: 'Newark' },
  { name: 'Islanders', city: 'New York', abbreviation: 'NYI', aliases: ['new york islanders', 'islanders', 'isles', 'nyi'], homeVenue: 'UBS Arena', homeCity: 'Elmont' },
  { name: 'Rangers', city: 'New York', abbreviation: 'NYR', aliases: ['new york rangers', 'rangers', 'nyr'], homeVenue: 'Madison Square Garden', homeCity: 'New York' },
  { name: 'Senators', city: 'Ottawa', abbreviation: 'OTT', aliases: ['ottawa', 'senators', 'sens', 'ott'], homeVenue: 'Canadian Tire Centre', homeCity: 'Ottawa' },
  { name: 'Flyers', city: 'Philadelphia', abbreviation: 'PHI', aliases: ['philadelphia', 'flyers', 'phi', 'philly'], homeVenue: 'Wells Fargo Center', homeCity: 'Philadelphia' },
  { name: 'Penguins', city: 'Pittsburgh', abbreviation: 'PIT', aliases: ['pittsburgh', 'penguins', 'pens', 'pit'], homeVenue: 'PPG Paints Arena', homeCity: 'Pittsburgh' },
  { name: 'Sharks', city: 'San Jose', abbreviation: 'SJS', aliases: ['san jose', 'sharks', 'sjs', 'sj'], homeVenue: 'SAP Center', homeCity: 'San Jose' },
  { name: 'Kraken', city: 'Seattle', abbreviation: 'SEA', aliases: ['seattle', 'kraken', 'sea'], homeVenue: 'Climate Pledge Arena', homeCity: 'Seattle' },
  { name: 'Blues', city: 'St. Louis', abbreviation: 'STL', aliases: ['st louis', 'saint louis', 'blues', 'stl'], homeVenue: 'Enterprise Center', homeCity: 'St. Louis' },
  { name: 'Lightning', city: 'Tampa Bay', abbreviation: 'TBL', aliases: ['tampa bay', 'lightning', 'bolts', 'tbl', 'tampa'], homeVenue: 'Amalie Arena', homeCity: 'Tampa' },
  { name: 'Maple Leafs', city: 'Toronto', abbreviation: 'TOR', aliases: ['toronto', 'maple leafs', 'leafs', 'tor'], homeVenue: 'Scotiabank Arena', homeCity: 'Toronto' },
  { name: 'Canucks', city: 'Vancouver', abbreviation: 'VAN', aliases: ['vancouver', 'canucks', 'nucks', 'van'], homeVenue: 'Rogers Arena', homeCity: 'Vancouver' },
  { name: 'Golden Knights', city: 'Vegas', abbreviation: 'VGK', aliases: ['vegas', 'las vegas', 'golden knights', 'knights', 'vgk'], homeVenue: 'T-Mobile Arena', homeCity: 'Las Vegas' },
  { name: 'Jets', city: 'Winnipeg', abbreviation: 'WPG', aliases: ['winnipeg', 'jets', 'wpg'], homeVenue: 'Canada Life Centre', homeCity: 'Winnipeg' },
  { name: 'Capitals', city: 'Washington', abbreviation: 'WSH', aliases: ['washington', 'capitals', 'caps', 'wsh', 'dc'], homeVenue: 'Capital One Arena', homeCity: 'Washington' },
  { name: 'Hockey Club', city: 'Utah', abbreviation: 'UTA', aliases: ['utah', 'hockey club', 'utah hockey club', 'utah hc', 'uta'], homeVenue: 'Delta Center', homeCity: 'Salt Lake City' }
];

// ============================================================================
// ALIAS NORMALIZATION + FUZZY SUPPORT
// ============================================================================

export interface AliasEntry {
  alias: string;
  team: TeamInfo;
  sport: Sport;
  isAbbreviation?: boolean;
}

function normalizeAlias(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 0;
  return 1 - distance / maxLength;
}

function buildAliasIndex(teams: TeamInfo[], sport: Sport): AliasEntry[] {
  const entries: AliasEntry[] = [];

  for (const team of teams) {
    const aliasSet = new Set<string>();
    aliasSet.add(team.name);
    aliasSet.add(team.city);
    aliasSet.add(team.abbreviation.toLowerCase());
    aliasSet.add(`${team.city} ${team.name}`);

    for (const alias of team.aliases) {
      aliasSet.add(alias);
    }

    // Normalized aliases (deduplicated after normalization)
    const normalizedAliases = new Set<string>();
    for (const alias of aliasSet) {
      const normalized = normalizeAlias(alias);
      if (normalized && !normalizedAliases.has(normalized)) {
        normalizedAliases.add(normalized);
        entries.push({
          alias: normalized,
          team,
          sport,
          isAbbreviation: normalized === team.abbreviation.toLowerCase()
        });
      }
    }
  }

  return entries;
}

const ALIAS_INDEX: Record<Sport, AliasEntry[]> = {
  NFL: buildAliasIndex(NFL_TEAMS, 'NFL'),
  CFB: buildAliasIndex(NFL_TEAMS, 'CFB'),
  NBA: buildAliasIndex(NBA_TEAMS, 'NBA'),
  CBB: buildAliasIndex(NBA_TEAMS, 'CBB'),
  NHL: buildAliasIndex(NHL_TEAMS, 'NHL')
};

function getAliasEntriesForSport(sport?: Sport): AliasEntry[] {
  if (sport) return ALIAS_INDEX[sport];
  // Default priority favors basketball for overlapping cities like ATL/LAC/LAL
  return [...ALIAS_INDEX.NBA, ...ALIAS_INDEX.NHL, ...ALIAS_INDEX.NFL];
}

export function listTeamAliases(sport?: Sport): AliasEntry[] {
  return getAliasEntriesForSport(sport);
}

// ============================================================================
// TEAM RESOLUTION (DETERMINISTIC + CONFIDENCE)
// ============================================================================

export function resolveTeamName(
  input: string,
  sport?: Sport
): { success: true; resolved: ResolvedTeam } | { success: false; error: string } {
  const normalizedInput = normalizeAlias(input);
  if (!normalizedInput) {
    return { success: false, error: 'Team name is empty or malformed' };
  }

  const candidates = getAliasEntriesForSport(sport);

  let best: ScoredAliasEntry | null = null;
  let runnerUp: ScoredAliasEntry | null = null;

  for (const entry of candidates) {
    const alias = entry.alias;
    const abbreviationMatch = normalizedInput === entry.team.abbreviation.toLowerCase();
    const exactAliasMatch = normalizedInput === alias;
    const containsAlias = !exactAliasMatch && normalizedInput.includes(alias) && alias.length >= 3;

    let score = 0;
    let matchType: ResolvedTeam['matchType'] = 'fuzzy';

    if (abbreviationMatch) {
      score = 1;
      matchType = 'abbreviation';
    } else if (exactAliasMatch) {
      score = 1;
      matchType = 'alias';
    } else if (containsAlias) {
      score = 0.97;
      matchType = 'contains';
    } else {
      score = similarity(normalizedInput, alias);
      matchType = 'fuzzy';
    }

    const candidate: ScoredAliasEntry = {
      ...entry,
      score,
      matchType,
      anchorMatched: abbreviationMatch || exactAliasMatch || containsAlias
    };

    if (!best || candidate.score > best.score) {
      runnerUp = best;
      best = candidate;
    } else if (!runnerUp || candidate.score > runnerUp.score) {
      runnerUp = candidate;
    }
  }

  if (!best || best.score < 0.8) {
    return {
      success: false,
      error: `Could not confidently resolve team "${input}". Please double-check the spelling.`
    };
  }

  const scoreGap = best.score - (runnerUp?.score ?? 0);
  const aliasTie = runnerUp && runnerUp.score === best.score && runnerUp.alias === best.alias;

  if (
    (best.matchType === 'fuzzy' && scoreGap < 0.2) ||
    (aliasTie && best.matchType !== 'abbreviation')
  ) {
    return {
      success: false,
      error: `Ambiguous team reference "${input}". Please specify the exact team name.`
    };
  }

  // Do not silently substitute when the text includes an explicit alias
  const aliasAnchored = best.anchorMatched || normalizedInput.includes(best.alias);
  if (!aliasAnchored && best.matchType !== 'abbreviation') {
    return {
      success: false,
      error: `Could not anchor team reference "${input}" to a known alias. Please clarify the opponent.`
    };
  }

  return {
    success: true,
    resolved: {
      team: best.team,
      sport: best.sport,
      matchedAlias: best.alias,
      confidence: best.score,
      matchType: best.matchType
    }
  };
}

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Find a team by any of its aliases, name, city, or abbreviation
 */
export function findTeam(query: string, sport?: Sport): { team: TeamInfo; sport: Sport } | null {
  const resolved = resolveTeamName(query, sport);
  if (resolved.success) {
    return { team: resolved.resolved.team, sport: resolved.resolved.sport };
  }
  return null;
}

/**
 * Find both teams from a matchup string like "Heat vs Hawks"
 */
export function findMatchupTeams(
  text: string,
  sport?: Sport
): { teamA: TeamInfo; teamB: TeamInfo; sport: Sport } | null {
  const normalizedText = normalizeAlias(text);

  const matchupPatterns: { regex: RegExp; pattern: 'at' | 'vs' | 'v' }[] = [
    { regex: /\b([a-z0-9\s\.]+?)\s+(?:at|@)\s+([a-z0-9\s\.]+?)(?=,|\.|;|\(|$)/i, pattern: 'at' },
    { regex: /\b([a-z0-9\s\.]+?)\s+(?:vs\.?|v)\s+([a-z0-9\s\.]+?)(?=,|\.|;|\(|$)/i, pattern: 'vs' }
  ];

  for (const { regex } of matchupPatterns) {
    const match = regex.exec(text);
    if (match) {
      const rawA = match[1].trim();
      const rawB = match[2].trim();
      const resolvedA = resolveTeamName(rawA, sport);
      const resolvedB = resolveTeamName(rawB, sport);

      if (resolvedA.success && resolvedB.success) {
        const resolvedSport = sport ?? (resolvedA.resolved.sport === resolvedB.resolved.sport ? resolvedA.resolved.sport : null);
        if (resolvedSport) {
          return {
            teamA: resolvedA.resolved.team,
            teamB: resolvedB.resolved.team,
            sport: resolvedSport
          };
        }
      }
    }
  }

  // Fallback: find first two explicit alias mentions in text
  const candidates = getAliasEntriesForSport(sport);
  const matches: { entry: AliasEntry; index: number }[] = [];

  for (const entry of candidates) {
    const aliasRegex = new RegExp(`\\b${entry.alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
    const matchIndex = normalizedText.search(aliasRegex);
    if (matchIndex !== -1) {
      if (!matches.some(m => m.entry.team.abbreviation === entry.team.abbreviation)) {
        matches.push({ entry, index: matchIndex });
      }
    }
  }

  matches.sort((a, b) => a.index - b.index);

  if (matches.length >= 2) {
    const first = matches[0];
    const second = matches[1];
    const resolvedSport = sport ?? (first.entry.sport === second.entry.sport ? first.entry.sport : null);

    if (resolvedSport) {
      return {
        teamA: first.entry.team,
        teamB: second.entry.team,
        sport: resolvedSport
      };
    }
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
  if (/\bnhl\b|\bhockey\b/.test(normalizedText)) return 'NHL';
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

  for (const team of NHL_TEAMS) {
    for (const alias of team.aliases) {
      if (normalizedText.includes(alias)) return 'NHL';
    }
  }

  return null;
}

/**
 * Get sport category (football or basketball)
 */
export function getSportCategory(sport: Sport): SportCategory {
  if (sport === 'NFL' || sport === 'CFB') return 'football';
  if (sport === 'NBA' || sport === 'CBB') return 'basketball';
  return 'hockey';
}
