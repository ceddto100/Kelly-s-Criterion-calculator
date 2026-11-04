/**
 * Team directory — every team in a league with its ESPN id, abbreviation,
 * names, brand color and logo URLs. The frontend uses it to put real team
 * logos next to names that only exist as text (bet history, stat tables, the
 * CSV-driven MLB slate).
 *
 * Source: ESPN's public `/teams` endpoint (same unofficial API the daily
 * scoreboard uses). One request per league, cached for 12 hours; on a failed
 * refresh we keep serving the last good copy.
 */
const axios = require('axios');

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 10000;
const CACHE_MS = 12 * 60 * 60 * 1000;

const TEAM_ENDPOINTS = {
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
  NHL: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams',
  MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams',
  WNBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams',
  CFB: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000',
  CBB: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=1000',
};

/** Pick the default and dark-background logo hrefs out of ESPN's `logos` array. */
function pickLogos(logos) {
  const list = Array.isArray(logos) ? logos : [];
  const rel = (l) => (Array.isArray(l?.rel) ? l.rel : []);
  const full = list.find((l) => rel(l).includes('full') && rel(l).includes('default')) || list[0];
  const dark = list.find((l) => rel(l).includes('full') && rel(l).includes('dark'));
  return { logo: full?.href || '', logoDark: dark?.href || '' };
}

function parseTeams(data) {
  const raw = data?.sports?.[0]?.leagues?.[0]?.teams || [];
  return raw
    .map((entry) => entry?.team || entry)
    .filter((t) => t && t.id)
    .map((t) => ({
      id: String(t.id),
      abbreviation: t.abbreviation || '',
      displayName: t.displayName || '',
      shortDisplayName: t.shortDisplayName || '',
      name: t.name || '',
      location: t.location || '',
      color: t.color ? `#${t.color}` : '',
      ...pickLogos(t.logos),
    }));
}

const cache = new Map(); // sport -> { at, teams }

async function fetchTeamDirectory(sport) {
  const url = TEAM_ENDPOINTS[sport];
  if (!url) return [];
  const hit = cache.get(sport);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.teams;
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
    const teams = parseTeams(res.data);
    if (teams.length) cache.set(sport, { at: Date.now(), teams });
    return teams.length ? teams : hit?.teams || [];
  } catch (e) {
    console.error(`[teamDirectory] ${sport} fetch failed: ${e.message}`);
    return hit?.teams || [];
  }
}

module.exports = { fetchTeamDirectory, parseTeams, pickLogos, TEAM_ENDPOINTS };
