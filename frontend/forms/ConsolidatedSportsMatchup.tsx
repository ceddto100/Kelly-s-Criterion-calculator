/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, Suspense, lazy } from 'react';

// Lazy load the individual matchup components
const SportsMatchup = lazy(() => import('./SportsMatchup'));
const NFLMatchup = lazy(() => import('./NFLMatchup'));
const NHLMatchup = lazy(() => import('./NHLMatchup'));

type SportType = 'NBA' | 'NFL' | 'NHL';

interface ConsolidatedSportsMatchupProps {
  onTransferToNBAEstimator?: (matchupData: any) => void;
  onTransferToNFLEstimator?: (matchupData: any) => void;
  onTransferToNHLEstimator?: (matchupData: any) => void;
}

export default function ConsolidatedSportsMatchup({
  onTransferToNBAEstimator,
  onTransferToNFLEstimator,
  onTransferToNHLEstimator,
}: ConsolidatedSportsMatchupProps) {
  const [activeSport, setActiveSport] = useState<SportType>('NBA');

  const sportOptions: { key: SportType; label: string; icon: string }[] = [
    { key: 'NBA', label: 'NBA', icon: '🏀' },
    { key: 'NFL', label: 'NFL', icon: '🏈' },
    { key: 'NHL', label: 'NHL', icon: '🏒' },
  ];

  return (
    <div style={{ width: '100%' }}>
      {/* Sport Toggle */}
      <div style={styles.sportToggleContainer}>
        <div style={styles.sportToggle}>
          {sportOptions.map((sport) => (
            <button
              key={sport.key}
              onClick={() => setActiveSport(sport.key)}
              style={{
                ...styles.sportButton,
                ...(activeSport === sport.key ? styles.sportButtonActive : {}),
              }}
            >
              <span style={styles.sportIcon}>{sport.icon}</span>
              <span>{sport.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sport-specific Matchup Component */}
      <Suspense
        fallback={
          <div style={styles.loadingContainer}>
            <span className="loading-spinner" style={{ marginRight: '.5rem' }}></span>
            Loading {activeSport} matchup data...
          </div>
        }
      >
        {activeSport === 'NBA' && (
          <SportsMatchup onTransferToEstimator={onTransferToNBAEstimator} />
        )}
        {activeSport === 'NFL' && (
          <NFLMatchup onTransferToEstimator={onTransferToNFLEstimator} />
        )}
        {activeSport === 'NHL' && (
          <NHLMatchup onTransferToEstimator={onTransferToNHLEstimator} />
        )}
      </Suspense>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  sportToggleContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  sportToggle: {
    display: 'flex',
    gap: '8px',
    padding: '4px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  sportButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'rgba(255, 255, 255, 0.7)',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  sportButtonActive: {
    background: 'var(--accent-gradient, linear-gradient(135deg, #a855f7 0%, #6366f1 100%))',
    color: 'white',
    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
  },
  sportIcon: {
    fontSize: '16px',
  },
  loadingContainer: {
    padding: '2rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
  },
};
