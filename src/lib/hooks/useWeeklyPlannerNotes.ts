'use client';

import { useCallback, useState } from 'react';
import { useFetch } from './useFetch';

export interface WeeklyPlannerNote {
  id: string;
  weekOf: string;
  content: string;
  updatedAt: string;
}

interface UseWeeklyPlannerNotesOptions {
  weekOf: string;
  enabled?: boolean;
}

function transformNote(json: unknown): WeeklyPlannerNote | null {
  const data = json as { note: WeeklyPlannerNote | null };
  return data.note ?? null;
}

export function useWeeklyPlannerNotes({ weekOf, enabled = true }: UseWeeklyPlannerNotesOptions) {
  const url = `/api/weekly-planner-notes?weekOf=${weekOf}`;

  const { data: note, loading, error, refresh } = useFetch<WeeklyPlannerNote | null>({
    url,
    initialData: null,
    transform: transformNote,
    label: 'weekly-planner-notes',
    enabled,
  });

  const [saving, setSaving] = useState(false);

  const saveNote = useCallback(async (content: string) => {
    setSaving(true);
    try {
      await fetch('/api/weekly-planner-notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekOf, content }),
      });
      await refresh();
    } catch (err) {
      console.error('Failed to save weekly planner note:', err);
    } finally {
      setSaving(false);
    }
  }, [weekOf, refresh]);

  return { note, loading, error, saving, saveNote, refresh };
}
