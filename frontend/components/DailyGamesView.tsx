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
import React, { useState, useEffect, useCallback } from 'react';
import { projectMLBGame, type MLBProjectionResult } from '../utils/mlbProjection';
import {
  buildGenericSelection,
  mlbInputToFields,
  preloadSportStats,
  TeamsNotFoundError,
  type DailyGameSelection,
} from '../utils/dailyGameTransfer';
import { loadSlateGames, preloadMLBStats, type MLBSlateGame } from '../utils/mlbStatsLoader';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

type SportKey = 'MLB' | 'NBA' | 'NFL' | 'NHL';

const SPORTS: { key: SportKey; label: string; icon: string }[] = [
  { key: 'MLB', label: 'MLB', icon: '⚾' },
  { key: 'NBA', label: 'NBA', icon: '🏀' },
  { key: 'NFL', label: 'NFL', icon: '🏈' },
  { key: 'NHL', label: 'NHL', icon: '🏒' },
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
        <div style={styles.stat}>
          <div style={styles.statLabel}>Total (O/U)</div>
          <div style={styles.statValue}>{game.overUnder !== null ? game.overUnder : '—'}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Spread</div>
          <div style={styles.statValue}>{game.spread || '—'}</div>
        </div>
      </div>

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
  const [sport, setSport] = useState<SportKey>('MLB');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mlbGames, setMlbGames] = useState<MLBSlateGame[]>([]);
  const [genericGames, setGenericGames] = useState<GenericDailyGame[]>([]);
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [selectError, setSelectError] = useState<string | null>(null);

  // Warm the CSV cache for the active sport so the first card tap is instant.
  useEffect(() => {
    if (sport === 'MLB') preloadMLBStats();
    else preloadSportStats(sport);
  }, [sport]);

  const handleMlbSelect = useCallback((game: MLBSlateGame) => {
    if (!onSelectGame) return;
    setSelectError(null);
    onSelectGame({
      sport: 'MLB',
      mlb: mlbInputToFields({
        homeTeam: game.slate.homeTeam,
        awayTeam: game.slate.awayTeam,
        bookTotal: game.slate.bookTotal ?? null,
        input: game.input,
      }),
    });
  }, [onSelectGame]);

  const handleGenericSelect = useCallback(async (game: GenericDailyGame) => {
    if (!onSelectGame || sport === 'MLB') return;
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
            Live slate with model projections. {new Date().toLocaleDateString()}
          </p>
          {onSelectGame && (
            <p style={styles.tapHint}>
              👉 Tap a game to send its line and team stats to the Probability Estimator.
            </p>
          )}
        </div>
        <button onClick={() => load(sport)} style={styles.refreshBtn} disabled={loading}>
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {/* Sport toggle */}
      <div style={styles.sportToggle}>
        {SPORTS.map((sp) => (
          <button
            key={sp.key}
            onClick={() => setSport(sp.key)}
            style={{ ...styles.sportButton, ...(sport === sp.key ? styles.sportButtonActive : {}) }}
          >
            <span style={{ fontSize: 18 }}>{sp.icon}</span> {sp.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={styles.errorBox}>
          Couldn't load {sport} games: {error}. The live feed may be unavailable right now.
        </div>
      )}

      {selectError && <div style={styles.errorBox}>{selectError}</div>}

      {loading && <div style={styles.loading}>Loading {sport} games…</div>}

      {!loading && !error && (
        <>
          {sport === 'MLB' ? (
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

      {sport !== 'MLB' && !loading && genericGames.length > 0 && (
        <div style={styles.note}>
          {sport === 'NHL'
            ? 'Tap a game to load both teams and the over/under into the Probability Estimator.'
            : `Tap a game to load both teams and the spread into the Probability Estimator.`}
        </div>
      )}

      <p style={styles.disclaimer}>
        Model projections only — a possible edge from formula output, not a guaranteed result.
        MLB reads the CSVs in <code>/stats/mlb/</code>: team offense (wRC+/wOBA/OPS/R-G), starter
        (ERA/FIP/xFIP/SIERA), bullpen quality and recent usage, ballpark, game-time weather and
        lineup status. Anything blank in the CSV stays blank — it lowers confidence rather than
        being guessed, and “No Bet” stays a smart outcome.
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
    color: 'var(--button-primary, #818cf8)', fontSize: '0.8rem', marginTop: '0.35rem', fontWeight: 600,
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
