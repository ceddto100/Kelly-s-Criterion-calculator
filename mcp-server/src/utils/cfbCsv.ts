/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * College football CSV loader
 * ===========================
 * The single place the app reads college football data from: the files
 * scripts/updateCFBStats.mjs writes under `/stats/cfb/`. Shared by the Walters
 * Protocol tab and the Today's Games CFB cards, and loadable in Node for tests.
 *
 *   cfb_ratings.csv      team_id, team, abbreviation, conference, rating,
 *                        rating_sources, ratings_gap_band
 *   cfb_slate.csv        this week's games: kickoff, ranks, neutral site,
 *                        consensus spread/total, and each side's rest days,
 *                        previous margin, time-zone change, body-clock hour,
 *                        stadium elevation and next opponent
 *   cfb_predictions.csv  settled automatic-model picks and closing-line value
 *   last_updated.json
 *
 * A blank cell stays undefined — a missing rating means "not rated", never 0.
 */

import { parseCsv } from './csv.js';
import {
  autoFactorsForGame,
  projectGame,
  type AutoFactors,
  type Confidence,
  type GameContextSide,
  type Venue,
  type WaltersResult,
} from './waltersCfb.js';

const BASE = '/stats/cfb';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface CFBTeam {
  teamId: number;
  team: string;
  abbreviation: string;
  conference: string;
  /** Mean of SP+ and FPI: points versus an average FBS team on a neutral field. */
  rating?: number;
  ratingSources: string;
  /** '0-3' | '3-6' | '6+' points of SP+/FPI disagreement; '' with one source. */
  ratingsGapBand: string;
}

export interface CFBSlateSide extends GameContextSide {
  teamId?: number;
  team: string;
  abbreviation: string;
  conference: string;
  classification: string;
  rank?: number;
  points?: number;
  nextOpponent: string;
}

export interface CFBSlateRow {
  gameId: number;
  season: number;
  seasonType: string;
  week: number;
  startDate: string;
  startTimeTbd: boolean;
  completed: boolean;
  neutralSite: boolean;
  conferenceGame: boolean;
  venue: string;
  venueElevationFt?: number;
  home: CFBSlateSide;
  away: CFBSlateSide;
  /** Consensus spread from the home designee's side. */
  spreadHome?: number;
  total?: number;
  lineBooks: number;
}

export interface CFBPick {
  gameId: number;
  predictedAt: string;
  gameTime: string;
  probability?: number;
  outcome: string;
  pickSide: string;
  confidence: string;
  clvPoints?: number;
  week?: number;
  homeTeam: string;
  awayTeam: string;
  modelVersion: string;
}

export interface CFBMeta {
  updatedAt?: string;
  season?: number;
  seasonType?: string;
  week?: number;
  ratingsUpdatedAt?: string | null;
  poll?: string;
  fbsGames?: number;
  fbsGamesWithLines?: number;
}

export interface CFBData {
  teams: CFBTeam[];
  slate: CFBSlateRow[];
  picks: CFBPick[];
  meta: CFBMeta | null;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const n = (v: string | undefined): number | undefined => {
  if (v === undefined || v.trim() === '') return undefined;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const yes = (v: string | undefined) => v === 'yes';

/** Header-only and missing files are empty; an HTML fallback page is treated as missing. */
function rows(text: string | null): Record<string, string>[] {
  if (!text || !text.trim() || text.trimStart().startsWith('<')) return [];
  return parseCsv(text);
}

function side(r: Record<string, string>, s: 'home' | 'away'): CFBSlateSide {
  return {
    teamId: n(r[`${s}_id`]),
    team: r[`${s}_team`] ?? '',
    abbreviation: r[`${s}_abbr`] ?? '',
    conference: r[`${s}_conference`] ?? '',
    classification: r[`${s}_classification`] ?? '',
    rank: n(r[`${s}_rank`]),
    points: n(r[`${s}_points`]),
    restDays: n(r[`${s}_rest_days`]),
    prevMargin: n(r[`${s}_prev_margin`]),
    tzChange: n(r[`${s}_tz_change`]),
    bodyClockHour: n(r[`${s}_body_clock_hour`]),
    baseElevationFt: n(r[`${s}_base_elevation_ft`]),
    nextOpponent: r[`${s}_next_opponent`] ?? '',
    nextOpponentRank: n(r[`${s}_next_opponent_rank`]),
  };
}

export function parseCFBData(files: {
  ratings: string | null;
  slate: string | null;
  predictions?: string | null;
  meta?: string | null;
}): CFBData {
  const teams: CFBTeam[] = rows(files.ratings).map((r) => ({
    teamId: Number(r.team_id),
    team: r.team,
    abbreviation: r.abbreviation ?? '',
    conference: r.conference ?? '',
    rating: n(r.rating),
    ratingSources: r.rating_sources ?? '',
    ratingsGapBand: r.ratings_gap_band ?? '',
  }));
  const slate: CFBSlateRow[] = rows(files.slate).map((r) => ({
    gameId: Number(r.game_id),
    season: Number(r.season),
    seasonType: r.season_type,
    week: Number(r.week),
    startDate: r.start_date,
    startTimeTbd: yes(r.start_time_tbd),
    completed: yes(r.completed),
    neutralSite: yes(r.neutral_site),
    conferenceGame: yes(r.conference_game),
    venue: r.venue ?? '',
    venueElevationFt: n(r.venue_elevation_ft),
    home: side(r, 'home'),
    away: side(r, 'away'),
    spreadHome: n(r.spread_home),
    total: n(r.total),
    lineBooks: n(r.line_books) ?? 0,
  }));
  const picks: CFBPick[] = rows(files.predictions ?? null).map((r) => ({
    gameId: Number(r.game_id),
    predictedAt: r.predicted_at,
    gameTime: r.game_time,
    probability: n(r.probability),
    outcome: r.outcome,
    pickSide: r.pick_side,
    confidence: r.confidence,
    clvPoints: n(r.clv_points),
    week: n(r.week),
    homeTeam: r.home_team ?? '',
    awayTeam: r.away_team ?? '',
    modelVersion: r.model_version ?? '',
  }));
  let meta: CFBMeta | null = null;
  try {
    meta = files.meta && !files.meta.trimStart().startsWith('<') ? JSON.parse(files.meta) : null;
  } catch {
    meta = null;
  }
  return { teams, slate, picks, meta };
}

/** Load with any reader (fs in Node, fetch in the browser). A null read means the file does not exist. */
export async function loadCFBDataFrom(read: (file: string) => Promise<string | null>): Promise<CFBData> {
  const [ratings, slate, predictions, meta] = await Promise.all([
    read('cfb_ratings.csv'),
    read('cfb_slate.csv'),
    read('cfb_predictions.csv'),
    read('last_updated.json'),
  ]);
  return parseCFBData({ ratings, slate, predictions, meta });
}

let cache: { time: number; promise: Promise<CFBData> } | null = null;

/** Browser loader, cached for a minute so switching tabs doesn't refetch. */
export function loadCFBData(refresh = false): Promise<CFBData> {
  if (!refresh && cache && Date.now() - cache.time < 60_000) return cache.promise;
  const promise = loadCFBDataFrom(async (file) => {
    const res = await fetch(`${BASE}/${file}`, { cache: 'no-cache' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
    return res.text();
  }).catch((e) => {
    cache = null; // let a later attempt retry rather than caching the failure
    throw e;
  });
  cache = { time: Date.now(), promise };
  return promise;
}

// ---------------------------------------------------------------------------
// Walters prefill
// ---------------------------------------------------------------------------

export interface PrefillTeam {
  teamId?: number;
  name: string;
  abbreviation: string;
  conference: string;
  classification: string;
  rank?: number;
  rating?: number;
  ratingsGapBand: string;
}

/** Everything the Walters tab needs to open a matchup already filled in. */
export interface WaltersPrefill {
  gameId?: number;
  week?: number;
  startDate?: string;
  startTimeTbd?: boolean;
  venueName?: string;
  completed?: boolean;
  teamA: PrefillTeam;
  teamB: PrefillTeam;
  /** From Team A's side. */
  venue: Venue;
  /** Team A's consensus spread. */
  marketSpread: number | null;
  total: number | null;
  lineBooks: number;
  auto: { A: AutoFactors; B: AutoFactors };
  hints: { A: string[]; B: string[] };
  /** Teams in this matchup without a rating. */
  notRated: string[];
}

const NO_AUTO: AutoFactors = {
  bye: false, shortWeek: false, travel: false, altitude: false, bounceback: false, lookahead: false,
};

export const teamLabel = (t: { abbreviation: string; name: string }) => t.abbreviation || t.name;

function prefillTeam(data: CFBData, s: CFBSlateSide): PrefillTeam {
  const rated = s.teamId !== undefined ? data.teams.find((t) => t.teamId === s.teamId) : undefined;
  return {
    teamId: s.teamId,
    name: s.team,
    abbreviation: s.abbreviation || rated?.abbreviation || '',
    conference: s.conference || rated?.conference || '',
    classification: s.classification,
    rank: s.rank,
    rating: rated?.rating,
    ratingsGapBand: rated?.ratingsGapBand ?? '',
  };
}

function teamHints(t: PrefillTeam, s?: CFBSlateSide, auto?: AutoFactors): string[] {
  const hints: string[] = [];
  if (auto?.lookahead && s) {
    hints.push(`Next week: #${s.nextOpponentRank} ${s.nextOpponent} — possible lookahead spot`);
  }
  if (t.ratingsGapBand === '6+') hints.push('SP+ and FPI disagree by 6+ points — check QB and injury news');
  if (t.classification && t.classification !== 'fbs') hints.push('FCS team — not rated');
  return hints;
}

/** A slate game, seen from `teamASide`. */
export function prefillFromSlate(data: CFBData, game: CFBSlateRow, teamASide: 'home' | 'away' = 'home'): WaltersPrefill {
  const auto = autoFactorsForGame(game);
  const flip = teamASide === 'away';
  const [aSide, bSide] = flip ? [game.away, game.home] : [game.home, game.away];
  const [aAuto, bAuto] = flip ? [auto.away, auto.home] : [auto.home, auto.away];
  const teamA = prefillTeam(data, aSide);
  const teamB = prefillTeam(data, bSide);
  const venue: Venue = game.neutralSite ? 'neutral' : flip ? 'away' : 'home';
  const spread = game.spreadHome === undefined ? null : flip ? (game.spreadHome === 0 ? 0 : -game.spreadHome) : game.spreadHome;
  return {
    gameId: game.gameId,
    week: game.week,
    startDate: game.startDate,
    startTimeTbd: game.startTimeTbd,
    venueName: game.venue,
    completed: game.completed,
    teamA,
    teamB,
    venue,
    marketSpread: spread,
    total: game.total ?? null,
    lineBooks: game.lineBooks,
    auto: { A: aAuto, B: bAuto },
    hints: { A: teamHints(teamA, aSide, aAuto), B: teamHints(teamB, bSide, bAuto) },
    notRated: [teamA, teamB].filter((t) => t.rating === undefined).map((t) => t.name),
  };
}

/**
 * Two teams picked by hand. If they meet on this week's slate the game's
 * context comes along; otherwise it is a hypothetical with no line or
 * automatic factors.
 */
export function prefillForTeams(data: CFBData, teamAId: number, teamBId: number, venue: Venue = 'home'): WaltersPrefill | null {
  const game = data.slate.find(
    (g) =>
      (g.home.teamId === teamAId && g.away.teamId === teamBId) ||
      (g.home.teamId === teamBId && g.away.teamId === teamAId),
  );
  if (game) return prefillFromSlate(data, game, game.home.teamId === teamAId ? 'home' : 'away');
  const a = data.teams.find((t) => t.teamId === teamAId);
  const b = data.teams.find((t) => t.teamId === teamBId);
  if (!a || !b) return null;
  const asPrefill = (t: CFBTeam): PrefillTeam => ({
    teamId: t.teamId, name: t.team, abbreviation: t.abbreviation, conference: t.conference,
    classification: 'fbs', rating: t.rating, ratingsGapBand: t.ratingsGapBand,
  });
  const teamA = asPrefill(a);
  const teamB = asPrefill(b);
  return {
    teamA, teamB, venue, marketSpread: null, total: null, lineBooks: 0,
    auto: { A: NO_AUTO, B: NO_AUTO },
    hints: { A: teamHints(teamA), B: teamHints(teamB) },
    notRated: [teamA, teamB].filter((t) => t.rating === undefined).map((t) => t.name),
  };
}

// ---------------------------------------------------------------------------
// Slate cards
// ---------------------------------------------------------------------------

export interface CFBSlateGame {
  row: CFBSlateRow;
  prefill: WaltersPrefill;
  /** Automatic-factor projection; null when a team is not rated. */
  projection: WaltersResult | null;
  isTop25: boolean;
  started: boolean;
}

/** This week's games, upcoming first, each projected with the automatic factors only. */
export function buildSlateGames(data: CFBData, now: Date = new Date()): CFBSlateGame[] {
  const games = data.slate.map((row) => {
    const prefill = prefillFromSlate(data, row);
    const { teamA, teamB } = prefill;
    const projection =
      teamA.rating !== undefined && teamB.rating !== undefined
        ? projectGame({
            ratingHome: teamA.rating, ratingAway: teamB.rating, neutralSite: row.neutralSite,
            spreadHome: row.spreadHome ?? null, home: row.home, away: row.away,
            venueElevationFt: row.venueElevationFt,
          }).result
        : null;
    const started = row.completed || Date.parse(row.startDate) <= now.getTime();
    const ranked = (r?: number) => r !== undefined && r <= 25;
    return { row, prefill, projection, isTop25: ranked(row.home.rank) || ranked(row.away.rank), started };
  });
  return games.sort(
    (a, b) => Number(a.started) - Number(b.started) || Date.parse(a.row.startDate) - Date.parse(b.row.startDate),
  );
}

/** "UGA -6.5" from Team A's spread; "PK" at zero. */
export function lineLabel(spreadA: number | null | undefined, labelA: string, labelB: string): string {
  if (spreadA === null || spreadA === undefined || !Number.isFinite(spreadA)) return '—';
  if (spreadA === 0) return 'PK';
  return spreadA < 0 ? `${labelA} ${spreadA}` : `${labelB} -${spreadA}`;
}

// ---------------------------------------------------------------------------
// Track record
// ---------------------------------------------------------------------------

export interface PickRecord {
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  /** Graded picks that also have a closing line to compare against. */
  withClose: number;
  beatClose: number;
  averageClv?: number;
}

const GRADED: Confidence[] = ['LEAN', 'BET', 'STRONG'];

/** Record for picks graded LEAN or better (voided games excluded). */
export function summarizePicks(picks: CFBPick[]): PickRecord {
  const graded = picks.filter(
    (p) => GRADED.includes(p.confidence as Confidence) && ['win', 'loss', 'push'].includes(p.outcome),
  );
  const clv = graded.map((p) => p.clvPoints).filter((v): v is number => v !== undefined);
  return {
    picks: graded.length,
    wins: graded.filter((p) => p.outcome === 'win').length,
    losses: graded.filter((p) => p.outcome === 'loss').length,
    pushes: graded.filter((p) => p.outcome === 'push').length,
    withClose: clv.length,
    beatClose: clv.filter((v) => v > 0).length,
    averageClv: clv.length ? clv.reduce((a, b) => a + b, 0) / clv.length : undefined,
  };
}
