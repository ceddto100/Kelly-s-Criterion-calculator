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
    <div className="w-full">
      {/* Sport Toggle */}
      <div className="flex justify-center mb-4">
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
          {sportOptions.map((sport) => (
            <button
              key={sport.key}
              onClick={() => setActiveSport(sport.key)}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold border-none rounded-lg cursor-pointer transition-all duration-200 ${
                activeSport === sport.key
                  ? 'bg-[var(--accent)] text-white shadow-[var(--accent-glow)]'
                  : 'text-white/70 bg-transparent'
              }`}
            >
              <span className="text-base">{sport.icon}</span>
              <span>{sport.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Sport-specific Matchup Component */}
      <Suspense
        fallback={
          <div className="p-8 text-center text-[var(--text-muted)]">
            <span className="loading-spinner mr-2"></span>
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
