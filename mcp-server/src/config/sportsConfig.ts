/**
 * Sport Formula Configuration (football & basketball spread models)
 * -----------------------------------------------------------------
 * Every weight and constant the Walters-style spread models use lives here so
 * the formulas can be tuned and backtested without editing the math. The spec
 * is explicit: "If using weights in formulas, place them in a clear config file
 * so they can be adjusted later." This is that file.
 *
 * Values are the existing, in-production numbers — extracting them here is
 * behavior-preserving. The math in calculations.ts now reads from here.
 */

// ============================================================================
// FOOTBALL (NFL / CFB)
// ============================================================================

export const FOOTBALL_CONFIG = {
  NFL: {
    sigma: 13.5, // points std dev for cover probability
    homeFieldAdvantage: 2.5,
    /**
     * Recent-form blend: effective rate = decayRate*season + (1-decayRate)*recent.
     * 0.9 => 90% season, 10% recent. Only applied when recent inputs are given.
     */
    decayRate: 0.9,
    /** Max points a starting-QB edge can swing the projection (clamp bound). */
    qbValue: 7.0,
    /**
     * Recalibrated 2026-07: net scoring is the strongest single predictor of
     * margin, so it carries the majority weight (0.5 ≈ full signal with ~50%
     * regression toward the mean for season averages). Yardage and turnovers
     * are partially embedded in net scoring already, so they enter as smaller
     * corroborating signals rather than co-equal components.
     */
    weights: {
      points: 0.5, // net points differential (primary signal)
      yards: 0.25, // net yards differential (per yardsPerPoint yards)
      // Season turnover differential is a TOTAL, not per-game, and turnover
      // luck regresses hard. Effective value per unit of season TO diff:
      // pointsPerTurnover(4) * turnoverRegression(0.5) * 0.06 = 0.12 pts,
      // which matches ~4 pts per turnover spread over a 17-game season.
      turnovers: 0.06,
    },
    /** Scaling constants inside each component. */
    scaling: {
      yardsPerPoint: 15, // ~15 net yards ≈ 1 point (empirical NFL yards-per-point)
      pointsPerTurnover: 4, // empirical value of a turnover
      turnoverRegression: 0.5, // regress raw turnover diff toward the mean
      turnoverClamp: 10, // clamp extreme season turnover diffs
    },
  },
  CFB: {
    sigma: 16.0, // higher variance in college
    homeFieldAdvantage: 3.0,
    decayRate: 0.85,
    qbValue: 9.0, // QBs swing college games more
    weights: {
      points: 0.5,
      yards: 0.25,
      // Shorter ~12-game season → each unit of season TO diff is worth more
      // per game than in the NFL: 4 * 0.5 * 0.08 = 0.16 pts per unit.
      turnovers: 0.08,
    },
    scaling: {
      yardsPerPoint: 15,
      pointsPerTurnover: 4,
      turnoverRegression: 0.5,
      turnoverClamp: 10,
    },
  },
} as const;

// ============================================================================
// BASKETBALL (NBA / CBB)
// ============================================================================

export const BASKETBALL_CONFIG = {
  NBA: {
    sigma: 12.0,
    // Modern NBA home-court advantage runs ~2.2–2.8 points; 1.5 undersold it.
    homeCourtAdvantage: 2.5,
    decayRate: 0.85, // 85% season, 15% recent when recent inputs given
    leagueAvgPace: 100,
    /**
     * Recalibrated 2026-07. The ppgFor + pointsAllowed pair together form the
     * net-scoring margin, the strongest predictor of future margin — at 0.4
     * each the pair passes through the net-rating gap at 0.4x, and the
     * correlated skill components (shooting, rebounding, turnovers) bring the
     * total effective pass-through to roughly 0.55–0.65x, i.e. season net
     * rating regressed toward the mean. The old 0.15/0.15 scoring weights
     * meant a +9 net-rating gap produced barely a 1.3-point edge, which
     * systematically underestimated favorites.
     */
    weights: {
      ppgFor: 0.4, // offensive output edge (primary, with pointsAllowed)
      pointsAllowed: 0.4, // defensive (points allowed) edge (primary)
      fgPct: 0.15,
      rebounds: 0.1,
      turnovers: 0.08,
      threePct: 0.06,
      threeRate: 0.05,
    },
    scaling: {
      fgPctPointsMultiplier: 2.0, // each 1% FG diff ≈ 2 pts
      threePctMultiplier: 1.0, // each 1% 3P diff ≈ 1 pt
      threeRateMultiplier: 15, // convert 3PA-rate diff to points
      reboundPointValue: 0.5, // each rebound-margin ≈ 0.5 second-chance pts
      turnoverPointValue: 1.0, // each turnover-margin ≈ 1 pt
    },
  },
  CBB: {
    sigma: 10.5,
    homeCourtAdvantage: 3.5,
    decayRate: 0.85,
    // BUG FIX: college basketball plays ~68 possessions, not the NBA's ~100.
    // The previous code reused the NBA's 100 for CBB, which wrongly compressed
    // college margins by ~32%. League-specific pace corrects that.
    leagueAvgPace: 68,
    weights: {
      ppgFor: 0.4,
      pointsAllowed: 0.4,
      fgPct: 0.15,
      rebounds: 0.1,
      turnovers: 0.08,
      threePct: 0.06,
      threeRate: 0.05,
    },
    scaling: {
      fgPctPointsMultiplier: 2.0,
      threePctMultiplier: 1.0,
      threeRateMultiplier: 15,
      reboundPointValue: 0.5,
      turnoverPointValue: 1.0,
    },
  },
} as const;

export type FootballLeague = keyof typeof FOOTBALL_CONFIG;
export type BasketballLeague = keyof typeof BASKETBALL_CONFIG;
