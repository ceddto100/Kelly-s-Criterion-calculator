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
    weights: {
      points: 0.4, // net points differential
      yards: 0.25, // net yards differential (per 25 yards)
      turnovers: 0.2, // turnover differential
    },
    /** Scaling constants inside each component. */
    scaling: {
      yardsPerPoint: 25, // 25 net yards ≈ 1 scaled unit
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
      points: 0.4,
      yards: 0.25,
      turnovers: 0.2,
    },
    scaling: {
      yardsPerPoint: 25,
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
    homeCourtAdvantage: 1.5,
    decayRate: 0.85, // 85% season, 15% recent when recent inputs given
    leagueAvgPace: 100,
    /**
     * Component weights (sum to 1.0). NOTE on correlation: scoring output
     * (PPG-for / points-allowed) and shooting efficiency (FG%) are positively
     * correlated — a team that shoots well tends to score more. They are kept as
     * separate inputs deliberately (volume vs efficiency carry distinct signal),
     * but this is the place to retune them once backtesting data exists. The
     * `ppgFor` + `pointsAllowed` pair together act as a net-scoring margin.
     */
    weights: {
      ppgFor: 0.15, // offensive output edge
      pointsAllowed: 0.15, // defensive (points allowed) edge
      fgPct: 0.25,
      rebounds: 0.17,
      turnovers: 0.13,
      threePct: 0.08,
      threeRate: 0.07,
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
      ppgFor: 0.15,
      pointsAllowed: 0.15,
      fgPct: 0.25,
      rebounds: 0.17,
      turnovers: 0.13,
      threePct: 0.08,
      threeRate: 0.07,
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
