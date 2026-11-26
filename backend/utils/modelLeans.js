// utils/modelLeans.js - the model's lean on every lined game (tracked, not bet).
//
// The MCP server's daily run stores, on each game's projection, the side the
// model alone prefers against the real line (`track`) and later grades it
// (`trackResult`). Nothing is staked. These pure helpers turn those records
// into the public "Model leans" panel: today's leans and the running record.

const SPORTS = ['NBA', 'NFL', 'NHL'];
const round1 = (n) => Math.round(n * 10) / 10;
const signed = (n) => (n > 0 ? `+${n}` : n === 0 ? 'PK' : `${n}`);
const validOdds = (o) => typeof o === 'number' && Number.isFinite(o) && Math.abs(o) >= 100;

/** Break-even win probability (%) of an American price, vig included. */
function breakEvenPct(odds) {
  return odds < 0 ? (-odds / (-odds + 100)) * 100 : (100 / (odds + 100)) * 100;
}

/** Profit in units on a 1-unit stake at an American price. */
function unitProfit(result, odds) {
  if (result === 'win') return odds < 0 ? 100 / -odds : odds / 100;
  if (result === 'loss') return -1;
  return 0;
}

/**
 * The lean as the side the model rates higher than the market (the value
 * side). Totals recorded before Nov 26, 2026 stored the side the model gave
 * over 50% instead; they carry modelOver/fairOver, so re-derive the side.
 */
function normalizeTrack(track) {
  // Records with their own price (Nov 2026 on) already store the value side.
  if (!track || track.market !== 'total' || validOdds(track.odds) || typeof track.modelOver !== 'number' || typeof track.fairOver !== 'number') return track;
  const over = track.modelOver >= track.fairOver;
  return {
    ...track,
    side: over ? 'over' : 'under',
    modelProbability: over ? track.modelOver : 100 - track.modelOver,
    marketProbability: over ? track.fairOver : 100 - track.fairOver,
  };
}

/** Graded result of a lean from its stored final score (null if not final). */
function leanResult(doc) {
  if (!['win', 'loss', 'push'].includes(doc.trackResult)) return null;
  if (typeof doc.finalHomeScore !== 'number' || typeof doc.finalAwayScore !== 'number') return doc.trackResult;
  return gradeLean(normalizeTrack(doc.track), doc.finalHomeScore, doc.finalAwayScore);
}

/** "Celtics -4.5" / "Over 6.5" for a tracked lean. */
function leanLabel(doc) {
  const t = normalizeTrack(doc.track) || {};
  if (t.market === 'total') return `${t.side === 'over' ? 'Over' : 'Under'} ${t.line}`;
  const home = t.side === 'home';
  const line = home ? t.line : -t.line;
  return `${home ? doc.homeTeam : doc.awayTeam} ${signed(line)}`;
}

/** Grade a lean against a (live or final) score: how it stands right now. */
function gradeLean(track, homeScore, awayScore) {
  if (track.market === 'total') {
    const total = homeScore + awayScore;
    if (total === track.line) return 'push';
    return (total > track.line) === (track.side === 'over') ? 'win' : 'loss';
  }
  const cover = homeScore - awayScore + track.line;
  if (cover === 0) return 'push';
  return (cover > 0) === (track.side === 'home') ? 'win' : 'loss';
}

/**
 * One lean for the panel. `game` is the matching ESPN scoreboard entry (for
 * live scores, clock and logos), or undefined.
 */
function describeLean(doc, game) {
  const t = normalizeTrack(doc.track);
  const graded = ['win', 'loss', 'push'].includes(doc.trackResult);
  const started = game && (game.status === 'in_progress' || game.status === 'final');
  const homeScore = graded ? doc.finalHomeScore ?? null : started ? game.homeScore ?? null : null;
  const awayScore = graded ? doc.finalAwayScore ?? null : started ? game.awayScore ?? null : null;
  const status = graded ? 'final' : game ? game.status : 'unknown';
  let result = graded ? leanResult(doc) : null;
  let currentGrade = null;
  if (!graded && started && homeScore !== null && awayScore !== null) {
    currentGrade = gradeLean(t, homeScore, awayScore);
    if (game.status === 'final') result = currentGrade; // graded on the next daily run
  }
  return {
    id: String(doc._id),
    sport: doc.league,
    market: t.market,
    pick: leanLabel(doc),
    modelPct: round1(t.modelProbability),
    marketPct: round1(t.marketProbability),
    gap: round1(t.modelProbability - t.marketProbability),
    // The lean's own price and what it needs to win to break even. Older
    // records (before prices were stored per lean) have none.
    odds: validOdds(t.odds) ? t.odds : null,
    breakEven: validOdds(t.odds) ? round1(breakEvenPct(t.odds)) : null,
    priceFromBook: validOdds(t.odds) ? t.pricesFromBook !== false : null,
    home: { name: doc.homeTeam, score: homeScore, logo: game?.homeLogo || '' },
    away: { name: doc.awayTeam, score: awayScore, logo: game?.awayLogo || '' },
    status,
    statusDetail: graded ? 'Final' : game?.statusDetail || '',
    startTime: game?.startTime || null,
    result,
    currentGrade,
  };
}

/** Running record of every graded lean, overall and per sport. */
function leanRecord(docs) {
  const blank = () => ({ wins: 0, losses: 0, pushes: 0 });
  const all = blank();
  const bySport = Object.fromEntries(SPORTS.map((s) => [s, blank()]));
  let first = null;
  // Leans with a recorded price: units won or lost at that price, and the
  // average win rate those prices needed.
  const priced = { leans: 0, units: 0, breakEvenSum: 0 };
  for (const d of docs) {
    const r = leanResult(d);
    if (!r) continue;
    const odds = d.track?.odds;
    if (validOdds(odds) && r !== 'push') {
      priced.leans++;
      priced.units += unitProfit(r, odds);
      priced.breakEvenSum += breakEvenPct(odds);
    }
    const key = r === 'win' ? 'wins' : r === 'loss' ? 'losses' : 'pushes';
    all[key]++;
    if (bySport[d.league]) bySport[d.league][key]++;
    const day = new Date(d.gameDate).toISOString().slice(0, 10);
    if (!first || day < first) first = day;
  }
  const rate = (r) => (r.wins + r.losses ? round1((100 * r.wins) / (r.wins + r.losses)) : null);
  return {
    ...all,
    winRate: rate(all),
    since: first,
    priced: priced.leans
      ? { leans: priced.leans, units: round1(priced.units), breakEven: round1(priced.breakEvenSum / priced.leans) }
      : null,
    bySport: SPORTS.map((s) => ({ sport: s, ...bySport[s], winRate: rate(bySport[s]) }))
      .filter((r) => r.wins + r.losses + r.pushes > 0),
  };
}

/** Latest slate day that has tracked leans (YYYY-MM-DD), or null. */
function latestDay(docs) {
  let best = null;
  for (const d of docs) {
    const day = new Date(d.gameDate).toISOString().slice(0, 10);
    if (!best || day > best) best = day;
  }
  return best;
}

module.exports = { breakEvenPct, unitProfit, normalizeTrack, leanResult, leanLabel, gradeLean, describeLean, leanRecord, latestDay, SPORTS };
