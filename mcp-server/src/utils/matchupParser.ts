/**
 * Natural Language Matchup Parser
 *
 * Parses betting requests in natural language format to extract:
 * - Sport (NFL, NBA, CFB, CBB)
 * - Teams involved in the matchup
 * - Point spread and which team is favored
 * - User's pick (which team they're betting on)
 * - Venue information (home/away/neutral)
 * - Odds (if provided)
 */

import {
  Sport,
  SportCategory,
  TeamInfo,
  isHomeVenue,
  detectSport,
  getSportCategory,
  resolveTeamName,
  listTeamAliases,
  ResolvedTeam
} from './teamData.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ParsedMatchup {
  sport: Sport;
  sportCategory: SportCategory;
  teamA: TeamInfo;          // User's picked team
  teamB: TeamInfo;          // Opponent
  spread: number;           // From perspective of teamA (negative if favored)
  venue: 'home' | 'away' | 'neutral';
  venueAssumed: boolean;    // Whether venue was inferred vs explicitly stated
  americanOdds?: number;    // If odds were provided
  rawText: string;          // Original input for traceability
  parsingNotes: string[];   // Notes about assumptions made
}

export interface ParsingResult {
  success: boolean;
  parsed?: ParsedMatchup;
  error?: string;
  clarificationNeeded?: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface MatchupTokens {
  teamAText: string;
  teamBText: string;
}

function normalizeForMatching(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract ordered team mentions from natural language text.
 * Returns candidates in priority order (explicit matchup patterns first, then alias mentions).
 */
function extractMatchupTokens(text: string, sport?: Sport): MatchupTokens[] {
  const compactText = text.replace(/\s+/g, ' ');
  const cleanedText = compactText.replace(/^\s*(nba|nfl|cbb|cfb)\s*[:\-]?\s*/i, '');
  const candidates: MatchupTokens[] = [];

  const matchupPatterns: RegExp[] = [
    /\b([a-z0-9\s\.\']{2,40}?)\s+(?:at|@)\s+([a-z0-9\s\.\']{2,40}?)(?=,|\.|;|\(|$)/i,
    /\b([a-z0-9\s\.\']{2,40}?)\s+(?:vs\.?|v)\s+([a-z0-9\s\.\']{2,40}?)(?=,|\.|;|\(|$)/i,
    /\b([a-z0-9\s\.\']{2,40}?)\s+versus\s+([a-z0-9\s\.\']{2,40}?)(?=,|\.|;|\(|$)/i
  ];

  for (const pattern of matchupPatterns) {
    const match = pattern.exec(cleanedText);
    if (match) {
      const teamAText = match[1].trim();
      const teamBText = match[2].trim();
      if (teamAText && teamBText) {
        candidates.push({ teamAText, teamBText });
        break;
      }
    }
  }

  // Fallback: find first two alias mentions in text (deterministic order by appearance)
  const normalizedText = normalizeForMatching(text);
  const aliasEntries = listTeamAliases(sport);
  const mentions: { alias: string; index: number }[] = [];

  const seenTeams = new Set<string>();

  for (const entry of aliasEntries) {
    const escapedAlias = escapeRegExp(entry.alias);
    const aliasRegex = new RegExp(`\\b${escapedAlias.replace(/\s+/g, '\\s+')}\\b`, 'i');
    const match = aliasRegex.exec(normalizedText);
    if (match) {
      const index = match.index;
      if (!seenTeams.has(entry.team.abbreviation)) {
        mentions.push({ alias: entry.alias, index });
        seenTeams.add(entry.team.abbreviation);
      }
    }
  }

  mentions.sort((a, b) => a.index - b.index);

  if (mentions.length >= 2) {
    const fallbackTokens: MatchupTokens = {
      teamAText: mentions[0].alias,
      teamBText: mentions[1].alias
    };

    // Avoid duplicate candidate entries
    const existing = candidates.some(
      c =>
        normalizeForMatching(c.teamAText) === normalizeForMatching(fallbackTokens.teamAText) &&
        normalizeForMatching(c.teamBText) === normalizeForMatching(fallbackTokens.teamBText)
    );
    if (!existing) {
      candidates.push(fallbackTokens);
    }
  }

  return candidates;
}

// ============================================================================
// SPREAD PARSING
// ============================================================================

/**
 * Parse spread from various formats:
 * - Numeric: -3.5, +7, 3.5
 * - Text: "minus three and a half", "favored by 7"
 * - With team: "Hawks -3.5", "-3.5 Hawks"
 */
function parseSpread(text: string): { spread: number; favoredTeamHint?: string } | null {
  const normalizedText = text.toLowerCase();

  // Pattern: explicit numeric spread like "-3.5", "+7", "3.5"
  const numericPattern = /([+-]?\d+(?:\.\d+)?)\s*(?:pt|pts|point|points)?/gi;
  const spreadMatches: { value: number; index: number }[] = [];

  let match;
  while ((match = numericPattern.exec(normalizedText)) !== null) {
    const value = parseFloat(match[1]);
    // Filter out numbers that are clearly not spreads (like years, scores)
    if (Math.abs(value) <= 50 && Math.abs(value) >= 0.5) {
      spreadMatches.push({ value, index: match.index });
    }
  }

  // Pattern: "favored by X" or "X point favorites"
  const favoredPattern = /favou?red\s+by\s+(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:-?\s*point\s+)?favou?rites?/gi;
  const favoredMatch = favoredPattern.exec(normalizedText);
  if (favoredMatch) {
    const value = parseFloat(favoredMatch[1] || favoredMatch[2]);
    return { spread: -value }; // Negative because they're favored
  }

  // Pattern: "X point underdogs"
  const underdogPattern = /(\d+(?:\.\d+)?)\s*(?:-?\s*point\s+)?underdogs?/gi;
  const underdogMatch = underdogPattern.exec(normalizedText);
  if (underdogMatch) {
    const value = parseFloat(underdogMatch[1]);
    return { spread: value }; // Positive because they're underdogs
  }

  // Pattern: text numbers like "minus three and a half"
  const textNumberPatterns: { pattern: RegExp; value: number }[] = [
    { pattern: /minus\s+(?:one|1)\s+(?:and\s+a\s+)?half/i, value: -1.5 },
    { pattern: /minus\s+(?:two|2)\s+(?:and\s+a\s+)?half/i, value: -2.5 },
    { pattern: /minus\s+(?:three|3)\s+(?:and\s+a\s+)?half/i, value: -3.5 },
    { pattern: /minus\s+(?:four|4)\s+(?:and\s+a\s+)?half/i, value: -4.5 },
    { pattern: /minus\s+(?:five|5)\s+(?:and\s+a\s+)?half/i, value: -5.5 },
    { pattern: /minus\s+(?:six|6)\s+(?:and\s+a\s+)?half/i, value: -6.5 },
    { pattern: /minus\s+(?:seven|7)\s+(?:and\s+a\s+)?half/i, value: -7.5 },
    { pattern: /plus\s+(?:one|1)\s+(?:and\s+a\s+)?half/i, value: 1.5 },
    { pattern: /plus\s+(?:two|2)\s+(?:and\s+a\s+)?half/i, value: 2.5 },
    { pattern: /plus\s+(?:three|3)\s+(?:and\s+a\s+)?half/i, value: 3.5 },
    { pattern: /plus\s+(?:four|4)\s+(?:and\s+a\s+)?half/i, value: 4.5 },
    { pattern: /plus\s+(?:five|5)\s+(?:and\s+a\s+)?half/i, value: 5.5 },
    { pattern: /plus\s+(?:six|6)\s+(?:and\s+a\s+)?half/i, value: 6.5 },
    { pattern: /plus\s+(?:seven|7)\s+(?:and\s+a\s+)?half/i, value: 7.5 },
    { pattern: /minus\s+(?:one|1)\b/i, value: -1 },
    { pattern: /minus\s+(?:two|2)\b/i, value: -2 },
    { pattern: /minus\s+(?:three|3)\b/i, value: -3 },
    { pattern: /minus\s+(?:four|4)\b/i, value: -4 },
    { pattern: /minus\s+(?:five|5)\b/i, value: -5 },
    { pattern: /minus\s+(?:six|6)\b/i, value: -6 },
    { pattern: /minus\s+(?:seven|7)\b/i, value: -7 },
    { pattern: /plus\s+(?:one|1)\b/i, value: 1 },
    { pattern: /plus\s+(?:two|2)\b/i, value: 2 },
    { pattern: /plus\s+(?:three|3)\b/i, value: 3 },
    { pattern: /plus\s+(?:four|4)\b/i, value: 4 },
    { pattern: /plus\s+(?:five|5)\b/i, value: 5 },
    { pattern: /plus\s+(?:six|6)\b/i, value: 6 },
    { pattern: /plus\s+(?:seven|7)\b/i, value: 7 }
  ];

  for (const { pattern, value } of textNumberPatterns) {
    if (pattern.test(normalizedText)) {
      return { spread: value };
    }
  }

  // Return the first valid spread found
  if (spreadMatches.length > 0) {
    return { spread: spreadMatches[0].value };
  }

  return null;
}

/**
 * Parse which team the spread is attached to
 * e.g., "Hawks -3.5" -> Hawks are favored by 3.5
 */
function findSpreadTeam(text: string, spread: number, teams: { teamA: TeamInfo; teamB: TeamInfo }): string | null {
  const normalizedText = text.toLowerCase();
  const spreadStr = spread.toString().replace('-', '').replace('+', '');

  // Look for patterns like "Hawks -3.5" or "-3.5 Hawks"
  for (const alias of [...teams.teamA.aliases, teams.teamA.name.toLowerCase()]) {
    const pattern1 = new RegExp(`${alias}\\s*[-+]?\\s*${spreadStr}`, 'i');
    const pattern2 = new RegExp(`[-+]?\\s*${spreadStr}\\s*${alias}`, 'i');
    if (pattern1.test(normalizedText) || pattern2.test(normalizedText)) {
      return teams.teamA.abbreviation;
    }
  }

  for (const alias of [...teams.teamB.aliases, teams.teamB.name.toLowerCase()]) {
    const pattern1 = new RegExp(`${alias}\\s*[-+]?\\s*${spreadStr}`, 'i');
    const pattern2 = new RegExp(`[-+]?\\s*${spreadStr}\\s*${alias}`, 'i');
    if (pattern1.test(normalizedText) || pattern2.test(normalizedText)) {
      return teams.teamB.abbreviation;
    }
  }

  return null;
}

// ============================================================================
// PICK PARSING
// ============================================================================

/**
 * Parse which team the user is picking
 * Looks for phrases like "I'm taking Hawks", "my pick is Atlanta", "betting on Hawks"
 */
function parseUserPick(text: string, teams: { teamA: TeamInfo; teamB: TeamInfo }): string | null {
  const normalizedText = text.toLowerCase();

  // Patterns that indicate a pick
  const pickPatterns = [
    /(?:i'?m\s+)?tak(?:e|ing)\s+(?:the\s+)?(\w+)/i,
    /(?:my\s+)?pick\s+(?:is\s+)?(?:the\s+)?(\w+)/i,
    /bet(?:ting)?\s+(?:on\s+)?(?:the\s+)?(\w+)/i,
    /going\s+(?:with\s+)?(?:the\s+)?(\w+)/i,
    /i\s+(?:like|want|choose)\s+(?:the\s+)?(\w+)/i,
    /backing\s+(?:the\s+)?(\w+)/i
  ];

  for (const pattern of pickPatterns) {
    const match = pattern.exec(normalizedText);
    if (match) {
      const pickedTeam = match[1].toLowerCase();

      // Check if it matches teamA
      const teamAMatch = teams.teamA.aliases.some(a => a.includes(pickedTeam) || pickedTeam.includes(a)) ||
        teams.teamA.name.toLowerCase().includes(pickedTeam) ||
        teams.teamA.city.toLowerCase().includes(pickedTeam);

      if (teamAMatch) return teams.teamA.abbreviation;

      // Check if it matches teamB
      const teamBMatch = teams.teamB.aliases.some(a => a.includes(pickedTeam) || pickedTeam.includes(a)) ||
        teams.teamB.name.toLowerCase().includes(pickedTeam) ||
        teams.teamB.city.toLowerCase().includes(pickedTeam);

      if (teamBMatch) return teams.teamB.abbreviation;
    }
  }

  return null;
}

// ============================================================================
// VENUE PARSING
// ============================================================================

/**
 * Parse venue information from text
 */
function parseVenue(
  text: string,
  teamA: TeamInfo,
  teamB: TeamInfo
): { venue: 'home' | 'away' | 'neutral'; assumed: boolean } {
  const normalizedText = text.toLowerCase();

  // Explicit neutral
  if (/neutral\s+(?:site|venue|field|court)/i.test(normalizedText)) {
    return { venue: 'neutral', assumed: false };
  }

  // Look for "at" or "in" patterns
  const atPattern = /(?:at|in|@)\s+(\w+(?:\s+\w+)?)/gi;
  let match;

  while ((match = atPattern.exec(normalizedText)) !== null) {
    const location = match[1].toLowerCase();

    // Check if location matches teamA's home
    if (isHomeVenue(location, teamA)) {
      return { venue: 'home', assumed: false };
    }

    // Check if location matches teamB's home
    if (isHomeVenue(location, teamB)) {
      return { venue: 'away', assumed: false };
    }
  }

  // Look for explicit home/away mentions
  const homePatterns = [
    new RegExp(`${teamA.name}\\s+(?:at\\s+)?home`, 'i'),
    new RegExp(`home\\s+(?:game\\s+)?(?:for\\s+)?${teamA.name}`, 'i'),
    ...teamA.aliases.map(a => new RegExp(`${a}\\s+at\\s+home`, 'i'))
  ];

  const awayPatterns = [
    new RegExp(`${teamA.name}\\s+(?:on\\s+the\\s+)?road`, 'i'),
    new RegExp(`${teamA.name}\\s+away`, 'i'),
    new RegExp(`away\\s+(?:game\\s+)?(?:for\\s+)?${teamA.name}`, 'i')
  ];

  for (const pattern of homePatterns) {
    if (pattern.test(normalizedText)) {
      return { venue: 'home', assumed: false };
    }
  }

  for (const pattern of awayPatterns) {
    if (pattern.test(normalizedText)) {
      return { venue: 'away', assumed: false };
    }
  }

  const teamAliases = [teamA.name, ...teamA.aliases].map(alias => alias.toLowerCase());
  for (const alias of teamAliases) {
    const escapedAlias = escapeRegExp(alias);
    const awayProximity = new RegExp(`\\b${escapedAlias}\\b[^\\n]{0,40}\\baway\\b`, 'i');
    const roadProximity = new RegExp(`\\b${escapedAlias}\\b[^\\n]{0,40}\\b(?:on\\s+the\\s+road|road)\\b`, 'i');

    if (awayProximity.test(normalizedText) || roadProximity.test(normalizedText)) {
      return { venue: 'away', assumed: false };
    }
  }

  // Look for city mentions that might indicate venue
  for (const alias of teamA.aliases) {
    if (normalizedText.includes(`in ${alias}`) || normalizedText.includes(`at ${alias}`)) {
      return { venue: 'home', assumed: false };
    }
  }

  for (const alias of teamB.aliases) {
    if (normalizedText.includes(`in ${alias}`) || normalizedText.includes(`at ${alias}`)) {
      return { venue: 'away', assumed: false };
    }
  }

  // Default to neutral with assumption flag
  return { venue: 'neutral', assumed: true };
}

// ============================================================================
// ODDS PARSING
// ============================================================================

/**
 * Parse American odds from text
 */
function parseOdds(text: string): number | null {
  const normalizedText = text.toLowerCase();

  // Pattern for American odds: -110, +150, etc.
  const oddsPatterns = [
    /(?:odds?|at)\s*([+-]?\d{3,4})\b/i,
    /([+-]\d{3,4})\s*odds?/i,
    /\b([+-]\d{3})\b(?!\s*(?:pt|point|spread))/i  // Avoid matching spreads
  ];

  for (const pattern of oddsPatterns) {
    const match = pattern.exec(normalizedText);
    if (match) {
      const odds = parseInt(match[1], 10);
      // Valid American odds are >= 100 or <= -100
      if (odds >= 100 || odds <= -100) {
        return odds;
      }
    }
  }

  return null;
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Parse a natural language betting request into structured data
 */
export function parseMatchupRequest(text: string): ParsingResult {
  const notes: string[] = [];
  const normalizedLower = text.toLowerCase();
  const explicitSportMentioned = /\b(nfl|nba|cfb|cbb|college football|ncaa football|college basketball|ncaa basketball|march madness)\b/.test(normalizedLower);

  // 1. Detect sport
  const detectedSport = detectSport(text);
  let sport = explicitSportMentioned ? detectedSport : null;

  // 2. Extract and resolve team mentions deterministically
  const tokenOptions = extractMatchupTokens(text, sport);
  if (!tokenOptions.length) {
    return {
      success: false,
      error: 'Could not identify both teams. Please provide a clear "A vs B" or "A at B" matchup.',
      clarificationNeeded: ['teams', 'sport']
    };
  }

  let teamAResolution: { success: true; resolved: ResolvedTeam } | null = null;
  let teamBResolution: { success: true; resolved: ResolvedTeam } | null = null;

  const resolutionErrors: string[] = [];

  for (const tokens of tokenOptions) {
    const resolvedA = resolveTeamName(tokens.teamAText, sport);
    const resolvedB = resolveTeamName(tokens.teamBText, sport);

    if (resolvedA.success && resolvedB.success) {
      const inferredSport = sport ?? (resolvedA.resolved.sport === resolvedB.resolved.sport ? resolvedA.resolved.sport : null);
      if (!inferredSport) {
        resolutionErrors.push('Could not determine sport from teams. Please specify NFL, NBA, CFB, or CBB.');
        continue;
      }

      teamAResolution = resolvedA;
      teamBResolution = resolvedB;
      sport = inferredSport;
      if (!explicitSportMentioned) {
        notes.push(`Sport inferred as ${sport} from team names`);
      }
      break;
    }

    resolutionErrors.push(resolvedA.success ? resolvedB.error || 'Could not resolve team B' : resolvedA.error || 'Could not resolve team A');
  }

  if (!teamAResolution || !teamBResolution || !sport) {
    return {
      success: false,
      error: resolutionErrors[0] || 'Could not resolve teams from the input.',
      clarificationNeeded: ['teams', 'sport']
    };
  }

  let teamA = teamAResolution.resolved.team;
  let teamB = teamBResolution.resolved.team;

  if (teamAResolution.resolved.matchType === 'fuzzy' || teamBResolution.resolved.matchType === 'fuzzy') {
    notes.push('Team names resolved with fuzzy matching; verify team spelling for accuracy.');
  }

  if (teamA.abbreviation === teamB.abbreviation) {
    return {
      success: false,
      error: 'Detected the same team twice. Please specify two distinct teams.',
      clarificationNeeded: ['teams']
    };
  }

  // 3. Parse spread
  const spreadResult = parseSpread(text);
  if (!spreadResult) {
    return {
      success: false,
      error: 'Could not parse point spread. Please provide a spread like "-3.5" or "favored by 7".',
      clarificationNeeded: ['spread']
    };
  }

  let spread = spreadResult.spread;

  // 4. Determine which team the spread applies to
  const spreadTeam = findSpreadTeam(text, spread, { teamA, teamB });

  // 5. Parse user's pick
  const userPick = parseUserPick(text, { teamA, teamB });

  // 6. Determine final orientation (teamA should be the user's pick)
  let pickTeam: TeamInfo;
  let opponentTeam: TeamInfo;

  if (userPick) {
    if (userPick === teamA.abbreviation) {
      pickTeam = teamA;
      opponentTeam = teamB;
    } else {
      pickTeam = teamB;
      opponentTeam = teamA;
    }
  } else if (spreadTeam) {
    // If no explicit pick, assume they're betting on the team with the spread mentioned
    if (spreadTeam === teamA.abbreviation) {
      pickTeam = teamA;
      opponentTeam = teamB;
    } else {
      pickTeam = teamB;
      opponentTeam = teamA;
    }
    notes.push(`Pick assumed to be ${pickTeam.name} (team mentioned with spread)`);
  } else {
    // Default to first team mentioned
    pickTeam = teamA;
    opponentTeam = teamB;
    notes.push(`Pick assumed to be ${pickTeam.name} (first team mentioned)`);
  }

  // 7. Normalize spread to picked team's perspective
  // If spread is negative (favorite) and attached to opponent, flip it
  if (spreadTeam && spreadTeam !== pickTeam.abbreviation) {
    spread = -spread;
    notes.push(`Spread adjusted to ${spread} from ${pickTeam.name}'s perspective`);
  }

  // 8. Parse venue
  const venueResult = parseVenue(text, pickTeam, opponentTeam);
  if (venueResult.assumed) {
    notes.push(`Venue assumed as neutral (not explicitly stated)`);
  }

  // 9. Parse odds
  const americanOdds = parseOdds(text);
  if (!americanOdds) {
    notes.push('Odds not provided - will default to -110');
  }

  // 10. Build result
  const parsed: ParsedMatchup = {
    sport,
    sportCategory: getSportCategory(sport),
    teamA: pickTeam,
    teamB: opponentTeam,
    spread,
    venue: venueResult.venue,
    venueAssumed: venueResult.assumed,
    americanOdds: americanOdds || undefined,
    rawText: text,
    parsingNotes: notes
  };

  return {
    success: true,
    parsed
  };
}

/**
 * Validate a parsed matchup for completeness
 */
export function validateParsedMatchup(parsed: ParsedMatchup): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!parsed.teamA?.name) {
    errors.push('Missing team A name');
  }

  if (!parsed.teamB?.name) {
    errors.push('Missing team B name');
  }

  if (parsed.spread === undefined || parsed.spread === null) {
    errors.push('Missing spread');
  }

  if (!parsed.sport) {
    errors.push('Missing sport');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
