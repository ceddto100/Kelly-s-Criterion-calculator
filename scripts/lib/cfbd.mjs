/**
 * scripts/lib/cfbd.mjs
 * ====================
 * Shapes CollegeFootballData.com (CFBD) API responses into the numbers the
 * college football Walters pipeline uses. Pure functions only — no network,
 * no filesystem, no clock — so the updater, the calibration script and the
 * tests all share one derivation of every value.
 *
 * Licensing note: CFBD's terms allow commercial display but forbid
 * republishing API data as a standalone dataset. The public CSVs therefore
 * carry DERIVED numbers (a blended rating, a disagreement band, a consensus
 * line, rest/travel context) — never the raw SP+ or FPI tables.
 */

const DAY_MS = 86400e3;

export const normalizeName = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function median(values) {
  const v = values.filter(isNum).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Nearest half point, the unit sportsbooks post spreads and totals in. */
export const roundToHalf = (x) => (isNum(x) ? Math.round(x * 2) / 2 : undefined);

/** Fixed decimals, or '' when the value is unknown (blank stays blank). */
export const fmt = (v, dp) => (isNum(v) ? (dp === undefined ? String(v) : v.toFixed(dp)) : '');

/** The CFB season a date belongs to: January/February bowls count toward the previous year. */
export function cfbSeasonYear(now) {
  return now.getUTCMonth() <= 1 ? now.getUTCFullYear() - 1 : now.getUTCFullYear();
}

// ---------------------------------------------------------------------------
// Betting lines
// ---------------------------------------------------------------------------

/**
 * One book's spread from the HOME team's side (negative = home favored).
 * `formattedSpread` names a team ("Georgia -7.5"), which is unambiguous, so it
 * wins whenever it parses; the bare `spread` field is the fallback.
 */
export function homeSpreadFromLine(line, homeTeam, awayTeam) {
  const text = String(line?.formattedSpread ?? '').trim();
  if (/^(pk|pick|pick'?em|even)$/i.test(text)) return 0;
  const m = text.match(/^(.*\S)\s+([-+]?\d+(?:\.\d+)?)$/);
  if (m) {
    const named = normalizeName(m[1]);
    // A number with no sign is the favorite's line.
    const namedSpread = /^[-+]/.test(m[2]) ? parseFloat(m[2]) : -Math.abs(parseFloat(m[2]));
    if (isNum(namedSpread)) {
      if (named === normalizeName(homeTeam)) return namedSpread === 0 ? 0 : namedSpread;
      if (named === normalizeName(awayTeam)) return namedSpread === 0 ? 0 : -namedSpread;
    }
  }
  return isNum(line?.spread) ? line.spread : undefined;
}

/** Consensus across every book CFBD lists: the median, to the nearest half point. */
export function consensusLine(bettingGame) {
  const spreads = [];
  const totals = [];
  for (const line of bettingGame?.lines ?? []) {
    const s = homeSpreadFromLine(line, bettingGame.homeTeam, bettingGame.awayTeam);
    if (isNum(s)) spreads.push(s);
    if (isNum(line?.overUnder)) totals.push(line.overUnder);
  }
  return {
    spreadHome: roundToHalf(median(spreads)),
    total: roundToHalf(median(totals)),
    books: spreads.length,
  };
}

/** A pick at `pickLineHome` graded against the final score. */
export function gradeSpread(homePoints, awayPoints, pickLineHome, side) {
  const cover = homePoints - awayPoints + pickLineHome;
  if (cover === 0) return 'push';
  return (side === 'home') === cover > 0 ? 'win' : 'loss';
}

/** Points of closing-line value: positive means the pick got a better number than the close. */
export function closingLineValue(side, pickLineHome, closeLineHome) {
  const v = side === 'home' ? pickLineHome - closeLineHome : closeLineHome - pickLineHome;
  return v === 0 ? 0 : v;
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

/** How far SP+ and FPI disagree, as a band rather than a number that would reveal both. */
export function ratingsGapBand(gap) {
  if (!isNum(gap)) return '';
  return gap < 3 ? '0-3' : gap < 6 ? '3-6' : '6+';
}

/**
 * One row per FBS team: the mean of SP+ and FPI (both measure points versus an
 * average FBS team), which sources were available, and how much they disagree.
 */
export function buildRatingRows(teams, spRows, fpiRows) {
  const sp = new Map(
    (spRows ?? [])
      .filter((r) => isNum(r?.rating) && r.team && r.team !== 'nationalAverages')
      .map((r) => [normalizeName(r.team), r.rating]),
  );
  const fpi = new Map(
    (fpiRows ?? []).filter((r) => isNum(r?.fpi) && r.team).map((r) => [normalizeName(r.team), r.fpi]),
  );
  const rows = (teams ?? []).map((t) => {
    const key = normalizeName(t.school);
    const available = [sp.get(key), fpi.get(key)].filter(isNum);
    const rating = available.length ? available.reduce((a, b) => a + b, 0) / available.length : undefined;
    return {
      team_id: t.id,
      team: t.school,
      abbreviation: t.abbreviation ?? '',
      conference: t.conference ?? '',
      rating: fmt(rating, 1),
      rating_sources: [sp.has(key) && 'sp+', fpi.has(key) && 'fpi'].filter(Boolean).join(' '),
      ratings_gap_band: available.length === 2 ? ratingsGapBand(Math.abs(sp.get(key) - fpi.get(key))) : '',
    };
  });
  return rows.sort(
    (a, b) =>
      (b.rating === '' ? -Infinity : Number(b.rating)) - (a.rating === '' ? -Infinity : Number(a.rating)) ||
      a.team.localeCompare(b.team),
  );
}

// ---------------------------------------------------------------------------
// Polls
// ---------------------------------------------------------------------------

/** CFP committee rankings beat the AP poll, which beats the coaches. FCS and lower polls never count. */
function pollPreference(name) {
  const n = String(name ?? '').toLowerCase();
  if (/fcs|division/.test(n)) return 0;
  if (n.includes('playoff')) return 3;
  if (n.startsWith('ap')) return 2;
  if (n.includes('coaches')) return 1;
  return 0;
}

/**
 * The newest poll week's preferred FBS poll, as teamId -> rank (1–25).
 * `asOf` limits it to polls released by a given week (poll week N comes out
 * before week N's games), which is what a pre-game backtest must use.
 */
export function latestRanks(pollWeeks, asOf) {
  const order = (w) => (w?.seasonType === 'postseason' ? 1000 : 0) + (w?.week ?? 0);
  const weeks = [...(pollWeeks ?? [])]
    .filter((w) => !asOf || order(w) <= order(asOf))
    .sort((a, b) => order(b) - order(a));
  for (const w of weeks) {
    const poll = [...(w.polls ?? [])]
      .filter((p) => pollPreference(p.poll) > 0 && p.ranks?.length)
      .sort((a, b) => pollPreference(b.poll) - pollPreference(a.poll))[0];
    if (poll) {
      return {
        poll: poll.poll,
        week: w.week,
        seasonType: w.seasonType,
        ranks: new Map(poll.ranks.filter((r) => isNum(r.rank) && r.rank <= 25).map((r) => [r.teamId, r.rank])),
      };
    }
  }
  return { poll: '', week: undefined, seasonType: undefined, ranks: new Map() };
}

// ---------------------------------------------------------------------------
// Schedule, clocks and venues
// ---------------------------------------------------------------------------

/**
 * The week holding the next kickoff, so the slate rolls forward as soon as a
 * week's last game is final. Games that kicked off in the last 6 hours still
 * count (in progress, or CFBD has not marked them complete yet).
 */
export function pickCurrentWeek(games, now) {
  let best;
  for (const g of games ?? []) {
    if (g.completed) continue;
    const t = Date.parse(g.startDate);
    if (!Number.isFinite(t) || t < now.getTime() - 6 * 3600e3) continue;
    if (!best || t < best.t) best = { t, season: g.season, seasonType: g.seasonType, week: g.week };
  }
  return best
    ? { season: best.season, seasonType: best.seasonType, week: best.week, nextKickoff: best.t }
    : undefined;
}

export function teamSchedules(games) {
  const byTeam = new Map();
  const add = (id, g) => {
    if (id === undefined || id === null) return;
    if (!byTeam.has(id)) byTeam.set(id, []);
    byTeam.get(id).push(g);
  };
  for (const g of games ?? []) {
    add(g.homeId, g);
    add(g.awayId, g);
  }
  for (const list of byTeam.values()) list.sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  return byTeam;
}

const easternDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Whole calendar days between two kickoffs, counted on the US Eastern calendar. */
export function calendarDaysBetween(earlierIso, laterIso) {
  const day = (iso) => Date.parse(easternDate.format(new Date(iso)) + 'T00:00:00Z') / DAY_MS;
  return Math.round(day(laterIso) - day(earlierIso));
}

/** UTC offset in hours for an IANA time zone at a moment (DST-aware). */
export function utcOffsetHours(timeZone, date) {
  if (!timeZone) return undefined;
  try {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (name === 'GMT') return 0;
    const m = name?.match(/GMT([+-])(\d{1,2}):(\d{2})/);
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) + Number(m[3]) / 60) : undefined;
  } catch {
    return undefined;
  }
}

/** Clock hour (0–23) in a time zone at a moment. */
export function localHour(timeZone, date) {
  if (!timeZone) return undefined;
  try {
    const h = parseInt(
      new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(date),
      10,
    );
    return Number.isFinite(h) ? h % 24 : undefined;
  } catch {
    return undefined;
  }
}

/**
 * CFBD venue elevations are unitless strings. Laramie, the highest FBS
 * stadium, is ~2,200 m / ~7,200 ft, so if even the 99th-percentile venue is
 * under 3,000 the data must be in meters.
 */
export function elevationFeetResolver(venues) {
  const values = (venues ?? []).map((v) => parseFloat(v?.elevation)).filter(Number.isFinite).sort((a, b) => a - b);
  const p99 = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * 0.99))] : 0;
  const unit = values.length && p99 < 3000 ? 'meters' : 'feet';
  const factor = unit === 'meters' ? 3.28084 : 1;
  return {
    unit,
    toFeet: (elevation) => {
      const e = parseFloat(elevation);
      return Number.isFinite(e) ? Math.round(e * factor) : undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// Slate
// ---------------------------------------------------------------------------

export const SLATE_HEADER = [
  'game_id', 'season', 'season_type', 'week', 'start_date', 'start_time_tbd', 'completed',
  'neutral_site', 'conference_game', 'venue', 'venue_elevation_ft',
  ...['home', 'away'].flatMap((s) => [
    `${s}_id`, `${s}_team`, `${s}_abbr`, `${s}_conference`, `${s}_classification`, `${s}_rank`,
    `${s}_points`, `${s}_rest_days`, `${s}_prev_margin`, `${s}_tz_change`, `${s}_body_clock_hour`,
    `${s}_base_elevation_ft`, `${s}_next_opponent`, `${s}_next_opponent_rank`,
  ]),
  'spread_home', 'total', 'line_books',
];

/**
 * What the pipeline knows about one team's side of a game. Only FBS teams get
 * context: CFBD's FBS game feed holds just an FCS team's games against FBS
 * opponents, so its rest days would be wrong — unknown is honest.
 */
export function sideContext(game, teamId, isHome, ctx) {
  const team = ctx.teamsById.get(teamId);
  if (!team) return {};
  const start = new Date(game.startDate);
  const schedule = ctx.schedules.get(teamId) ?? [];
  const prev = [...schedule]
    .reverse()
    .find(
      (g) => Date.parse(g.startDate) < start.getTime() && g.completed && isNum(g.homePoints) && isNum(g.awayPoints),
    );
  const next = schedule.find((g) => Date.parse(g.startDate) > start.getTime());
  const homeTz = team.location?.timezone;
  const venueOffset = utcOffsetHours(ctx.venueTz, start);
  const teamOffset = utcOffsetHours(homeTz, start);
  const nextOpponentId = next ? (next.homeId === teamId ? next.awayId : next.homeId) : undefined;
  return {
    restDays: prev ? calendarDaysBetween(prev.startDate, game.startDate) : undefined,
    prevMargin: prev
      ? prev.homeId === teamId
        ? prev.homePoints - prev.awayPoints
        : prev.awayPoints - prev.homePoints
      : undefined,
    tzChange: isNum(venueOffset) && isNum(teamOffset) ? Math.abs(venueOffset - teamOffset) : undefined,
    bodyClockHour: game.startTimeTBD ? undefined : localHour(homeTz, start),
    atHome: isHome && !game.neutralSite,
    baseElevationFt: ctx.toFeet(team.location?.elevation),
    nextOpponent: next ? (next.homeId === teamId ? next.awayTeam : next.homeTeam) : undefined,
    nextOpponentRank: nextOpponentId !== undefined ? ctx.ranks.get(nextOpponentId) : undefined,
  };
}

/**
 * The current week's games involving an FBS team, one object per game with
 * both sides' context and the consensus line. Values stay numbers/booleans
 * here; toCsv() stringifies them.
 */
export function buildSlate({ games, current, teams, venues, ranks, lines }) {
  const teamsById = new Map((teams ?? []).map((t) => [t.id, t]));
  const venuesById = new Map((venues ?? []).map((v) => [v.id, v]));
  const { toFeet, unit } = elevationFeetResolver(venues);
  const schedules = teamSchedules(games);
  const linesById = new Map((lines ?? []).map((bg) => [bg.id, consensusLine(bg)]));

  const slate = (games ?? [])
    .filter(
      (g) =>
        g.season === current.season &&
        g.seasonType === current.seasonType &&
        g.week === current.week &&
        (teamsById.has(g.homeId) || teamsById.has(g.awayId)),
    )
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate))
    .map((g) => {
      const venue = venuesById.get(g.venueId) ?? (!g.neutralSite ? teamsById.get(g.homeId)?.location : undefined);
      const ctx = { teamsById, schedules, ranks, toFeet, venueTz: venue?.timezone };
      const line = linesById.get(g.id) ?? {};
      const side = (id, name, conference, classification, points, isHome) => ({
        id,
        team: name,
        abbr: teamsById.get(id)?.abbreviation ?? '',
        conference: conference ?? '',
        classification: classification ?? '',
        rank: ranks.get(id),
        points: g.completed ? points : undefined,
        ...sideContext(g, id, isHome, ctx),
      });
      return {
        gameId: g.id,
        season: g.season,
        seasonType: g.seasonType,
        week: g.week,
        startDate: g.startDate,
        startTimeTbd: Boolean(g.startTimeTBD),
        completed: Boolean(g.completed),
        neutralSite: Boolean(g.neutralSite),
        conferenceGame: Boolean(g.conferenceGame),
        venue: g.venue ?? venue?.name ?? '',
        venueElevationFt: toFeet(venue?.elevation),
        home: side(g.homeId, g.homeTeam, g.homeConference, g.homeClassification, g.homePoints, true),
        away: side(g.awayId, g.awayTeam, g.awayConference, g.awayClassification, g.awayPoints, false),
        spreadHome: line.spreadHome,
        total: line.total,
        lineBooks: line.books ?? 0,
      };
    });
  return { slate, elevationUnit: unit };
}

const yesNo = (b) => (b ? 'yes' : 'no');

export function slateCsvRow(game) {
  const row = {
    game_id: game.gameId,
    season: game.season,
    season_type: game.seasonType,
    week: game.week,
    start_date: game.startDate,
    start_time_tbd: yesNo(game.startTimeTbd),
    completed: yesNo(game.completed),
    neutral_site: yesNo(game.neutralSite),
    conference_game: yesNo(game.conferenceGame),
    venue: game.venue,
    venue_elevation_ft: fmt(game.venueElevationFt),
    spread_home: fmt(game.spreadHome),
    total: fmt(game.total),
    line_books: game.lineBooks,
  };
  for (const s of ['home', 'away']) {
    const t = game[s];
    Object.assign(row, {
      [`${s}_id`]: t.id ?? '',
      [`${s}_team`]: t.team ?? '',
      [`${s}_abbr`]: t.abbr ?? '',
      [`${s}_conference`]: t.conference ?? '',
      [`${s}_classification`]: t.classification ?? '',
      [`${s}_rank`]: fmt(t.rank),
      [`${s}_points`]: fmt(t.points),
      [`${s}_rest_days`]: fmt(t.restDays),
      [`${s}_prev_margin`]: fmt(t.prevMargin),
      [`${s}_tz_change`]: fmt(t.tzChange),
      [`${s}_body_clock_hour`]: fmt(t.bodyClockHour),
      [`${s}_base_elevation_ft`]: fmt(t.baseElevationFt),
      [`${s}_next_opponent`]: t.nextOpponent ?? '',
      [`${s}_next_opponent_rank`]: fmt(t.nextOpponentRank),
    });
  }
  return row;
}

// ---------------------------------------------------------------------------
// CSV writing
// ---------------------------------------------------------------------------

/** Quote every cell so school names with commas or quotes can never break a row. */
export function toCsv(header, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [header.map(cell).join(','), ...rows.map((r) => header.map((h) => cell(r[h])).join(','))].join('\n') + '\n';
}
