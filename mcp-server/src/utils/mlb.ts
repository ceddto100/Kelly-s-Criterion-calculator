/**
 * MLB Projection Engine
 * =====================
 * A from-scratch, baseball-specific run projection model. This is NOT copied
 * from the NBA/NFL/NHL logic — MLB scoring is driven by starting pitching,
 * bullpen quality/fatigue, ballpark, weather, lineup construction and
 * handedness, none of which the other sports model.
 *
 * Design goals (in priority order):
 *   1. Explainable  - every number traces back to a named driver.
 *   2. Adjustable   - all constants live in config/mlbConfig.ts.
 *   3. Testable     - pure functions, deterministic, no I/O.
 *   4. Disciplined  - emits no-bet far more often than it fires.
 *
 * Run-scoring model (multiplicative around a league baseline):
 *
 *   projectedRuns(batting vs pitching) =
 *       LEAGUE_AVG_RUNS
 *     * offenseMultiplier(battingTeam)
 *     * pitchingMultiplier(opposingStarter, opposingBullpen)
 *     * parkMultiplier
 *     * weatherMultiplier
 *     * lineupMultiplier
 *     * recentFormMultiplier
 *
 * Each multiplier is centered on 1.0, so neutral inputs reproduce the league
 * average. The game total is the sum of both teams' projected runs.
 */

import {
  MLB_LEAGUE,
  MLB_OFFENSE_WEIGHTS,
  MLB_PITCHING_SPLIT,
  MLB_STARTER_WEIGHTS,
  MLB_BULLPEN,
  MLB_PARK,
  MLB_WEATHER,
  MLB_LINEUP,
  MLB_RECENT_FORM,
  MLB_DECISION,
  MLB_CONFIDENCE_WEIGHTS,
} from '../config/mlbConfig.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface MLBOffenseStats {
  /** Weighted Runs Created Plus (100 = league average). Best single input. */
  wrcPlus?: number;
  /** Weighted On-Base Average. */
  woba?: number;
  /** On-base Plus Slugging. */
  ops?: number;
  /** Runs scored per game (raw output). */
  runsPerGame?: number;
  /** Runs per game over the last ~15 games (recent form). */
  recentRunsPerGame?: number;
}

export interface MLBStarterStats {
  /** Whether the probable starter is confirmed. Affects confidence. */
  confirmed?: boolean;
  era?: number;
  fip?: number;
  xfip?: number;
  siera?: number;
}

export interface MLBBullpenStats {
  era?: number;
  fip?: number;
  whip?: number;
  /** Relief innings thrown in the last 1 / 3 days (fatigue). */
  inningsLast1d?: number;
  inningsLast3d?: number;
  /** Whether the closer is available today. */
  closerAvailable?: boolean;
}

export interface MLBLineupInfo {
  /** Whether today's lineup is officially confirmed. Affects confidence. */
  confirmed?: boolean;
  /** Number of regular star hitters resting/absent today. */
  starsOut?: number;
  /** True if this team's batters have the platoon edge vs the opposing SP. */
  platoonAdvantage?: boolean;
}

export interface MLBTeamInput {
  name: string;
  offense: MLBOffenseStats;
  starter: MLBStarterStats;
  bullpen: MLBBullpenStats;
  lineup?: MLBLineupInfo;
}

export type WindDirection = 'out' | 'in' | 'crosswind' | 'none';

export interface MLBGameEnvironment {
  /** Run park factor (100 = neutral). Defaults to neutral if omitted. */
  parkFactor?: number;
  temperatureF?: number;
  windSpeedMph?: number;
  windDirection?: WindDirection;
  /** True if the roof is closed / dome (neutralizes weather). */
  roofClosed?: boolean;
  /** Whether weather inputs are considered reliable. Affects confidence. */
  weatherReliable?: boolean;
}

export interface MLBLineInput {
  /** Sportsbook total (over/under) line. */
  total?: number;
  /** Sportsbook moneyline (American odds) for the home team. */
  homeMoneyline?: number;
  /** Sportsbook moneyline (American odds) for the away team. */
  awayMoneyline?: number;
  /**
   * True if the total has moved sharply from open (sharp money signal). When
   * true and our lean opposes the move, confidence is trimmed.
   */
  totalMovedSharply?: boolean;
}

export interface MLBProjectionInput {
  home: MLBTeamInput;
  away: MLBTeamInput;
  environment?: MLBGameEnvironment;
  line?: MLBLineInput;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Clamp a value into [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * normalize_stat: map a raw stat to a multiplier centered on 1.0 relative to a
 * baseline. `higherIsBetter` controls direction. For run scoring, an offense
 * stat above the baseline should INCREASE expected runs (higherIsBetter=true);
 * a pitcher ERA above the baseline (worse pitcher) should also increase the
 * batting team's expected runs (higherIsBetter=true from the hitter's view).
 *
 * The `sensitivity` scales how strongly deviations move the multiplier.
 */
export function normalizeStat(
  value: number,
  baseline: number,
  sensitivity = 1,
): number {
  if (!isFinite(value) || baseline === 0) return 1;
  const ratio = value / baseline;
  return 1 + (ratio - 1) * sensitivity;
}

/** Weighted blend over only the inputs that are present (non-null/finite). */
function weightedBlend(
  entries: Array<{ value: number | undefined; weight: number }>,
): { value: number; coverage: number } | null {
  let weightSum = 0;
  let valueSum = 0;
  let usedWeight = 0;
  let totalWeight = 0;
  for (const { value, weight } of entries) {
    totalWeight += weight;
    if (value === undefined || value === null || !isFinite(value)) continue;
    weightSum += weight;
    valueSum += value * weight;
    usedWeight += weight;
  }
  if (weightSum === 0) return null;
  return { value: valueSum / weightSum, coverage: usedWeight / totalWeight };
}

// ---------------------------------------------------------------------------
// Component multipliers
// ---------------------------------------------------------------------------

export interface MultiplierResult {
  multiplier: number;
  /** 0-1: how much of the expected input data was actually present. */
  coverage: number;
}

/**
 * calculate_offense_score: convert an offensive profile into a run multiplier.
 * wRC+ is the anchor (already park/league adjusted); wOBA, OPS and raw R/G fill
 * in. Recent form is folded in separately by calculate_recent_form_adjustment.
 */
export function calculateOffenseScore(offense: MLBOffenseStats): MultiplierResult {
  const candidates: Array<{ value: number | undefined; weight: number }> = [
    {
      value:
        offense.wrcPlus !== undefined
          ? offense.wrcPlus / 100 // wRC+ 100 = average -> 1.0
          : undefined,
      weight: MLB_OFFENSE_WEIGHTS.wrcPlus,
    },
    {
      value:
        offense.woba !== undefined
          ? // wOBA scales tightly; amplify so a good wOBA meaningfully lifts runs
            normalizeStat(offense.woba, MLB_LEAGUE.avgWoba, 2.2)
          : undefined,
      weight: MLB_OFFENSE_WEIGHTS.woba,
    },
    {
      value:
        offense.ops !== undefined
          ? normalizeStat(offense.ops, MLB_LEAGUE.avgOps, 1.4)
          : undefined,
      weight: MLB_OFFENSE_WEIGHTS.ops,
    },
    {
      value:
        offense.runsPerGame !== undefined
          ? normalizeStat(offense.runsPerGame, MLB_LEAGUE.avgRunsPerTeam, 1)
          : undefined,
      weight: MLB_OFFENSE_WEIGHTS.runsPerGame,
    },
  ];
  const blended = weightedBlend(candidates);
  if (!blended) return { multiplier: 1, coverage: 0 };
  // Guard against extreme inputs producing unrealistic multipliers.
  return { multiplier: clamp(blended.value, 0.7, 1.35), coverage: blended.coverage };
}

/** Blend a pitcher's ERA estimators into a single runs-allowed-per-9 figure. */
function starterRunRate(starter: MLBStarterStats): { value: number; coverage: number } | null {
  return weightedBlend([
    { value: starter.siera, weight: MLB_STARTER_WEIGHTS.siera },
    { value: starter.xfip, weight: MLB_STARTER_WEIGHTS.xfip },
    { value: starter.fip, weight: MLB_STARTER_WEIGHTS.fip },
    { value: starter.era, weight: MLB_STARTER_WEIGHTS.era },
  ]);
}

function bullpenRunRate(bullpen: MLBBullpenStats): { value: number; coverage: number } | null {
  // WHIP is on a different scale; convert to an approximate runs/9 before blend
  // using the rough relationship runs/9 ~= (WHIP - 1.0) * 4 + leagueEra anchor.
  const whipAsEra =
    bullpen.whip !== undefined ? (bullpen.whip - 1.3) * 3.5 + MLB_LEAGUE.avgEra : undefined;
  return weightedBlend([
    { value: bullpen.fip, weight: MLB_BULLPEN.weights.fip },
    { value: bullpen.era, weight: MLB_BULLPEN.weights.era },
    { value: whipAsEra, weight: MLB_BULLPEN.weights.whip },
  ]);
}

/** Bullpen fatigue penalty (multiplier >= 1 applied to bullpen run rate). */
export function bullpenFatiguePenalty(bullpen: MLBBullpenStats): number {
  let penalty = 0;
  const { fatigue } = MLB_BULLPEN;
  if (bullpen.inningsLast1d !== undefined && bullpen.inningsLast1d > fatigue.last1dThreshold) {
    penalty += Math.min(
      fatigue.maxPenalty,
      ((bullpen.inningsLast1d - fatigue.last1dThreshold) / fatigue.last1dThreshold) *
        fatigue.maxPenalty,
    );
  }
  if (bullpen.inningsLast3d !== undefined && bullpen.inningsLast3d > fatigue.last3dThreshold) {
    penalty += Math.min(
      fatigue.maxPenalty,
      ((bullpen.inningsLast3d - fatigue.last3dThreshold) / fatigue.last3dThreshold) *
        fatigue.maxPenalty,
    );
  }
  return 1 + Math.min(fatigue.maxPenalty, penalty);
}

/**
 * calculate_starting_pitcher_adjustment + calculate_bullpen_adjustment combined
 * into the pitching multiplier seen by the OPPOSING offense. A high run rate
 * (bad pitching) yields a multiplier > 1 (the batting team scores more).
 */
export function calculatePitchingMultiplier(
  starter: MLBStarterStats,
  bullpen: MLBBullpenStats,
): MultiplierResult & { starterMultiplier: number; bullpenMultiplier: number } {
  const sp = starterRunRate(starter);
  const bp = bullpenRunRate(bullpen);

  const starterMultiplier = sp
    ? clamp(normalizeStat(sp.value, MLB_LEAGUE.avgEra, 1), 0.72, 1.3)
    : 1;
  const fatigue = bullpenFatiguePenalty(bullpen);
  const bullpenMultiplier = bp
    ? clamp(normalizeStat(bp.value, MLB_LEAGUE.avgEra, 1) * fatigue, 0.75, 1.35)
    : 1;

  // Shift more of the game onto the bullpen if the closer is unavailable.
  let bullpenShare = MLB_PITCHING_SPLIT.bullpenShare;
  if (bullpen.closerAvailable === false) {
    bullpenShare += MLB_BULLPEN.fatigue.closerUnavailableShift;
  }
  const starterShare = 1 - bullpenShare;

  const multiplier = starterShare * starterMultiplier + bullpenShare * bullpenMultiplier;

  // Coverage: average of the two units' data coverage.
  const coverage = ((sp?.coverage ?? 0) + (bp?.coverage ?? 0)) / 2;

  return { multiplier, coverage, starterMultiplier, bullpenMultiplier };
}

/** calculate_park_adjustment. */
export function calculateParkMultiplier(env?: MLBGameEnvironment): number {
  const pf = env?.parkFactor ?? MLB_PARK.neutral;
  return clamp(pf, MLB_PARK.min, MLB_PARK.max) / MLB_PARK.neutral;
}

/** calculate_weather_adjustment. */
export function calculateWeatherMultiplier(env?: MLBGameEnvironment): number {
  if (!env || env.roofClosed) return 1; // dome / closed roof neutralizes weather
  let effect = 0;
  if (env.temperatureF !== undefined) {
    effect += (env.temperatureF - MLB_WEATHER.neutralTempF) * MLB_WEATHER.runsPerDegreeF;
  }
  if (env.windSpeedMph !== undefined && env.windDirection) {
    if (env.windDirection === 'out') {
      effect += env.windSpeedMph * MLB_WEATHER.windOutPerMph;
    } else if (env.windDirection === 'in') {
      effect -= env.windSpeedMph * MLB_WEATHER.windInPerMph;
    }
    // crosswind / none: no run effect
  }
  effect = clamp(effect, -MLB_WEATHER.maxEffect, MLB_WEATHER.maxEffect);
  return 1 + effect;
}

/** calculate_lineup_adjustment. Mean-shifting effects only (confidence handled separately). */
export function calculateLineupMultiplier(lineup?: MLBLineupInfo): number {
  if (!lineup) return 1;
  let effect = 0;
  if (lineup.starsOut && lineup.starsOut > 0) {
    effect -= Math.min(MLB_LINEUP.maxPenalty, lineup.starsOut * MLB_LINEUP.perStarOutPenalty);
  }
  if (lineup.platoonAdvantage) {
    effect += MLB_LINEUP.platoonAdvantage;
  }
  return 1 + effect;
}

/**
 * calculate_recent_form_adjustment. Blends recent R/G toward the season offense
 * rating with a small, capped weight so a hot week cannot dominate a projection.
 */
export function calculateRecentFormMultiplier(offense: MLBOffenseStats): number {
  if (offense.recentRunsPerGame === undefined) return 1;
  const recentRatio = normalizeStat(offense.recentRunsPerGame, MLB_LEAGUE.avgRunsPerTeam, 1);
  const weighted = 1 + (recentRatio - 1) * MLB_RECENT_FORM.maxWeight;
  return clamp(weighted, 1 - MLB_RECENT_FORM.maxEffect, 1 + MLB_RECENT_FORM.maxEffect);
}

// ---------------------------------------------------------------------------
// Projected runs
// ---------------------------------------------------------------------------

export interface TeamRunBreakdown {
  team: string;
  projectedRuns: number;
  offenseMultiplier: number;
  pitchingMultiplier: number; // opposing pitching faced
  parkMultiplier: number;
  weatherMultiplier: number;
  lineupMultiplier: number;
  recentFormMultiplier: number;
  dataCoverage: number; // 0-1
}

/**
 * calculate_projected_team_runs: project the runs a batting team scores against
 * the opposing team's pitching, in the given environment.
 */
export function calculateProjectedTeamRuns(
  batting: MLBTeamInput,
  fielding: MLBTeamInput,
  env: MLBGameEnvironment | undefined,
): TeamRunBreakdown {
  const offense = calculateOffenseScore(batting.offense);
  const pitching = calculatePitchingMultiplier(fielding.starter, fielding.bullpen);
  const park = calculateParkMultiplier(env);
  const weather = calculateWeatherMultiplier(env);
  const lineup = calculateLineupMultiplier(batting.lineup);
  const recentForm = calculateRecentFormMultiplier(batting.offense);

  const projectedRuns =
    MLB_LEAGUE.avgRunsPerTeam *
    offense.multiplier *
    pitching.multiplier *
    park *
    weather *
    lineup *
    recentForm;

  // Data coverage drives confidence: offense + pitching are the load-bearing
  // inputs, so they dominate the coverage score.
  const dataCoverage = clamp(0.6 * offense.coverage + 0.4 * pitching.coverage, 0, 1);

  return {
    team: batting.name,
    projectedRuns,
    offenseMultiplier: offense.multiplier,
    pitchingMultiplier: pitching.multiplier,
    parkMultiplier: park,
    weatherMultiplier: weather,
    lineupMultiplier: lineup,
    recentFormMultiplier: recentForm,
    dataCoverage,
  };
}

// ---------------------------------------------------------------------------
// Probability helpers (totals + moneyline)
// ---------------------------------------------------------------------------

/** Normal CDF (Abramowitz-Stegun), shared with the rest of the codebase. */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

/** American odds -> implied probability (includes vig). */
export function impliedProbability(americanOdds: number): number {
  return americanOdds > 0
    ? 100 / (americanOdds + 100)
    : Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

/** Remove the vig from a two-way market to get fair implied probabilities. */
export function devig(homeOdds: number, awayOdds: number): { home: number; away: number } {
  const h = impliedProbability(homeOdds);
  const a = impliedProbability(awayOdds);
  const total = h + a;
  return { home: h / total, away: a / total };
}

// ---------------------------------------------------------------------------
// Edge, lean, confidence (the disciplined decision layer)
// ---------------------------------------------------------------------------

export type Lean = 'over' | 'under' | 'home' | 'away' | 'no-bet';

/** calculate_edge for totals (projected total minus book total, in runs). */
export function calculateTotalEdge(projectedTotal: number, bookTotal: number): number {
  return projectedTotal - bookTotal;
}

/** determine_lean for totals. */
export function determineTotalLean(edgeRuns: number, dataCompleteness: number): Lean {
  if (dataCompleteness < MLB_DECISION.minDataCompleteness) return 'no-bet';
  if (Math.abs(edgeRuns) < MLB_DECISION.totalMinEdgeRuns) return 'no-bet';
  return edgeRuns > 0 ? 'over' : 'under';
}

/**
 * Convert a projected run margin (home - away) into a home win probability via a
 * logistic function whose scale is calibrated to MLB run distributions.
 */
export function runMarginToWinProb(runMargin: number): number {
  return 1 / (1 + Math.exp(-runMargin / MLB_DECISION.moneylineRunScale));
}

export interface MLBConfidenceInputs {
  /** Absolute edge magnitude, normalized to 0-1 (1 = large, confident edge). */
  edgeStrength: number;
  /** 0-1 agreement between independent stat categories. */
  agreement: number;
  /** 0-1 data quality (coverage + confirmations + weather reliability). */
  dataQuality: number;
}

/**
 * calculate_confidence_score: blends edge size, cross-category agreement and
 * data quality. Returns 0-100. Confidence is deliberately conservative: weak
 * data or conflicting signals cap the score even when the edge looks large.
 */
export function calculateConfidenceScore(inputs: MLBConfidenceInputs): number {
  const raw =
    MLB_CONFIDENCE_WEIGHTS.edge * clamp(inputs.edgeStrength, 0, 1) +
    MLB_CONFIDENCE_WEIGHTS.agreement * clamp(inputs.agreement, 0, 1) +
    MLB_CONFIDENCE_WEIGHTS.dataQuality * clamp(inputs.dataQuality, 0, 1);
  // Data quality acts as a ceiling: you can never be highly confident on thin data.
  const ceiling = 0.5 + 0.5 * clamp(inputs.dataQuality, 0, 1);
  return Math.round(clamp(raw, 0, 1) * ceiling * 100);
}

export type ConfidenceLabel = 'low' | 'medium' | 'high';

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 65) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Drivers + risk factors (explainability)
// ---------------------------------------------------------------------------

export interface StatDriver {
  factor: string;
  detail: string;
  /** Signed impact on the projected total in runs. */
  impactRuns: number;
}

/**
 * identify_stat_drivers: explain WHY the projection landed where it did by
 * attributing each multiplier's deviation from neutral to a run impact.
 */
export function identifyStatDrivers(
  home: TeamRunBreakdown,
  away: TeamRunBreakdown,
): StatDriver[] {
  const drivers: StatDriver[] = [];
  const base = MLB_LEAGUE.avgRunsPerTeam;

  const add = (factor: string, mult: number, runs: number, side: string) => {
    const impact = (mult - 1) * base;
    if (Math.abs(impact) < 0.05) return;
    drivers.push({
      factor,
      detail: `${side}: ${mult >= 1 ? '+' : ''}${((mult - 1) * 100).toFixed(0)}% (${
        impact >= 0 ? '+' : ''
      }${impact.toFixed(2)} runs)`,
      impactRuns: impact,
    });
  };

  add('Opposing pitching', home.pitchingMultiplier, home.projectedRuns, home.team);
  add('Opposing pitching', away.pitchingMultiplier, away.projectedRuns, away.team);
  add('Offense', home.offenseMultiplier, home.projectedRuns, home.team);
  add('Offense', away.offenseMultiplier, away.projectedRuns, away.team);
  // Park/weather apply to both teams equally; report once using the home side.
  add('Ballpark', home.parkMultiplier, 0, 'Both teams');
  add('Weather', home.weatherMultiplier, 0, 'Both teams');

  return drivers.sort((a, b) => Math.abs(b.impactRuns) - Math.abs(a.impactRuns)).slice(0, 5);
}

/** identify_risk_factors: surface everything that should lower trust in the bet. */
export function identifyRiskFactors(input: MLBProjectionInput, dataCompleteness: number): string[] {
  const risks: string[] = [];
  const { home, away, environment, line } = input;

  if (home.starter.confirmed === false || away.starter.confirmed === false) {
    risks.push('Probable starter(s) not confirmed — projection may shift on lineup news.');
  }
  if (home.lineup?.confirmed === false || away.lineup?.confirmed === false) {
    risks.push('Lineup(s) not confirmed — star rest days could change run expectancy.');
  }
  if ((home.lineup?.starsOut ?? 0) > 0 || (away.lineup?.starsOut ?? 0) > 0) {
    risks.push('Key hitter(s) resting/absent — offense downgraded.');
  }
  if (home.bullpen.closerAvailable === false || away.bullpen.closerAvailable === false) {
    risks.push('Closer unavailable — late-inning run prevention is shakier.');
  }
  const homeFatigue = bullpenFatiguePenalty(home.bullpen);
  const awayFatigue = bullpenFatiguePenalty(away.bullpen);
  if (homeFatigue > 1.02 || awayFatigue > 1.02) {
    risks.push('Bullpen fatigue detected from recent usage — late-game variance up.');
  }
  if (environment && environment.weatherReliable === false) {
    risks.push('Weather inputs flagged unreliable — wind/temperature effects uncertain.');
  }
  if (environment && environment.windSpeedMph !== undefined && environment.windSpeedMph >= 15) {
    risks.push('High wind — outcome more volatile and forecast-dependent.');
  }
  if (line?.totalMovedSharply) {
    risks.push('Total has moved sharply — sharp money may already reflect new info.');
  }
  if (dataCompleteness < 0.7) {
    risks.push('Incomplete stat inputs — confidence reduced accordingly.');
  }
  return risks;
}

// ---------------------------------------------------------------------------
// Top-level projection
// ---------------------------------------------------------------------------

export interface MLBTotalsResult {
  market: 'total';
  projectedHomeRuns: number;
  projectedAwayRuns: number;
  projectedTotal: number;
  bookTotal: number | null;
  edgeRuns: number | null;
  lean: Lean;
  overProbability: number;
  underProbability: number;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
}

export interface MLBMoneylineResult {
  market: 'moneyline';
  projectedHomeRuns: number;
  projectedAwayRuns: number;
  homeWinProbability: number;
  awayWinProbability: number;
  fairHomeImplied: number | null;
  fairAwayImplied: number | null;
  homeEdge: number | null;
  awayEdge: number | null;
  lean: Lean;
  confidence: number;
  confidenceLabel: ConfidenceLabel;
}

export interface MLBProjectionResult {
  matchup: string;
  homeBreakdown: TeamRunBreakdown;
  awayBreakdown: TeamRunBreakdown;
  dataCompleteness: number;
  totals: MLBTotalsResult;
  moneyline: MLBMoneylineResult;
  drivers: StatDriver[];
  riskFactors: string[];
  disclaimer: string;
}

const DISCLAIMER =
  'Model projection only — a possible edge based on formula output, not a guaranteed result. ' +
  'No bet is risk-free. Use bankroll discipline.';

/**
 * Agreement score: do the independent categories tell the same story?
 * We compare whether offense and (inverse) pitching push the total in the same
 * direction relative to neutral. High agreement -> higher confidence.
 */
function categoryAgreement(home: TeamRunBreakdown, away: TeamRunBreakdown): number {
  const signals = [
    home.offenseMultiplier - 1,
    away.offenseMultiplier - 1,
    home.pitchingMultiplier - 1,
    away.pitchingMultiplier - 1,
    home.parkMultiplier - 1,
    home.weatherMultiplier - 1,
  ];
  const positive = signals.filter((s) => s > 0.005).length;
  const negative = signals.filter((s) => s < -0.005).length;
  const active = positive + negative;
  if (active === 0) return 0.5; // neutral
  return Math.max(positive, negative) / active; // 0.5 (split) .. 1 (unanimous)
}

/**
 * Main entry point. Produces totals + moneyline projections with confidence,
 * lean, no-bet logic, drivers and risk factors.
 */
export function projectMLBGame(input: MLBProjectionInput): MLBProjectionResult {
  const env = input.environment;

  const homeBreakdown = calculateProjectedTeamRuns(input.home, input.away, env);
  const awayBreakdown = calculateProjectedTeamRuns(input.away, input.home, env);

  const projectedTotal = homeBreakdown.projectedRuns + awayBreakdown.projectedRuns;

  // Data completeness blends each team's coverage with confirmation flags.
  let dataCompleteness = (homeBreakdown.dataCoverage + awayBreakdown.dataCoverage) / 2;
  if (input.home.starter.confirmed === false || input.away.starter.confirmed === false) {
    dataCompleteness *= 0.85;
  }
  if (input.home.lineup?.confirmed === false || input.away.lineup?.confirmed === false) {
    dataCompleteness *= 0.92;
  }
  if (env?.weatherReliable === false) dataCompleteness *= 0.96;
  dataCompleteness = clamp(dataCompleteness, 0, 1);

  const agreement = categoryAgreement(homeBreakdown, awayBreakdown);

  // ----- Totals -----
  const bookTotal = input.line?.total ?? null;
  const edgeRuns = bookTotal !== null ? calculateTotalEdge(projectedTotal, bookTotal) : null;
  const zTotal =
    bookTotal !== null ? (projectedTotal - bookTotal) / MLB_DECISION.totalSigma : 0;
  const overProbability = bookTotal !== null ? (1 - normCdf(-zTotal)) * 100 : 50;
  const underProbability = 100 - overProbability;

  let totalsLean: Lean = 'no-bet';
  if (edgeRuns !== null) {
    totalsLean = determineTotalLean(edgeRuns, dataCompleteness);
    if (input.line?.totalMovedSharply && totalsLean !== 'no-bet') {
      // If the line moved sharply against our lean, demand a bigger edge.
      const movedToward = (input.line.total ?? 0) && edgeRuns;
      if (Math.abs(edgeRuns) < MLB_DECISION.totalMinEdgeRuns * 1.5) totalsLean = 'no-bet';
      void movedToward;
    }
  }

  const totalsEdgeStrength =
    edgeRuns !== null ? clamp(Math.abs(edgeRuns) / (MLB_DECISION.totalMinEdgeRuns * 3), 0, 1) : 0;
  const totalsConfidence = calculateConfidenceScore({
    edgeStrength: totalsEdgeStrength,
    agreement,
    dataQuality: dataCompleteness,
  });

  const totals: MLBTotalsResult = {
    market: 'total',
    projectedHomeRuns: round2(homeBreakdown.projectedRuns),
    projectedAwayRuns: round2(awayBreakdown.projectedRuns),
    projectedTotal: round2(projectedTotal),
    bookTotal,
    edgeRuns: edgeRuns !== null ? round2(edgeRuns) : null,
    lean: totalsLean,
    overProbability: round1(overProbability),
    underProbability: round1(underProbability),
    confidence: totalsLean === 'no-bet' ? Math.min(totalsConfidence, 44) : totalsConfidence,
    confidenceLabel: confidenceLabel(totalsLean === 'no-bet' ? 0 : totalsConfidence),
  };

  // ----- Moneyline -----
  const runMargin = homeBreakdown.projectedRuns - awayBreakdown.projectedRuns;
  const homeWinProbability = runMarginToWinProb(runMargin);
  const awayWinProbability = 1 - homeWinProbability;

  let fairHome: number | null = null;
  let fairAway: number | null = null;
  let homeEdge: number | null = null;
  let awayEdge: number | null = null;
  if (input.line?.homeMoneyline !== undefined && input.line?.awayMoneyline !== undefined) {
    const fair = devig(input.line.homeMoneyline, input.line.awayMoneyline);
    fairHome = fair.home;
    fairAway = fair.away;
    homeEdge = homeWinProbability - fair.home;
    awayEdge = awayWinProbability - fair.away;
  }

  let mlLean: Lean = 'no-bet';
  if (homeEdge !== null && awayEdge !== null && dataCompleteness >= MLB_DECISION.minDataCompleteness) {
    if (homeEdge >= MLB_DECISION.moneylineMinEdge && homeEdge >= awayEdge) mlLean = 'home';
    else if (awayEdge >= MLB_DECISION.moneylineMinEdge) mlLean = 'away';
  }

  const mlEdgeMag =
    homeEdge !== null && awayEdge !== null ? Math.max(homeEdge, awayEdge) : 0;
  const mlEdgeStrength = clamp(mlEdgeMag / (MLB_DECISION.moneylineMinEdge * 3), 0, 1);
  const mlConfidence = calculateConfidenceScore({
    edgeStrength: mlEdgeStrength,
    agreement,
    dataQuality: dataCompleteness,
  });

  const moneyline: MLBMoneylineResult = {
    market: 'moneyline',
    projectedHomeRuns: round2(homeBreakdown.projectedRuns),
    projectedAwayRuns: round2(awayBreakdown.projectedRuns),
    homeWinProbability: round1(homeWinProbability * 100),
    awayWinProbability: round1(awayWinProbability * 100),
    fairHomeImplied: fairHome !== null ? round1(fairHome * 100) : null,
    fairAwayImplied: fairAway !== null ? round1(fairAway * 100) : null,
    homeEdge: homeEdge !== null ? round1(homeEdge * 100) : null,
    awayEdge: awayEdge !== null ? round1(awayEdge * 100) : null,
    lean: mlLean,
    confidence: mlLean === 'no-bet' ? Math.min(mlConfidence, 44) : mlConfidence,
    confidenceLabel: confidenceLabel(mlLean === 'no-bet' ? 0 : mlConfidence),
  };

  return {
    matchup: `${input.away.name} @ ${input.home.name}`,
    homeBreakdown,
    awayBreakdown,
    dataCompleteness: round2(dataCompleteness),
    totals,
    moneyline,
    drivers: identifyStatDrivers(homeBreakdown, awayBreakdown),
    riskFactors: identifyRiskFactors(input, dataCompleteness),
    disclaimer: DISCLAIMER,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
