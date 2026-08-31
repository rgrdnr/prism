'use client';

import { useCallback, useMemo, useState } from 'react';
import { addDays, format, startOfWeek } from 'date-fns';
import { useWeekViewData } from '@/lib/hooks/useWeekViewData';
import { useWeeklyPlannerNotes } from '@/lib/hooks/useWeeklyPlannerNotes';
import { useWeeklyHabits } from '@/lib/hooks/useWeeklyHabits';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from '@/components/ui/use-toast';
import type { Meal } from '@/types';

// The paper planner this page mirrors is always laid out Monday -> Sunday,
// independent of the user's global "week starts on" display preference.
const PLANNER_WEEK_STARTS_ON = 1 as const;

export function usePlannerViewData() {
  const { requireAuth } = useAuth();
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();

  const today = useMemo(() => new Date(), []);
  const defaultWeekStart = useMemo(
    () => startOfWeek(today, { weekStartsOn: PLANNER_WEEK_STARTS_ON }),
    [today],
  );
  const [currentWeek, setCurrentWeek] = useState<Date>(defaultWeekStart);
  const weekOfString = format(currentWeek, 'yyyy-MM-dd');
  const weekEndString = format(addDays(currentWeek, 6), 'yyyy-MM-dd');

  const goToPreviousWeek = useCallback(() => setCurrentWeek((prev) => addDays(prev, -7)), []);
  const goToNextWeek = useCallback(() => setCurrentWeek((prev) => addDays(prev, 7)), []);
  const goToThisWeek = useCallback(() => setCurrentWeek(defaultWeekStart), [defaultWeekStart]);
  const isCurrentWeek = weekOfString === format(defaultWeekStart, 'yyyy-MM-dd');

  const { days, loading: daysLoading, refresh: refreshDays } = useWeekViewData({
    weekStart: currentWeek,
    weekStartsOn: PLANNER_WEEK_STARTS_ON,
  });

  // Highlights-only by default: the Planner should be a clean weekly-at-a-glance
  // view, not the full calendar. "Show all" temporarily reveals every event
  // (dimmed) so the user can pick which ones to promote to highlights.
  const [showAllEvents, setShowAllEvents] = useState(false);

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
    openAddMeal,
    openAddEvent,
    addMeal,
    editMeal,
    deleteMeal,
    deleteEvent,
    confirmDialogProps,
  };
}

export type { Meal };
