/**
 * scripts/lib/cfbCalibration.mjs
 * ==============================
 * Checks the college football Walters constants against past seasons using
 * only numbers that existed BEFORE each game (docs/PREDICTION_MODEL.md):
 *
 *   - the closing consensus spread   (CFBD /lines)
 *   - CFBD's pre-game Elo ratings    (CFBD /games homePregameElo/awayPregameElo)
 *   - schedule/travel/altitude context and the poll released before the game
 *
 * CFBD does not keep week-by-week SP+/FPI snapshots, so the SP+/FPI blend
 * itself cannot be backtested honestly; pre-game Elo stands in as the rating.
 * The live pick log (cfb_predictions.csv) is the real test of the blend.
 *
 * Nothing here changes the engine. It reports estimates with standard errors
 * and suggests a value only when the estimate is at least two standard errors
 * from zero; everything else keeps its structural default.
 */

import {
  WALTERS_CFB,
  autoFactorsForGame,
  normalCdf,
  projectWalters,
} from '../../mcp-server/src/utils/waltersCfb.ts';
import {
  consensusLine,
  elevationFeetResolver,
  isNum,
  latestRanks,
  sideContext,
  teamSchedules,
} from './cfbd.mjs';

export const FACTOR_NAMES = ['bye', 'shortWeek', 'travel', 'altitude', 'bounceback', 'lookahead'];

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/**
 * One record per completed regular-season FBS-vs-FBS game with a closing line
 * and both pre-game Elo ratings. Postseason games are left out: opt-outs and
 * bowl motivation are a different problem.
 */
export function buildGameRecords({ games, lines, teams, venues, pollWeeks }) {
  const teamsById = new Map((teams ?? []).map((t) => [t.id, t]));
  const venuesById = new Map((venues ?? []).map((v) => [v.id, v]));
  const { toFeet } = elevationFeetResolver(venues);
  const schedules = teamSchedules(games);
  const closeById = new Map((lines ?? []).map((bg) => [bg.id, consensusLine(bg).spreadHome]));
  const records = [];
  for (const g of games ?? []) {
    if (g.seasonType !== 'regular' || !g.completed) continue;
    if (g.homeClassification !== 'fbs' || g.awayClassification !== 'fbs') continue;
    const closeHome = closeById.get(g.id);
    if (![g.homePoints, g.awayPoints, g.homePregameElo, g.awayPregameElo, closeHome].every(isNum)) continue;
    const venue = venuesById.get(g.venueId) ?? (!g.neutralSite ? teamsById.get(g.homeId)?.location : undefined);
    const ranks = latestRanks(pollWeeks, { seasonType: 'regular', week: g.week }).ranks;
    const ctx = { teamsById, schedules, ranks, toFeet, venueTz: venue?.timezone };
    const home = sideContext(g, g.homeId, true, ctx);
    const away = sideContext(g, g.awayId, false, ctx);
    const venueElevationFt = toFeet(venue?.elevation);
    const auto = autoFactorsForGame({ neutralSite: Boolean(g.neutralSite), home, away, venueElevationFt });
    records.push({
      id: g.id,
      season: g.season,
      week: g.week,
      startDate: g.startDate,
      neutral: Boolean(g.neutralSite),
      homeMargin: g.homePoints - g.awayPoints,
      closeHome,
      eloDiff: g.homePregameElo - g.awayPregameElo,
      home,
      away,
      venueElevationFt,
      auto,
      net: Object.fromEntries(FACTOR_NAMES.map((f) => [f, Number(auto.home[f]) - Number(auto.away[f])])),
    });
  }
  return records;
}

// ---------------------------------------------------------------------------
// Least squares
// ---------------------------------------------------------------------------

function invert(matrix) {
  const n = matrix.length;
  const a = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    for (let j = 0; j < 2 * n; j += 1) a[col][j] /= p;
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const f = a[r][col];
      if (f !== 0) for (let j = 0; j < 2 * n; j += 1) a[r][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row.slice(n));
}

/**
 * Ordinary least squares with standard errors. Columns that never vary (a
 * factor that never occurred) are dropped and reported as undefined.
 */
export function leastSquares(rows, y, names) {
  const keep = names.map((_, j) => j === 0 || rows.some((r) => r[j] !== rows[0][j]));
  const idx = keep.map((v, j) => (v ? j : -1)).filter((j) => j >= 0);
  const X = rows.map((r) => idx.map((j) => r[j]));
  const n = X.length;
  const m = idx.length;
  const xtx = Array.from({ length: m }, (_, i) =>
    Array.from({ length: m }, (_, j) => X.reduce((s, row) => s + row[i] * row[j], 0)));
  const xty = Array.from({ length: m }, (_, i) => X.reduce((s, row, r) => s + row[i] * y[r], 0));
  const inv = n > m ? invert(xtx) : null;
  const out = Object.fromEntries(names.map((name) => [name, undefined]));
  if (!inv) return { n, coef: out, se: { ...out }, rmse: undefined };
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * xty[j], 0));
  const rss = X.reduce((s, row, r) => s + (y[r] - row.reduce((t, v, j) => t + v * beta[j], 0)) ** 2, 0);
  const s2 = rss / (n - m);
  const coef = { ...out };
  const se = { ...out };
  idx.forEach((j, i) => {
    coef[names[j]] = beta[i];
    se[names[j]] = Math.sqrt(Math.max(0, s2 * inv[i][i]));
  });
  return { n, coef, se, rmse: Math.sqrt(rss / n) };
}

// ---------------------------------------------------------------------------
// Probability scoring
// ---------------------------------------------------------------------------

/** samples: [{ p (0–1), y (0|1) }] */
export function scoreProbabilities(samples) {
  const n = samples.length;
  if (!n) return { count: 0, logLoss: undefined, brier: undefined, reliability: [] };
  const clamp = (p) => Math.min(1 - 1e-15, Math.max(1e-15, p));
  return {
    count: n,
    logLoss: samples.reduce((s, { p, y }) => s - (y * Math.log(clamp(p)) + (1 - y) * Math.log(1 - clamp(p))), 0) / n,
    brier: samples.reduce((s, { p, y }) => s + (p - y) ** 2, 0) / n,
    reliability: Array.from({ length: 10 }, (_, i) => {
      const bin = samples.filter(({ p }) => Math.min(9, Math.floor(p * 10)) === i);
      return {
        lower: i / 10,
        count: bin.length,
        meanProbability: bin.length ? bin.reduce((s, r) => s + r.p, 0) / bin.length : undefined,
        observedRate: bin.length ? bin.reduce((s, r) => s + r.y, 0) / bin.length : undefined,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Calibration
// ---------------------------------------------------------------------------

const LINE_BUCKETS = [0, 3.5, 7.5, 14, 21, 28, Infinity];

/** Root-mean-square miss of the final margin around the closing line, by line size. */
export function marginSpreadByLine(records) {
  return LINE_BUCKETS.slice(0, -1).map((lo, i) => {
    const hi = LINE_BUCKETS[i + 1];
    const bin = records.filter((r) => Math.abs(r.closeHome) >= lo && Math.abs(r.closeHome) < hi);
    const sq = bin.map((r) => (r.homeMargin + r.closeHome) ** 2);
    return {
      lines: `${lo}–${hi === Infinity ? '' : hi}`,
      count: bin.length,
      meanLine: bin.length ? bin.reduce((s, r) => s + Math.abs(r.closeHome), 0) / bin.length : undefined,
      rms: bin.length ? Math.sqrt(sq.reduce((a, b) => a + b, 0) / bin.length) : undefined,
    };
  });
}

/** Fit sigma = base + slope × max(0, |line| − knee) to the by-line spread. */
export function fitSigma(records, knee = WALTERS_CFB.sigma.knee) {
  const inside = records.filter((r) => Math.abs(r.closeHome) < knee);
  const outside = records.filter((r) => Math.abs(r.closeHome) >= knee);
  if (inside.length < 30) return undefined;
  const base = Math.sqrt(inside.reduce((s, r) => s + (r.homeMargin + r.closeHome) ** 2, 0) / inside.length);
  let num = 0;
  let den = 0;
  for (const r of outside) {
    const x = Math.abs(r.closeHome) - knee;
    num += x * (Math.abs(r.homeMargin + r.closeHome) * Math.sqrt(Math.PI / 2) - base);
    den += x * x;
  }
  const slopePerPoint = den > 0 && outside.length >= 30 ? Math.max(0, num / den) : 0;
  return { base, knee, slopePerPoint };
}

const significant = (estimate, se) => isNum(estimate) && isNum(se) && se > 0 && Math.abs(estimate) >= 2 * se;
const round = (v, dp = 2) => (isNum(v) ? Math.round(v * 10 ** dp) / 10 ** dp : undefined);

function fitMarginModel(records) {
  const names = ['intercept', 'eloDiff', 'home', ...FACTOR_NAMES];
  const rows = records.map((r) => [1, r.eloDiff, r.neutral ? 0 : 1, ...FACTOR_NAMES.map((f) => r.net[f])]);
  return leastSquares(rows, records.map((r) => r.homeMargin), names);
}

/** Held-out scoring of the engine with an Elo stand-in for the power ratings. */
function evaluate(records, config, pointsPerElo) {
  const samples = [];
  const tiers = { LEAN: { win: 0, loss: 0, push: 0 }, BET: { win: 0, loss: 0, push: 0 }, STRONG: { win: 0, loss: 0, push: 0 } };
  const outright = [];
  for (const r of records) {
    const result = projectWalters(
      {
        ratingA: pointsPerElo * (r.eloDiff / 2),
        ratingB: -pointsPerElo * (r.eloDiff / 2),
        venue: r.neutral ? 'neutral' : 'home',
        marketSpread: r.closeHome,
        factorsA: { bye: r.auto.home.bye, shortWeek: r.auto.home.shortWeek, travel: r.auto.home.travel, altitude: r.auto.home.altitude, bounceback: r.auto.home.bounceback },
        factorsB: { bye: r.auto.away.bye, shortWeek: r.auto.away.shortWeek, travel: r.auto.away.travel, altitude: r.auto.away.altitude, bounceback: r.auto.away.bounceback },
      },
      config,
    );
    // The error-range check needs no ratings: how well does N(-close, sigma) price the outright winner?
    const sigma = config.sigma.base + config.sigma.slopePerPoint * Math.max(0, Math.abs(r.closeHome) - config.sigma.knee);
    if (r.homeMargin !== 0) outright.push({ p: normalCdf(-r.closeHome / sigma), y: r.homeMargin > 0 ? 1 : 0 });
    if (result.pick === null) continue;
    const cover = r.homeMargin + r.closeHome;
    if (cover === 0) {
      if (tiers[result.confidence]) tiers[result.confidence].push += 1;
      continue;
    }
    const won = (result.pick === 'A') === cover > 0;
    samples.push({ p: result.pickProbability / 100, y: won ? 1 : 0 });
    if (tiers[result.confidence]) tiers[result.confidence][won ? 'win' : 'loss'] += 1;
  }
  const { reliability, ...scores } = scoreProbabilities(samples);
  const outrightScores = scoreProbabilities(outright);
  return {
    againstTheSpread: { ...scores, reliability, byConfidence: tiers },
    outrightWinnerFromClosingLine: { count: outrightScores.count, logLoss: outrightScores.logLoss, brier: outrightScores.brier },
  };
}

export function calibrate({ train, validate, config = WALTERS_CFB }) {
  const fit = fitMarginModel(train);
  const market = leastSquares(
    train.map((r) => [1, r.eloDiff, r.neutral ? 0 : 1]),
    train.map((r) => -r.closeHome),
    ['intercept', 'eloDiff', 'home'],
  );
  const mispricing = leastSquares(
    train.map((r) => [1, ...FACTOR_NAMES.map((f) => r.net[f])]),
    train.map((r) => r.homeMargin + r.closeHome),
    ['intercept', ...FACTOR_NAMES],
  );
  const sigma = fitSigma(train, config.sigma.knee);
  const pointsPerElo = fit.coef.eloDiff ?? 1 / 25;

  const factors = FACTOR_NAMES.map((name) => {
    const estimate = fit.coef[name];
    const se = fit.se[name];
    return {
      name,
      current: config.factors[name],
      games: train.filter((r) => r.net[name] !== 0).length,
      effectOnMargin: { estimate: round(estimate), se: round(se) },
      marketMispricing: { estimate: round(mispricing.coef[name]), se: round(mispricing.se[name]) },
      suggested: significant(estimate, se) ? round(estimate, 1) : config.factors[name],
    };
  });

  const suggestedConfig = {
    ...config,
    homeFieldAdvantage: significant(fit.coef.home, fit.se.home) ? round(fit.coef.home, 1) : config.homeFieldAdvantage,
    sigma: sigma ? { base: round(sigma.base, 1), knee: sigma.knee, slopePerPoint: round(sigma.slopePerPoint, 2) } : config.sigma,
    factors: { ...config.factors, ...Object.fromEntries(factors.map((f) => [f.name, f.suggested])) },
  };

  return {
    note:
      'Pre-game inputs only (closing lines, pre-game Elo, schedule context, prior polls). CFBD keeps no weekly ' +
      'SP+/FPI snapshots, so pre-game Elo stands in for the power rating; the live pick log is the real test of ' +
      'the SP+/FPI blend. Suggestions require an estimate at least 2 standard errors from zero. Nothing here ' +
      'is applied to the engine automatically.',
    games: { train: train.length, validate: validate.length },
    homeField: {
      current: config.homeFieldAdvantage,
      fromFinalScores: { estimate: round(fit.coef.home), se: round(fit.se.home) },
      pricedByClosingLines: { estimate: round(market.coef.home), se: round(market.se.home) },
    },
    pointsPerEloPoint: { estimate: round(pointsPerElo, 4), se: round(fit.se.eloDiff, 4) },
    marginSpread: { current: config.sigma, fitted: sigma && { ...sigma, base: round(sigma.base), slopePerPoint: round(sigma.slopePerPoint, 3) }, byLine: marginSpreadByLine(train) },
    factors,
    validation: {
      baselineLogLoss: Math.log(2),
      current: evaluate(validate, config, pointsPerElo),
      suggested: evaluate(validate, suggestedConfig, pointsPerElo),
    },
    suggestedConfig: {
      homeFieldAdvantage: suggestedConfig.homeFieldAdvantage,
      sigma: suggestedConfig.sigma,
      factors: suggestedConfig.factors,
    },
  };
}
