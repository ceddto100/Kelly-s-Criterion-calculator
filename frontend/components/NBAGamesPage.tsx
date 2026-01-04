import React, { useState, useEffect, useCallback } from 'react';

// Types for API response
interface Team {
  id: number;
  name: string;
  logo: string;
}

interface Score {
  quarter_1: number | null;
  quarter_2: number | null;
  quarter_3: number | null;
  quarter_4: number | null;
  over_time: number | null;
  total: number | null;
}

interface League {
  id: number;
  name: string;
  type: string;
  season: string;
  logo: string;
}

interface Country {
  id: number;
  name: string;
  code: string;
  flag: string;
}

interface Game {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  timezone: string;
  stage: string | null;
  week: string | null;
  status: {
    long: string;
    short: string;
    timer: string | null;
  };
  league: League;
  country: Country;
  teams: {
    home: Team;
    away: Team;
  };
  scores: {
    home: Score;
    away: Score;
  };
}

interface APIResponse {
  get: string;
  parameters: Record<string, string>;
  errors: string[];
  results: number;
  response: Game[];
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const POLL_INTERVAL_MS = 15000; // 15 seconds
const NBA_LEAGUE_ID = 12; // NBA league ID in API-Sports

// Format date as YYYY-MM-DD
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format display date
function formatDisplayDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export const NBAGamesPage: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const today = getTodayDate();
  const timezone = 'America/New_York';

  const fetchGames = useCallback(async (refresh = false) => {
    try {
      const url = `${BACKEND_URL}/api/nba/games?date=${today}&timezone=${timezone}${refresh ? '&refresh=1' : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data: APIResponse = await response.json();

      if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors.join(', '));
      }

      // Filter to NBA only if league data is present
      let filteredGames = data.response || [];
      if (filteredGames.length > 0 && filteredGames[0].league) {
        filteredGames = filteredGames.filter(
          (game) => game.league.id === NBA_LEAGUE_ID || game.league.name === 'NBA'
        );
      }

      // Sort by scheduled start time ascending
      filteredGames.sort((a, b) => a.timestamp - b.timestamp);

      setGames(filteredGames);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch games');
    } finally {
      setLoading(false);
    }
  }, [today, timezone]);

  // Initial fetch and polling
  useEffect(() => {
    fetchGames();

    const intervalId = setInterval(() => {
      fetchGames();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [fetchGames]);

  const handleRefresh = () => {
    setLoading(true);
    fetchGames(true);
  };

  const formatGameTime = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusDisplay = (status: Game['status']): string => {
    return status.long || status.short || 'Unknown';
  };

  const getScoreDisplay = (score: Score | null): string => {
    if (!score || score.total === null) return '-';
    return String(score.total);
  };

  const isGameLive = (status: Game['status']): boolean => {
    const liveStatuses = ['Q1', 'Q2', 'Q3', 'Q4', 'OT', 'HT', 'BT'];
    return liveStatuses.includes(status.short);
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>NBA Games &mdash; {formatDisplayDate(today)}</h1>
        <div style={styles.headerActions}>
          {lastUpdated && (
            <span style={styles.lastUpdated}>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={handleRefresh} style={styles.refreshButton} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      <main style={styles.main}>
        {loading && games.length === 0 && (
          <div style={styles.loadingContainer}>
            <div style={styles.spinner}></div>
            <p style={styles.loadingText}>Loading games...</p>
          </div>
        )}

        {error && (
          <div style={styles.errorContainer}>
            <p style={styles.errorIcon}>!</p>
            <p style={styles.errorText}>{error}</p>
            <button onClick={handleRefresh} style={styles.retryButton}>
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div style={styles.emptyContainer}>
            <p style={styles.emptyIcon}>-</p>
            <p style={styles.emptyText}>No NBA games scheduled for today</p>
          </div>
        )}

        {games.length > 0 && (
          <div style={styles.gamesGrid}>
            {games.map((game) => (
              <div key={game.id} style={styles.gameCard}>
                <div style={styles.gameHeader}>
                  <span
                    style={{
                      ...styles.status,
                      ...(isGameLive(game.status) ? styles.statusLive : {}),
                    }}
                  >
                    {getStatusDisplay(game.status)}
                  </span>
                  <span style={styles.gameTime}>{formatGameTime(game.date)}</span>
                </div>

                <div style={styles.matchup}>
                  <div style={styles.team}>
                    {game.teams.away.logo && (
                      <img
                        src={game.teams.away.logo}
                        alt={game.teams.away.name}
                        style={styles.teamLogo}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span style={styles.teamName}>{game.teams.away.name}</span>
                    <span style={styles.score}>{getScoreDisplay(game.scores.away)}</span>
                  </div>

                  <div style={styles.atSymbol}>@</div>

                  <div style={styles.team}>
                    {game.teams.home.logo && (
                      <img
                        src={game.teams.home.logo}
                        alt={game.teams.home.name}
                        style={styles.teamLogo}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <span style={styles.teamName}>{game.teams.home.name}</span>
                    <span style={styles.score}>{getScoreDisplay(game.scores.home)}</span>
                  </div>
                </div>

                <div style={styles.scoreLine}>
                  <span style={styles.scoreLabel}>Score:</span>
                  <span style={styles.scoreValue}>
                    {getScoreDisplay(game.scores.away)} &mdash; {getScoreDisplay(game.scores.home)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <p>Auto-refreshes every 15 seconds</p>
      </footer>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
    color: '#e0e0e0',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '20px',
  },
  header: {
    maxWidth: '1200px',
    margin: '0 auto 24px',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
  },
  title: {
    fontSize: 'clamp(1.5rem, 4vw, 2rem)',
    fontWeight: 700,
    background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  lastUpdated: {
    fontSize: '0.85rem',
    color: '#888',
  },
  refreshButton: {
    background: 'rgba(6, 182, 212, 0.2)',
    border: '1px solid rgba(6, 182, 212, 0.4)',
    color: '#06b6d4',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'all 0.2s ease',
  },
  main: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid rgba(6, 182, 212, 0.2)',
    borderTopColor: '#06b6d4',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '16px',
    color: '#888',
  },
  errorContainer: {
    textAlign: 'center',
    padding: '60px 20px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: '16px',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  errorIcon: {
    fontSize: '3rem',
    marginBottom: '16px',
  },
  errorText: {
    color: '#ef4444',
    marginBottom: '16px',
  },
  retryButton: {
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#ef4444',
    padding: '8px 24px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  emptyContainer: {
    textAlign: 'center',
    padding: '60px 20px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyText: {
    color: '#888',
  },
  gamesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '20px',
  },
  gameCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    padding: '20px',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  gameHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  status: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: '4px',
    background: 'rgba(100, 100, 100, 0.3)',
    textTransform: 'uppercase',
  },
  statusLive: {
    background: 'rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    animation: 'pulse 2s infinite',
  },
  gameTime: {
    fontSize: '0.85rem',
    color: '#888',
  },
  matchup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
  },
  team: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  teamLogo: {
    width: '32px',
    height: '32px',
    objectFit: 'contain',
  },
  teamName: {
    flex: 1,
    fontWeight: 600,
    fontSize: '1rem',
  },
  score: {
    fontSize: '1.25rem',
    fontWeight: 700,
    minWidth: '40px',
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  atSymbol: {
    textAlign: 'center',
    color: '#666',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  scoreLine: {
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    paddingTop: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#888',
    fontSize: '0.85rem',
  },
  scoreValue: {
    fontWeight: 700,
    fontSize: '1.1rem',
    fontFamily: 'monospace',
  },
  footer: {
    maxWidth: '1200px',
    margin: '24px auto 0',
    textAlign: 'center',
    color: '#666',
    fontSize: '0.85rem',
  },
};

export default NBAGamesPage;
