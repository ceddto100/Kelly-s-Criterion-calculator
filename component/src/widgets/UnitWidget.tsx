/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Unit Betting Widget Component
 */

import React, { useEffect, useState } from 'react';

interface UnitData {
  bankroll: number;
  unitSize: number;
  unitsToWager: number;
  calculatedUnitSize: number;
  recommendedStake: number;
}

declare global {
  interface Window {
    openai?: {
      toolOutput?: any;
    };
  }
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

export default function UnitWidget() {
  const [data, setData] = useState<UnitData | null>(null);

  useEffect(() => {
    // Access tool output from window.openai
    const toolOutput = window.openai?.toolOutput;

    if (toolOutput?.structuredContent) {
      setData(toolOutput.structuredContent);
    } else {
      console.warn('No unit betting data found in toolOutput');
    }
  }, []);

  if (!data) {
    return (
      <div className="widget-container">
        <p style={{ color: 'var(--widget-text-muted)' }}>Loading unit betting results...</p>
      </div>
    );
  }

  return (
    <div className="widget-container">
      <div className="results">
        <div className="result-label">Recommended Stake</div>
        <div className="result-large">{formatCurrency(data.recommendedStake)}</div>
        <div className="result-detail">
          {data.unitsToWager} unit{data.unitsToWager !== 1 ? 's' : ''} × {formatCurrency(data.calculatedUnitSize)} per unit
        </div>

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
      </div>
    </div>
  );
}
