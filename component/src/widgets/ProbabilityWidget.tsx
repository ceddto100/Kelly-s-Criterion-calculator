/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Probability Estimator Widget Component
 */

import React, { useEffect, useState } from 'react';

interface ProbabilityData {
  sport: 'football' | 'basketball';
  predictedMargin: number;
  spread: number;
  probability: number;
  teamStats: any;
  opponentStats: any;
}

declare global {
  interface Window {
    openai?: {
      toolOutput?: any;
      callTool?: (toolName: string, params: any) => Promise<any>;
    };
  }
}

export default function ProbabilityWidget() {
  const [data, setData] = useState<ProbabilityData | null>(null);
  const [isCallingKelly, setIsCallingKelly] = useState(false);

  useEffect(() => {
    // Access tool output from window.openai
    const toolOutput = window.openai?.toolOutput;

    if (toolOutput?.structuredContent) {
      setData(toolOutput.structuredContent);
    } else {
      console.warn('No probability data found in toolOutput');
    }
  }, []);

  const handleUseInKelly = async () => {
    if (!data || !window.openai?.callTool) {
      console.warn('Cannot call Kelly tool: missing data or API');
      return;
    }

    setIsCallingKelly(true);
    try {
      // Call Kelly calculator with estimated probability
      await window.openai.callTool('kelly-calculate', {
        bankroll: 1000, // Default bankroll
        odds: -110, // Default odds
        probability: data.probability,
        fraction: '1'
      });
    } catch (error) {
      console.error('Error calling Kelly tool:', error);
    } finally {
      setIsCallingKelly(false);
    }
  };

  if (!data) {
    return (
      <div className="widget-container">
        <p style={{ color: 'var(--widget-text-muted)' }}>Loading probability estimation...</p>
      </div>
    );
  }

  const isFavorite = data.spread < 0;
  const spreadDisplay = data.spread > 0 ? `+${data.spread}` : data.spread.toString();
  const marginDisplay = data.predictedMargin > 0 ? `+${data.predictedMargin.toFixed(1)}` : data.predictedMargin.toFixed(1);

  return (
    <div className="widget-container">
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
  );
}
