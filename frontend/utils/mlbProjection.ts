/**
 * MLB Projection Engine (frontend)
 * ================================
 * Faithful port of mcp-server/src/utils/mlb.ts so the UI can project games
 * client-side with the exact same, unit-tested math. Baseball-specific: runs are
 * modeled multiplicatively around a league baseline, each driver producing an
 * auditable multiplier centered on 1.0.
 *
 * This mirrors the existing pattern of frontend/utils/nhlProjection.ts (a
 * client copy of the NHL math). Keep this in sync with the backend engine.
 *
 * All tunable weights/constants live in MLB_CONFIG below so the model can be
 * adjusted and backtested without touching the math.
 */

// ---------------------------------------------------------------------------
// Configuration (mirror of mcp-server/src/config/mlbConfig.ts)
// ---------------------------------------------------------------------------

export const MLB_CONFIG = {
  league: {
    avgRunsPerTeam: 4.3,
    avgEra: 4.25,
    avgWoba: 0.318,
    avgOps: 0.72,
    starterInnings: 5.5,
    totalInnings: 9,
  },
  offenseWeights: { wrcPlus: 0.45, woba: 0.3, ops: 0.15, runsPerGame: 0.1 },
  starterWeights: { siera: 0.35, xfip: 0.25, fip: 0.25, era: 0.15 },
  bullpen: {
    weights: { fip: 0.45, era: 0.3, whip: 0.25 },
    fatigue: {
      last1dThreshold: 2.5,
      last3dThreshold: 9,
      maxPenalty: 0.08,
      closerUnavailableShift: 0.04,
    },
  },
  park: { neutral: 100, min: 88, max: 118 },
  weather: {
    neutralTempF: 70,
    runsPerDegreeF: 0.0007,
    windOutPerMph: 0.007,
    windInPerMph: 0.006,
    maxEffect: 0.08,
  },
  lineup: { perStarOutPenalty: 0.03, maxPenalty: 0.1, platoonAdvantage: 0.015 },
  recentForm: { maxWeight: 0.2, maxEffect: 0.05 },
  decision: {
    totalMinEdgeRuns: 0.5,
    moneylineMinEdge: 0.04,
    minDataCompleteness: 0.5,
    totalSigma: 2.9,
    moneylineRunScale: 3.35,
  },
  confidenceWeights: { edge: 0.4, agreement: 0.3, dataQuality: 0.3 },
};

const C = MLB_CONFIG;
const PITCHING_STARTER_SHARE = C.league.starterInnings / C.league.totalInnings;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MLBOffenseStats {
  wrcPlus?: number;
  woba?: number;
  ops?: number;
  runsPerGame?: number;
  recentRunsPerGame?: number;
}
export interface MLBStarterStats {
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
  inningsLast1d?: number;
  inningsLast3d?: number;
  closerAvailable?: boolean;
}
export interface MLBLineupInfo {
  confirmed?: boolean;
  starsOut?: number;
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
  parkFactor?: number;
  temperatureF?: number;
  windSpeedMph?: number;
  windDirection?: WindDirection;
  roofClosed?: boolean;
  weatherReliable?: boolean;
}
export interface MLBLineInput {
  total?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
  totalMovedSharply?: boolean;
}
export interface MLBProjectionInput {
  home: MLBTeamInput;
  away: MLBTeamInput;
  environment?: MLBGameEnvironment;
  line?: MLBLineInput;
}

export type Lean = 'over' | 'under' | 'home' | 'away' | 'no-bet';
export type ConfidenceLabel = 'low' | 'medium' | 'high';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeStat(value: number, baseline: number, sensitivity = 1): number {
  if (!isFinite(value) || baseline === 0) return 1;
  const ratio = value / baseline;
  return 1 + (ratio - 1) * sensitivity;
}

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

export interface MultiplierResult {
  multiplier: number;
  coverage: number;
}

// ---------------------------------------------------------------------------
// Component multipliers
// ---------------------------------------------------------------------------

export function calculateOffenseScore(offense: MLBOffenseStats): MultiplierResult {
  const candidates = [
    {
      value: offense.wrcPlus !== undefined ? offense.wrcPlus / 100 : undefined,
      weight: C.offenseWeights.wrcPlus,
    },
    {
      value:
        offense.woba !== undefined ? normalizeStat(offense.woba, C.league.avgWoba, 2.2) : undefined,
      weight: C.offenseWeights.woba,
    },
    {
      value: offense.ops !== undefined ? normalizeStat(offense.ops, C.league.avgOps, 1.4) : undefined,
      weight: C.offenseWeights.ops,
    },
    {
      value:
        offense.runsPerGame !== undefined
          ? normalizeStat(offense.runsPerGame, C.league.avgRunsPerTeam, 1)
          : undefined,
      weight: C.offenseWeights.runsPerGame,
    },
  ];
  const blended = weightedBlend(candidates);
  if (!blended) return { multiplier: 1, coverage: 0 };
  return { multiplier: clamp(blended.value, 0.7, 1.35), coverage: blended.coverage };
}

function starterRunRate(s: MLBStarterStats) {
  return weightedBlend([
    { value: s.siera, weight: C.starterWeights.siera },
    { value: s.xfip, weight: C.starterWeights.xfip },
    { value: s.fip, weight: C.starterWeights.fip },
    { value: s.era, weight: C.starterWeights.era },
  ]);
}

function bullpenRunRate(b: MLBBullpenStats) {
  const whipAsEra = b.whip !== undefined ? (b.whip - 1.3) * 3.5 + C.league.avgEra : undefined;
  return weightedBlend([
    { value: b.fip, weight: C.bullpen.weights.fip },
    { value: b.era, weight: C.bullpen.weights.era },
    { value: whipAsEra, weight: C.bullpen.weights.whip },
  ]);
}

export function bullpenFatiguePenalty(b: MLBBullpenStats): number {
  let penalty = 0;
  const f = C.bullpen.fatigue;
  if (b.inningsLast1d !== undefined && b.inningsLast1d > f.last1dThreshold) {
    penalty += Math.min(f.maxPenalty, ((b.inningsLast1d - f.last1dThreshold) / f.last1dThreshold) * f.maxPenalty);
  }
  if (b.inningsLast3d !== undefined && b.inningsLast3d > f.last3dThreshold) {
    penalty += Math.min(f.maxPenalty, ((b.inningsLast3d - f.last3dThreshold) / f.last3dThreshold) * f.maxPenalty);
  }
  return 1 + Math.min(f.maxPenalty, penalty);
}

export function calculatePitchingMultiplier(
  starter: MLBStarterStats,
  bullpen: MLBBullpenStats,
): MultiplierResult & { starterMultiplier: number; bullpenMultiplier: number } {
  const sp = starterRunRate(starter);
  const bp = bullpenRunRate(bullpen);
  const starterMultiplier = sp ? clamp(normalizeStat(sp.value, C.league.avgEra, 1), 0.72, 1.3) : 1;
  const fatigue = bullpenFatiguePenalty(bullpen);
  const bullpenMultiplier = bp ? clamp(normalizeStat(bp.value, C.league.avgEra, 1) * fatigue, 0.75, 1.35) : 1;

  let bullpenShare = 1 - PITCHING_STARTER_SHARE;
  if (bullpen.closerAvailable === false) bullpenShare += C.bullpen.fatigue.closerUnavailableShift;
  const starterShare = 1 - bullpenShare;

  const multiplier = starterShare * starterMultiplier + bullpenShare * bullpenMultiplier;
  const coverage = ((sp?.coverage ?? 0) + (bp?.coverage ?? 0)) / 2;
  return { multiplier, coverage, starterMultiplier, bullpenMultiplier };
}

export function calculateParkMultiplier(env?: MLBGameEnvironment): number {
  const pf = env?.parkFactor ?? C.park.neutral;
  return clamp(pf, C.park.min, C.park.max) / C.park.neutral;
}

export function calculateWeatherMultiplier(env?: MLBGameEnvironment): number {
  if (!env || env.roofClosed) return 1;
  let effect = 0;
  if (env.temperatureF !== undefined) {
    effect += (env.temperatureF - C.weather.neutralTempF) * C.weather.runsPerDegreeF;
  }
  if (env.windSpeedMph !== undefined && env.windDirection) {
    if (env.windDirection === 'out') effect += env.windSpeedMph * C.weather.windOutPerMph;
    else if (env.windDirection === 'in') effect -= env.windSpeedMph * C.weather.windInPerMph;
  }
  effect = clamp(effect, -C.weather.maxEffect, C.weather.maxEffect);
  return 1 + effect;
}

export function calculateLineupMultiplier(lineup?: MLBLineupInfo): number {
  if (!lineup) return 1;
  let effect = 0;
  if (lineup.starsOut && lineup.starsOut > 0) {
    effect -= Math.min(C.lineup.maxPenalty, lineup.starsOut * C.lineup.perStarOutPenalty);
  }
  if (lineup.platoonAdvantage) effect += C.lineup.platoonAdvantage;
  return 1 + effect;
}

export function calculateRecentFormMultiplier(offense: MLBOffenseStats): number {
  if (offense.recentRunsPerGame === undefined) return 1;
  const recentRatio = normalizeStat(offense.recentRunsPerGame, C.league.avgRunsPerTeam, 1);
  const weighted = 1 + (recentRatio - 1) * C.recentForm.maxWeight;
  return clamp(weighted, 1 - C.recentForm.maxEffect, 1 + C.recentForm.maxEffect);
}

// ---------------------------------------------------------------------------
// Projected runs
// ---------------------------------------------------------------------------

export interface TeamRunBreakdown {
  team: string;
  projectedRuns: number;
  offenseMultiplier: number;
  pitchingMultiplier: number;
  parkMultiplier: number;
  weatherMultiplier: number;
  lineupMultiplier: number;
  recentFormMultiplier: number;
  dataCoverage: number;
}

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
    C.league.avgRunsPerTeam *
    offense.multiplier *
    pitching.multiplier *
    park *
    weather *
    lineup *
    recentForm;

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
// Probability helpers
// ---------------------------------------------------------------------------

export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

export function impliedProbability(americanOdds: number): number {
  return americanOdds > 0
    ? 100 / (americanOdds + 100)
    : Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
}

export function devig(homeOdds: number, awayOdds: number): { home: number; away: number } {
  const h = impliedProbability(homeOdds);
  const a = impliedProbability(awayOdds);
  const total = h + a;
  return { home: h / total, away: a / total };
}

export function calculateTotalEdge(projectedTotal: number, bookTotal: number): number {
  return projectedTotal - bookTotal;
}

export function determineTotalLean(edgeRuns: number, dataCompleteness: number): Lean {
  if (dataCompleteness < C.decision.minDataCompleteness) return 'no-bet';
  if (Math.abs(edgeRuns) < C.decision.totalMinEdgeRuns) return 'no-bet';
  return edgeRuns > 0 ? 'over' : 'under';
}

export function runMarginToWinProb(runMargin: number): number {
  return 1 / (1 + Math.exp(-runMargin / C.decision.moneylineRunScale));
}

export interface MLBConfidenceInputs {
  edgeStrength: number;
  agreement: number;
  dataQuality: number;
}

export function calculateConfidenceScore(inputs: MLBConfidenceInputs): number {
  const raw =
    C.confidenceWeights.edge * clamp(inputs.edgeStrength, 0, 1) +
    C.confidenceWeights.agreement * clamp(inputs.agreement, 0, 1) +
    C.confidenceWeights.dataQuality * clamp(inputs.dataQuality, 0, 1);
  const ceiling = 0.5 + 0.5 * clamp(inputs.dataQuality, 0, 1);
  return Math.round(clamp(raw, 0, 1) * ceiling * 100);
}

export function confidenceLabel(score: number): ConfidenceLabel {
  if (score >= 65) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
}

// ---------------------------------------------------------------------------
// Drivers + risks
// ---------------------------------------------------------------------------

export interface StatDriver {
  factor: string;
  detail: string;
  impactRuns: number;
}

export function identifyStatDrivers(home: TeamRunBreakdown, away: TeamRunBreakdown): StatDriver[] {
  const drivers: StatDriver[] = [];
  const base = C.league.avgRunsPerTeam;
  const add = (factor: string, mult: number, side: string) => {
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
  add('Opposing pitching', home.pitchingMultiplier, home.team);
  add('Opposing pitching', away.pitchingMultiplier, away.team);
  add('Offense', home.offenseMultiplier, home.team);
  add('Offense', away.offenseMultiplier, away.team);
  add('Ballpark', home.parkMultiplier, 'Both teams');
  add('Weather', home.weatherMultiplier, 'Both teams');
  return drivers.sort((a, b) => Math.abs(b.impactRuns) - Math.abs(a.impactRuns)).slice(0, 5);
}

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
  if (bullpenFatiguePenalty(home.bullpen) > 1.02 || bullpenFatiguePenalty(away.bullpen) > 1.02) {
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
  homeTeam: string;
  awayTeam: string;
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
  if (active === 0) return 0.5;
  return Math.max(positive, negative) / active;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function projectMLBGame(input: MLBProjectionInput): MLBProjectionResult {
  const env = input.environment;
  const homeBreakdown = calculateProjectedTeamRuns(input.home, input.away, env);
  const awayBreakdown = calculateProjectedTeamRuns(input.away, input.home, env);
  const projectedTotal = homeBreakdown.projectedRuns + awayBreakdown.projectedRuns;

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

  // Totals
  const bookTotal = input.line?.total ?? null;
  const edgeRuns = bookTotal !== null ? calculateTotalEdge(projectedTotal, bookTotal) : null;
  const zTotal = bookTotal !== null ? (projectedTotal - bookTotal) / C.decision.totalSigma : 0;
  const overProbability = bookTotal !== null ? (1 - normCdf(-zTotal)) * 100 : 50;
  const underProbability = 100 - overProbability;

  let totalsLean: Lean = 'no-bet';
  if (edgeRuns !== null) {
    totalsLean = determineTotalLean(edgeRuns, dataCompleteness);
    if (input.line?.totalMovedSharply && totalsLean !== 'no-bet') {
      if (Math.abs(edgeRuns) < C.decision.totalMinEdgeRuns * 1.5) totalsLean = 'no-bet';
    }
  }

  const totalsEdgeStrength =
    edgeRuns !== null ? clamp(Math.abs(edgeRuns) / (C.decision.totalMinEdgeRuns * 3), 0, 1) : 0;
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

  // Moneyline
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
  if (homeEdge !== null && awayEdge !== null && dataCompleteness >= C.decision.minDataCompleteness) {
    if (homeEdge >= C.decision.moneylineMinEdge && homeEdge >= awayEdge) mlLean = 'home';
    else if (awayEdge >= C.decision.moneylineMinEdge) mlLean = 'away';
  }

  const mlEdgeMag = homeEdge !== null && awayEdge !== null ? Math.max(homeEdge, awayEdge) : 0;
  const mlEdgeStrength = clamp(mlEdgeMag / (C.decision.moneylineMinEdge * 3), 0, 1);
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
    homeTeam: input.home.name,
    awayTeam: input.away.name,
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
