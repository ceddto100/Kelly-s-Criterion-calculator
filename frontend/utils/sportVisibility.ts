/**
 * Sport visibility
 * ================
 * The admin can hide whole sports app-wide (e.g. MLB once its season ends)
 * from the Promo page. The list lives on the backend (/api/settings) and is
 * shared here through a tiny external store so every screen stays in sync.
 */
import { useSyncExternalStore } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

export type ManagedSport = 'NBA' | 'NFL' | 'MLB' | 'NHL' | 'CFB';

export const MANAGED_SPORTS: { key: ManagedSport; label: string; icon: string }[] = [
  { key: 'NBA', label: 'NBA', icon: '🏀' },
  { key: 'NFL', label: 'NFL', icon: '🏈' },
  { key: 'MLB', label: 'MLB', icon: '⚾' },
  { key: 'NHL', label: 'NHL', icon: '🏒' },
  { key: 'CFB', label: 'College Football', icon: '🎓' },
];

let hiddenSports: ManagedSport[] = [];
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setHiddenSportsLocal(next: ManagedSport[]) {
  hiddenSports = [...next];
  loaded = true;
  emit();
}

export function loadHiddenSports(force = false): Promise<void> {
  if (inflight) return inflight;
  if (loaded && !force) return Promise.resolve();
  inflight = fetch(`${BACKEND_URL}/api/settings`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && Array.isArray(data.hiddenSports)) setHiddenSportsLocal(data.hiddenSports);
    })
    .catch(() => {
      // Network/backend issue: fail open and keep showing every sport.
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function saveHiddenSports(next: ManagedSport[]): Promise<ManagedSport[]> {
  const response = await fetch(`${BACKEND_URL}/api/settings/hidden-sports`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hiddenSports: next }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || 'Unable to save sport visibility');
  setHiddenSportsLocal(data.hiddenSports);
  return data.hiddenSports;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void loadHiddenSports();
  return () => listeners.delete(listener);
}

const getSnapshot = () => hiddenSports;

/** Reactive list of sports the admin has hidden. */
export function useHiddenSports(): ManagedSport[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Returns a predicate: isVisible('MLB') -> false when MLB is hidden. */
export function useSportVisible(): (sport: ManagedSport) => boolean {
  const hidden = useHiddenSports();
  return (sport) => !hidden.includes(sport);
}
