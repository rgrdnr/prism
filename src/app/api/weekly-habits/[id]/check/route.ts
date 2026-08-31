/**
 *
 * ENDPOINT: /api/weekly-habits/[id]/check
 * - PUT: Set (or clear) a habit's checked state for a specific date
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { weeklyHabits, weeklyHabitChecks } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { setWeeklyHabitCheckSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = validateRequest(setWeeklyHabitCheckSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const [habit] = await db
      .select({ id: weeklyHabits.id })
      .from(weeklyHabits)
      .where(eq(weeklyHabits.id, id));

    if (!habit) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    const { date, checked } = validation.data;

    if (!checked) {
      await db
        .delete(weeklyHabitChecks)
        .where(and(eq(weeklyHabitChecks.habitId, id), eq(weeklyHabitChecks.date, date)));
      await invalidateEntity('weekly-habits');
      return NextResponse.json({ habitId: id, date, checked: false });
    }

    await db
      .insert(weeklyHabitChecks)
      .values({ habitId: id, date, checked: true, checkedBy: auth.userId })
      .onConflictDoUpdate({
        target: [weeklyHabitChecks.habitId, weeklyHabitChecks.date],
        set: { checked: true, checkedBy: auth.userId },
      });

    await invalidateEntity('weekly-habits');

    return NextResponse.json({ habitId: id, date, checked: true });
  } catch (error) {
    logError('Failed to set weekly habit check:', error);
    return NextResponse.json({ error: 'Failed to update check' }, { status: 500 });
  }
}
