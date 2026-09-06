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
   * FIP/xFIP/SIERA are all scaled to league ERA by construction, so a single
   * baseline is correct for the whole starter blend.
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
 * Home-field advantage. MLB home teams win ~53.5% of games, but a pure
 * "projected run margin" model with symmetric inputs produces exactly 50% —
 * a systematic ~3.5pp bias against every home team. HFA has two distinct parts
 * and they must be modeled separately:
 *
 *  1. `runEdge` — a real scoring edge (familiarity, last change, travel/rest).
 *     Applied as +runEdge/2 to the home offense and -runEdge/2 to the away
 *     offense, so the GAME TOTAL is unchanged (league avg already averages over
 *     home and away team-games) and only the margin moves.
 *  2. `winProbLogitBonus` — the structural last-at-bat edge that does NOT show
 *     up in runs: the home team bats last, only needs one run in a tie, and
 *     stops batting once ahead in the 9th. Added as a logistic intercept.
 *
 * Calibration: neutral matchup -> margin = 4.3 * 0.02 = 0.086 runs;
 * logistic(0.086 / 2.75 + 0.108) = 53.5%, matching the observed league rate.
 */
export const MLB_HOME_FIELD = {
  /** Fractional run edge for the home side, split +/- half across both teams. */
  runEdge: 0.02,
} as const;

/**
 * Clamp bounds on each component multiplier. These exist to stop a garbage
 * input from producing an absurd projection — they must NOT bind on real,
 * legitimate values. The previous starter floor of 0.72 bound at SIERA 3.06,
 * which silently truncated every genuine ace (a 2.6 SIERA was treated the same
 * as a 3.06). Bounds now sit outside the realistic range of MLB inputs.
 */
export const MLB_CLAMPS = {
  /** Team wRC+ realistically spans ~80-125, so this never binds in practice. */
  offenseMin: 0.7,
  offenseMax: 1.35,
  /** SIERA ~2.3 (elite) to ~6.0 (replacement) => ratio 0.54 to 1.41. */
  starterMin: 0.55,
  starterMax: 1.45,
  /** Bullpen unit ERA/FIP ~2.9 to ~5.6 => ratio 0.68 to 1.32, plus fatigue. */
  bullpenMin: 0.6,
  bullpenMax: 1.45,
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
 * Data-coverage (information sufficiency) model.
 * -----------------------------------------------
 * Coverage feeds `dataCompleteness`, which gates every bet via
 * `minDataCompleteness`. It must therefore answer "do we know enough to have an
 * opinion?", NOT "did the caller fill in every optional field?".
 *
 * The original model returned `sum(weights of stats present) / sum(all
 * weights)`, which conflated the two. Consequences, measured against the live
 * engine: wRC+ alone — the single best offensive summary in baseball, and by
 * itself sufficient — scored 0.45; SIERA alone scored 0.17 for pitching; and
 * the production StatsAPI feed (OPS + R/G + ERA) scored 0.17 overall against a
 * 0.50 floor. That made *every* game an automatic no-bet regardless of edge.
 *
 * These tiers instead score by what a stat actually tells you. The best stat
 * present sets the floor; corroborating stats add a small bonus. Capped at 1.
 */
export const MLB_COVERAGE = {
  offense: {
    /** wRC+ is park- and league-adjusted: on its own it is sufficient. */
    wrcPlus: 1.0,
    /** wOBA is nearly as good but not park-adjusted. */
    woba: 0.85,
    /** OPS is a decent proxy; unadjusted and slugging-biased. */
    ops: 0.7,
    /** Raw runs/game is an outcome, not a skill estimate. */
    runsPerGame: 0.5,
    /** Added per extra corroborating stat beyond the best one present. */
    corroborationBonus: 0.05,
  },
  starter: {
    /** Any modern ERA estimator is a complete answer for run prevention. */
    estimator: 1.0, // SIERA / xFIP / FIP
    /** ERA alone is outcome-based and defense-contaminated. */
    eraOnly: 0.6,
    corroborationBonus: 0.05,
  },
  bullpen: {
    /** A rate stat for the unit is what the model needs. */
    rate: 1.0, // FIP or ERA
    /** WHIP alone is converted onto the ERA scale — usable but noisier. */
    whipOnly: 0.75,
    corroborationBonus: 0.05,
  },
  /** The starter owns ~61% of innings, so it dominates pitching coverage. */
  starterShareOfPitchingCoverage: 0.65,
  /** Offense vs pitching split when combining into a team's coverage score. */
  offenseShareOfTeamCoverage: 0.55,
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
  /**
   * Fatigue: heavy recent usage degrades a bullpen. Thresholds must sit ABOVE
   * ordinary workload or the penalty stops discriminating and just becomes a
   * blanket upward bias on runs. Modern starters average ~5.2 IP, so a typical
   * bullpen throws ~3.8 relief IP per game and ~11 over three days — the old
   * 2.5 / 9.0 thresholds fired on nearly every team every day. These sit at
   * roughly the 70th percentile of usage instead.
   */
  fatigue: {
    /** Relief innings over the last day above which fatigue kicks in. */
    last1dThreshold: 4.5,
    /** Relief innings over the last 3 days above which fatigue kicks in. */
    last3dThreshold: 11.5,
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
  /**
   * Fractional run change per degree away from neutral (~+1.0% per 10°F).
   * Batted-ball carry studies put the temperature effect at roughly 1-1.5% of
   * run scoring per 10°F; 0.0007 understated it.
   */
  runsPerDegreeF: 0.001,
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
  /**
   * Std dev (in runs) of an actual MLB game total around its projected mean.
   * A single team's runs have SD ~3.1 (mean 4.3, heavily overdispersed vs
   * Poisson), so two independent sides give SD(total) ~4.4 — and that is a
   * FLOOR, because it ignores model error. The previous 2.9 overstated
   * over/under probabilities badly: a +1.0-run edge read as 63.5% over when the
   * honest figure is ~59%. Overstated probabilities feed straight into the
   * Kelly calculator, so this constant is the one most likely to cause real
   * over-betting.
   */
  totalSigma: 4.4,
  /**
   * Logistic scale converting a projected run margin into a win probability.
   * Calibrated against both Pythagenpat (exp 1.83) and a normal approximation
   * on the run-differential distribution. At 3.35 the model was too flat: a
   * 2.0-run projected margin read as 64.5% when both references say ~67-70%.
   */
  moneylineRunScale: 2.75,
  /**
   * Logistic intercept for the home side, capturing the last-at-bat advantage
   * that never appears in projected runs (see MLB_HOME_FIELD). Combined with
   * the run edge this reproduces the league's ~53.5% home win rate on a
   * neutral matchup.
   */
  homeWinLogitBonus: 0.108,
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
