'use client';

import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { DAYS_SINGLE_ARRAY } from '@/lib/constants/days';

/** A plain reference calendar (no events) — matches the small "at a glance" months on a paper planner. */
export function MiniMonth({ month, today }: { month: Date; today: Date }) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d);

  return (
    <div className="flex-1 min-w-[180px]">
      <div className="text-center text-sm font-semibold mb-1">{format(month, 'MMMM yyyy')}</div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {DAYS_SINGLE_ARRAY.map((label, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-muted-foreground">
            {label}
          </div>
        ))}
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              'text-center text-xs py-0.5 rounded-full',
              !isSameMonth(day, month) && 'text-muted-foreground/40',
              isSameDay(day, today) && 'bg-primary text-primary-foreground font-semibold',
            )}
          >
            {format(day, 'd')}
          </div>
        ))}
      </div>
    </div>
  );
}
