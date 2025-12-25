/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type NormalizedProbabilityArgs = {
  sport: string;
  team_favorite: string;
  team_underdog: string;
  spread: number;
};

const favoriteAliases = [
  'team_favorite',
  'favorite_team',
  'favorite',
  'fav',
  'team1',
  'team_1',
  'teamA',
  'team_a',
  'home_team',
  'home',
  'homeTeam',
  'first_team',
  'firstTeam'
] as const;

const underdogAliases = [
  'team_underdog',
  'underdog_team',
  'underdog',
  'dog',
  'team2',
  'team_2',
  'teamB',
  'team_b',
  'away_team',
  'away',
  'awayTeam',
  'second_team',
  'secondTeam'
] as const;

const spreadAliases = [
  'spread',
  'point_spread',
  'pointSpread',
  'line',
  'points'
] as const;

export const favoriteAliasLabel = `team_favorite (aliases: ${favoriteAliases.join(', ')})`;
export const underdogAliasLabel = `team_underdog (aliases: ${underdogAliases.join(', ')})`;
export const spreadAliasLabel = `spread (aliases: ${spreadAliases.join(', ')})`;

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractArgs(rawArgs: unknown): Record<string, unknown> {
  let args: unknown = rawArgs;

  // Allow arguments to be provided as a JSON string
  if (typeof args === 'string') {
    const parsed = safeParseJson(args);
    if (parsed && typeof parsed === 'object') {
      args = parsed;
    }
  }

  if (args && typeof args === 'object') {
    const maybeArgs = args as { arguments?: unknown; params?: { arguments?: unknown } };

    // Handle MCP style nesting: params.arguments or arguments
    const nestedArgs = maybeArgs.params?.arguments ?? maybeArgs.arguments;
    if (nestedArgs !== undefined) {
      args = nestedArgs;
      if (typeof args === 'string') {
        const parsed = safeParseJson(args);
        if (parsed && typeof parsed === 'object') {
          args = parsed;
        }
      }
    }
  }

  if (process.env.DEBUG_PROBABILITY === 'true') {
    // eslint-disable-next-line no-console
    console.debug('[probability] raw args received:', args);
  }

  return args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
}

function pickFirstAlias(args: Record<string, unknown>, aliases: readonly string[]): unknown {
  for (const key of aliases) {
    if (key in args) {
      return args[key];
    }
  }
  return undefined;
}

function coerceString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  return str === '' ? undefined : str;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    const num = Number(trimmed);
    return Number.isNaN(num) ? undefined : num;
  }
  return undefined;
}

export function normalizeProbabilityArgs(
  rawArgs: unknown,
  options?: { defaultSport?: 'basketball' | 'football' | 'generic' }
): { normalized: NormalizedProbabilityArgs; missingFields: string[] } {
  const args = extractArgs(rawArgs);

  const teamFavoriteValue = coerceString(pickFirstAlias(args, favoriteAliases));
  const teamUnderdogValue = coerceString(pickFirstAlias(args, underdogAliases));
  const spreadValue = coerceNumber(pickFirstAlias(args, spreadAliases));

  const missingFields: string[] = [];
  if (!teamFavoriteValue) missingFields.push(favoriteAliasLabel);
  if (!teamUnderdogValue) missingFields.push(underdogAliasLabel);
  if (spreadValue === undefined) missingFields.push(spreadAliasLabel);

  const normalized: NormalizedProbabilityArgs = {
    sport: coerceString(args.sport) || options?.defaultSport || 'basketball',
    team_favorite: teamFavoriteValue || '',
    team_underdog: teamUnderdogValue || '',
    spread: spreadValue ?? Number.NaN
  };

  return { normalized, missingFields };
}

