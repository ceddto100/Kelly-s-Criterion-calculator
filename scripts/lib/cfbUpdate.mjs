/**
 * scripts/lib/cfbUpdate.mjs
 * =========================
 * The college football refresh, with the API client, clock and directories
 * injected so tests can run the whole pipeline on fixtures. The CLI wrapper
 * is scripts/updateCFBStats.mjs.
 *
 * Writes to outDir (served publicly by the app):
 *   cfb_ratings.csv      one row per FBS team: blended SP+/FPI rating
 *   cfb_slate.csv        this week's games with context and consensus lines
 *   cfb_predictions.csv  settled automatic-model picks (derived numbers only)
 *   last_updated.json
 *
 * Keeps in cacheDir (private — restored between CI runs by actions/cache):
 *   <season>/teams.json, venues.json   season-static API responses
 *   <season>/state.json                pending picks with the line they were
 *                                      logged at, needed to grade them later
 *
 * API calls per run: games + lines + rankings (3), plus SP+ and FPI on
 * Sunday–Tuesday runs (2), plus last week's lines when picks need grading (1).
 * Teams and venues cost 2 calls once per season. That keeps the twice-daily
 * schedule near 250 of the free tier's 1,000 monthly calls.
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseCsv } from '../../mcp-server/src/utils/csv.ts';
import { WALTERS_CFB_VERSION, projectGame } from '../../mcp-server/src/utils/waltersCfb.ts';
import {
  SLATE_HEADER,
  buildRatingRows,
  buildSlate,
  cfbSeasonYear,
  closingLineValue,
  consensusLine,
  gradeSpread,
  isNum,
  latestRanks,
  pickCurrentWeek,
  slateCsvRow,
  toCsv,
} from './cfbd.mjs';

export const RATINGS_HEADER = [
  'team_id', 'team', 'abbreviation', 'conference', 'rating', 'rating_sources', 'ratings_gap_band',
];

export const PREDICTIONS_HEADER = [
  'game_id', 'sport', 'market', 'predicted_at', 'game_time', 'probability', 'outcome',
  'pick_side', 'confidence', 'clv_points', 'week', 'home_team', 'away_team', 'model_version',
];

/** Picks are logged once, at the first run inside this window before kickoff. */
export const SNAPSHOT_WINDOW_MS = 72 * 3600e3;
/** A pending pick whose game never finished this long after kickoff is voided (cancelled). */
const VOID_AFTER_MS = 7 * 86400e3;

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function readCsvFile(file) {
  const text = readText(file);
  return text.trim() ? parseCsv(text) : [];
}

function openCache(cacheDir, season) {
  const dir = path.join(cacheDir, String(season));
  return {
    read(name) {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
      } catch {
        return undefined;
      }
    },
    write(name, data) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data));
      return data;
    },
  };
}

/**
 * Run one refresh. `api(endpoint, params)` must resolve to parsed JSON and
 * throw on HTTP errors. Resolves to a summary; throws (writing nothing) if a
 * required call fails.
 */
export async function runCfbUpdate({ api, outDir, cacheDir, now = new Date(), log = console.log }) {
  const season = cfbSeasonYear(now);
  // No FBS season has kicked off before late August or run past January, so
  // the spring and summer runs spend no API calls at all.
  const month = now.getUTCMonth();
  if (month >= 2 && month <= 6) {
    log('College football offseason (March–July). Files left unchanged.');
    return { status: 'offseason', season, calls: 0 };
  }
  let calls = 0;
  const get = (endpoint, params = {}) => {
    calls += 1;
    return api(endpoint, params);
  };
  const cache = openCache(cacheDir, season);

  const teams = cache.read('teams') ?? cache.write('teams', await get('/teams/fbs', { year: season }));
  const venues = cache.read('venues') ?? cache.write('venues', await get('/venues'));
  const games = await get('/games', { year: season, seasonType: 'both', classification: 'fbs' });

  const current = pickCurrentWeek(games, now);
  // Schedules are published months ahead; don't build a "this week" slate for
  // a kickoff that is still more than ten days away.
  if (!current || current.nextKickoff - now.getTime() > 10 * 86400e3) {
    log(`No ${season} games in the next ten days — offseason. Files left unchanged.`);
    return { status: 'offseason', season, calls };
  }
  log(`Season ${season}, ${current.seasonType} week ${current.week}`);

  const [lines, pollWeeks] = await Promise.all([
    get('/lines', { year: season, seasonType: current.seasonType, week: current.week }),
    get('/rankings', { year: season, seasonType: 'both' }),
  ]);
  const poll = latestRanks(pollWeeks);

  // --- ratings: refresh Sunday–Tuesday (SP+ and FPI update after the weekend), or when missing
  const ratingsFile = path.join(outDir, 'cfb_ratings.csv');
  const previousMeta = JSON.parse(readText(path.join(outDir, 'last_updated.json')) || '{}');
  let ratingRows = readCsvFile(ratingsFile);
  let ratingsUpdatedAt = previousMeta.season === season ? previousMeta.ratingsUpdatedAt ?? null : null;
  let ratingsChanged = false;
  const haveRatings = previousMeta.season === season && ratingRows.some((r) => r.rating !== '');
  if ([0, 1, 2].includes(now.getUTCDay()) || !haveRatings) {
    try {
      const [sp, fpi] = await Promise.all([
        get('/ratings/sp', { year: season }),
        get('/ratings/fpi', { year: season }),
      ]);
      ratingRows = buildRatingRows(teams, sp, fpi);
      ratingsUpdatedAt = now.toISOString();
      ratingsChanged = true;
    } catch (e) {
      if (!haveRatings) throw e;
      log(`  SP+/FPI refresh failed (${e.message}) — keeping the ratings from ${ratingsUpdatedAt}`);
    }
  }
  const ratingById = new Map(
    ratingRows.filter((r) => r.rating !== '').map((r) => [Number(r.team_id), Number(r.rating)]),
  );

  // --- this week's slate
  const { slate, elevationUnit } = buildSlate({ games, current, teams, venues, ranks: poll.ranks, lines });

  // --- pick log: snapshot new picks, grade finished ones
  const predictionsFile = path.join(outDir, 'cfb_predictions.csv');
  const logged = readCsvFile(predictionsFile).filter((r) => r.sport === 'CFB');
  const loggedIds = new Set(logged.map((r) => Number(r.game_id)));
  const stored = cache.read('state');
  const state = stored?.season === season ? stored : { season, pending: [] };

  let snapshots = 0;
  for (const g of slate) {
    const start = Date.parse(g.startDate);
    if (g.completed || !(start > now.getTime()) || start - now.getTime() > SNAPSHOT_WINDOW_MS) continue;
    if (loggedIds.has(g.gameId) || state.pending.some((p) => p.gameId === g.gameId)) continue;
    const ratingHome = ratingById.get(g.home.id);
    const ratingAway = ratingById.get(g.away.id);
    if (!isNum(g.spreadHome) || !isNum(ratingHome) || !isNum(ratingAway)) continue;
    const { result } = projectGame({
      ratingHome, ratingAway, neutralSite: g.neutralSite, spreadHome: g.spreadHome,
      home: g.home, away: g.away, venueElevationFt: g.venueElevationFt,
    });
    if (!result.pick) continue;
    state.pending.push({
      gameId: g.gameId,
      seasonType: g.seasonType,
      week: g.week,
      startDate: g.startDate,
      homeTeam: g.home.team,
      awayTeam: g.away.team,
      predictedAt: now.toISOString(),
      side: result.pick === 'A' ? 'home' : 'away',
      pickLineHome: g.spreadHome,
      probability: Math.round(result.pickProbability * 100) / 100,
      confidence: result.confidence,
      modelVersion: WALTERS_CFB_VERSION,
    });
    snapshots += 1;
  }

  const finished = new Map(
    games.filter((g) => g.completed && isNum(g.homePoints) && isNum(g.awayPoints)).map((g) => [g.id, g]),
  );
  const closing = new Map();
  const weekKey = (seasonType, week) => `${seasonType}:${week}`;
  closing.set(weekKey(current.seasonType, current.week), lines);
  for (const p of state.pending) {
    const key = weekKey(p.seasonType, p.week);
    if (!finished.has(p.gameId) || closing.has(key)) continue;
    try {
      closing.set(key, await get('/lines', { year: season, seasonType: p.seasonType, week: p.week }));
    } catch (e) {
      log(`  closing lines for ${key} unavailable (${e.message}) — grading without CLV`);
      closing.set(key, []);
    }
  }

  const settled = [];
  const stillPending = [];
  for (const p of state.pending) {
    const g = finished.get(p.gameId);
    const cancelled = !g && now.getTime() - Date.parse(p.startDate) > VOID_AFTER_MS;
    if (!g && !cancelled) {
      stillPending.push(p);
      continue;
    }
    const close = g
      ? consensusLine((closing.get(weekKey(p.seasonType, p.week)) ?? []).find((bg) => bg.id === p.gameId))
          .spreadHome
      : undefined;
    settled.push({
      game_id: p.gameId,
      sport: 'CFB',
      market: 'spread',
      predicted_at: p.predictedAt,
      game_time: p.startDate,
      probability: p.probability.toFixed(2),
      outcome: g ? gradeSpread(g.homePoints, g.awayPoints, p.pickLineHome, p.side) : 'void',
      pick_side: p.side,
      confidence: p.confidence,
      clv_points: g && isNum(close) ? String(closingLineValue(p.side, p.pickLineHome, close)) : '',
      week: p.week,
      home_team: p.homeTeam,
      away_team: p.awayTeam,
      model_version: p.modelVersion,
    });
  }
  state.pending = stillPending;

  // --- write everything only after every required call succeeded
  fs.mkdirSync(outDir, { recursive: true });
  if (ratingsChanged) fs.writeFileSync(ratingsFile, toCsv(RATINGS_HEADER, ratingRows));
  fs.writeFileSync(path.join(outDir, 'cfb_slate.csv'), toCsv(SLATE_HEADER, slate.map(slateCsvRow)));
  const predictions = [...logged, ...settled].sort(
    (a, b) => Date.parse(a.game_time) - Date.parse(b.game_time) || Number(a.game_id) - Number(b.game_id),
  );
  if (settled.length || !fs.existsSync(predictionsFile)) {
    fs.writeFileSync(predictionsFile, toCsv(PREDICTIONS_HEADER, predictions));
  }
  cache.write('state', state);

  const fbsVsFbs = slate.filter((g) => g.home.classification === 'fbs' && g.away.classification === 'fbs');
  const meta = {
    updatedAt: now.toISOString(),
    season,
    seasonType: current.seasonType,
    week: current.week,
    games: slate.length,
    fbsGames: fbsVsFbs.length,
    fbsGamesWithLines: fbsVsFbs.filter((g) => isNum(g.spreadHome)).length,
    rankedGames: slate.filter((g) => g.home.rank || g.away.rank).length,
    ratedTeams: ratingById.size,
    ratingsUpdatedAt,
    poll: poll.poll ? `${poll.poll}, week ${poll.week}` : '',
    apiCalls: calls,
    picksPending: state.pending.length,
    picksLogged: predictions.length,
    modelVersion: WALTERS_CFB_VERSION,
    venueElevationUnit: elevationUnit,
    sources: ['CollegeFootballData.com API: games, betting lines, rankings, SP+ and FPI ratings, venues, teams'],
    derived: [
      'rating = mean of SP+ and FPI (points vs. an average FBS team on a neutral field)',
      'ratings_gap_band = how far SP+ and FPI disagree (0-3, 3-6, 6+ points)',
      'spread_home / total = median across books, nearest half point',
      'rest days, previous margin, time-zone change, body-clock hour, stadium elevations, next opponent',
    ],
  };
  fs.writeFileSync(path.join(outDir, 'last_updated.json'), JSON.stringify(meta, null, 2) + '\n');

  log(
    `  ${slate.length} games (${meta.fbsGamesWithLines}/${fbsVsFbs.length} FBS matchups with lines), ` +
      `${ratingById.size} rated teams${ratingsChanged ? ' (refreshed)' : ''}, poll: ${meta.poll || 'none yet'}`,
  );
  log(`  picks: ${snapshots} logged, ${settled.length} graded, ${state.pending.length} pending; ${calls} API calls`);
  return { status: 'ok', ...meta, snapshots, settled: settled.length };
}
