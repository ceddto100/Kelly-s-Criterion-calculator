/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kelly Criterion Widget Component
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { DisplayMode } from '../types/openai';

interface KellyData {
  bankroll: number;
  odds: number;
  probability: number;
  fraction: number;
  decimalOdds: number;
  stake: number;
  stakePercentage: number;
  hasValue: boolean;
  insight?: string;
}

interface KellyWidgetState {
  showDetails?: boolean;
  collapsed?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

export default function KellyWidget() {
  // 1. Access toolOutput
  const [data, setData] = useState<KellyData | null>(null);
  const [metaData, setMetaData] = useState<any>(null);

  // 2. Access widgetState for persistence
  const [showDetails, setShowDetails] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // 3. Access displayMode
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline');

  // 4. Access maxHeight
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    // 1. Get toolOutput (both structuredContent and _meta)
    const toolOutput = window.openai?.toolOutput;

    if (toolOutput) {
      // structuredContent fields are at top level
      setData(toolOutput as KellyData);

      // _meta fields are under _meta property
      if (toolOutput._meta) {
        setMetaData(toolOutput._meta);
      }
    } else {
      console.warn('No Kelly data found in toolOutput');
    }

    // 2. Restore widgetState
    const savedState = window.openai?.widgetState as KellyWidgetState | undefined;
    if (savedState) {
      if (typeof savedState.showDetails === 'boolean') {
        setShowDetails(savedState.showDetails);
      }
      if (typeof savedState.collapsed === 'boolean') {
        setCollapsed(savedState.collapsed);
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

  // Save state when it changes
  const handleToggleDetails = () => {
    const newShowDetails = !showDetails;
    setShowDetails(newShowDetails);

    window.openai?.setWidgetState?.({
      ...window.openai.widgetState,
      showDetails: newShowDetails
    });
  };

  const handleToggleCollapsed = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);

    window.openai?.setWidgetState?.({
      ...window.openai.widgetState,
      collapsed: newCollapsed
    });
  };

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

  if (!data) {
    return (
      <div className={`widget-container mode-${displayMode}`}>
        <p style={{ color: 'var(--widget-text-muted)' }}>Loading Kelly Criterion results...</p>
      </div>
    );
  }

  // PiP mode - minimal compact view
  if (displayMode === 'pip') {
    return (
      <div className={`widget-container mode-${displayMode}`} style={containerStyle}>
        <div className="pip-header">
          <h3>Kelly Calculator</h3>
        </div>
        <div className="results">
          {data.hasValue ? (
            <>
              <div className="result-label">Stake</div>
              <div className="result-large">{formatCurrency(data.stake)}</div>
              <div className="result-detail">{data.stakePercentage.toFixed(2)}%</div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--widget-danger)' }}>
              <strong>No Value</strong>
              <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Skip this bet</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Inline and Fullscreen modes - full featured view
  return (
    <div
      className={`widget-container mode-${displayMode} ${collapsed ? 'collapsed' : ''}`}
      style={containerStyle}
    >
      <div className={displayMode === 'inline' && maxHeight ? 'widget-scrollable' : ''}>
        {data.hasValue ? (
          <div className="results">
            <div className="result-label">Recommended Stake</div>
            <div className="result-large">{formatCurrency(data.stake)}</div>
            <div className="result-detail">
              {data.stakePercentage.toFixed(2)}% of your bankroll
            </div>

            {data.fraction < 1 && (
              <div className="result-detail" style={{ marginTop: '0.5rem' }}>
                Using {data.fraction === 0.5 ? 'Half' : 'Quarter'} Kelly ({data.fraction}x)
              </div>
            )}

            {showDetails && (
              <>
                <div className="input-summary">
                  <h3>Calculation Inputs</h3>
                  <div className="summary-grid">
                    <span className="summary-label">Bankroll:</span>
                    <span className="summary-value">{formatCurrency(data.bankroll)}</span>

                    <span className="summary-label">American Odds:</span>
                    <span className="summary-value">{data.odds > 0 ? '+' : ''}{data.odds}</span>

                    <span className="summary-label">Win Probability:</span>
                    <span className="summary-value">{data.probability.toFixed(2)}%</span>

                    <span className="summary-label">Decimal Odds:</span>
                    <span className="summary-value">{data.decimalOdds.toFixed(2)}</span>
                  </div>
                </div>

                {data.insight && (
                  <div className="insight-box">
                    <h3>Analyst Insight</h3>
                    <p>{data.insight}</p>
                  </div>
                )}

                {metaData && displayMode === 'fullscreen' && (
                  <div className="insight-box" style={{ marginTop: '1rem' }}>
                    <h3>Additional Information</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--widget-text-muted)' }}>
                      {JSON.stringify(metaData, null, 2)}
                    </p>
                  </div>
                )}
              </>
            )}

            {displayMode === 'inline' && (
              <button
                className="expand-button"
                onClick={handleToggleDetails}
                style={{ marginTop: '1rem' }}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>
        ) : (
          <div>
            <div className="no-value-warning">
              <h2>⚠️ No Value - Do Not Bet</h2>
              <p style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
                The Kelly Criterion indicates negative expected value for this bet.
                Protect your bankroll by skipping this opportunity.
              </p>
            </div>

            {showDetails && (
              <>
                <div className="input-summary">
                  <h3>Calculation Inputs</h3>
                  <div className="summary-grid">
                    <span className="summary-label">Bankroll:</span>
                    <span className="summary-value">{formatCurrency(data.bankroll)}</span>

                    <span className="summary-label">American Odds:</span>
                    <span className="summary-value">{data.odds > 0 ? '+' : ''}{data.odds}</span>

                    <span className="summary-label">Win Probability:</span>
                    <span className="summary-value">{data.probability.toFixed(2)}%</span>
                  </div>
                </div>

                {data.insight && (
                  <div className="insight-box">
                    <h3>Analyst Insight</h3>
                    <p>{data.insight}</p>
                  </div>
                )}
              </>
            )}

            {displayMode === 'inline' && (
              <button
                className="expand-button"
                onClick={handleToggleDetails}
                style={{ marginTop: '1rem' }}
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
