/**
 * MLB Projection Configuration
 * --------------------------------
 * Every constant the MLB engine uses lives here so the model can be tuned and
 * back-tested without touching the math. No magic numbers in the engine itself.
 *
 * Philosophy: MLB run scoring is modeled multiplicatively around a league
 * baseline. Each independent factor (offense, starting pitching, bullpen, park,
 * weather, lineup, recent form) produces a multiplier centered on 1.0, where
 * >1.0 means "more runs than average" and <1.0 means "fewer runs than average".
 * Multiplying neutral factors leaves the league baseline unchanged, which makes
 * the projection explainable and each driver auditable.
 */

export const MLB_LEAGUE = {
  /** League-average runs scored per team per game (recent MLB seasons ~4.3). */
  avgRunsPerTeam: 4.3,
  /**
   * League-average run-prevention rate on the ERA/FIP scale (runs allowed per 9
   * innings). Used to convert a pitcher's FIP/ERA into a run multiplier.
   */
  avgEra: 4.25,
  /** League-average wOBA (used when wRC+ is unavailable). */
  avgWoba: 0.318,
  /** League-average OPS (last-resort offense fallback). */
  avgOps: 0.72,
  /** Typical innings a modern MLB starter is expected to throw. */
  starterInnings: 5.5,
  /** Total regulation innings. */
  totalInnings: 9,
} as const;

/**
 * Blend weights for converting a team's offensive profile into a single
 * offense multiplier. Stats are tried in priority order; the highest-priority
 * available stat anchors the rating, with others nudging it. Weights are
 * normalized over whatever inputs are actually present, so missing data never
 * silently biases the result.
 */
export const MLB_OFFENSE_WEIGHTS = {
  wrcPlus: 0.45, // best single offense summary (park & league adjusted)
  woba: 0.3, // strong rate stat, run-value based
  ops: 0.15, // widely available, correlates with run production
  runsPerGame: 0.1, // raw output; noisy / context-dependent, low weight
} as const;

/**
 * How much of a game's run prevention is attributable to the starter vs the
 * bullpen. Derived from expected innings: a starter going ~5.5 of 9 innings
 * owns ~61% of the game. Bullpen weight rises with fatigue (see BULLPEN).
 */
export const MLB_PITCHING_SPLIT = {
  starterShare: MLB_LEAGUE.starterInnings / MLB_LEAGUE.totalInnings, // ~0.61
  get bullpenShare() {
    return 1 - this.starterShare;
  },
} as const;

/**
 * Starting pitcher rating blend. ERA estimators (FIP/xFIP/SIERA) are preferred
 * over raw ERA because ERA is heavily influenced by defense and sequencing
 * luck. We never rely on ERA alone.
 */
export const MLB_STARTER_WEIGHTS = {
  siera: 0.35, // most predictive of future run prevention
  xfip: 0.25, // normalizes HR/FB luck
  fip: 0.25, // defense-independent
  era: 0.15, // outcome-based, kept small as a sanity anchor
} as const;

export const MLB_BULLPEN = {
  /** Rating blend for the bullpen unit. */
  weights: {
    fip: 0.45,
    era: 0.3,
    whip: 0.25,
  },
  /**
   * Fatigue: heavy recent usage degrades a bullpen and shifts more of the
   * game's run prevention onto a tired unit. Penalty is a multiplier applied to
   * the bullpen's run contribution (>1 = allows more runs).
   */
  fatigue: {
    /** Relief innings over the last day above which fatigue kicks in. */
    last1dThreshold: 2.5,
    /** Relief innings over the last 3 days above which fatigue kicks in. */
    last3dThreshold: 9,
    /** Max multiplicative penalty to bullpen run prevention from fatigue. */
    maxPenalty: 0.08,
    /** Extra bullpen share of the game when the closer is unavailable. */
    closerUnavailableShift: 0.04,
  },
} as const;

/**
 * Park factors are expressed on the standard "100 = neutral" scale
 * (e.g. Coors Field ~112 for runs). Divided by 100 to become a multiplier.
 */
export const MLB_PARK = {
  neutral: 100,
  /** Clamp to guard against bad inputs. */
  min: 88,
  max: 118,
} as const;

/**
 * Weather adjustments. Baseball offense rises in warm air (the ball carries)
 * and with wind blowing out; it falls in cold/dense air and with wind blowing
 * in. All effects are small and capped.
 */
export const MLB_WEATHER = {
  /** Reference temperature where weather is run-neutral (°F). */
  neutralTempF: 70,
  /** Fractional run change per degree away from neutral (~+0.7% per 10°F). */
  runsPerDegreeF: 0.0007,
  /** Wind blowing OUT to the outfield: fractional run gain per mph. */
  windOutPerMph: 0.007,
  /** Wind blowing IN from the outfield: fractional run loss per mph. */
  windInPerMph: 0.006,
  /** Total cap on the weather multiplier deviation from 1.0. */
  maxEffect: 0.08,
} as const;

/**
 * Lineup adjustments. A confirmed lineup with stars in does not move the
 * projection (the offense rating already assumes a normal lineup); missing
 * stars or a downgraded lineup reduces it. Platoon (handedness) advantage is a
 * small bump. Unconfirmed lineups do NOT move the mean — they reduce
 * confidence instead (handled in the confidence model).
 */
export const MLB_LINEUP = {
  /** Run multiplier penalty per rested/absent star hitter. */
  perStarOutPenalty: 0.03,
  /** Cap on total lineup penalty. */
  maxPenalty: 0.1,
  /** Small bump when the batting side has the platoon (handedness) edge. */
  platoonAdvantage: 0.015,
} as const;

/**
 * Recent form. Hot/cold streaks carry information but are small samples, so the
 * effect is deliberately capped and regressed heavily toward season-long norms.
 */
export const MLB_RECENT_FORM = {
  /** Maximum weight given to recent form vs season-long rating. */
  maxWeight: 0.2,
  /** Cap on the recent-form multiplier deviation from 1.0. */
  maxEffect: 0.05,
} as const;

/**
 * No-bet and confidence thresholds. These encode discipline: the model should
 * decline to bet far more often than it fires.
 */
export const MLB_DECISION = {
  /**
   * Minimum projected-vs-book edge (in runs) required to consider a total lean.
   * Below this the line is too close to the projection to claim an edge.
   */
  totalMinEdgeRuns: 0.5,
  /** Minimum moneyline win-probability edge vs the implied line to lean. */
  moneylineMinEdge: 0.04,
  /**
   * Minimum data-completeness score (0-1) below which we force a no-bet
   * regardless of edge, because the projection is too speculative.
   */
  minDataCompleteness: 0.5,
  /** Std dev (in runs) of a single MLB game total around its mean. */
  totalSigma: 2.9,
  /** Logistic scale converting a run-margin into a win probability. */
  moneylineRunScale: 3.35,
} as const;

/**
 * Confidence model weights. Confidence is NOT just edge size — it blends edge,
 * agreement between independent stat categories, and data quality. Weights sum
 * to 1.0.
 */
export const MLB_CONFIDENCE_WEIGHTS = {
  edge: 0.4, // how big the projected edge is
  agreement: 0.3, // do offense/pitching/park point the same way
  dataQuality: 0.3, // completeness + confirmations
} as const;
