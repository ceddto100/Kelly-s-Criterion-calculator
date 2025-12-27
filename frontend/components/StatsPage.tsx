import React, { useState, useEffect } from 'react';

interface StatsData {
  [key: string]: string | number;
}

interface StatsPageProps {}

type SortDirection = 'asc' | 'desc' | null;

export const StatsPage: React.FC<StatsPageProps> = () => {
  const [sport, setSport] = useState<'NBA' | 'NFL'>('NBA');
  const [statCategory, setStatCategory] = useState<string>('ppg');
  const [statsData, setStatsData] = useState<StatsData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const nbaCategories = [
    { id: 'ppg', label: 'Points Per Game', file: '/stats/nba/ppg.csv', higherIsBetter: true },
    { id: 'allowed', label: 'Points Allowed', file: '/stats/nba/allowed.csv', higherIsBetter: false },
    { id: 'fieldgoal', label: 'Field Goal %', file: '/stats/nba/fieldgoal.csv', higherIsBetter: true },
    { id: 'rebound', label: 'Rebound Margin', file: '/stats/nba/rebound_margin.csv', higherIsBetter: true },
    { id: 'turnover', label: 'Turnover Margin', file: '/stats/nba/turnover_margin.csv', higherIsBetter: true },
  ];

  const nflCategories = [
    { id: 'ppg', label: 'Points Per Game', file: '/stats/nfl/nfl_ppg.csv', higherIsBetter: true },
    { id: 'allowed', label: 'Points Allowed', file: '/stats/nfl/nfl_allowed.csv', higherIsBetter: false },
    { id: 'off_yards', label: 'Offensive Yards', file: '/stats/nfl/nfl_off_yards.csv', higherIsBetter: true },
    { id: 'def_yards', label: 'Defensive Yards', file: '/stats/nfl/nfl_def_yards.csv', higherIsBetter: false },
    { id: 'turnover', label: 'Turnover Differential', file: '/stats/nfl/nfl_turnover_diff.csv', higherIsBetter: true },
  ];

  const categories = sport === 'NBA' ? nbaCategories : nflCategories;
  const currentCategory = categories.find((c) => c.id === statCategory);

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
      setSortColumn(null);
      setSortDirection(null);
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

  const getStatColumn = () => {
    const headers = getTableHeaders();
    // The stat value is always the last column in the CSV
    return headers[headers.length - 1] || headers[0];
  };

  const getSortedAndFilteredData = () => {
    let filteredData = [...statsData];

    // Apply search filter
    if (searchQuery) {
      filteredData = filteredData.filter((row) => {
        return Object.values(row).some((value) =>
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    // Apply sorting
    if (sortColumn && sortDirection) {
      filteredData.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        } else {
          return bStr.localeCompare(aStr);
        }
      });
    }

    return filteredData;
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortColumn(null);
        setSortDirection(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getTopPerformers = () => {
    if (statsData.length === 0) return [];
    const statColumn = getStatColumn();
    const higherIsBetter = currentCategory?.higherIsBetter ?? true;

    const sorted = [...statsData].sort((a, b) => {
      const aVal = Number(a[statColumn]) || 0;
      const bVal = Number(b[statColumn]) || 0;
      return higherIsBetter ? bVal - aVal : aVal - bVal;
    });

    return sorted.slice(0, 3);
  };

  const getCellColor = (value: number, column: string) => {
    if (column === getTableHeaders()[0]) return null; // Don't color team names

    const statColumn = getStatColumn();
    if (column !== statColumn) return null;

    const values = statsData.map((row) => Number(row[column]) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) return null;

    const normalized = (value - min) / range;
    const higherIsBetter = currentCategory?.higherIsBetter ?? true;
    const score = higherIsBetter ? normalized : 1 - normalized;

    // Green to red gradient
    if (score >= 0.7) {
      return { background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.4)' };
    } else if (score >= 0.4) {
      return { background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)' };
    } else {
      return { background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' };
    }
  };

  const getMedalIcon = (index: number) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `${index + 1}`;
  };

  const displayData = getSortedAndFilteredData();
  const topPerformers = getTopPerformers();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>📈 Sports Statistics</h2>
        <p style={styles.subtitle}>
          Comprehensive team analytics from {sport} - Make data-driven betting decisions
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

        <input
          type="text"
          placeholder="🔍 Search teams..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {!loading && !error && statsData.length > 0 && topPerformers.length > 0 && (
        <div style={styles.topPerformersSection}>
          <h3 style={styles.sectionTitle}>🏆 Top Performers</h3>
          <div style={styles.topPerformersGrid}>
            {topPerformers.map((team, index) => {
              const teamName = String(team[getTableHeaders()[0]]);
              const statValue = team[getStatColumn()];
              const medal = getMedalIcon(index);

              return (
                <div
                  key={index}
                  style={{
                    ...styles.performerCard,
                    ...(index === 0 ? styles.performerCardFirst : {}),
                  }}
                >
                  <div style={styles.medalBadge}>{medal}</div>
                  <div style={styles.performerTeam}>{teamName}</div>
                  <div style={styles.performerStat}>
                    {typeof statValue === 'number'
                      ? statValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : statValue}
                  </div>
                  <div style={styles.performerLabel}>
                    {currentCategory?.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

        {!loading && !error && displayData.length === 0 && statsData.length > 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🔍</div>
            <p style={styles.emptyText}>No teams match your search</p>
          </div>
        )}

        {!loading && !error && displayData.length > 0 && (
          <>
            <div style={styles.tableHeader}>
              <div style={styles.tableTitle}>
                📊 {currentCategory?.label} Rankings
              </div>
              <div style={styles.tableInfo}>
                Showing {displayData.length} of {statsData.length} teams
              </div>
            </div>
            <div style={styles.tableContainer}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, ...styles.rankColumn }}>#</th>
                    {getTableHeaders().map((header, index) => (
                      <th
                        key={index}
                        style={{
                          ...styles.th,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleSort(header)}
                      >
                        <div style={styles.thContent}>
                          {header}
                          {sortColumn === header && (
                            <span style={styles.sortIcon}>
                              {sortDirection === 'asc' ? ' ▲' : ' ▼'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      style={styles.tr}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(168, 85, 247, 0.1)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                        (e.currentTarget as HTMLElement).style.transform = 'translateX(0)';
                      }}
                    >
                      <td style={{ ...styles.td, ...styles.rankCell }}>
                        <span style={styles.rankNumber}>
                          {rowIndex < 3 ? getMedalIcon(rowIndex) : rowIndex + 1}
                        </span>
                      </td>
                      {getTableHeaders().map((header, colIndex) => {
                        const value = row[header];
                        const cellStyle =
                          typeof value === 'number'
                            ? getCellColor(value, header)
                            : null;

                        return (
                          <td
                            key={colIndex}
                            style={{
                              ...styles.td,
                              ...(colIndex === 0 ? styles.teamNameCell : {}),
                              ...(cellStyle || {}),
                            }}
                          >
                            {typeof value === 'number'
                              ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                              : value}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={styles.infoCard}>
        <div style={styles.infoHeader}>
          <h3 style={styles.infoTitle}>💡 How to Use These Stats</h3>
        </div>
        <ul style={styles.infoList}>
          <li style={styles.infoItem}>
            <strong>Search:</strong> Use the search bar to quickly find specific teams
          </li>
          <li style={styles.infoItem}>
            <strong>Sort:</strong> Click column headers to sort by any metric
          </li>
          <li style={styles.infoItem}>
            <strong>Color Coding:</strong> Green indicates top performers, yellow is average, red is below average
          </li>
          <li style={styles.infoItem}>
            <strong>Kelly Criterion:</strong> Use these statistics to inform your probability estimates when calculating optimal bet sizes
          </li>
        </ul>
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
    textAlign: 'center',
  },
  title: {
    fontSize: '36px',
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
    maxWidth: '600px',
    margin: '0 auto',
  },
  controls: {
    display: 'flex',
    gap: '15px',
    marginBottom: '25px',
    flexWrap: 'wrap',
    alignItems: 'center',
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
    transform: 'translateY(-2px)',
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
    transition: 'all 0.3s ease',
  },
  searchInput: {
    padding: '12px 16px',
    fontSize: '14px',
    color: 'white',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    outline: 'none',
    flex: '1',
    minWidth: '200px',
    transition: 'all 0.3s ease',
  },
  topPerformersSection: {
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'white',
    marginBottom: '15px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  topPerformersGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px',
    marginBottom: '10px',
  },
  performerCard: {
    background: 'rgba(255, 255, 255, 0.08)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
  },
  performerCardFirst: {
    background: 'rgba(234, 179, 8, 0.15)',
    border: '2px solid rgba(234, 179, 8, 0.4)',
    boxShadow: '0 8px 32px rgba(234, 179, 8, 0.2)',
  },
  medalBadge: {
    fontSize: '32px',
    marginBottom: '5px',
  },
  performerTeam: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
  },
  performerStat: {
    fontSize: '28px',
    fontWeight: 'bold',
    background: 'var(--accent-gradient)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  performerLabel: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statsCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
    minHeight: '400px',
    overflow: 'hidden',
  },
  tableHeader: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
  },
  tableTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'white',
  },
  tableInfo: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.6)',
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
    fontSize: '13px',
    fontWeight: '700',
    color: 'white',
    background: 'rgba(168, 85, 247, 0.15)',
    borderBottom: '2px solid rgba(168, 85, 247, 0.4)',
    position: 'sticky',
    top: 0,
    zIndex: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    transition: 'background 0.2s ease',
  },
  thContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  },
  sortIcon: {
    fontSize: '10px',
    opacity: 0.8,
  },
  rankColumn: {
    width: '60px',
    textAlign: 'center',
  },
  td: {
    padding: '14px 16px',
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.9)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    transition: 'all 0.2s ease',
  },
  teamNameCell: {
    fontWeight: '600',
    color: 'white',
  },
  rankCell: {
    textAlign: 'center',
    fontWeight: '600',
  },
  rankNumber: {
    fontSize: '16px',
  },
  tr: {
    background: 'transparent',
    transition: 'all 0.2s ease',
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
    animation: 'spin 2s linear infinite',
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
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'white',
    background: 'var(--accent-gradient)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
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
    padding: '24px',
    background: 'rgba(59, 130, 246, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '16px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  infoHeader: {
    marginBottom: '15px',
  },
  infoTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'white',
  },
  infoList: {
    margin: 0,
    paddingLeft: '20px',
    listStyle: 'none',
  },
  infoItem: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: '1.8',
    marginBottom: '8px',
    position: 'relative',
    paddingLeft: '0',
  },
};
