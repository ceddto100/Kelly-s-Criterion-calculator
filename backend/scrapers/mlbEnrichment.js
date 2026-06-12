// backend/scrapers/mlbEnrichment.js
// =============================================================================
// Same-day enrichment for the MLB daily slate: ballpark factors, game-time
// weather, and bullpen recent usage. These are the inputs that change too fast
// for the nightly FanGraphs cron (scripts/updateMLBAdvanced.py), so they're
// fetched when /api/mlb/daily is requested:
//
//   - Park run factor + center-field bearing: static table below, keyed by the
//     venue name StatsAPI reports. Factors are approximate multi-year run park
//     factors (100 = neutral); refresh yearly. Bearings are approximate
//     home-plate→center-field azimuths used only to classify wind as
//     out/in/crosswind — the engine caps weather at ±8%, so small bearing
//     errors can't swing a projection.
//   - Weather: Open-Meteo forecast (free, no key) at the venue's coordinates
//     for the hour nearest first pitch. Skipped for fixed domes.
//   - Bullpen usage: relief innings per team over the last 1 and 3 days,
//     summed from StatsAPI boxscores (every pitcher after the starter counts
//     as relief). Past days are cached in-process once fully Final.
//
// Everything is best-effort: any fetch failure returns undefined/empty and the
// projection engine simply treats the input as missing (lower confidence),
// which is today's behavior.
// =============================================================================

const axios = require('axios');

const STATSAPI_BASE = 'https://statsapi.mlb.com/api/v1';
const OPEN_METEO_BASE = 'https://api.open-meteo.com/v1/forecast';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; Betgistics/1.0)' };
const TIMEOUT = 12000;

async function getJson(url) {
  const res = await axios.get(url, { headers: HEADERS, timeout: TIMEOUT });
  return res.data;
}

function toNum(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : undefined;
}

function normalizeVenue(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// --- ballpark table ----------------------------------------------------------
// pf: run park factor (100 = neutral). cf: approximate true-north azimuth from
// home plate to center field (degrees), for wind out/in classification.
// Synonyms cover recent venue renames so StatsAPI's current name always hits.
const VENUES = {
  'coors field': { pf: 112, cf: 3 },
  'fenway park': { pf: 106, cf: 52 },
  'great american ball park': { pf: 104, cf: 120 },
  'george m. steinbrenner field': { pf: 104, cf: 75 },
  'kauffman stadium': { pf: 103, cf: 45 },
  'chase field': { pf: 103, cf: 0 },
  'sutter health park': { pf: 103, cf: 60 },
  'truist park': { pf: 102, cf: 30 },
  'citizens bank park': { pf: 102, cf: 9 },
  'american family field': { pf: 102, cf: 130 },
  'globe life field': { pf: 101, cf: 46 },
  'rate field': { pf: 101, cf: 35 },
  'guaranteed rate field': { pf: 101, cf: 35 },
  'angel stadium': { pf: 100, cf: 65 },
  'nationals park': { pf: 100, cf: 28 },
  'wrigley field': { pf: 100, cf: 35 },
  'target field': { pf: 99, cf: 90 },
  'yankee stadium': { pf: 99, cf: 75 },
  'rogers centre': { pf: 99, cf: 345 },
  'daikin park': { pf: 99, cf: 343 },
  'minute maid park': { pf: 99, cf: 343 },
  'comerica park': { pf: 99, cf: 145 },
  'oriole park at camden yards': { pf: 98, cf: 31 },
  'camden yards': { pf: 98, cf: 31 },
  'dodger stadium': { pf: 98, cf: 26 },
  'busch stadium': { pf: 98, cf: 62 },
  'progressive field': { pf: 97, cf: 0 },
  'pnc park': { pf: 97, cf: 117 },
  'loandepot park': { pf: 97, cf: 78 },
  'citi field': { pf: 96, cf: 13 },
  'petco park': { pf: 96, cf: 0 },
  'tropicana field': { pf: 96, cf: 45 },
  'oakland coliseum': { pf: 96, cf: 55 },
  'oracle park': { pf: 95, cf: 87 },
  't-mobile park': { pf: 92, cf: 45 },
};

const VENUE_LOOKUP = new Map(
  Object.entries(VENUES).map(([k, v]) => [normalizeVenue(k), v])
);

function getParkFactor(venueName) {
  return VENUE_LOOKUP.get(normalizeVenue(venueName))?.pf;
}

function getCfBearing(venueName) {
  return VENUE_LOOKUP.get(normalizeVenue(venueName))?.cf;
}

/** StatsAPI fieldInfo.roofType → engine roofClosed. Retractable stays unknown. */
function roofClosedFromType(roofType) {
  if (roofType === 'Dome') return true;
  if (roofType === 'Open') return false;
  return undefined;
}

// --- wind classification -------------------------------------------------------

/** Smallest absolute angle between two bearings, in degrees [0, 180]. */
function angularDiff(a, b) {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/**
 * Classify wind for the projection engine. `windFromDeg` is the meteorological
 * direction the wind blows FROM; blowing out means air moves home plate →
 * center field, i.e. the wind comes from the opposite of the CF bearing.
 */
function classifyWindDirection(windFromDeg, cfBearingDeg) {
  if (windFromDeg === undefined || cfBearingDeg === undefined) return undefined;
  if (angularDiff(windFromDeg, cfBearingDeg + 180) <= 45) return 'out';
  if (angularDiff(windFromDeg, cfBearingDeg) <= 45) return 'in';
  return 'crosswind';
}

// --- weather (Open-Meteo) ------------------------------------------------------

/** Pick the forecast hour nearest the game's first pitch. */
function pickHourly(hourly, targetIso) {
  const times = hourly?.time ?? [];
  if (!times.length) return null;
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) return null;
  let best = 0;
  let bestDiff = Infinity;
  times.forEach((t, i) => {
    // timezone=UTC responses omit the Z suffix; add it so Date.parse reads UTC.
    const iso = /Z|[+-]\d\d:\d\d$/.test(t) ? t : `${t}Z`;
    const diff = Math.abs(Date.parse(iso) - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  const temperatureF = toNum(hourly.temperature_2m?.[best]);
  const windSpeedMph = toNum(hourly.wind_speed_10m?.[best]);
  const windFromDeg = toNum(hourly.wind_direction_10m?.[best]);
  if (temperatureF === undefined && windSpeedMph === undefined) return null;
  return { temperatureF, windSpeedMph, windFromDeg };
}

async function fetchGameWeather(latitude, longitude, gameIso) {
  try {
    const date = String(gameIso).slice(0, 10);
    const url =
      `${OPEN_METEO_BASE}?latitude=${latitude}&longitude=${longitude}` +
      `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=UTC` +
      `&start_date=${date}&end_date=${date}`;
    const data = await getJson(url);
    return pickHourly(data?.hourly, gameIso);
  } catch (e) {
    return null;
  }
}

/**
 * Build the engine's environment block for one scheduled game (park factor,
 * roof, and — for non-dome parks with known coordinates — forecast weather).
 */
async function buildGameEnvironment(game) {
  const env = {};
  const pf = getParkFactor(game.venueName);
  if (pf !== undefined) env.parkFactor = pf;
  const roof = roofClosedFromType(game.roofType);
  if (roof !== undefined) env.roofClosed = roof;
  if (roof === true) return env; // fixed dome: weather can't matter

  if (game.latitude !== undefined && game.longitude !== undefined && game.gameDate) {
    const wx = await fetchGameWeather(game.latitude, game.longitude, game.gameDate);
    if (wx) {
      if (wx.temperatureF !== undefined) env.temperatureF = Math.round(wx.temperatureF);
      if (wx.windSpeedMph !== undefined) env.windSpeedMph = Math.round(wx.windSpeedMph);
      const dir = classifyWindDirection(wx.windFromDeg, getCfBearing(game.venueName));
      if (dir) env.windDirection = dir;
      // A retractable roof may close; the forecast might never apply.
      if (game.roofType === 'Retractable') env.weatherReliable = false;
    }
  }
  return Object.keys(env).length ? env : undefined;
}

// --- bullpen recent usage --------------------------------------------------------

/** Baseball innings notation → outs ("2.1" = 2⅓ innings = 7 outs). */
function ipToOuts(ip) {
  if (ip === undefined || ip === null || ip === '') return 0;
  const [whole, frac] = String(ip).split('.');
  const w = parseInt(whole, 10);
  const f = frac ? parseInt(frac[0], 10) : 0;
  if (!Number.isFinite(w)) return 0;
  return w * 3 + (Number.isFinite(f) ? f : 0);
}

/**
 * Relief outs per team from one boxscore. StatsAPI lists `pitchers` in order
 * of appearance, so everyone after the first is counted as relief (an opener
 * misclassifies slightly — acceptable for a fatigue signal).
 */
function parseBoxscoreReliefOuts(box) {
  const results = [];
  for (const side of ['home', 'away']) {
    const teamSide = box?.teams?.[side];
    if (!teamSide?.team?.id) continue;
    const pitchers = Array.isArray(teamSide.pitchers) ? teamSide.pitchers : [];
    let outs = 0;
    for (const pid of pitchers.slice(1)) {
      const stat = teamSide.players?.[`ID${pid}`]?.stats?.pitching;
      outs += ipToOuts(stat?.inningsPitched);
    }
    results.push({ teamId: teamSide.team.id, reliefOuts: outs });
  }
  return results;
}

// Cache per past date — but only once every game that day is Final, so a West
// Coast game still in progress can't freeze an undercount.
const reliefDayCache = new Map(); // dateStr -> Map(teamId -> outs)

async function reliefOutsForDate(dateStr) {
  if (reliefDayCache.has(dateStr)) return reliefDayCache.get(dateStr);
  const byTeam = new Map();
  let allFinal = true;
  try {
    const sched = await getJson(`${STATSAPI_BASE}/schedule?sportId=1&date=${dateStr}`);
    const gamePks = [];
    for (const d of sched?.dates ?? []) {
      for (const g of d?.games ?? []) {
        if (g?.status?.abstractGameState === 'Final') gamePks.push(g.gamePk);
        else allFinal = false;
      }
    }
    const boxes = await Promise.all(
      gamePks.map((pk) =>
        getJson(`${STATSAPI_BASE}/game/${pk}/boxscore`).catch(() => null)
      )
    );
    for (const box of boxes) {
      if (!box) continue;
      for (const { teamId, reliefOuts } of parseBoxscoreReliefOuts(box)) {
        byTeam.set(teamId, (byTeam.get(teamId) || 0) + reliefOuts);
      }
    }
  } catch (e) {
    allFinal = false; // don't cache a failed day
  }
  if (allFinal) reliefDayCache.set(dateStr, byTeam);
  return byTeam;
}

/**
 * Relief innings per team over the last 1 and 3 days, shaped for the engine's
 * bullpen fatigue input: Map(teamId -> { inningsLast1d, inningsLast3d }).
 */
async function fetchReliefUsage(now = new Date()) {
  const dates = [1, 2, 3].map((n) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  });
  const [d1, d2, d3] = await Promise.all(dates.map(reliefOutsForDate));
  const usage = new Map();
  const teamIds = new Set([...d1.keys(), ...d2.keys(), ...d3.keys()]);
  for (const id of teamIds) {
    const outs1 = d1.get(id) || 0;
    const outs3 = outs1 + (d2.get(id) || 0) + (d3.get(id) || 0);
    usage.set(id, {
      inningsLast1d: Math.round((outs1 / 3) * 10) / 10,
      inningsLast3d: Math.round((outs3 / 3) * 10) / 10,
    });
  }
  return usage;
}

module.exports = {
  buildGameEnvironment,
  fetchReliefUsage,
  fetchGameWeather,
  // exported for tests
  getParkFactor,
  getCfBearing,
  roofClosedFromType,
  classifyWindDirection,
  angularDiff,
  pickHourly,
  ipToOuts,
  parseBoxscoreReliefOuts,
};
