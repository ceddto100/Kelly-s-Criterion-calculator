/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Daily Games View — "Today's Slate"
 * ==================================
 * The first screen in this app that shows LIVE games instead of manual input.
 *
 * MLB: reads `/stats/mlb/mlb_slate.csv` for today's matchups and joins each one
 * to the team, bullpen, park and starter CSVs (`utils/mlbStatsLoader`), then
 * runs it through the unit-tested projectMLBGame() engine right here in the
 * browser — same math and same data as the manual MLB estimator. No backend
 * call: MLB now works exactly like the NBA/NFL/NHL tabs, off static CSVs.
 *
 * CFB: reads this week's slate and the SP+/FPI rating blend from `/stats/cfb/`
 * (`utils/cfbStatsLoader`) and projects each game with the Walters Protocol
 * engine using only the automatically detected factors. Top 25 is the default
 * filter; tapping a card opens the Walters tab with the matchup filled in.
 *
 * NBA / NFL / NHL: calls GET /api/games/daily?sport=X to show today's slate with
 * the consensus line and live status/score. Full client-side projections for
 * those sports need the team-stat CSVs the matchup tab loads; this view surfaces
 * the games + lines today and links the user to the matchup/estimator tabs.
 *
 * Honesty: MLB projections lean only when there is a book line AND the engine's
 * data-completeness clears its threshold. A blank cell in the CSV stays blank
 * all the way through — the model never substitutes a guess for a missing stat,
 * it just lowers confidence, and "no bet" stays a valid outcome.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useHiddenSports } from '../utils/sportVisibility';
import { projectMLBGame, type MLBProjectionResult } from '../utils/mlbProjection';
import {
  buildGenericSelection,
  mlbInputToFields,
  preloadSportStats,
  TeamsNotFoundError,
  type DailyGameSelection,
} from '../utils/dailyGameTransfer';
import { loadSlateGames, preloadMLBStats, type MLBSlateGame } from '../utils/mlbStatsLoader';
import {
  buildSlateGames,
  lineLabel,
  loadCFBData,
  teamLabel,
  type CFBData,
  type CFBSlateGame,
} from '../utils/cfbStatsLoader';
import { WALTERS_CFB } from '../utils/waltersCfb';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

type SportKey = 'MLB' | 'CFB' | 'NBA' | 'NFL' | 'NHL';

const SPORTS: { key: SportKey; label: string; icon: string }[] = [
  { key: 'NBA', label: 'NBA', icon: '🏀' },
  { key: 'NFL', label: 'NFL', icon: '🏈' },
  { key: 'NHL', label: 'NHL', icon: '🏒' },
  { key: 'CFB', label: 'CFB', icon: '🎓' },
  { key: 'MLB', label: 'MLB', icon: '⚾' },
];

// ---- shapes returned by the backend -----------------------------------------

interface GenericDailyGame {
  gameId: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeAbbr?: string;
  awayAbbr?: string;
  startTime: string;
  status: string;
  statusDetail?: string;
  homeScore: number | null;
  awayScore: number | null;
  overUnder: number | null;
  spread: string | null;
  homeSpread?: number | null;
  /** True when ESPN's line is a moneyline (e.g. "SJ -125"), not a point spread. */
  isMoneyline?: boolean;
  /** 'pregame' = closing line recovered after kickoff; 'live' = still on the scoreboard. */
  lineSource?: 'pregame' | 'live' | null;
  atsResult?: 'home' | 'away' | 'push' | null;
  totalResult?: 'over' | 'under' | 'push' | null;
}

function fmtSpread(n: number): string {
  return n === 0 ? 'PK' : `${n > 0 ? '+' : ''}${n}`;
}

/** "Packers -3.5 covered" / "Over 44.5 hit" style result lines for live & final games. */
function gameResults(game: GenericDailyGame): { text: string; color: string }[] {
  const out: { text: string; color: string }[] = [];
  const isFinal = game.status === 'final';
  const verbCover = isFinal ? 'covered' : 'covering';
  if (game.isMoneyline && game.homeScore !== null && game.awayScore !== null) {
    if (game.homeScore !== game.awayScore) {
      const team = game.homeScore > game.awayScore ? game.homeTeam : game.awayTeam;
      out.push({ text: `${team} ML ${isFinal ? 'won' : 'leading'}`, color: '#22c55e' });
    }
  } else if (game.atsResult) {
    if (game.atsResult === 'push') {
      out.push({ text: isFinal ? 'Spread: push' : 'Spread: on the number', color: '#94a3b8' });
    } else if (game.homeSpread !== null && game.homeSpread !== undefined) {
      const home = game.atsResult === 'home';
      const team = home ? game.homeTeam : game.awayTeam;
      const line = home ? game.homeSpread : -game.homeSpread;
      out.push({ text: `${team} ${fmtSpread(line)} ${verbCover}`, color: '#22c55e' });
    }
  }
  if (game.totalResult && game.overUnder !== null) {
    if (game.totalResult === 'push') {
      out.push({ text: `Total ${game.overUnder}: push`, color: '#94a3b8' });
    } else {
      const label = game.totalResult === 'over' ? 'Over' : 'Under';
      out.push({
        text: `${label} ${game.overUnder} ${isFinal ? 'hit' : 'pacing'}`,
        color: game.totalResult === 'over' ? '#22c55e' : '#0ea5e9',
      });
    }
  }
  return out;
}

// ---- helpers ----------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

const LEAN_COLORS: Record<string, string> = {
  over: '#22c55e',
  under: '#0ea5e9',
  home: '#22c55e',
  away: '#0ea5e9',
  'no-bet': '#94a3b8',
};

function confColor(label: string): string {
  if (label === 'high') return '#22c55e';
  if (label === 'medium') return '#f59e0b';
  return '#94a3b8';
}

// ---- MLB projection card ----------------------------------------------------

function MLBGameCard({ game, onSelect }: { game: MLBSlateGame; onSelect?: () => void }) {
  const result: MLBProjectionResult = projectMLBGame(game.input);
  const t = result.totals;
  const s = game.slate;
  const leanColor = LEAN_COLORS[t.lean] || '#94a3b8';
  const leanText =
    t.lean === 'no-bet'
      ? 'No Bet'
      : `${t.lean.toUpperCase()}${t.bookTotal !== null ? ' ' + t.bookTotal : ''}`;

  return (
    <ClickableCard onSelect={onSelect}>
      <div style={styles.cardHeader}>
        <div>
          <div style={styles.matchup}>{s.awayTeam} @ {s.homeTeam}</div>
          <div style={styles.subtle}>
            {formatTime(s.gameTime)}{s.venue ? ` · ${s.venue}` : ''}
          </div>
        </div>
        <span style={{ ...styles.leanBadge, background: leanColor }}>{leanText}</span>
      </div>

      <div style={styles.statRow}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Projected</div>
          <div style={styles.statValue}>{t.projectedTotal.toFixed(1)}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Book Total</div>
          <div style={styles.statValue}>{t.bookTotal !== null ? t.bookTotal : '—'}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Edge (runs)</div>
          <div style={{ ...styles.statValue, color: leanColor }}>
            {t.edgeRuns !== null ? (t.edgeRuns > 0 ? '+' : '') + t.edgeRuns.toFixed(2) : '—'}
          </div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Confidence</div>
          <div style={{ ...styles.statValue, color: confColor(t.confidenceLabel) }}>
            {t.confidence}<span style={styles.subtle}> /100</span>
          </div>
        </div>
      </div>

      <div style={styles.starterRow}>
        <span style={styles.subtle}>
          SP: {s.awayTeam.split(' ').pop()} {s.awayStarter || 'TBD'} ·{' '}
          {s.homeTeam.split(' ').pop()} {s.homeStarter || 'TBD'}
        </span>
      </div>

      {t.bookTotal === null && (
        <div style={styles.note}>No book total posted yet — projection shown, no lean.</div>
      )}

      {game.missingTeams.length > 0 && (
        <div style={styles.note}>
          No CSV stats found for {game.missingTeams.join(' and ')} — projection is incomplete.
        </div>
      )}

      {onSelect && <CardCTA label="Open in Probability Estimator" />}
    </ClickableCard>
  );
}

// ---- college football (Walters Protocol) card -------------------------------

const CFB_CONFIDENCE_COLORS: Record<string, string> = {
  STRONG: '#22c55e',
  BET: '#f59e0b',
  LEAN: '#0ea5e9',
};

function kickoff(iso: string, tbd: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return tbd
    ? `${d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · time TBD`
    : d.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function CFBGameCard({ game, onSelect }: { game: CFBSlateGame; onSelect?: () => void }) {
  const { row, prefill, projection: p } = game;
  const home = prefill.teamA;
  const away = prefill.teamB;
  const homeLabel = teamLabel(home);
  const awayLabel = teamLabel(away);
  const rank = (r?: number) => (r !== undefined ? `#${r} ` : '');
  const hasPick = p !== null && p.pick !== null && p.confidence !== 'NO_BET' && !game.started;

  const badge = row.completed
    ? row.away.points !== undefined && row.home.points !== undefined
      ? `Final ${row.away.points}–${row.home.points}`
      : 'Final'
    : game.started
      ? 'Kicked off'
      : prefill.marketSpread === null
        ? 'No line yet'
        : p === null
          ? 'Not rated'
          : hasPick
            ? `${teamLabel(p.pick === 'A' ? home : away)} ${p.pickSpread === 0 ? 'PK' : `${p.pickSpread! > 0 ? '+' : ''}${p.pickSpread}`} · ${p.confidence}`
            : 'No Bet';
  const badgeColor = hasPick ? CFB_CONFIDENCE_COLORS[p!.confidence] : row.completed ? '#475569' : '#94a3b8';

  // Automatic factors, named per team (a lookahead is only a suggestion).
  const factorNames: [keyof typeof prefill.auto.A, string][] = [
    ['bye', 'off a bye'], ['shortWeek', 'short week'], ['travel', 'long trip'],
    ['altitude', 'altitude'], ['bounceback', 'bounceback'], ['lookahead', 'lookahead?'],
  ];
  const factors = [
    ...factorNames.filter(([k]) => prefill.auto.A[k]).map(([, label]) => `${homeLabel} ${label}`),
    ...factorNames.filter(([k]) => prefill.auto.B[k]).map(([, label]) => `${awayLabel} ${label}`),
  ];

  return (
    <ClickableCard onSelect={onSelect}>
      <div style={styles.cardHeader}>
        <div>
          <div style={styles.matchup}>
            {rank(away.rank)}{away.name} {row.neutralSite ? 'vs' : '@'} {rank(home.rank)}{home.name}
          </div>
          <div style={styles.subtle}>
            {kickoff(row.startDate, row.startTimeTbd)}
            {row.venue ? ` · ${row.venue}` : ''}
            {row.neutralSite ? ' · neutral site' : ''}
          </div>
        </div>
        <span style={{ ...styles.leanBadge, background: badgeColor }}>{badge}</span>
      </div>

      <div style={styles.statRow}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Book line</div>
          <div style={styles.statValue}>{lineLabel(prefill.marketSpread, homeLabel, awayLabel)}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Walters line</div>
          <div style={styles.statValue}>{p ? lineLabel(Math.round(p.trueLine * 10) / 10, homeLabel, awayLabel) : '—'}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Edge (pts)</div>
          <div style={{ ...styles.statValue, color: hasPick ? badgeColor : 'var(--text-primary)' }}>
            {p?.edge != null ? p.edge.toFixed(1) : '—'}
          </div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Cover %</div>
          <div style={styles.statValue}>{p?.pickProbability != null ? `${p.pickProbability.toFixed(1)}%` : '—'}</div>
        </div>
      </div>

      {factors.length > 0 && (
        <div style={styles.starterRow}>
          <span style={styles.subtle}>Auto factors: {factors.join(' · ')}</span>
        </div>
      )}

      {prefill.notRated.length > 0 && (
        <div style={styles.note}>
          No power rating for {prefill.notRated.join(' and ')}
          {prefill.marketSpread !== null ? ' — line shown, no projection.' : ' — no projection.'}
        </div>
      )}
      {p?.cappedForBigSpread && hasPick && (
        <div style={styles.note}>
          {WALTERS_CFB.bigSpread}+ point line — capped at LEAN (starters sit, garbage time).
        </div>
      )}
      {hasPick && p!.edge! >= WALTERS_CFB.thresholds.checkNews && (
        <div style={styles.note}>
          This {p!.edge!.toFixed(1)}-point edge usually means the market knows something the ratings
          don't — check QB and injury news before betting.
        </div>
      )}

      {onSelect && <CardCTA label="Open in Walters Protocol" />}
    </ClickableCard>
  );
}

// ---- generic (NBA/NFL/NHL) slate card ---------------------------------------

function GenericGameCard({
  game,
  sport,
  onSelect,
  busy,
}: {
  game: GenericDailyGame;
  sport: SportKey;
  onSelect?: () => void;
  busy?: boolean;
}) {
  const isLive = game.status === 'in_progress';
  const isFinal = game.status === 'final';
  // NHL projects on the total; NBA/NFL project against the spread.
  const ctaLabel = busy
    ? 'Loading team stats…'
    : sport === 'NHL'
      ? 'Open over/under in Estimator'
      : 'Open spread in Estimator';
  const results = gameResults(game);
  return (
    <ClickableCard onSelect={onSelect} busy={busy}>
      <div style={styles.cardHeader}>
        <div>
          <div style={styles.matchup}>{game.awayTeam} @ {game.homeTeam}</div>
          <div style={styles.subtle}>
            {isLive || isFinal ? game.statusDetail : formatTime(game.startTime)}
          </div>
        </div>
        {(isLive || isFinal) && game.homeScore !== null && (
          <span style={{ ...styles.leanBadge, background: isLive ? '#f59e0b' : '#475569' }}>
            {game.awayScore} – {game.homeScore}
          </span>
        )}
      </div>
      <div style={styles.statRow}>
        {/* Only label a line when there is a number to show. */}
        {game.overUnder !== null && game.overUnder !== undefined && (
          <div style={styles.stat}>
            <div style={styles.statLabel}>{isLive || isFinal ? 'Pre-game O/U' : 'Total (O/U)'}</div>
            <div style={styles.statValue}>{game.overUnder}</div>
          </div>
        )}
        {!!game.spread && (
          <div style={styles.stat}>
            <div style={styles.statLabel}>{game.isMoneyline
              ? isLive || isFinal ? 'Pre-game ML' : 'Moneyline'
              : isLive || isFinal ? 'Pre-game spread' : 'Spread'}</div>
            <div style={styles.statValue}>{game.spread}</div>
          </div>
        )}
        {(game.overUnder === null || game.overUnder === undefined) && !game.spread && !(isLive || isFinal) && (
          <div style={styles.subtle}>No spread or total posted yet.</div>
        )}
        {(isLive || isFinal) && game.homeScore !== null && game.awayScore !== null && (
          <div style={styles.stat}>
            <div style={styles.statLabel}>Total pts</div>
            <div style={styles.statValue}>{game.homeScore + game.awayScore}</div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div style={styles.resultRow}>
          {!isFinal && <span style={styles.subtle}>Live:</span>}
          {results.map((r) => (
            <span key={r.text} style={{ ...styles.resultChip, borderColor: r.color, color: r.color }}>
              {r.text}
            </span>
          ))}
        </div>
      )}

      {onSelect && <CardCTA label={ctaLabel} />}
    </ClickableCard>
  );
}

// ---- shared clickable card shell --------------------------------------------

function ClickableCard({
  onSelect,
  busy,
  children,
}: {
  onSelect?: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  if (!onSelect) return <div style={styles.card}>{children}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-busy={busy || undefined}
      onClick={() => { if (!busy) onSelect(); }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !busy) {
          e.preventDefault();
          onSelect();
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...styles.card,
        cursor: busy ? 'progress' : 'pointer',
        ...(hover ? styles.cardHover : {}),
      }}
    >
      {children}
    </div>
  );
}

function CardCTA({ label }: { label: string }) {
  return (
    <div style={styles.cardCta}>
      <span>{label}</span>
      <span aria-hidden style={{ fontWeight: 800 }}>→</span>
    </div>
  );
}

// ---- main view --------------------------------------------------------------

export default function DailyGamesView({
  onSelectGame,
}: {
  onSelectGame?: (selection: DailyGameSelection) => void;
}) {
  const [sport, setSport] = useState<SportKey>('NBA');
  const hiddenSports = useHiddenSports();
  const visibleSports = SPORTS.filter((sp) => !hiddenSports.includes(sp.key));

  // If the admin hides the selected sport, jump to the first one still shown.
  useEffect(() => {
    if (visibleSports.length && !visibleSports.some((sp) => sp.key === sport)) {
      setSport(visibleSports[0].key);
    }
  }, [hiddenSports]); // eslint-disable-line react-hooks/exhaustive-deps
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mlbGames, setMlbGames] = useState<MLBSlateGame[]>([]);
  const [genericGames, setGenericGames] = useState<GenericDailyGame[]>([]);
  const [cfbData, setCfbData] = useState<CFBData | null>(null);
  const [cfbFilter, setCfbFilter] = useState<'top25' | 'all'>('top25');
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  // Warm the CSV cache for the active sport so the first card tap is instant.
  useEffect(() => {
    if (sport === 'MLB') preloadMLBStats();
    else if (sport !== 'CFB') preloadSportStats(sport);
  }, [sport]);

  const cfbGames = useMemo(() => (cfbData ? buildSlateGames(cfbData) : []), [cfbData]);
  const visibleCfbGames = cfbFilter === 'top25' ? cfbGames.filter((g) => g.isTop25) : cfbGames;

  const handleCfbSelect = useCallback((game: CFBSlateGame) => {
    if (!onSelectGame) return;
    setSelectError(null);
    onSelectGame({ sport: 'CFB', walters: game.prefill });
  }, [onSelectGame]);

  const handleMlbSelect = useCallback((game: MLBSlateGame) => {
    if (!onSelectGame) return;
    setSelectError(null);
    onSelectGame({
      sport: 'MLB',
      mlb: mlbInputToFields({
        homeTeam: game.slate.homeTeam,
        awayTeam: game.slate.awayTeam,
        homeAbbr: game.slate.homeAbbr,
        awayAbbr: game.slate.awayAbbr,
        homeStarter: game.slate.homeStarter,
        awayStarter: game.slate.awayStarter,
        bookTotal: game.slate.bookTotal ?? null,
        input: game.input,
      }),
    });
  }, [onSelectGame]);

  const handleGenericSelect = useCallback(async (game: GenericDailyGame) => {
    if (!onSelectGame || sport === 'MLB' || sport === 'CFB') return;
    setSelectError(null);
    setBusyGameId(game.gameId);
    try {
      const selection = await buildGenericSelection(sport, game);
      onSelectGame(selection);
    } catch (e) {
      if (e instanceof TeamsNotFoundError) {
        setSelectError(
          `${e.message}. Open the Probability Estimator and enter this matchup manually.`,
        );
      } else {
        setSelectError(e instanceof Error ? e.message : 'Could not load that matchup.');
      }
    } finally {
      setBusyGameId(null);
    }
  }, [onSelectGame, sport]);

  const load = useCallback(async (s: SportKey) => {
    setLoading(true);
    setError(null);
    try {
      if (s === 'MLB') {
        // Straight from /stats/mlb/*.csv — no backend, same as NBA/NFL/NHL.
        setMlbGames(await loadSlateGames());
      } else if (s === 'CFB') {
        // This week's slate + ratings from /stats/cfb; Refresh skips the 1-minute cache.
        setCfbData(await loadCFBData(true));
      } else {
        const res = await fetch(`${BACKEND_URL}/api/games/daily?sport=${s}`);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const data = await res.json();
        setGenericGames(data.games || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(sport); }, [sport, load]);

  return (
    <div className="panel" style={{ maxWidth: 1100 }}>
      <div style={styles.headerRow}>
        <div>
          <h2 style={{ margin: 0 }}>Today's Games</h2>
          <p style={styles.subtle}>
            {sport === 'CFB'
              ? `This week's college football slate${cfbData?.meta?.week ? ` · week ${cfbData.meta.week}` : ''}${
                  cfbData?.meta?.updatedAt ? ` · updated ${new Date(cfbData.meta.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''
                }`
              : `Live slate with model projections. ${new Date().toLocaleDateString()}`}
          </p>
        </div>
        <button onClick={() => load(sport)} style={styles.refreshBtn} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Sport toggle */}
      <div style={styles.sportToggle}>
        {visibleSports.map((sp) => (
          <button
            key={sp.key}
            onClick={() => setSport(sp.key)}
            style={{ ...styles.sportButton, ...(sport === sp.key ? styles.sportButtonActive : {}) }}
          >
            <span style={{ fontSize: 18 }}>{sp.icon}</span> {sp.label}
          </button>
        ))}
      </div>

      {onSelectGame && (
        <div style={styles.tapHint} role="note">
          <span>
            Tap any game to load its prediction
            <span style={styles.tapHintSub}>
              {sport === 'CFB' ? 'Opens in the Walters Protocol' : 'Opens in the Probability Estimator'}
            </span>
          </span>
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          Couldn't load {sport} games: {error}. The live feed may be unavailable right now.
        </div>
      )}

      {selectError && <div style={styles.errorBox}>{selectError}</div>}

      {loading && <div style={styles.loading}>Loading {sport} games…</div>}

      {sport === 'CFB' && !loading && !error && cfbGames.length > 0 && (
        <div style={styles.filterRow} role="group" aria-label="College football filter">
          {([['top25', 'Top 25'], ['all', 'All FBS']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={cfbFilter === key}
              onClick={() => setCfbFilter(key)}
              style={{ ...styles.filterButton, ...(cfbFilter === key ? styles.filterButtonActive : {}) }}
            >
              {label}
              <span style={{ opacity: 0.75, fontWeight: 500 }}>
                {' '}({key === 'top25' ? cfbGames.filter((g) => g.isTop25).length : cfbGames.length})
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && !error && (
        <>
          {sport === 'CFB' ? (
            cfbGames.length === 0 ? (
              <div style={styles.empty}>
                No college football games in <code>/stats/cfb/cfb_slate.csv</code> yet. Once the
                CFBD_API_KEY secret is added, the stats workflow refreshes this week's slate twice a day.
              </div>
            ) : visibleCfbGames.length === 0 ? (
              <div style={styles.empty}>No Top 25 teams are left on this week's slate. Switch to All FBS.</div>
            ) : (
              visibleCfbGames.map((g) => (
                <CFBGameCard
                  key={g.row.gameId}
                  game={g}
                  onSelect={onSelectGame ? () => handleCfbSelect(g) : undefined}
                />
              ))
            )
          ) : sport === 'MLB' ? (
            mlbGames.length === 0 ? (
              <div style={styles.empty}>
                No MLB games in <code>/stats/mlb/mlb_slate.csv</code> for today. Run the stat
                updater (or the stat-fetching agent) to refresh the slate.
              </div>
            ) : (
              mlbGames.map((g) => (
                <MLBGameCard
                  key={g.id}
                  game={g}
                  onSelect={onSelectGame ? () => handleMlbSelect(g) : undefined}
                />
              ))
            )
          ) : genericGames.length === 0 ? (
            <div style={styles.empty}>No {sport} games found for today.</div>
          ) : (
            genericGames.map((g) => (
              <GenericGameCard
                key={g.gameId}
                game={g}
                sport={sport}
                busy={busyGameId === g.gameId}
                onSelect={onSelectGame ? () => handleGenericSelect(g) : undefined}
              />
            ))
          )}
        </>
      )}

      <p style={styles.disclaimer}>
        Predictions are model estimates and do not account for injuries — check injury news before betting.
      </p>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  headerRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem',
  },
  refreshBtn: {
    background: 'var(--surface-1)', color: 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)', borderRadius: 10,
    padding: '0.5rem 0.9rem', cursor: 'pointer', fontWeight: 600,
  },
  sportToggle: {
    display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem',
  },
  sportButton: {
    flex: '1 1 auto', minWidth: 70, background: 'var(--surface-1)',
    color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
    borderRadius: 12, padding: '0.6rem 0.8rem', cursor: 'pointer', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
  },
  sportButtonActive: {
    background: 'var(--button-primary)', color: '#fff', borderColor: 'transparent',
    boxShadow: 'var(--button-glow)',
  },
  filterRow: {
    display: 'flex', gap: '0.5rem', marginTop: '-0.5rem', marginBottom: '1rem',
  },
  filterButton: {
    background: 'var(--surface-1)', color: 'var(--text-secondary)',
    border: '1px solid var(--border-subtle)', borderRadius: 999,
    padding: '0.35rem 0.85rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
  },
  filterButtonActive: {
    background: 'var(--button-primary)', color: '#fff', border: '1px solid transparent',
    boxShadow: 'var(--button-glow)',
  },
  card: {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, padding: '1rem 1.1rem', marginBottom: '0.85rem',
    transition: 'transform 0.12s ease, border-color 0.12s ease, background 0.12s ease',
  },
  cardHover: {
    background: 'rgba(255,255,255,0.07)', borderColor: 'var(--button-primary, rgba(99,102,241,0.6))',
    transform: 'translateY(-2px)',
  },
  cardCta: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: '0.5rem', marginTop: '0.9rem', paddingTop: '0.7rem',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    color: 'var(--button-primary, #818cf8)', fontWeight: 700, fontSize: '0.82rem',
  },
  tapHint: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    margin: '0 0 1rem', padding: '0.85rem 1rem', borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(190,242,100,0.18), rgba(52,211,153,0.14))',
    border: '1.5px solid rgba(190,242,100,0.65)',
    boxShadow: '0 0 18px rgba(190,242,100,0.25)',
    color: '#d9f99d', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '0.01em',
  },
  tapHintSub: {
    display: 'block', marginTop: '0.15rem', color: 'var(--text-muted)',
    fontSize: '0.78rem', fontWeight: 600,
  },
  cardHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem',
  },
  matchup: { fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' },
  subtle: { color: 'var(--text-muted)', fontSize: '0.8rem' },
  leanBadge: {
    color: '#0b1020', fontWeight: 800, fontSize: '0.8rem', padding: '0.3rem 0.7rem',
    borderRadius: 999, whiteSpace: 'nowrap',
  },
  statRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))',
    gap: '0.6rem', marginTop: '0.9rem',
  },
  stat: { textAlign: 'center' },
  statLabel: { color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' },
  statValue: { color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.15rem', marginTop: 2 },
  resultRow: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem',
    marginTop: '0.75rem',
  },
  resultChip: {
    border: '1px solid', borderRadius: '999px', padding: '0.2rem 0.6rem',
    fontSize: '0.78rem', fontWeight: 700,
  },
  starterRow: { marginTop: '0.8rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(255,255,255,0.06)' },
  note: {
    marginTop: '0.7rem', color: 'var(--text-muted)', fontSize: '0.8rem',
    fontStyle: 'italic',
  },
  loading: { textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' },
  empty: { textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' },
  errorBox: {
    background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.4)',
    color: '#fda4af', borderRadius: 12, padding: '0.8rem 1rem', marginBottom: '1rem',
  },
  disclaimer: {
    marginTop: '1.25rem', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.5,
  },
};
