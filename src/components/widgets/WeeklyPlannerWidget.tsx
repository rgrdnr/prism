'use client';

import * as React from 'react';
import { format, isSameDay, startOfDay } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { WeekItemCard } from '@/components/calendar/cells/WeekItemCard';
import { useWeekViewData } from '@/lib/hooks/useWeekViewData';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTimeRange } from '@/lib/utils/timeFormat';

// Matches OverlayItemsCell's / PlannerView's MEAL_FALLBACK_COLOR so a meal
// reads the same color here as it does on the Calendar and Planner pages
// when no one's cooking it yet.
const MEAL_FALLBACK_COLOR = '#10b981';

export interface WeeklyPlannerWidgetProps {
  className?: string;
  gridW?: number;
  gridH?: number;
}

export const WeeklyPlannerWidget = React.memo(function WeeklyPlannerWidget({
  className,
  gridH,
}: WeeklyPlannerWidgetProps) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const itemSize = !gridH || gridH < 10 ? 'sm' : 'md';

  // Days stack vertically and scroll, so unlike the old side-by-side layout
  // this doesn't need to shrink the day count to fit narrower widths —
  // always show a fixed 4-day rolling window.
  const { days, loading, error } = useWeekViewData({
    weekStart: today,
    weekStartsOn: 1,
    daysToShow: 4,
    alignToWeekStart: false,
  });

  const hasAnything = days.some((d) => d.meals.length > 0 || d.allDayEvents.length > 0 || d.timedEvents.length > 0);

  return (
    <WidgetContainer
      title="Weekly Planner"
      titleHref="/planner"
      icon={<CalendarDays className="h-4 w-4" />}
      size="large"
      loading={loading}
      error={error}
      className={className}
    >
      {!hasAnything ? (
        <WidgetEmpty
          icon={<CalendarDays className="h-8 w-8" />}
          message="Nothing planned for the next few days"
        />
      ) : (
        // Days stack vertically (one full-width row each) rather than side
        // by side — a narrow per-day column left titles and times truncated
        // with no room to actually read what's planned.
        <div className="h-full min-h-0 overflow-y-auto -mr-2 pr-2 space-y-3">
          {days.map((bucket) => {
            const isToday = isSameDay(bucket.date, today);
            // Highlights only, matching the full Planner page's default
            // view — a dashboard glance shouldn't be as busy as the full
            // calendar.
            const highlightEvents = [...bucket.allDayEvents, ...bucket.timedEvents].filter((e) => e.showOnPlanner);
            const isEmpty = bucket.meals.length === 0 && highlightEvents.length === 0;
            return (
              <div key={bucket.date.toISOString()} className={cn('space-y-1', isToday && 'rounded-lg bg-accent/30 p-2 -m-2')}>
                <div className="flex items-center gap-2">
                  <h4 className={cn('text-sm font-semibold capitalize', isToday && 'text-primary')}>
                    {bucket.dayOfWeek}
                  </h4>
                  <span className="text-xs text-muted-foreground">{format(bucket.date, 'MMM d')}</span>
                  {isToday && (
                    <span className="text-[10px] px-1.5 py-0 rounded-full bg-primary text-primary-foreground">Today</span>
                  )}
                </div>
                {isEmpty ? (
                  <div className="text-xs text-muted-foreground italic">Nothing planned</div>
                ) : (
                  <div className="space-y-1">
                    {bucket.meals.map((meal) => (
                      <WeekItemCard
                        key={meal.id}
                        variant="meal"
                        size={itemSize}
                        layout="row"
                        stripeColor={meal.cookedBy?.color || meal.createdBy?.color || MEAL_FALLBACK_COLOR}
                        title={meal.name}
                        timeLabel={meal.mealType}
                        muted={Boolean(meal.cookedAt)}
                      />
                    ))}
                    {highlightEvents.map((event) => (
                      <WeekItemCard
                        key={event.id}
                        variant="event"
                        size={itemSize}
                        layout="row"
                        stripeColor={event.color || '#3B82F6'}
                        title={event.title}
                        timeLabel={
                          event.allDay
                            ? undefined
                            : formatDisplayTimeRange(
                                event.startTime,
                                event.endTime ?? new Date(event.startTime.getTime() + 3600000),
                                timeFormat,
                                displayTimezone,
                              )
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </WidgetContainer>
  );
});
