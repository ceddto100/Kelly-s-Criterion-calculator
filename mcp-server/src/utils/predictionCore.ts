import { estimateBasketballProbability, estimateFootballProbability } from './calculations.js';
import { calculateNHLProjection } from './nhl.js';
import { buildMatchupInput, buildSlateGame, loadMLBStatsFrom, type MLBStats } from './mlbCsv.js';
import { projectMLBGame } from './mlb.js';

export type PredictionSport = 'NBA' | 'NFL' | 'NHL' | 'MLB';
export const MODEL_VERSION = 'csv-2026.09-v1';
export type CsvTeam = {team: string; abbreviation: string; stats: Record<string, number>};
export type Catalog = {sport: PredictionSport; teams: CsvTeam[]; updatedAt: string | null; files: string[]; mlb?: MLBStats};
export type PredictionRequest = {sport: PredictionSport; home: string; away: string; line?: number; gameDate?: string};
export type Prediction = {
  sport: PredictionSport; home: string; away: string; headline: string; summary: string;
  homeScore?: number; awayScore?: number; margin?: number; total?: number;
  probability?: number; probabilityLabel?: string; pushProbability?: number;
  drivers: string[]; warnings: string[]; updatedAt: string | null; modelVersion: string;
  source: 'CSV'; files: string[]; inputs: Record<string, unknown>;
};

// Existing CSV columns only. All files are read by both browser and MCP.
const METRICS = {
  NBA: {ppg:'ppg',allowed:'allowed',fieldgoal:'fg_pct',rebound_margin:'rebound_margin',turnover_margin:'turnover_margin',pace:'pace',three_pct:'three_pct',three_rate:'three_rate',off_rtg:'off_rtg',def_rtg:'def_rtg',net_rtg:'net_rtg'},
  NFL: {nfl_ppg:'ppg',nfl_allowed:'allowed',nfl_off_yards:'off_yards',nfl_def_yards:'def_yards',nfl_turnover_diff:'turnover_diff'},
  NHL: {nhl_xgf60:'xgf60',nhl_xga60:'xga60',nhl_gsax60:'gsax60',nhl_hdcf60:'hdcf60',nhl_pp:'pp',nhl_pk:'pk',nhl_times_shorthanded:'times_shorthanded'},
};

import {parseCsv} from './csv.js';
export {parseCsv} from './csv.js';

export async function loadCatalog(sport: PredictionSport, read: (path: string) => Promise<string>): Promise<Catalog> {
  let updatedAt: string | null = null;
  try {const meta = JSON.parse(await read('last_updated.json')); updatedAt = meta.sports?.[sport] ?? null;} catch {}
  if (sport === 'MLB') {
    const mlb = await loadMLBStatsFrom(file => read('mlb/' + file));
    return {sport, mlb, updatedAt: mlb.updatedAt, files: ['mlb_team_offense.csv','mlb_starters.csv','mlb_bullpen.csv','mlb_parks.csv','mlb_slate.csv'].map(f=>'mlb/'+f),
      teams: mlb.teams.map(t=>({team:t.team,abbreviation:t.abbreviation,stats:Object.fromEntries(Object.entries(t).filter(([,v])=>typeof v==='number')) as Record<string,number>}))};
  }
  const entries = Object.entries(METRICS[sport]);
  const teams = new Map<string,CsvTeam>();
  await Promise.all(entries.map(async ([file, metric]) => {
    const rows = parseCsv(await read(sport.toLowerCase() + '/' + file + '.csv'));
    if (!rows.length) throw new Error(file + ': empty CSV');
    const seen = new Set<string>();
    for (const row of rows) {
      if (!row.team || !row.abbreviation || !(metric in row)) throw new Error(file + ': invalid schema');
      const rawKey = row.abbreviation.toUpperCase();
      const key = sport === 'NHL' && rawKey === 'UTAH' ? 'UTA' : rawKey;
      if (seen.has(key)) throw new Error(file + ': duplicate team ' + key);
      seen.add(key);
      const team = teams.get(key) ?? {team:sport === 'NHL' && key === 'UTA' ? 'Utah Mammoth' : row.team,abbreviation:key,stats:{}};
      if (row[metric] !== '') {
        const value = Number(row[metric]);
        if (!Number.isFinite(value)) throw new Error(file + ': invalid number for ' + key);
        const signed=['turnover_margin','rebound_margin','net_rtg','turnover_diff','gsax60'].includes(metric);
        if(!signed && value<0) throw new Error(file+': negative rate for '+key);
        if(['fg_pct','three_pct','pp','pk'].includes(metric) && value>100) throw new Error(file+': percentage exceeds 100');
        if(metric==='three_rate' && value>1) throw new Error(file+': three-point rate must be a fraction');
        team.stats[metric] = value;
      }
      teams.set(key,team);
    }
  }));
  return {sport, updatedAt, teams:[...teams.values()].sort((a,b)=>a.team.localeCompare(b.team)), files:entries.map(([f])=>sport.toLowerCase()+'/'+f+'.csv')};
}

export function resolveTeam(catalog: Catalog, name: string): CsvTeam {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/^la /, 'los angeles ');
  const normalized = normalize(name);
  const key = catalog.sport === 'NHL' && ['utah','utah hockey club','utah mammoth'].includes(normalized) ? 'uta' : normalized;
  if (!key) throw new Error('Choose a team');
  const exact = catalog.teams.filter(t=>t.abbreviation.toLowerCase()===key || normalize(t.team)===key);
  const matches = exact.length ? exact : catalog.teams.filter(t=>normalize(t.team).includes(key));
  if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous team; use its full name or abbreviation' : 'Team not found in the CSV snapshot: ' + name);
  return matches[0];
}

export function predictFromCatalog(catalog: Catalog, request: PredictionRequest): Prediction {
  if (catalog.sport !== request.sport) throw new Error('Sport does not match snapshot');
  const h = resolveTeam(catalog,request.home), a = resolveTeam(catalog,request.away);
  if (h.abbreviation === a.abbreviation) throw new Error('Choose two different teams');
  if (request.line !== undefined && !Number.isFinite(request.line)) throw new Error('Invalid line');
  if ((catalog.sport==='MLB'||catalog.sport==='NHL') && request.line !== undefined && request.line < 0) throw new Error('Game totals must be non-negative');
  const warnings = ['Model estimates are not yet calibrated against historical game outcomes.'];
  if (!catalog.updatedAt) warnings.push('Snapshot date is unavailable.');
  else if (Date.now() - Date.parse(catalog.updatedAt) > 7 * 86400000) warnings.push('This snapshot is older than seven days; it may describe a previous season.');
  const result: Prediction = {sport:catalog.sport, home:h.team, away:a.team, headline:'',summary:'',drivers:[],warnings,updatedAt:catalog.updatedAt,modelVersion:MODEL_VERSION,source:'CSV',files:catalog.files,inputs:{home:h.stats,away:a.stats}};
  const required = (keys: string[]) => {
    for (const team of [h,a]) for (const key of keys) if (!Number.isFinite(team.stats[key])) throw new Error('Missing ' + key + ' for ' + team.team);
  };
  if (catalog.sport === 'MLB') {
    const data = catalog.mlb!;
    const matches = data.slate.filter(s=>s.homeAbbr===h.abbreviation && s.awayAbbr===a.abbreviation && (!request.gameDate || s.gameDate===request.gameDate));
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const selected = matches.filter(s=>s.gameDate===(request.gameDate ?? today));
    if (selected.length > 1) throw new Error('Multiple games found; select starters in the MLB estimator for this doubleheader');
    if (request.gameDate && !selected.length) throw new Error('No matching game on that date in the CSV slate');
    const input = selected.length ? buildSlateGame(data,selected[0],0).input : buildMatchupInput(data,h.team,a.team).input;
    if (!selected.length) warnings.push('Hypothetical matchup: no dated slate or confirmed starters selected.');
    if (request.line !== undefined) input.line = {...input.line,total:request.line};
    for(const team of [input.home,input.away]) if(![team.offense.wrcPlus,team.offense.woba,team.offense.ops,team.offense.runsPerGame].some(v=>v!==undefined && Number.isFinite(v))) throw new Error('Missing offense statistics for '+team.name);
    const p = projectMLBGame(input);
    result.inputs = input as unknown as Record<string,unknown>;
    result.homeScore = p.totals.projectedHomeRuns; result.awayScore = p.totals.projectedAwayRuns;
    result.total = p.totals.projectedTotal; result.probability = p.moneyline.homeWinProbability;
    result.probabilityLabel = h.team + ' win estimate';
    if(request.line !== undefined) {result.probability = p.totals.overProbability; result.probabilityLabel = 'Over ' + request.line + ' runs';}
    result.headline = (p.moneyline.homeWinProbability >= 50 ? h.team : a.team) + ' lean';
    result.summary = 'Run projection from offense, opposing pitching and the home ballpark.';
    result.drivers = ['wRC+ anchors offense; wOBA, OPS and runs are fallbacks.', 'Starter and bullpen contributions follow their expected share of innings.', 'Available weather and lineup data adjust the same shared model.'];
    warnings.push(...p.riskFactors);
  } else if (catalog.sport === 'NHL') {
    required(['xgf60','xga60','gsax60','hdcf60','pp','pk','times_shorthanded']);
    const convert = (s: Record<string,number>)=>({xGF60:s.xgf60,xGA60:s.xga60,GSAx60:s.gsax60,HDCF60:s.hdcf60,PP:s.pp,PK:s.pk,timesShorthandedPerGame:s.times_shorthanded});
    const p = calculateNHLProjection(convert(h.stats),convert(a.stats),request.line ?? 0);
    result.homeScore=p.homeScore; result.awayScore=p.awayScore;result.total=p.projectedTotal;
    result.headline=p.projectedTotal.toFixed(1)+' projected goals';
    result.summary='Expected scoring from each offense against the opposing defense and goaltending.';
    if(request.line!==undefined) {result.probability=p.overProbability;result.probabilityLabel='Over '+request.line+' goals';result.pushProbability=p.pushProbability;}
    result.drivers=['All-situation expected goals balance offense and defense.', 'Goalie GSAx is regressed to reduce small-sample swings.', 'Chance quality and power plays are already included in expected goals.'];
  } else {
    required(['ppg','allowed']);
    const hs=h.stats, as=a.stats;
    const common={teamPPG:hs.ppg,teamAllowed:hs.allowed,opponentPPG:as.ppg,opponentAllowed:as.allowed};
    const stats=catalog.sport==='NBA' ? {...common,teamPace:hs.pace,opponentPace:as.pace,teamOffRtg:hs.off_rtg,teamDefRtg:hs.def_rtg,opponentOffRtg:as.off_rtg,opponentDefRtg:as.def_rtg} : {...common,teamOffYards:hs.off_yards,teamDefYards:hs.def_yards,opponentOffYards:as.off_yards,opponentDefYards:as.def_yards,teamTurnoverDiff:hs.turnover_diff,opponentTurnoverDiff:as.turnover_diff};
    const estimate=catalog.sport==='NBA'?estimateBasketballProbability:estimateFootballProbability;
    const p=estimate(stats,request.line ?? 0,'home');
    result.margin=p.predictedMargin;result.probability=p.probability;
    result.probabilityLabel=request.line===undefined ? h.team+' win estimate' : h.team+' covers '+(request.line>0?'+':'')+request.line;
    result.headline=(p.predictedMargin>=0?h.team:a.team)+' by '+Math.abs(p.predictedMargin).toFixed(1);
    result.summary='Projected margin with home advantage, using the selected snapshot.';
    result.drivers=catalog.sport==='NBA'?['Offensive and defensive efficiency share equal matchup weight.','Both teams are compared at the same expected pace.','Shooting, rebounds and turnovers are shown in stats, without counting them again.']:['Scoring differential is the primary matchup signal.','Yardage contributes a smaller supporting signal.','Season turnover totals receive no extra bonus without a games-played denominator.'];
  }
  return JSON.parse(JSON.stringify(result)) as Prediction;
}
