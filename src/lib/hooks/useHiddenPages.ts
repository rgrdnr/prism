'use client';

import { useState, useCallback, useMemo } from 'react';
import { ALWAYS_VISIBLE_HREFS } from '@/lib/constants/navItems';
import type { NavItem } from '@/lib/constants/navItems';
import { LAN_ONLY_NAV_HREFS } from '@/lib/network/externalAccess';
import { useNetworkContext } from '@/lib/hooks/useNetworkContext';
import { useFetchOnMount } from './useFetchOnMount';
import { sharedGet } from '@/lib/utils/sharedGet';

const CACHE_KEY = 'prism:hidden-pages';

function readCachedHiddenPages(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch { return []; }
}

const DOCK_CACHE_KEY = 'prism-dock-pages';

function readCachedDockPages(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(DOCK_CACHE_KEY);
    const v = cached ? JSON.parse(cached) : null;
    return Array.isArray(v) ? v : null;
  } catch { return null; }
}

export function useHiddenPages() {
  const [hiddenPages, setHiddenPagesState] = useState<string[]>(readCachedHiddenPages);
  // The pages on the dock, in order (#925); null is the default six.
  const [dockPages, setDockPagesState] = useState<string[] | null>(readCachedDockPages);
  const [loaded, setLoaded] = useState(false);

  const fetchHiddenPages = useCallback(async () => {
    try {
      const res = await sharedGet('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const val = data.settings?.hiddenPages;
        if (Array.isArray(val)) {
          setHiddenPagesState(val);
          localStorage.setItem(CACHE_KEY, JSON.stringify(val));
        }
        const dock = data.settings?.dockPages;
        if (Array.isArray(dock)) {
          setDockPagesState(dock);
          localStorage.setItem(DOCK_CACHE_KEY, JSON.stringify(dock));
        }
      }
    } catch { /* ignore */ }
    setLoaded(true);
  }, []);

  useFetchOnMount(fetchHiddenPages);

  const setHiddenPages = useCallback(async (pages: string[]) => {
    setHiddenPagesState(pages);
    localStorage.setItem(CACHE_KEY, JSON.stringify(pages));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'hiddenPages', value: pages }),
      });
    } catch { /* ignore */ }
  }, []);

  const setDockPages = useCallback(async (pages: string[]) => {
    setDockPagesState(pages);
    localStorage.setItem(DOCK_CACHE_KEY, JSON.stringify(pages));
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'dockPages', value: pages }),
      });
    } catch { /* ignore */ }
  }, []);

  // Pages the household hid, plus — when reached from outside the home
  // network — pages that can't work there. The second set is never written
  // back to the setting: it describes where the caller is, not a preference.
  const { tvEnabled } = useNetworkContext();
  const hiddenSet = useMemo(() => {
    const set = new Set(hiddenPages);
    if (!tvEnabled) LAN_ONLY_NAV_HREFS.forEach((href) => set.add(href));
    return set;
  }, [hiddenPages, tvEnabled]);

  const filterNavItems = useCallback(
    (items: NavItem[]): NavItem[] =>
      items.filter(
        (item) => ALWAYS_VISIBLE_HREFS.has(item.href) || !hiddenSet.has(item.href)
      ),
    [hiddenSet]
  );

  const isPageHidden = useCallback(
    (href: string): boolean =>
      !ALWAYS_VISIBLE_HREFS.has(href) && hiddenSet.has(href),
    [hiddenSet]
  );

  return {
    hiddenPages,
    dockPages,
    setDockPages,
    loaded,
    setHiddenPages,
    filterNavItems,
    isPageHidden,
  };
}
