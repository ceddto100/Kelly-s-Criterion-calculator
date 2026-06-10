/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StatsFreshness
 * ==============
 * Small inline badge showing how current the season-stat CSVs are (the data
 * that feeds the NBA/NFL/NHL projection equations). Reads the manifest written
 * by the stats updater (scripts/writeStatsManifest.js) at /stats/last_updated.json.
 * Turns amber/red when the data is stale so users — and you — can see at a glance
 * that the updater needs attention. MLB is fetched live, so it isn't shown here.
 */
import React, { useEffect, useState } from 'react';

interface Manifest {
  updatedAt?: string;
  sports?: Record<string, string>;
  mlb?: string;
}

type SportKey = 'NBA' | 'NFL' | 'NHL';

const STALE_HOURS = 48;

function describe(iso?: string): { text: string; hours: number } {
  if (!iso) return { text: 'never', hours: Infinity };
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { text: 'unknown', hours: Infinity };
  const hours = (Date.now() - t) / 36e5;
  if (hours < 1) return { text: 'just now', hours };
  if (hours < 24) return { text: `${Math.round(hours)}h ago`, hours };
  const days = Math.round(hours / 24);
  return { text: `${days} day${days === 1 ? '' : 's'} ago`, hours };
}

// Module-level cache so switching sport tabs doesn't refetch the manifest.
let cached: Manifest | null | undefined;

export default function StatsFreshness({ sportKey }: { sportKey?: SportKey }) {
  const [manifest, setManifest] = useState<Manifest | null>(cached ?? null);

  useEffect(() => {
    if (cached !== undefined) return;
    let alive = true;
    fetch('/stats/last_updated.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Manifest | null) => {
        cached = d;
        if (alive) setManifest(d);
      })
      .catch(() => {
        cached = null;
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!manifest) return null;

  const iso = sportKey ? manifest.sports?.[sportKey] : manifest.updatedAt;
  const { text, hours } = describe(iso);
  const stale = hours > STALE_HOURS;

  return (
    <div style={{ ...styles.wrap, ...(stale ? styles.stale : {}) }} title="When the team season-stat data was last refreshed">
      <span>
        📊 Team stats updated: <strong>{text}</strong>
      </span>
      {stale && <span style={styles.badge}>may be outdated</span>}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  wrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10,
    padding: '0.45rem 0.7rem',
    margin: '0 0 1rem',
  },
  stale: {
    color: '#fcd34d',
    background: 'rgba(245,158,11,0.10)',
    borderColor: 'rgba(245,158,11,0.35)',
  },
  badge: {
    fontWeight: 700,
    fontSize: '0.7rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    color: '#0b1020',
    background: '#fcd34d',
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
  },
};
