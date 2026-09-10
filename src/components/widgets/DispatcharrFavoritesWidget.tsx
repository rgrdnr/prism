'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import { vlcHref } from '@/lib/utils/vlc';

interface FavoriteChannel {
  id: string;
  channelName: string;
  channelNumber: string | null;
  logoUrl: string;
  watchUrl: string | null;
}

export interface DispatcharrFavoritesWidgetProps {
  className?: string;
}

// A wall-mounted display can sit idle for days — refresh occasionally so a
// favorite's watchUrl picks up an instance URL change made in dispatcharr-now
// meanwhile, on top of the refresh useVisibilityPolling already does when the
// tab regains visibility.
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export const DispatcharrFavoritesWidget = React.memo(function DispatcharrFavoritesWidget({
  className,
}: DispatcharrFavoritesWidgetProps) {
  const [favorites, setFavorites] = useState<FavoriteChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);

  const load = useCallback(() => {
    fetch('/api/dispatcharr-favorites')
      .then((r) => (r.ok ? r.json() : { favorites: [] }))
      .then((data) => {
        setFavorites(data.favorites ?? []);
        setServiceUnavailable(Boolean(data.serviceUnavailable));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(load, REFRESH_INTERVAL_MS);

  return (
    <WidgetContainer title="TV Favorites" icon={<Tv className="h-4 w-4" />} loading={loading} className={className}>
      {favorites.length === 0 ? (
        <WidgetEmpty
          icon={<Tv className="h-8 w-8" />}
          message="No favorite channels yet"
          action={
            <a href="/settings?section=dispatcharr" className="text-xs text-primary hover:underline">
              Add channels &rarr;
            </a>
          }
        />
      ) : (
        <div className="h-full overflow-y-auto -mr-2 pr-2">
          <div className="grid grid-cols-2 gap-2">
            {favorites.map((channel) => {
              const disabled = !channel.watchUrl;
              return (
                <a
                  key={channel.id}
                  href={channel.watchUrl ? vlcHref(channel.watchUrl) : undefined}
                  aria-disabled={disabled}
                  onClick={(e) => { if (disabled) e.preventDefault(); }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg p-2 bg-muted/50 hover:bg-muted transition-colors',
                    disabled && 'opacity-50 pointer-events-none'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={channel.logoUrl} alt="" className="h-8 w-8 rounded object-contain shrink-0" />
                  <span className="min-w-0">
                    <span className="text-xs font-medium truncate block">{channel.channelName}</span>
                    {channel.channelNumber && (
                      <span className="text-[10px] text-muted-foreground">Ch {channel.channelNumber}</span>
                    )}
                  </span>
                </a>
              );
            })}
          </div>
          {serviceUnavailable && (
            <p className="mt-2 text-[10px] text-muted-foreground text-center">
              Can&apos;t reach the TV service right now
            </p>
          )}
        </div>
      )}
    </WidgetContainer>
  );
});
