'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { NetworkContext } from '@/lib/network/externalAccess';

/**
 * Whether this browser is reaching Prism from outside the home network (see
 * src/lib/network/externalAccess.ts), shared across every component that asks.
 *
 * Until the first answer arrives it assumes the LAN. The wall display and
 * everything else at home is the common case and shouldn't flash its TV
 * controls away on every load; an external caller at worst sees them for a
 * moment, and the server refuses the routes regardless.
 *
 * Deliberately not persisted: a phone walks out of the house with the tab
 * open. It re-checks when the tab becomes visible again or the network
 * changes.
 */

const LAN_DEFAULT: NetworkContext = { external: false, tvEnabled: true };

let current: NetworkContext = LAN_DEFAULT;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function refresh(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = fetch('/api/context', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data: Partial<NetworkContext> | null) => {
      if (!data || typeof data.external !== 'boolean') return;
      const next: NetworkContext = { external: data.external, tvEnabled: data.tvEnabled !== false };
      if (next.external !== current.external || next.tvEnabled !== current.tvEnabled) {
        current = next;
        listeners.forEach((l) => l());
      }
    })
    .catch(() => { /* keep the last known answer */ })
    .finally(() => { inFlight = null; });
  return inFlight;
}

let windowListenersAttached = false;
function attachWindowListeners() {
  if (windowListenersAttached || typeof window === 'undefined') return;
  windowListenersAttached = true;
  const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', () => refresh());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const getSnapshot = () => current;
const getServerSnapshot = () => LAN_DEFAULT;

export function useNetworkContext(): NetworkContext {
  const ctx = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    attachWindowListeners();
    refresh();
  }, []);
  return ctx;
}

/** Test hook: reset module state between tests. */
export function __resetNetworkContextForTests() {
  current = LAN_DEFAULT;
  inFlight = null;
  listeners.clear();
}
