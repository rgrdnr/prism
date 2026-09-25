'use client';

import { RefreshCw, Tv } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { SubpageHeader } from '@/components/layout/SubpageHeader';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, formatDisplayTimeRange } from '@/lib/utils/timeFormat';
import { launchHref } from '@/lib/utils/vlc';
import { useTvGuide, type GuideChannel } from './useTvGuide';

/** 0–1 of how far through a programme `now` is. */
function progressOf(start: string, end: string, now: number): number {
  const s = Date.parse(start);
  const e = Date.parse(end);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  return Math.min(1, Math.max(0, (now - s) / (e - s)));
}

function ChannelCard({ channel, now }: { channel: GuideChannel; now: number }) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const { current, next } = channel;
  const disabled = !channel.watchUrl;

  return (
    <a
      href={channel.watchUrl ? launchHref(channel.watchUrl, channel.channelName) : undefined}
      aria-disabled={disabled}
      onClick={(e) => {
        if (disabled) e.preventDefault();
      }}
      className={cn(
        'flex gap-3 rounded-lg border border-border bg-card/85 p-3 transition-colors hover:bg-muted/60',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={channel.logoUrl} alt="" className="h-12 w-12 rounded object-contain" />
        {channel.channelNumber && (
          <span className="text-[10px] text-muted-foreground">Ch {channel.channelNumber}</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-muted-foreground">{channel.channelName}</div>

        {current ? (
          <>
            <div className="truncate text-sm font-semibold">{current.title}</div>
            <div className="text-xs text-muted-foreground">
              {formatDisplayTimeRange(new Date(current.start), new Date(current.end), timeFormat, displayTimezone)}
            </div>
            <div
              className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressOf(current.start, current.end, now) * 100)}
              aria-label="Programme progress"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${progressOf(current.start, current.end, now) * 100}%` }}
              />
            </div>
            {current.description && (
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{current.description}</p>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground">No guide data</div>
        )}

        {next && (
          <div className="mt-1.5 truncate text-xs">
            <span className="text-muted-foreground">
              Next · {formatDisplayTime(new Date(next.start), timeFormat, {}, displayTimezone)}
            </span>{' '}
            <span className="font-medium">{next.title}</span>
          </div>
        )}
      </div>
    </a>
  );
}

export function TvGuideView() {
  const { channels, loading, serviceUnavailable, now, refresh } = useTvGuide();

  return (
    <PageWrapper>
      <div className="flex h-screen flex-col">
        <SubpageHeader
          icon={<Tv className="h-5 w-5" />}
          title="TV Guide"
          actions={
            <Button variant="ghost" size="icon" onClick={() => refresh()} aria-label="Refresh guide">
              <RefreshCw className="h-4 w-4" />
            </Button>
          }
        />

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
          ) : channels.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Tv className="h-8 w-8" />
              <p className="text-sm">No favorite channels yet</p>
              <a href="/settings?section=dispatcharr" className="text-xs text-primary hover:underline">
                Add channels &rarr;
              </a>
            </div>
          ) : (
            <>
              {serviceUnavailable && (
                <p className="mb-3 text-center text-xs text-muted-foreground">
                  Can&apos;t reach the TV service right now
                </p>
              )}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {channels.map((channel) => (
                  <ChannelCard key={channel.id} channel={channel} now={now} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
