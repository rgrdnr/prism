'use client';

import { useCallback, useEffect, useState } from 'react';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';

export interface GuideProgram {
  title: string;
  description: string | null;
  /** ISO timestamps */
  start: string;
  end: string;
}

export interface GuideChannel {
  id: string;
  channelName: string;
  channelNumber: string | null;
  logoUrl: string;
  watchUrl: string | null;
  current: GuideProgram | null;
  next: GuideProgram | null;
}

interface FavoriteRow {
  id: string;
  channelName: string;
  channelNumber: string | null;
  logoUrl: string;
  watchUrl: string | null;
}

interface FavoritePrograms {
  current: GuideProgram | null;
  next: GuideProgram | null;
}

/**
 * Guide slots run 30+ minutes, and a slot ending triggers its own refetch
 * below, so this only has to catch schedule changes.
 */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** How often to re-evaluate progress bars and notice a programme has ended. */
const TICK_MS = 30 * 1000;

export function useTvGuide() {
  const [channels, setChannels] = useState<GuideChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const [favRes, epgRes] = await Promise.all([
        fetch('/api/dispatcharr-favorites'),
        fetch('/api/dispatcharr-favorites/epg'),
      ]);
      const favData: { favorites?: FavoriteRow[]; serviceUnavailable?: boolean } = favRes.ok
        ? await favRes.json()
        : {};
      const epgData: { programs?: Record<string, FavoritePrograms>; serviceUnavailable?: boolean } = epgRes.ok
        ? await epgRes.json()
        : {};

      const programs = epgData.programs ?? {};
      setChannels(
        (favData.favorites ?? []).map((f) => ({
          ...f,
          current: programs[f.id]?.current ?? null,
          next: programs[f.id]?.next ?? null,
        }))
      );
      setServiceUnavailable(Boolean(favData.serviceUnavailable || epgData.serviceUnavailable || !epgRes.ok));
      setNow(Date.now());
    } catch {
      // Keep whatever is already on screen; the next poll will try again.
      setServiceUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useVisibilityPolling(load, REFRESH_INTERVAL_MS);

  // Drive the progress bars, and refetch as soon as any "now playing" slot ends
  // rather than showing a finished programme until the next scheduled poll.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const anyEnded = channels.some((c) => c.current && Date.parse(c.current.end) <= now);
  useEffect(() => {
    if (anyEnded) load();
  }, [anyEnded, load]);

  return { channels, loading, serviceUnavailable, now, refresh: load };
}
