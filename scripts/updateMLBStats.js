#!/usr/bin/env node
/**
 * scripts/updateMLBStats.js
 * =========================
 * Writes the MLB CSVs the app reads at runtime, in the same
 * `frontend/public/stats/<sport>/` shape the NBA/NFL/NHL updaters use:
 *
 *   frontend/public/stats/mlb/mlb_team_offense.csv
 *   frontend/public/stats/mlb/mlb_starters.csv
 *   frontend/public/stats/mlb/mlb_bullpen.csv
 *   frontend/public/stats/mlb/mlb_parks.csv
 *   frontend/public/stats/mlb/mlb_slate.csv
 *   frontend/public/stats/mlb/last_updated.json
 *
 * Why this replaces scripts/updateMLBAdvanced.py
 * ---------------------------------------------
 * The old updater pulled everything from FanGraphs, which blanket-403s
 * cloud/CI IPs. Every scheduled run failed and MLB silently fell back to
 * OPS/ERA. This script uses only sources that answer from anywhere:
 *
 *   - MLB StatsAPI  (statsapi.mlb.com)  — teams, venues, team hitting, every
 *     pitcher's season line, today's schedule + probable starters + lineups,
 *     and boxscores for bullpen usage. Free, no auth, no bot wall.
 *   - ESPN scoreboard                    — consensus total + moneylines.
 *   - Open-Meteo                         — first-pitch temperature and wind.
 *
 * wOBA and FIP are COMPUTED here from StatsAPI counting stats using the
 * standard public formulas rather than scraped, so they need no third party.
 *
 * What this script deliberately leaves blank
 * ------------------------------------------
 * `wrc_plus`, `xfip` and `siera` cannot be derived from StatsAPI (they need
 * FanGraphs' park/league context and batted-ball data). Those columns are
 * written empty and are meant to be filled by the stat-fetching agent — see
 * .claude/skills/mlb-stat-fetcher/. The engine treats a blank cell as "not
 * supplied" and lowers its data-completeness score accordingly, which is the
 * honest behavior: it never invents a number it does not have.
 *
 * Usage:  node scripts/updateMLBStats.js [--skip-slate]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'stats', 'mlb');
const STATSAPI = 'https://statsapi.mlb.com/api/v1';
const ESPN_SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast';
const UA = 'Mozilla/5.0 (compatible; Betgistics/1.0; +https://betgistics.app)';

// ---------------------------------------------------------------------------
// Park run factors (100 = neutral)
// ---------------------------------------------------------------------------
// Multi-year Statcast-style RUN park factors. These move very little season to
// season, so they live in the repo rather than being fetched daily. Refresh
// once a year from https://baseballsavant.mlb.com/leaderboard/statcast-park-factors
// (stat = Runs, 3-year rolling). Keyed by team abbreviation because a club can
// change venues (the A's and Rays both did) without changing identity.
// NOTE: keys must be the abbreviations StatsAPI actually returns — it uses AZ
// (not ARI), SD, SF, TB, CWS, KC and WSH. Aliases are included so a source that
// uses the longer forms still resolves.
const PARK_FACTORS = {
  COL: 112, CIN: 108, BOS: 107, ATH: 106, TB: 105, TBR: 105, AZ: 103, ARI: 103,
  KC: 102, KCR: 102, PHI: 102, LAA: 102, BAL: 101, CHC: 101, ATL: 101,
  WSH: 101, WSN: 101, TOR: 101, NYY: 100, TEX: 100, MIN: 100, MIL: 100,
  CWS: 100, CHW: 100, HOU: 99, DET: 99, PIT: 99, CLE: 98, STL: 98, LAD: 98,
  NYM: 97, MIA: 96, SD: 96, SDP: 96, SF: 95, SFG: 95, SEA: 93, OAK: 106,
};

// wOBA linear weights (FanGraphs' published scale; stable year to year).
const W = { uBB: 0.69, HBP: 0.722, x1B: 0.888, x2B: 1.271, x3B: 1.616, HR: 2.101 };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const num = (v) => {
  if (v === undefined || v === null || v === '' || v === '-.--' || v === '-') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};

/** MLB innings are written 60.1 = 60 and 1/3. Convert to outs. */
const inningsToOuts = (ip) => {
  const n = num(ip);
  if (n === undefined) return 0;
  const whole = Math.trunc(n);
  const frac = Math.round((n - whole) * 10);
  return whole * 3 + Math.min(frac, 2);
};

const fmt = (v, dp) => (v === undefined || v === null || !Number.isFinite(v) ? '' : v.toFixed(dp));

/** Quote every cell so team names containing commas can never break a row. */
function writeCsv(file, header, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const body = [header.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))];
  fs.writeFileSync(path.join(OUT_DIR, file), body.join('\n') + '\n', 'utf8');
  console.log(`  wrote ${file} (${rows.length} rows)`);
}

const seasonYear = () => {
  const now = new Date();
  // Regular season runs late March -> early October; before March use last year.
  return now.getUTCMonth() >= 2 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
};

const isoDate = (d) => d.toISOString().slice(0, 10);
const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * MLB's "today" is the US Eastern date, not UTC. Without this a run after 8pm
 * ET returns tomorrow's (nearly empty) slate, because US night games fall on
 * the next UTC day.
 */
const mlbToday = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// ---------------------------------------------------------------------------
// teams + venues
// ---------------------------------------------------------------------------

async function fetchTeams() {
  const data = await getJson(`${STATSAPI}/teams?sportId=1&hydrate=venue(location,fieldInfo)`);
  const byId = new Map();
  for (const t of data.teams || []) {
    byId.set(t.id, {
      id: t.id,
      name: t.name,
      abbreviation: t.abbreviation,
      venue: t.venue?.name || '',
      roofType: t.venue?.fieldInfo?.roofType || 'Open',
      latitude: num(t.venue?.location?.defaultCoordinates?.latitude),
      longitude: num(t.venue?.location?.defaultCoordinates?.longitude),
    });
  }
  return byId;
}

// ---------------------------------------------------------------------------
// team offense: OPS, runs/game, computed wOBA, recent runs/game
// ---------------------------------------------------------------------------

/** wOBA from raw counting stats — the standard public formula, not a scrape. */
function computeWoba(s) {
  const hits = num(s.hits) ?? 0;
  const doubles = num(s.doubles) ?? 0;
  const triples = num(s.triples) ?? 0;
  const hr = num(s.homeRuns) ?? 0;
  const singles = hits - doubles - triples - hr;
  const bb = num(s.baseOnBalls) ?? 0;
  const ibb = num(s.intentionalWalks) ?? 0;
  const hbp = num(s.hitByPitch) ?? 0;
  const ab = num(s.atBats) ?? 0;
  const sf = num(s.sacFlies) ?? 0;
  const uBB = bb - ibb;
  const denom = ab + uBB + sf + hbp;
  if (denom <= 0) return undefined;
  const wobaNum =
    W.uBB * uBB + W.HBP * hbp + W.x1B * singles + W.x2B * doubles + W.x3B * triples + W.HR * hr;
  return wobaNum / denom;
}

async function fetchTeamOffense(season, teams) {
  const data = await getJson(
    `${STATSAPI}/teams/stats?season=${season}&group=hitting&stats=season&sportIds=1`,
  );
  const out = new Map();
  for (const split of data.stats?.[0]?.splits || []) {
    const t = teams.get(split.team?.id);
    if (!t) continue;
    const s = split.stat || {};
    const games = num(s.gamesPlayed);
    const runs = num(s.runs);
    out.set(t.id, {
      ops: num(s.ops),
      woba: computeWoba(s),
      runsPerGame: games && games > 0 && runs !== undefined ? runs / games : undefined,
    });
  }
  return out;
}

/** Runs/game over the trailing `days` days — the engine's recent-form input. */
async function fetchRecentForm(season, teams, days = 21) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const out = new Map();
  for (const t of teams.values()) {
    try {
      const data = await getJson(
        `${STATSAPI}/teams/${t.id}/stats?stats=byDateRange&group=hitting` +
          `&season=${season}&startDate=${isoDate(start)}&endDate=${isoDate(end)}`,
      );
      const s = data.stats?.[0]?.splits?.[0]?.stat || {};
      const games = num(s.gamesPlayed);
      const runs = num(s.runs);
      if (games && games > 0 && runs !== undefined) out.set(t.id, runs / games);
    } catch {
      /* best effort — a missing recent split just leaves the column blank */
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// pitchers: per-pitcher ERA + computed FIP, and the team bullpen aggregate
// ---------------------------------------------------------------------------

/**
 * FIP = ((13*HR) + (3*(BB+HBP)) - (2*K)) / IP + cFIP, where cFIP is set so the
 * league FIP equals the league ERA. We derive cFIP from the same population we
 * are scoring, which is exactly how FanGraphs defines it.
 */
function fipComponents(s) {
  const outs = inningsToOuts(s.inningsPitched);
  if (outs <= 0) return null;
  const ip = outs / 3;
  const raw =
    (13 * (num(s.homeRuns) ?? 0) +
      3 * ((num(s.baseOnBalls) ?? 0) + (num(s.hitBatsmen) ?? num(s.hitByPitch) ?? 0)) -
      2 * (num(s.strikeOuts) ?? 0)) /
    ip;
  return { raw, outs, ip, earnedRuns: num(s.earnedRuns) ?? 0 };
}

async function fetchPitchers(season, teams) {
  const data = await getJson(
    `${STATSAPI}/stats?stats=season&group=pitching&season=${season}` +
      `&sportId=1&playerPool=all&limit=2000`,
  );
  const splits = data.stats?.[0]?.splits || [];

  // League cFIP: total earned runs and outs across everyone we just pulled.
  let lgER = 0;
  let lgOuts = 0;
  let lgRawWeighted = 0;
  const rows = [];
  for (const sp of splits) {
    const c = fipComponents(sp.stat || {});
    if (!c) continue;
    lgER += c.earnedRuns;
    lgOuts += c.outs;
    lgRawWeighted += c.raw * c.outs;
  }
  const lgEra = lgOuts > 0 ? (lgER * 27) / lgOuts : 4.25;
  const lgRaw = lgOuts > 0 ? lgRawWeighted / lgOuts : 0;
  const cFip = lgEra - lgRaw;
  console.log(`  league ERA ${lgEra.toFixed(2)}, cFIP ${cFip.toFixed(3)}`);

  // Per-pitcher rows + bullpen aggregation (relievers only: gamesStarted === 0).
  const bullpen = new Map(); // teamId -> weighted sums
  for (const sp of splits) {
    const s = sp.stat || {};
    const t = teams.get(sp.team?.id);
    const c = fipComponents(s);
    if (!c) continue;
    const fip = c.raw + cFip;

    if (t) {
      rows.push([
        sp.player?.fullName || '',
        t.name,
        t.abbreviation,
        '', // throws — filled by the agent from a handedness source
        fmt(num(s.era), 2),
        fmt(fip, 2),
        '', // xfip  — FanGraphs only
        '', // siera — FanGraphs only
      ]);
    }

    const gs = num(s.gamesStarted) ?? 0;
    if (!t || gs > 0) continue;
    const agg =
      bullpen.get(t.id) || { outs: 0, fip: 0, er: 0, walks: 0, hits: 0 };
    agg.outs += c.outs;
    agg.fip += fip * c.outs;
    agg.er += c.earnedRuns;
    agg.walks += (num(s.baseOnBalls) ?? 0);
    agg.hits += (num(s.hits) ?? 0);
    bullpen.set(t.id, agg);
  }

  rows.sort((a, b) => a[2].localeCompare(b[2]) || a[0].localeCompare(b[0]));

  const bullpenRows = [];
  for (const t of [...teams.values()].sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))) {
    const agg = bullpen.get(t.id);
    if (!agg || agg.outs === 0) continue;
    const ip = agg.outs / 3;
    bullpenRows.push({
      team: t,
      fip: agg.fip / agg.outs,
      era: (agg.er * 27) / agg.outs,
      whip: (agg.walks + agg.hits) / ip,
    });
  }
  return { pitcherRows: rows, bullpenRows };
}

// ---------------------------------------------------------------------------
// bullpen recent usage (fatigue input) from the last 3 days of boxscores
// ---------------------------------------------------------------------------

async function fetchReliefUsage(teams) {
  const last1d = new Map();
  const last3d = new Map();
  const today = new Date();
  for (let back = 1; back <= 3; back += 1) {
    const day = isoDate(new Date(today.getTime() - back * 86400000));
    let schedule;
    try {
      schedule = await getJson(`${STATSAPI}/schedule?sportId=1&date=${day}`);
    } catch {
      continue;
    }
    const games = (schedule.dates || []).flatMap((d) => d.games || []);
    for (const g of games) {
      if (g.status?.abstractGameState !== 'Final') continue;
      let box;
      try {
        box = await getJson(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`);
      } catch {
        continue;
      }
      const boxTeams = box.liveData?.boxscore?.teams || {};
      for (const side of ['home', 'away']) {
        const teamId = boxTeams[side]?.team?.id;
        const order = boxTeams[side]?.pitchers || [];
        if (!teamId || order.length < 2) continue;
        // Everyone after the starter is relief.
        let outs = 0;
        for (const pid of order.slice(1)) {
          const p = boxTeams[side]?.players?.[`ID${pid}`];
          outs += inningsToOuts(p?.stats?.pitching?.inningsPitched);
        }
        const ip = outs / 3;
        last3d.set(teamId, (last3d.get(teamId) || 0) + ip);
        if (back === 1) last1d.set(teamId, (last1d.get(teamId) || 0) + ip);
      }
    }
  }
  void teams;
  return { last1d, last3d };
}

// ---------------------------------------------------------------------------
// today's slate: schedule + probables + lineups + odds + weather
// ---------------------------------------------------------------------------

/**
 * Classify wind against an approximate home-plate -> center-field bearing so
 * "out to center" and "in from center" mean the same thing at every park.
 */
const CF_BEARING = {
  ARI: 0, ATL: 50, ATH: 60, BAL: 30, BOS: 45, CHC: 30, CWS: 65, CIN: 60,
  CLE: 0, COL: 5, DET: 30, HOU: 20, KC: 45, LAA: 45, LAD: 25, MIA: 60,
  MIL: 15, MIN: 60, NYM: 30, NYY: 75, PHI: 15, PIT: 115, SD: 0, SF: 65,
  SEA: 60, STL: 60, TB: 45, TEX: 25, TOR: 0, WSH: 30,
};

function classifyWind(windFromDeg, cfBearing) {
  if (windFromDeg === undefined || cfBearing === undefined) return 'none';
  // Meteorological direction is where the wind comes FROM.
  let diff = Math.abs(((windFromDeg - cfBearing + 540) % 360) - 180);
  // diff ~180 => blowing from home plate toward center = "out".
  if (diff >= 135) return 'out';
  if (diff <= 45) return 'in';
  return 'crosswind';
}

async function fetchEspnLines() {
  const byTeam = new Map();
  try {
    const data = await getJson(ESPN_SCOREBOARD);
    for (const event of data.events || []) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      const odds = comp.odds?.[0] || {};
      const entry = {
        total: num(odds.overUnder),
        homeMl: num(odds.homeTeamOdds?.moneyLine),
        awayMl: num(odds.awayTeamOdds?.moneyLine),
      };
      for (const c of comp.competitors || []) {
        const name = c.team?.displayName || c.team?.name;
        if (name) byTeam.set(normalize(name), entry);
      }
    }
  } catch (e) {
    console.log(`  ESPN odds unavailable (${e.message}) — totals left blank`);
  }
  return byTeam;
}

async function fetchWeather(lat, lon, startTimeIso) {
  if (lat === undefined || lon === undefined) return {};
  try {
    const data = await getJson(
      `${OPEN_METEO}?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=2`,
    );
    const times = data.hourly?.time || [];
    if (!times.length) return {};
    const target = new Date(startTimeIso).getTime();
    let bestIdx = 0;
    let bestGap = Infinity;
    times.forEach((t, i) => {
      const gap = Math.abs(new Date(t + 'Z').getTime() - target);
      if (gap < bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    });
    return {
      temperatureF: num(data.hourly.temperature_2m?.[bestIdx]),
      windSpeedMph: num(data.hourly.wind_speed_10m?.[bestIdx]),
      windFromDeg: num(data.hourly.wind_direction_10m?.[bestIdx]),
    };
  } catch {
    return {};
  }
}

async function buildSlate(teams, lines) {
  const data = await getJson(
    `${STATSAPI}/schedule?sportId=1&date=${mlbToday()}` +
      `&hydrate=probablePitcher,venue(location,fieldInfo),lineups`,
  );
  const rows = [];
  for (const date of data.dates || []) {
    for (const g of date.games || []) {
      const home = teams.get(g.teams?.home?.team?.id);
      const away = teams.get(g.teams?.away?.team?.id);
      if (!home || !away) continue;
      if (g.status?.abstractGameState === 'Final') continue;

      const roofType = g.venue?.fieldInfo?.roofType || home.roofType;
      const roofClosed = roofType === 'Dome' || roofType === 'Closed';
      const lat = num(g.venue?.location?.defaultCoordinates?.latitude) ?? home.latitude;
      const lon = num(g.venue?.location?.defaultCoordinates?.longitude) ?? home.longitude;

      const wx = roofClosed ? {} : await fetchWeather(lat, lon, g.gameDate);
      const line = lines.get(normalize(home.name)) || lines.get(normalize(away.name)) || {};

      const lineupOk = (players) => (Array.isArray(players) && players.length >= 9 ? 'yes' : 'no');

      rows.push([
        (g.gameDate || '').slice(0, 10),
        g.gameDate || '',
        away.name,
        away.abbreviation,
        home.name,
        home.abbreviation,
        g.venue?.name || home.venue,
        g.teams?.away?.probablePitcher?.fullName || '',
        g.teams?.away?.probablePitcher?.id ? 'yes' : 'no',
        g.teams?.home?.probablePitcher?.fullName || '',
        g.teams?.home?.probablePitcher?.id ? 'yes' : 'no',
        fmt(line.total, 1),
        line.homeMl ?? '',
        line.awayMl ?? '',
        fmt(wx.temperatureF, 0),
        fmt(wx.windSpeedMph, 0),
        roofClosed ? 'none' : classifyWind(wx.windFromDeg, CF_BEARING[home.abbreviation]),
        roofClosed ? 'yes' : 'no',
        lineupOk(g.lineups?.awayPlayers),
        lineupOk(g.lineups?.homePlayers),
      ]);
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const season = seasonYear();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`=== Betgistics MLB stats update (season ${season}) ===`);

  const teams = await fetchTeams();
  console.log(`  ${teams.size} teams`);

  const sorted = [...teams.values()].sort((a, b) =>
    a.abbreviation.localeCompare(b.abbreviation),
  );

  // --- parks (static factors + live venue/roof from StatsAPI) ---------------
  writeCsv(
    'mlb_parks.csv',
    ['team', 'abbreviation', 'venue', 'park_factor', 'roof_type'],
    sorted.map((t) => [
      t.name,
      t.abbreviation,
      t.venue,
      PARK_FACTORS[t.abbreviation] ?? 100,
      t.roofType,
    ]),
  );

  // --- team offense ---------------------------------------------------------
  const [offense, recent] = await Promise.all([
    fetchTeamOffense(season, teams),
    fetchRecentForm(season, teams),
  ]);
  writeCsv(
    'mlb_team_offense.csv',
    ['team', 'abbreviation', 'wrc_plus', 'woba', 'ops', 'runs_per_game', 'recent_runs_per_game'],
    sorted.map((t) => {
      const o = offense.get(t.id) || {};
      return [
        t.name,
        t.abbreviation,
        '', // wrc_plus — FanGraphs only, filled by the stat-fetching agent
        fmt(o.woba, 3),
        fmt(o.ops, 3),
        fmt(o.runsPerGame, 2),
        fmt(recent.get(t.id), 2),
      ];
    }),
  );

  // --- pitchers + bullpen ---------------------------------------------------
  const { pitcherRows, bullpenRows } = await fetchPitchers(season, teams);
  writeCsv(
    'mlb_starters.csv',
    ['pitcher', 'team', 'abbreviation', 'throws', 'era', 'fip', 'xfip', 'siera'],
    pitcherRows,
  );

  const usage = await fetchReliefUsage(teams);
  writeCsv(
    'mlb_bullpen.csv',
    [
      'team', 'abbreviation', 'bullpen_fip', 'bullpen_era', 'bullpen_whip',
      'innings_last1d', 'innings_last3d', 'closer_available',
    ],
    bullpenRows.map((b) => [
      b.team.name,
      b.team.abbreviation,
      fmt(b.fip, 2),
      fmt(b.era, 2),
      fmt(b.whip, 2),
      fmt(usage.last1d.get(b.team.id) ?? 0, 1),
      fmt(usage.last3d.get(b.team.id) ?? 0, 1),
      '', // closer_available — no reliable free feed; agent or user supplies it
    ]),
  );

  // --- today's slate --------------------------------------------------------
  let slateRows = [];
  if (!process.argv.includes('--skip-slate')) {
    const lines = await fetchEspnLines();
    slateRows = await buildSlate(teams, lines);
    writeCsv(
      'mlb_slate.csv',
      [
        'game_date', 'game_time', 'away_team', 'away_abbr', 'home_team', 'home_abbr',
        'venue', 'away_starter', 'away_starter_confirmed', 'home_starter',
        'home_starter_confirmed', 'book_total', 'home_moneyline', 'away_moneyline',
        'temperature_f', 'wind_speed_mph', 'wind_direction', 'roof_closed',
        'away_lineup_confirmed', 'home_lineup_confirmed',
      ],
      slateRows,
    );
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'last_updated.json'),
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        season,
        teams: sorted.length,
        pitchers: pitcherRows.length,
        bullpens: bullpenRows.length,
        slateGames: slateRows.length,
        sources: [
          'MLB StatsAPI (teams, venues, team hitting, pitcher season lines, schedule, boxscores)',
          'ESPN MLB scoreboard (consensus total + moneylines)',
          'Open-Meteo (first-pitch temperature + wind)',
          'repository PARK_FACTORS table (refresh yearly from Baseball Savant)',
        ],
        computedHere: ['woba (linear weights)', 'fip (league-normalised cFIP)'],
        agentFilled: ['wrc_plus', 'xfip', 'siera', 'throws', 'closer_available'],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log('  wrote last_updated.json\nDone.');
}

main().catch((e) => {
  console.error('MLB stats update failed:', e.message);
  process.exit(1);
});
