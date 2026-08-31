'use client';

import { useCallback, useMemo } from 'react';
import { useFetch } from './useFetch';

export interface WeeklyHabitCheck {
  date: string;
  checked: boolean;
}

export interface WeeklyHabit {
  id: string;
  label: string;
  sortOrder: number;
  checks: WeeklyHabitCheck[];
}

interface UseWeeklyHabitsOptions {
  from: string;
  to: string;
  enabled?: boolean;
}

function transformHabits(json: unknown): WeeklyHabit[] {
  const data = json as { habits: WeeklyHabit[] };
  return data.habits || [];
}

export function useWeeklyHabits({ from, to, enabled = true }: UseWeeklyHabitsOptions) {
  const url = `/api/weekly-habits?from=${from}&to=${to}`;

  const { data: habits, loading, error, refresh } = useFetch<WeeklyHabit[]>({
    url,
    initialData: [],
    transform: transformHabits,
    label: 'weekly-habits',
    enabled,
  });

  const isChecked = useCallback((habit: WeeklyHabit, date: string) => {
    return habit.checks.some((c) => c.date === date && c.checked);
  }, []);

  const addHabit = useCallback(async (label: string) => {
    try {
      await fetch('/api/weekly-habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, sortOrder: habits.length }),
      });
      await refresh();
    } catch (err) {
      console.error('Failed to add habit:', err);
    }
  }, [habits.length, refresh]);

  const removeHabit = useCallback(async (habitId: string) => {
    try {
      await fetch(`/api/weekly-habits/${habitId}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      console.error('Failed to remove habit:', err);
    }
  }, [refresh]);

  const renameHabit = useCallback(async (habitId: string, label: string) => {
    try {
      await fetch(`/api/weekly-habits/${habitId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      await refresh();
    } catch (err) {
      console.error('Failed to rename habit:', err);
    }
  }, [refresh]);

  const toggleCheck = useCallback(async (habitId: string, date: string, checked: boolean) => {
    try {
      await fetch(`/api/weekly-habits/${habitId}/check`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, checked }),
      });
      await refresh();
    } catch (err) {
      console.error('Failed to update habit check:', err);
    }
  }, [refresh]);

  const sortedHabits = useMemo(
    () => [...habits].sort((a, b) => a.sortOrder - b.sortOrder),
    [habits],
  );

  return {
    habits: sortedHabits,
    loading,
    error,
    isChecked,
    addHabit,
    removeHabit,
    renameHabit,
    toggleCheck,
    refresh,
  };
}
