/**
 * Team & league logos
 * ===================
 * Resolves a team (by name, abbreviation or ESPN id) to a logo URL.
 *
 * - Daily-games cards already carry `homeLogo`/`awayLogo` from the ESPN
 *   scoreboard, so they don't need a lookup.
 * - Everywhere else (bet history, stat tables, CSV slates) only has text, so we
 *   load the league's team directory once from GET /api/teams?sport=X and match
 *   against it. If the directory can't be reached we fall back to ESPN's CDN
 *   URL pattern for pro leagues, and the <TeamLogo> component falls back to a
 *   colored initials badge if that image 404s too.
 */
import { useEffect, useState } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export type LeagueKey = 'NBA' | 'NFL' | 'NHL' | 'MLB' | 'WNBA' | 'CFB' | 'CBB';

export interface TeamInfo {
  id: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  name: string;
  location: string;
  color: string;
  logo: string;
  logoDark: string;
}

const ESPN_CDN = 'https://a.espncdn.com/i/teamlogos';

/** League marks for sport toggles. College has no single league logo — callers keep their emoji. */
export const LEAGUE_LOGOS: Partial<Record<LeagueKey, string>> = {
  NBA: `${ESPN_CDN}/leagues/500/nba.png`,
  NFL: `${ESPN_CDN}/leagues/500/nfl.png`,
  NHL: `${ESPN_CDN}/leagues/500/nhl.png`,
  MLB: `${ESPN_CDN}/leagues/500/mlb.png`,
  WNBA: `${ESPN_CDN}/leagues/500/wnba.png`,
};

const CDN_FOLDER: Record<LeagueKey, string> = {
  NBA: 'nba', NFL: 'nfl', NHL: 'nhl', MLB: 'mlb', WNBA: 'wnba', CFB: 'ncaa', CBB: 'ncaa',
};

/** Map any sport value used in the app (league codes, legacy generic names) to a league. */
export function toLeague(sport: string | undefined | null): LeagueKey | null {
  switch ((sport || '').toLowerCase()) {
    case 'nba': case 'basketball': return 'NBA';
    case 'nfl': case 'football': return 'NFL';
    case 'nhl': case 'hockey': return 'NHL';
    case 'mlb': case 'baseball': return 'MLB';
    case 'wnba': return 'WNBA';
    case 'cfb': case 'ncaaf': return 'CFB';
    case 'cbb': case 'ncaab': return 'CBB';
    default: return null;
  }
}

const norm = (s: string | undefined | null) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Abbreviations other sources use that differ from ESPN's.
const ABBR_ALIASES: Record<string, string> = {
  cws: 'chw', az: 'ari', wsn: 'wsh', was: 'wsh', sdp: 'sd', sfg: 'sf', tbr: 'tb', kcr: 'kc',
  oak: 'ath', // Athletics left Oakland; ESPN now uses ATH
  nj: 'njd', sj: 'sjs', gsw: 'gs', nyk: 'ny', nop: 'no', sas: 'sa', pho: 'phx', jac: 'jax', wft: 'wsh',
};

/** Find a team in a directory by abbreviation, full name, nickname or "City Nickname". */
export function findTeam(dir: TeamInfo[], query: string | undefined | null, abbr?: string | null): TeamInfo | null {
  if (!dir.length) return null;
  const a = norm(abbr);
  if (a) {
    const aa = ABBR_ALIASES[a] || a;
    const byAbbr = dir.find((t) => norm(t.abbreviation) === a) || dir.find((t) => norm(t.abbreviation) === aa);
    if (byAbbr) return byAbbr;
  }
  const q = norm(query);
  if (!q) return null;
  const exact = dir.find((t) =>
    norm(t.displayName) === q || norm(t.shortDisplayName) === q ||
    norm(`${t.location} ${t.name}`) === q || norm(t.abbreviation) === q ||
    norm(t.abbreviation) === (ABBR_ALIASES[q] || ''),
  );
  if (exact) return exact;
  // Nickname only ("Lakers") or a slightly different full name ("LA Clippers").
  const byNick = dir.filter((t) => t.name && norm(t.name).length >= 4 && (q === norm(t.name) || q.endsWith(norm(t.name))));
  if (byNick.length === 1) return byNick[0];
  const byLocation = dir.filter((t) => t.location && norm(t.location) === q);
  return byLocation.length === 1 ? byLocation[0] : null;
}

/** Best logo for the app's dark themes. */
export const logoFor = (t: TeamInfo | null | undefined) => (t ? t.logoDark || t.logo || '' : '');

/** Direct CDN URL — works for pro leagues by abbreviation and college by ESPN id. */
export function cdnLogoUrl(league: LeagueKey, opts: { abbr?: string | null; id?: string | number | null }): string {
  if (league === 'CFB' || league === 'CBB') {
    return opts.id ? `${ESPN_CDN}/ncaa/500/${opts.id}.png` : '';
  }
  const a = norm(opts.abbr);
  if (!a || a.length > 4) return '';
  return `${ESPN_CDN}/${CDN_FOLDER[league]}/500/${ABBR_ALIASES[a] || a}.png`;
}

// ---- directory loading (one request per league per page load) ---------------

const dirCache = new Map<LeagueKey, TeamInfo[]>();
const inflight = new Map<LeagueKey, Promise<TeamInfo[]>>();

export function loadTeamDirectory(league: LeagueKey): Promise<TeamInfo[]> {
  const hit = dirCache.get(league);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(league);
  if (pending) return pending;
  const p = fetch(`${BACKEND_URL}/api/teams?sport=${league}`)
    .then((r) => (r.ok ? r.json() : { teams: [] }))
    .then((d) => {
      const teams: TeamInfo[] = Array.isArray(d?.teams) ? d.teams : [];
      if (teams.length) dirCache.set(league, teams); // don't cache failures; retry next mount
      return teams;
    })
    .catch(() => [] as TeamInfo[])
    .finally(() => inflight.delete(league));
  inflight.set(league, p);
  return p;
}

/** React hook: the league's team directory ([] until loaded or if unavailable). */
export function useTeamDirectory(sport: string | null | undefined): TeamInfo[] {
  const league = toLeague(sport);
  const [dir, setDir] = useState<TeamInfo[]>(() => (league && dirCache.get(league)) || []);
  useEffect(() => {
    if (!league) { setDir([]); return; }
    let alive = true;
    const cached = dirCache.get(league);
    if (cached) { setDir(cached); return; }
    loadTeamDirectory(league).then((t) => { if (alive) setDir(t); });
    return () => { alive = false; };
  }, [league]);
  return dir;
}
