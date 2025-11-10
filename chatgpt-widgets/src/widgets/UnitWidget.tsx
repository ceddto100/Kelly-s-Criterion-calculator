/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit Betting Widget Component
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { DisplayMode } from '../types/openai';
import LoadingState from './LoadingState';

interface UnitData {
  bankroll: number;
  unitSize: number;
  unitsToWager: number;
  calculatedUnitSize: number;
  recommendedStake: number;
}

interface UnitWidgetState {
  showDetails?: boolean;
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

export default function UnitWidget() {
  // 1. Access toolOutput
  const [data, setData] = useState<UnitData | null>(null);
  const [metaData, setMetaData] = useState<any>(null);

  // 2. Access widgetState for persistence
  const [showDetails, setShowDetails] = useState(true);

  // 3. Access displayMode
  const [displayMode, setDisplayMode] = useState<DisplayMode>('inline');

  // 4. Access maxHeight
  const [maxHeight, setMaxHeight] = useState<number | null>(null);

  useEffect(() => {
    // 1. Get toolOutput (both structuredContent and _meta)
    const toolOutput = window.openai?.toolOutput;

    if (toolOutput) {
      // structuredContent fields are at top level
      setData(toolOutput as UnitData);

      // _meta fields are under _meta property
      if (toolOutput._meta) {
        setMetaData(toolOutput._meta);
      }
    } else {
      console.warn('No unit betting data found in toolOutput');
    }

    // 2. Restore widgetState
    const savedState = window.openai?.widgetState as UnitWidgetState | undefined;
    if (savedState) {
      if (typeof savedState.showDetails === 'boolean') {
        setShowDetails(savedState.showDetails);
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
    return <LoadingState message="Loading calculator results..." />;
  }

  // PiP mode - minimal compact view
  if (displayMode === 'pip') {
    return (
      <div className={`widget-container mode-${displayMode}`} style={containerStyle}>
        <div className="pip-header">
          <h3>Unit Betting</h3>
        </div>
        <div className="results">
          <div className="result-label">Stake</div>
          <div className="result-large">{formatCurrency(data.recommendedStake)}</div>
          <div className="result-detail" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            {data.unitsToWager} unit{data.unitsToWager !== 1 ? 's' : ''}
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
          <div className="result-label">Recommended Stake</div>
          <div className="result-large">{formatCurrency(data.recommendedStake)}</div>
          <div className="result-detail">
            {data.unitsToWager} unit{data.unitsToWager !== 1 ? 's' : ''} × {formatCurrency(data.calculatedUnitSize)} per unit
          </div>

          {showDetails && (
            <>
              <div className="input-summary">
                <h3>Calculation Details</h3>
                <div className="summary-grid">
                  <span className="summary-label">Bankroll:</span>
                  <span className="summary-value">{formatCurrency(data.bankroll)}</span>

                  <span className="summary-label">Unit Size:</span>
                  <span className="summary-value">{data.unitSize}%</span>

                  <span className="summary-label">Calculated Unit:</span>
                  <span className="summary-value">{formatCurrency(data.calculatedUnitSize)}</span>

                  <span className="summary-label">Units to Wager:</span>
                  <span className="summary-value">{data.unitsToWager}</span>
                </div>
              </div>

              <div className="insight-box">
                <h3>About Unit Betting</h3>
                <p>
                  Unit betting is a simpler alternative to Kelly Criterion. It involves betting a consistent
                  percentage of your bankroll based on your confidence level, rather than optimizing for
                  mathematical edge.
                </p>
              </div>
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
      </div>
    </div>
  );
}
