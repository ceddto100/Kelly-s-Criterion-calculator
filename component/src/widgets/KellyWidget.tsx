/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Kelly Criterion Widget Component
 */

import React, { useEffect, useState } from 'react';

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

export default function KellyWidget() {
  const [data, setData] = useState<KellyData | null>(null);

  useEffect(() => {
    // Access tool output from window.openai
    const toolOutput = window.openai?.toolOutput;

    if (toolOutput?.structuredContent) {
      setData(toolOutput.structuredContent);
    } else {
      console.warn('No Kelly data found in toolOutput');
    }
  }, []);

  if (!data) {
    return (
      <div className="widget-container">
        <p style={{ color: 'var(--widget-text-muted)' }}>Loading Kelly Criterion results...</p>
      </div>
    );
  }

  return (
    <div className="widget-container">
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
        </div>
      )}
    </div>
  );
}
