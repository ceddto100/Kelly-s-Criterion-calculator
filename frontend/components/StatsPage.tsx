import React, { useState, useEffect } from 'react';

interface StatsData {
  [key: string]: string | number;
}

interface StatsPageProps {}

type SortDirection = 'asc' | 'desc' | null;

export const StatsPage: React.FC<StatsPageProps> = () => {
  const [sport, setSport] = useState<'NBA' | 'NFL' | 'NHL'>('NBA');
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
    { id: 'pace', label: 'Pace (Poss/Game)', file: '/stats/nba/pace.csv', higherIsBetter: true },
    { id: 'three_pct', label: '3-Point %', file: '/stats/nba/three_pct.csv', higherIsBetter: true },
    { id: 'three_rate', label: '3-Point Rate', file: '/stats/nba/three_rate.csv', higherIsBetter: true },
    { id: 'off_rtg', label: 'Offensive Rating', file: '/stats/nba/off_rtg.csv', higherIsBetter: true },
    { id: 'def_rtg', label: 'Defensive Rating', file: '/stats/nba/def_rtg.csv', higherIsBetter: false },
    { id: 'net_rtg', label: 'Net Rating', file: '/stats/nba/net_rtg.csv', higherIsBetter: true },
  ];

  const nflCategories = [
    { id: 'ppg', label: 'Points Per Game', file: '/stats/nfl/nfl_ppg.csv', higherIsBetter: true },
    { id: 'allowed', label: 'Points Allowed', file: '/stats/nfl/nfl_allowed.csv', higherIsBetter: false },
    { id: 'off_yards', label: 'Offensive Yards', file: '/stats/nfl/nfl_off_yards.csv', higherIsBetter: true },
    { id: 'def_yards', label: 'Defensive Yards', file: '/stats/nfl/nfl_def_yards.csv', higherIsBetter: false },
    { id: 'turnover', label: 'Turnover Differential', file: '/stats/nfl/nfl_turnover_diff.csv', higherIsBetter: true },
  ];

  const nhlCategories = [
    { id: 'xgf60', label: 'xGF/60 (Expected Goals For)', file: '/stats/nhl/nhl_xgf60.csv', higherIsBetter: true },
    { id: 'xga60', label: 'xGA/60 (Expected Goals Against)', file: '/stats/nhl/nhl_xga60.csv', higherIsBetter: false },
    { id: 'gsax60', label: 'GSAx/60 (Goals Saved Above Expected)', file: '/stats/nhl/nhl_gsax60.csv', higherIsBetter: true },
    { id: 'hdcf60', label: 'HDCF/60 (High Danger Chances For)', file: '/stats/nhl/nhl_hdcf60.csv', higherIsBetter: true },
    { id: 'pp', label: 'Power Play %', file: '/stats/nhl/nhl_pp.csv', higherIsBetter: true },
    { id: 'pk', label: 'Penalty Kill %', file: '/stats/nhl/nhl_pk.csv', higherIsBetter: true },
    { id: 'times_shorthanded', label: 'Times Shorthanded/Game', file: '/stats/nhl/nhl_times_shorthanded.csv', higherIsBetter: false },
  ];

  const categories = sport === 'NBA' ? nbaCategories : sport === 'NFL' ? nflCategories : nhlCategories;
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
    if (column === getTableHeaders()[0]) return null;

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
    <div className="p-5 max-w-6xl mx-auto pb-24">
      <div className="mb-8 text-center">
        <h2 className="text-4xl font-bold mb-2.5 accent-gradient-text">📈 Sports Statistics</h2>
        <p className="text-base text-[var(--text-secondary)] max-w-xl mx-auto">
          Comprehensive team analytics from {sport} - Make data-driven betting decisions
        </p>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap items-center">
        <div className="flex gap-2.5">
          <button
            onClick={() => {
              setSport('NBA');
              setStatCategory('ppg');
            }}
            className={`px-6 py-3 text-base font-semibold rounded-xl cursor-pointer transition-all duration-300 border ${
              sport === 'NBA'
                ? 'bg-[var(--accent)] text-white shadow-[var(--accent-glow)] -translate-y-0.5 border-transparent'
                : 'text-[var(--text-secondary)] bg-[var(--bg-surface)] border-[var(--border-default)]'
            }`}
          >
            🏀 NBA
          </button>
          <button
            onClick={() => {
              setSport('NFL');
              setStatCategory('ppg');
            }}
            className={`px-6 py-3 text-base font-semibold rounded-xl cursor-pointer transition-all duration-300 border ${
              sport === 'NFL'
                ? 'bg-[var(--accent)] text-white shadow-[var(--accent-glow)] -translate-y-0.5 border-transparent'
                : 'text-[var(--text-secondary)] bg-[var(--bg-surface)] border-[var(--border-default)]'
            }`}
          >
            🏈 NFL
          </button>
          <button
            onClick={() => {
              setSport('NHL');
              setStatCategory('xgf60');
            }}
            className={`px-6 py-3 text-base font-semibold rounded-xl cursor-pointer transition-all duration-300 border ${
              sport === 'NHL'
                ? 'bg-[var(--accent)] text-white shadow-[var(--accent-glow)] -translate-y-0.5 border-transparent'
                : 'text-[var(--text-secondary)] bg-[var(--bg-surface)] border-[var(--border-default)]'
            }`}
          >
            🏒 NHL
          </button>
        </div>

        <select
          value={statCategory}
          onChange={(e) => setStatCategory(e.target.value)}
          className="input-field min-w-[200px]"
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
          className="input-field flex-1 min-w-[200px]"
        />
      </div>

      {!loading && !error && statsData.length > 0 && topPerformers.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">🏆 Top Performers</h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-4 mb-2.5">
            {topPerformers.map((team, index) => {
              const teamName = String(team[getTableHeaders()[0]]);
              const statValue = team[getStatColumn()];
              const medal = getMedalIcon(index);

              return (
                <div
                  key={index}
                  className={`glass-card p-5 flex flex-col items-center gap-2 cursor-pointer ${
                    index === 0 ? 'bg-yellow-500/15 border-2 border-yellow-500/40 shadow-lg' : ''
                  }`}
                >
                  <div className="text-3xl mb-1">{medal}</div>
                  <div className="text-lg font-bold text-[var(--text-primary)] text-center">{teamName}</div>
                  <div className="text-3xl font-bold accent-gradient-text">
                    {typeof statValue === 'number'
                      ? statValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
                      : statValue}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                    {currentCategory?.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="glass-card min-h-[400px] overflow-hidden">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <div className="text-5xl mb-5 loading-spinner">⏳</div>
            <p className="text-[var(--text-secondary)] text-base">Loading statistics...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <div className="text-5xl mb-5">⚠️</div>
            <p className="text-[var(--danger)] text-base mb-5">{error}</p>
            <button onClick={loadStats} className="btn-accent">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && statsData.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <div className="text-5xl mb-5">📊</div>
            <p className="text-[var(--text-secondary)] text-base">No statistics available</p>
          </div>
        )}

        {!loading && !error && displayData.length === 0 && statsData.length > 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-5">
            <div className="text-5xl mb-5">🔍</div>
            <p className="text-[var(--text-secondary)] text-base">No teams match your search</p>
          </div>
        )}

        {!loading && !error && displayData.length > 0 && (
          <>
            <div className="px-6 py-5 border-b border-white/10 flex justify-between items-center flex-wrap gap-2.5">
              <div className="text-lg font-bold text-[var(--text-primary)]">
                📊 {currentCategory?.label} Rankings
              </div>
              <div className="text-sm text-[var(--text-muted)]">
                Showing {displayData.length} of {statsData.length} teams
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="p-4 text-left text-xs font-bold text-white bg-[var(--accent-muted)] border-b-2 border-[var(--accent)] sticky top-0 z-10 uppercase tracking-wider w-[60px] text-center">#</th>
                    {getTableHeaders().map((header, index) => (
                      <th
                        key={index}
                        className="p-4 text-left text-xs font-bold text-white bg-[var(--accent-muted)] border-b-2 border-[var(--accent)] sticky top-0 z-10 uppercase tracking-wider cursor-pointer hover:bg-[var(--accent)]/20 transition-colors"
                        onClick={() => handleSort(header)}
                      >
                        <div className="flex items-center gap-1">
                          {header}
                          {sortColumn === header && (
                            <span className="text-[10px] opacity-80">
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
                      className="transition-all duration-200 hover:bg-[var(--accent-muted)] hover:translate-x-1"
                    >
                      <td className="px-4 py-3.5 text-sm text-white/90 border-b border-white/5 text-center font-semibold">
                        <span className="text-base">
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
                            className={`px-4 py-3.5 text-sm text-white/90 border-b border-white/5 ${
                              colIndex === 0 ? 'font-semibold text-white' : ''
                            }`}
                            style={cellStyle || undefined}
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

      <div className="mt-6 p-6 glass-card">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">💡 How to Use These Stats</h3>
        </div>
        <ul className="m-0 pl-5 list-none space-y-2">
          <li className="text-sm text-[var(--text-secondary)] leading-relaxed">
            <strong>Search:</strong> Use the search bar to quickly find specific teams
          </li>
          <li className="text-sm text-[var(--text-secondary)] leading-relaxed">
            <strong>Sort:</strong> Click column headers to sort by any metric
          </li>
          <li className="text-sm text-[var(--text-secondary)] leading-relaxed">
            <strong>Color Coding:</strong> Green indicates top performers, yellow is average, red is below average
          </li>
          <li className="text-sm text-[var(--text-secondary)] leading-relaxed">
            <strong>Kelly Criterion:</strong> Use these statistics to inform your probability estimates when calculating optimal bet sizes
          </li>
        </ul>
      </div>
    </div>
  );
};
