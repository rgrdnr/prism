'use client';

import { useCallback, useMemo, useState } from 'react';
import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import { useWeekViewData } from '@/lib/hooks/useWeekViewData';
import { useCalendarFilter } from '@/lib/hooks/useCalendarFilter';
import { useWeeklyPlannerNotes } from '@/lib/hooks/useWeeklyPlannerNotes';
import { useWeeklyHabits } from '@/lib/hooks/useWeeklyHabits';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from '@/components/ui/use-toast';
import type { Meal } from '@/types';
import type { CalendarEvent } from '@/types/calendar';

// The paper planner this page mirrors is always laid out Monday -> Sunday,
// independent of the user's global "week starts on" display preference.
const PLANNER_WEEK_STARTS_ON = 1 as const;

export function usePlannerViewData() {
  const { requireAuth } = useAuth();
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();

  const today = useMemo(() => new Date(), []);

  // Days-to-show is a separate axis from "which week": at 7 days the display
  // window is the fixed Monday-Sunday week (matching the paper planner). At
  // 4 or 5 it's a rolling window that starts on today instead of Monday, so
  // switching down from 7 mid-week doesn't hide days already passed.
  const [daysToShow, setDaysToShowState] = useState<4 | 5 | 7>(7);

  const defaultAnchorFor = useCallback((count: 4 | 5 | 7) => (
    count === 7 ? startOfWeek(today, { weekStartsOn: PLANNER_WEEK_STARTS_ON }) : startOfDay(today)
  ), [today]);

  const [currentWeek, setCurrentWeek] = useState<Date>(() => defaultAnchorFor(7));

  const setDaysToShow = useCallback((count: 4 | 5 | 7) => {
    setDaysToShowState(count);
    setCurrentWeek(defaultAnchorFor(count));
  }, [defaultAnchorFor]);

  const goToPreviousWeek = useCallback(() => setCurrentWeek((prev) => addDays(prev, -daysToShow)), [daysToShow]);
  const goToNextWeek = useCallback(() => setCurrentWeek((prev) => addDays(prev, daysToShow)), [daysToShow]);
  const goToThisWeek = useCallback(() => setCurrentWeek(defaultAnchorFor(daysToShow)), [defaultAnchorFor, daysToShow]);
  const isCurrentWeek = format(currentWeek, 'yyyy-MM-dd') === format(defaultAnchorFor(daysToShow), 'yyyy-MM-dd');

  const { days, loading: daysLoading, refresh: refreshDays } = useWeekViewData({
    weekStart: currentWeek,
    weekStartsOn: PLANNER_WEEK_STARTS_ON,
    daysToShow,
    alignToWeekStart: daysToShow === 7,
  });

  // Goals/Notes/mini-calendars track the calendar week containing whatever's
  // currently displayed, always Monday-anchored and always the full 7 days —
  // independent of daysToShow, since a habit tracker for "half a week" isn't
  // a coherent thing. This also means the Add Meal modal always has a valid
  // full-week range to resolve any day-of-week name against.
  const goalsWeekStart = useMemo(
    () => startOfWeek(currentWeek, { weekStartsOn: PLANNER_WEEK_STARTS_ON }),
    [currentWeek],
  );
  const weekOfString = format(goalsWeekStart, 'yyyy-MM-dd');
  const weekEndString = format(addDays(goalsWeekStart, 6), 'yyyy-MM-dd');
  const goalsWeekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(goalsWeekStart, i)),
    [goalsWeekStart],
  );

  // Highlights-only by default: the Planner should be a clean weekly-at-a-glance
  // view, not the full calendar. "Show all" temporarily reveals every event
  // (dimmed) so the user can pick which ones to promote to highlights.
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Person/calendar filter, same mechanism the Calendar page uses. Applied
  // before the highlight filter, so e.g. "only Jordan" narrows the pool that
  // "highlights only" vs "show all" then further filters.
  const { selectedCalendarIds, toggleCalendar, filterEvents, calendarGroups } = useCalendarFilter();

  const toggleEventHighlight = useCallback(async (eventId: string, showOnPlanner: boolean) => {
    const user = await requireAuth('Update Planner highlight', 'Please log in to change what shows on the Weekly Planner');
    if (!user) return;
    try {
      await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showOnPlanner }),
      });
      await refreshDays();
    } catch (err) {
      console.error('Failed to update event highlight:', err);
    }
  }, [requireAuth, refreshDays]);

  const {
    note,
    loading: noteLoading,
    saving: noteSaving,
    saveNote,
  } = useWeeklyPlannerNotes({ weekOf: weekOfString });

  const {
    habits,
    loading: habitsLoading,
    isChecked,
    addHabit,
    removeHabit,
    toggleCheck: toggleHabitCheck,
  } = useWeeklyHabits({ from: weekOfString, to: weekEndString });

  const [showAddMeal, setShowAddMeal] = useState(false);
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [activeDay, setActiveDay] = useState<Date | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const openEditEvent = useCallback(async (event: CalendarEvent) => {
    const user = await requireAuth('Edit Event', 'Please log in to edit an event');
    if (!user) return;
    setEditingEvent(event);
  }, [requireAuth]);

  const openAddMeal = useCallback(async (day: Date) => {
    const user = await requireAuth('Add Meal', 'Please log in to add a meal');
    if (!user) return;
    setActiveDay(day);
    setShowAddMeal(true);
  }, [requireAuth]);

  const openAddEvent = useCallback(async (day: Date) => {
    const user = await requireAuth('Add Event', 'Please log in to add an event');
    if (!user) return;
    setActiveDay(day);
    setShowAddEvent(true);
  }, [requireAuth]);

  const addMeal = useCallback(async (meal: Record<string, unknown>) => {
    const user = await requireAuth("Who's planning this meal?");
    if (!user) return;
    try {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meal, createdBy: user.id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create meal');
      }
      await refreshDays();
    } catch (err) {
      console.error('Failed to add meal:', err);
      toast({ title: err instanceof Error ? err.message : 'Failed to add meal', variant: 'destructive' });
    }
  }, [requireAuth, refreshDays]);

  const editMeal = useCallback(async (mealId: string, updates: Partial<Meal>) => {
    try {
      await fetch(`/api/meals/${mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await refreshDays();
    } catch (err) {
      console.error('Failed to edit meal:', err);
    }
  }, [refreshDays]);

  const deleteMeal = useCallback(async (mealId: string) => {
    if (!await confirm('Delete this meal?', 'This will remove the meal from the planner.')) return;
    try {
      await fetch(`/api/meals/${mealId}`, { method: 'DELETE' });
      await refreshDays();
    } catch (err) {
      console.error('Failed to delete meal:', err);
    }
  }, [confirm, refreshDays]);

  const deleteEvent = useCallback(async (eventId: string) => {
    if (!await confirm('Delete this event?', 'This will remove the event from the calendar.')) return;
    try {
      await fetch(`/api/events/${eventId}`, { method: 'DELETE' });
      await refreshDays();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  }, [confirm, refreshDays]);

  return {
    today,
    currentWeek,
    weekOfString,
    weekEndString,
    goalsWeekDates,
    daysToShow,
    setDaysToShow,
    goToPreviousWeek,
    goToNextWeek,
    goToThisWeek,
    isCurrentWeek,
    days,
    daysLoading,
    refreshDays,
    showAllEvents,
    setShowAllEvents,
    toggleEventHighlight,
    calendarGroups,
    selectedCalendarIds,
    toggleCalendar,
    filterEvents,
    note,
    noteLoading,
    noteSaving,
    saveNote,
    habits,
    habitsLoading,
    isChecked,
    addHabit,
    removeHabit,
    toggleHabitCheck,
    showAddMeal,
    setShowAddMeal,
    showAddEvent,
    setShowAddEvent,
    activeDay,
    setActiveDay,
    editingMeal,
    setEditingMeal,
    editingEvent,
    setEditingEvent,
    openAddMeal,
    openAddEvent,
    openEditEvent,
    addMeal,
    editMeal,
    deleteMeal,
    deleteEvent,
    confirmDialogProps,
  };
}

export type { Meal };
