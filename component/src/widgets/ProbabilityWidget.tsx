/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Probability Estimator Widget Component
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { DisplayMode } from '../types/openai';

interface ProbabilityData {
  sport: 'football' | 'basketball';
  predictedMargin: number;
  spread: number;
  probability: number;
  teamStats: any;
  opponentStats: any;
}

interface ProbabilityWidgetState {
  showStats?: boolean;
  defaultBankroll?: number;
  defaultOdds?: number;
}

export default function ProbabilityWidget() {
  // 1. Access toolOutput
  const [data, setData] = useState<ProbabilityData | null>(null);
  const [metaData, setMetaData] = useState<any>(null);
  const [isCallingKelly, setIsCallingKelly] = useState(false);

  // 2. Access widgetState for persistence
  const [showStats, setShowStats] = useState(true);
  const [defaultBankroll, setDefaultBankroll] = useState(1000);
  const [defaultOdds, setDefaultOdds] = useState(-110);

  // 3. Access displayMode
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline');

  // 4. Access maxHeight
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    // 1. Get toolOutput (both structuredContent and _meta)
    const toolOutput = window.openai?.toolOutput;

    if (toolOutput) {
      // structuredContent fields are at top level
      setData(toolOutput as ProbabilityData);

      // _meta fields are under _meta property
      if (toolOutput._meta) {
        setMetaData(toolOutput._meta);
      }
    } else {
      console.warn('No probability data found in toolOutput');
    }

    // 2. Restore widgetState
    const savedState = window.openai?.widgetState as ProbabilityWidgetState | undefined;
    if (savedState) {
      if (typeof savedState.showStats === 'boolean') {
        setShowStats(savedState.showStats);
      }
      if (typeof savedState.defaultBankroll === 'number') {
        setDefaultBankroll(savedState.defaultBankroll);
      }
      if (typeof savedState.defaultOdds === 'number') {
        setDefaultOdds(savedState.defaultOdds);
      }
    }

    // 3. Get displayMode
    const mode = window.openai?.displayMode || 'inline';
    setDisplayMode(mode);

    // 4. Get maxHeight
    const height = window.openai?.maxHeight;
    if (height) {
      setMaxHeight(height);
    }
  }, []);

  // Calculate container style based on displayMode and maxHeight
  const containerStyle = useMemo(() => {
    const style: React.CSSProperties = {};

    if (displayMode === 'inline' && maxHeight) {
      style.maxHeight = `${maxHeight}px`;
      style.overflowY = 'auto';
    } else if (displayMode === 'fullscreen') {
      style.height = '100vh';
    } else if (displayMode === 'pip') {
      style.height = '300px';
      style.maxHeight = '300px';
    }

    return style;
  }, [displayMode, maxHeight]);

  // Save state when changed
  const handleToggleStats = () => {
    const newShowStats = !showStats;
    setShowStats(newShowStats);

    window.openai?.setWidgetState?.({
      ...window.openai.widgetState,
      showStats: newShowStats
    });
  };

  const handleUseInKelly = async () => {
    if (!data || !window.openai?.callTool) {
      console.warn('Cannot call Kelly tool: missing data or API');
      return;
    }

    setIsCallingKelly(true);
    try {
      // Call Kelly calculator with estimated probability
      await window.openai.callTool('kelly-calculate', {
        bankroll: defaultBankroll,
        odds: defaultOdds,
        probability: data.probability,
        fraction: '1'
      });

      // Save last used values
      window.openai?.setWidgetState?.({
        ...window.openai.widgetState,
        defaultBankroll,
        defaultOdds
      });
    } catch (error) {
      console.error('Error calling Kelly tool:', error);
    } finally {
      setIsCallingKelly(false);
    }
  };

  if (!data) {
    return (
      <div className={`widget-container mode-${displayMode}`}>
        <p style={{ color: 'var(--widget-text-muted)' }}>Loading probability estimation...</p>
      </div>
    );
  }

  const isFavorite = data.spread < 0;
  const spreadDisplay = data.spread > 0 ? `+${data.spread}` : data.spread.toString();
  const marginDisplay = data.predictedMargin > 0 ? `+${data.predictedMargin.toFixed(1)}` : data.predictedMargin.toFixed(1);

  // PiP mode - minimal compact view
  if (displayMode === 'pip') {
    return (
      <div className={`widget-container mode-${displayMode}`} style={containerStyle}>
        <div className="pip-header">
          <h3>Probability</h3>
        </div>
        <div className="results">
          <div className="result-label">{isFavorite ? 'Cover' : 'Upset'} Probability</div>
          <div className="result-percentage">{data.probability.toFixed(2)}%</div>
          <div className="result-detail" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            {data.sport === 'football' ? 'NFL' : 'NBA'} • Spread: {spreadDisplay}
          </div>
        </div>
      </div>
    );
  }

  // Inline and Fullscreen modes - full featured view
  return (
    <div
      className={`widget-container mode-${displayMode}`}
      style={containerStyle}
    >
      <div className={displayMode === 'inline' && maxHeight ? 'widget-scrollable' : ''}>
        <div className="results">
          <div className="result-label">
            Estimated {isFavorite ? 'Cover' : 'Upset'} Probability
          </div>
          <div className="result-percentage">{data.probability.toFixed(2)}%</div>

          <div className="summary-grid" style={{ marginTop: '1rem' }}>
            <span className="summary-label">Sport:</span>
            <span className="summary-value">{data.sport === 'football' ? 'Football' : 'Basketball'}</span>

            <span className="summary-label">Point Spread:</span>
            <span className="summary-value">{spreadDisplay}</span>

            <span className="summary-label">Predicted Margin:</span>
            <span className="summary-value">{marginDisplay} points</span>
          </div>

          {showStats && (
            <div className="input-summary">
              <h3>Team Statistics</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th style={{ textAlign: 'right' }}>Your Team</th>
                    <th style={{ textAlign: 'right' }}>Opponent</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Points For</td>
                    <td style={{ textAlign: 'right' }}>{data.teamStats.pointsFor.toFixed(1)}</td>
                    <td style={{ textAlign: 'right' }}>{data.opponentStats.pointsFor.toFixed(1)}</td>
                  </tr>
                  <tr>
                    <td>Points Against</td>
                    <td style={{ textAlign: 'right' }}>{data.teamStats.pointsAgainst.toFixed(1)}</td>
                    <td style={{ textAlign: 'right' }}>{data.opponentStats.pointsAgainst.toFixed(1)}</td>
                  </tr>
                  {data.sport === 'football' ? (
                    <>
                      <tr>
                        <td>Off. Yards</td>
                        <td style={{ textAlign: 'right' }}>{data.teamStats.offYards.toFixed(0)}</td>
                        <td style={{ textAlign: 'right' }}>{data.opponentStats.offYards.toFixed(0)}</td>
                      </tr>
                      <tr>
                        <td>Def. Yards</td>
                        <td style={{ textAlign: 'right' }}>{data.teamStats.defYards.toFixed(0)}</td>
                        <td style={{ textAlign: 'right' }}>{data.opponentStats.defYards.toFixed(0)}</td>
                      </tr>
                      <tr>
                        <td>Turnover Diff</td>
                        <td style={{ textAlign: 'right' }}>{data.teamStats.turnoverDiff > 0 ? '+' : ''}{data.teamStats.turnoverDiff.toFixed(1)}</td>
                        <td style={{ textAlign: 'right' }}>{data.opponentStats.turnoverDiff > 0 ? '+' : ''}{data.opponentStats.turnoverDiff.toFixed(1)}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <td>FG%</td>
                        <td style={{ textAlign: 'right' }}>{(data.teamStats.fgPct * 100).toFixed(1)}%</td>
                        <td style={{ textAlign: 'right' }}>{(data.opponentStats.fgPct * 100).toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td>Rebound Margin</td>
                        <td style={{ textAlign: 'right' }}>{data.teamStats.reboundMargin > 0 ? '+' : ''}{data.teamStats.reboundMargin.toFixed(1)}</td>
                        <td style={{ textAlign: 'right' }}>{data.opponentStats.reboundMargin > 0 ? '+' : ''}{data.opponentStats.reboundMargin.toFixed(1)}</td>
                      </tr>
                      <tr>
                        <td>Turnover Margin</td>
                        <td style={{ textAlign: 'right' }}>{data.teamStats.turnoverMargin > 0 ? '+' : ''}{data.teamStats.turnoverMargin.toFixed(1)}</td>
                        <td style={{ textAlign: 'right' }}>{data.opponentStats.turnoverMargin > 0 ? '+' : ''}{data.opponentStats.turnoverMargin.toFixed(1)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {displayMode === 'inline' && (
            <button
              className="expand-button"
              onClick={handleToggleStats}
              style={{ marginTop: '1rem' }}
            >
              {showStats ? 'Hide Stats' : 'Show Stats'}
            </button>
          )}

          {window.openai?.callTool && (
            <button
              className="action-button"
              onClick={handleUseInKelly}
              disabled={isCallingKelly}
            >
              {isCallingKelly ? 'Calculating...' : `Use ${data.probability.toFixed(2)}% in Kelly Calculator`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
