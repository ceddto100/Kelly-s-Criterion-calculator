import React, { useState, useEffect } from 'react';

interface StatsData {
  [key: string]: string | number;
}

interface StatsPageProps {}

export const StatsPage: React.FC<StatsPageProps> = () => {
  const [sport, setSport] = useState<'NBA' | 'NFL'>('NBA');
  const [statCategory, setStatCategory] = useState<string>('ppg');
  const [statsData, setStatsData] = useState<StatsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryDetails: Record<string, { title: string; description: string; accent: string; icon: string }> = {
    ppg: {
      title: 'Scoring Pulse',
      description: 'Quick snapshot of how explosive each offense has been.',
      accent: 'linear-gradient(135deg, #22d3ee 0%, #8b5cf6 100%)',
      icon: '⚡',
    },
    allowed: {
      title: 'Defensive Wall',
      description: 'Teams limiting opponents and controlling the pace.',
      accent: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
      icon: '🛡️',
    },
    fieldgoal: {
      title: 'Shooting Touch',
      description: 'Field goal efficiency and shot quality markers.',
      accent: 'linear-gradient(135deg, #f472b6 0%, #fb7185 100%)',
      icon: '🎯',
    },
    rebound: {
      title: 'Glass Control',
      description: 'Who is owning the boards and creating second chances.',
      accent: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
      icon: '🧲',
    },
    turnover: {
      title: 'Possession Game',
      description: 'Protecting the rock and forcing mistakes.',
      accent: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
      icon: '🔐',
    },
    off_yards: {
      title: 'Offensive Engine',
      description: 'Total yards gained highlights sustained drives.',
      accent: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
      icon: '🚀',
    },
    def_yards: {
      title: 'Defensive Grip',
      description: 'Keeping opponents in check through stout defense.',
      accent: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      icon: '🧱',
    },
  };

  const nbaCategories = [
    { id: 'ppg', label: 'Points Per Game', file: '/stats/ppg.csv' },
    { id: 'allowed', label: 'Points Allowed', file: '/stats/allowed.csv' },
    { id: 'fieldgoal', label: 'Field Goal %', file: '/stats/fieldgoal.csv' },
    { id: 'rebound', label: 'Rebound Margin', file: '/stats/rebound_margin.csv' },
    { id: 'turnover', label: 'Turnover Margin', file: '/stats/turnover_margin.csv' },
  ];

  const nflCategories = [
    { id: 'ppg', label: 'Points Per Game', file: '/stats/nfl/nfl_ppg.csv' },
    { id: 'allowed', label: 'Points Allowed', file: '/stats/nfl/nfl_allowed.csv' },
    { id: 'off_yards', label: 'Offensive Yards', file: '/stats/nfl/nfl_off_yards.csv' },
    { id: 'def_yards', label: 'Defensive Yards', file: '/stats/nfl/nfl_def_yards.csv' },
    { id: 'turnover', label: 'Turnover Differential', file: '/stats/nfl/nfl_turnover_diff.csv' },
  ];

  const categories = sport === 'NBA' ? nbaCategories : nflCategories;

  useEffect(() => {
    loadStats();
  }, [sport, statCategory]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const category = categories.find((c) => c.id === statCategory);
      if (!category) {
        throw new Error('Category not found');
      }

      const response = await fetch(category.file);
      if (!response.ok) {
        throw new Error('Failed to load stats');
      }

      const csvText = await response.text();
      const parsed = parseCSV(csvText);
      setStatsData(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
      setStatsData([]);
    } finally {
      setLoading(false);
    }
  };

  const parseCSV = (csvText: string): StatsData[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map((h) => h.trim());
    const data: StatsData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length === headers.length) {
        const row: StatsData = {};
        headers.forEach((header, index) => {
          const value = values[index];
          row[header] = isNaN(Number(value)) ? value : Number(value);
        });
        data.push(row);
      }
    }

    return data;
  };

  const getTableHeaders = () => {
    if (statsData.length === 0) return [];
    return Object.keys(statsData[0]);
  };

  const formatHeader = (header: string) => {
    return header
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const detail = categoryDetails[statCategory] ?? categoryDetails.ppg;
  const topTeam = statsData[0]?.team || statsData[0]?.Team;

  return (
    <div style={styles.container}>
      <div style={styles.bgGlow} />
      <div style={styles.header}>
        <div style={styles.titleRow}>
          <div>
            <p style={styles.kicker}>Insights for smarter Kelly bets</p>
            <h2 style={styles.title}>📈 Sports Statistics</h2>
            <p style={styles.subtitle}>
              Live team statistics from NBA and NFL
            </p>
          </div>
          <div style={styles.tagPill}>{sport === 'NBA' ? '🏀 NBA teams' : '🏈 NFL teams'}</div>
        </div>
        <div style={styles.detailCard}>
          <div style={{ ...styles.detailBadge, background: detail.accent }}>
            {detail.icon}
          </div>
          <div>
            <p style={styles.detailEyebrow}>{categories.find((c) => c.id === statCategory)?.label}</p>
            <h3 style={styles.detailTitle}>{detail.title}</h3>
            <p style={styles.detailText}>{detail.description}</p>
          </div>
          <div style={styles.detailMeta}>
            <div>
              <p style={styles.metaLabel}>Teams</p>
              <p style={styles.metaValue}>{statsData.length || '—'}</p>
            </div>
            <div>
              <p style={styles.metaLabel}>Top performer</p>
              <p style={styles.metaValue}>{topTeam ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.controls}>
        <div style={styles.sportToggle}>
          <button
            onClick={() => {
              setSport('NBA');
              setStatCategory('ppg');
            }}
            style={{
              ...styles.sportButton,
              ...(sport === 'NBA' ? styles.sportButtonActive : {}),
            }}
          >
            🏀 NBA
          </button>
          <button
            onClick={() => {
              setSport('NFL');
              setStatCategory('ppg');
            }}
            style={{
              ...styles.sportButton,
              ...(sport === 'NFL' ? styles.sportButtonActive : {}),
            }}
          >
            🏈 NFL
          </button>
        </div>

        <select
          value={statCategory}
          onChange={(e) => setStatCategory(e.target.value)}
          style={styles.categorySelect}
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.statsCard}>
        {loading && (
          <div style={styles.loadingState}>
            <div style={styles.spinner}>⏳</div>
            <p style={styles.loadingText}>Loading statistics...</p>
          </div>
        )}

        {error && (
          <div style={styles.errorState}>
            <div style={styles.errorIcon}>⚠️</div>
            <p style={styles.errorText}>{error}</p>
            <button onClick={loadStats} style={styles.retryButton}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && statsData.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📊</div>
            <p style={styles.emptyText}>No statistics available</p>
          </div>
        )}

        {!loading && !error && statsData.length > 0 && (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {getTableHeaders().map((header, index) => (
                    <th key={index} style={styles.th}>
                      {formatHeader(header)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statsData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    style={rowIndex % 2 === 0 ? styles.trEven : styles.trOdd}
                  >
                    {getTableHeaders().map((header, colIndex) => (
                      <td key={colIndex} style={{ ...styles.td, ...(typeof row[header] === 'number' ? styles.numeric : {}) }}>
                        {typeof row[header] === 'number'
                          ? row[header].toLocaleString()
                          : row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={styles.infoCard}>
        <h3 style={styles.infoTitle}>ℹ️ About These Stats</h3>
        <p style={styles.infoText}>
          Statistics are updated regularly from official {sport} data sources.
          Use these stats to make informed betting decisions with the Kelly
          Criterion calculator.
        </p>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    paddingBottom: '100px',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGlow: {
    position: 'absolute',
    inset: 0,
    background: 'radial-gradient(circle at 15% 20%, rgba(34, 211, 238, 0.12) 0, transparent 35%), radial-gradient(circle at 80% 0%, rgba(168, 85, 247, 0.12) 0, transparent 45%)',
    filter: 'blur(12px)',
    zIndex: 0,
  },
  header: {
    marginBottom: '30px',
    position: 'relative',
    zIndex: 1,
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  kicker: {
    color: 'var(--text-secondary)',
    fontSize: '13px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontWeight: 700,
    margin: 0,
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    marginBottom: '10px',
    background: 'var(--accent-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  tagPill: {
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    padding: '10px 14px',
    borderRadius: '999px',
    color: 'rgba(255, 255, 255, 0.86)',
    fontWeight: 700,
    boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
  },
  detailCard: {
    marginTop: '16px',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    gap: '16px',
    alignItems: 'center',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '18px',
    padding: '18px',
    boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
  },
  detailBadge: {
    width: '52px',
    height: '52px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '14px',
    fontSize: '22px',
    boxShadow: '0 14px 30px rgba(0,0,0,0.25)',
  },
  detailEyebrow: {
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    fontWeight: 700,
  },
  detailTitle: {
    margin: '4px 0',
    fontSize: '20px',
    color: 'white',
  },
  detailText: {
    margin: 0,
    color: 'rgba(255, 255, 255, 0.76)',
    lineHeight: 1.5,
    maxWidth: '620px',
  },
  detailMeta: {
    display: 'flex',
    gap: '18px',
    alignItems: 'center',
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '14px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },
  metaLabel: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontWeight: 700,
  },
  metaValue: {
    margin: 0,
    color: 'white',
    fontSize: '17px',
    fontWeight: 800,
  },
  controls: {
    display: 'flex',
    gap: '15px',
    marginBottom: '25px',
    flexWrap: 'wrap',
  },
  sportToggle: {
    display: 'flex',
    gap: '10px',
  },
  sportButton: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  sportButtonActive: {
    background: 'var(--accent-gradient)',
    color: 'white',
    boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
  },
  categorySelect: {
    padding: '12px 16px',
    fontSize: '14px',
    color: 'white',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    cursor: 'pointer',
    outline: 'none',
    minWidth: '200px',
    boxShadow: '0 12px 28px rgba(0,0,0,0.2)',
  },
  statsCard: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    minHeight: '400px',
    overflow: 'hidden',
    position: 'relative',
  },
  tableContainer: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    background: 'rgba(168, 85, 247, 0.2)',
    borderBottom: '2px solid rgba(168, 85, 247, 0.4)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.9)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'background 0.2s ease, transform 0.2s ease',
  },
  numeric: {
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums',
  },
  trEven: {
    background: 'rgba(255, 255, 255, 0.03)',
  },
  trOdd: {
    background: 'transparent',
  },
  loadingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  spinner: {
    fontSize: '48px',
    marginBottom: '20px',
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '16px',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  errorIcon: {
    fontSize: '48px',
    marginBottom: '20px',
  },
  errorText: {
    color: 'rgba(239, 68, 68, 0.9)',
    fontSize: '16px',
    marginBottom: '20px',
  },
  retryButton: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '20px',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: '16px',
  },
  infoCard: {
    marginTop: '25px',
    padding: '20px',
    background: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  infoTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    marginBottom: '10px',
  },
  infoText: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: '1.6',
  },
};
