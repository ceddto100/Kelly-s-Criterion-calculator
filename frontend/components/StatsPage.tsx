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

  const nbaCategories = [
    { id: 'ppg', label: 'Points Per Game', file: '/stats/nba/nba_ppg.csv' },
    { id: 'allowed', label: 'Points Allowed', file: '/stats/nba/nba_allowed.csv' },
    { id: 'fieldgoal', label: 'Field Goal %', file: '/stats/nba/nba_fieldgoal.csv' },
    { id: 'rebound', label: 'Rebound Margin', file: '/stats/nba/nba_rebound_margin.csv' },
    { id: 'turnover', label: 'Turnover Margin', file: '/stats/nba/nba_turnover_margin.csv' },
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📈 Sports Statistics</h2>
        <p style={styles.subtitle}>
          Live team statistics from NBA and NFL
        </p>
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
                      {header}
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
                      <td key={colIndex} style={styles.td}>
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
  },
  header: {
    marginBottom: '30px',
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
  },
  statsCard: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    minHeight: '400px',
    overflow: 'hidden',
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
