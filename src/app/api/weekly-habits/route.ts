/**
 *
 * ENDPOINT: /api/weekly-habits
 * - GET:  List active habits with their checks in a date range
 * - POST: Create a new habit
 *
 * QUERY PARAMETERS (GET):
 * - from: Start date (YYYY-MM-DD)
 * - to:   End date (YYYY-MM-DD)
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { weeklyHabits, weeklyHabitChecks } from '@/lib/db/schema';
import { eq, and, gte, lte, asc, inArray } from 'drizzle-orm';
import { createWeeklyHabitSchema, validateRequest } from '@/lib/validations';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/weekly-habits?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ habits: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json(
        { error: 'from and to query parameters (YYYY-MM-DD) are required' },
        { status: 400 }
      );
    }

    const cacheKey = `weekly-habits:${from}:${to}`;

    const data = await getCached(cacheKey, async () => {
      const habitRows = await db
        .select({
          id: weeklyHabits.id,
          label: weeklyHabits.label,
          sortOrder: weeklyHabits.sortOrder,
        })
        .from(weeklyHabits)
        .where(eq(weeklyHabits.archived, false))
        .orderBy(asc(weeklyHabits.sortOrder));

      const habitIds = habitRows.map((h) => h.id);
      const checkRows = habitIds.length
        ? await db
            .select({
              habitId: weeklyHabitChecks.habitId,
              date: weeklyHabitChecks.date,
              checked: weeklyHabitChecks.checked,
            })
            .from(weeklyHabitChecks)
            .where(
              and(
                inArray(weeklyHabitChecks.habitId, habitIds),
                gte(weeklyHabitChecks.date, from),
                lte(weeklyHabitChecks.date, to)
              )
            )
        : [];

      const habits = habitRows.map((habit) => ({
        ...habit,
        checks: checkRows
          .filter((c) => c.habitId === habit.id)
          .map((c) => ({ date: c.date, checked: c.checked })),
      }));

      return { habits };
    });

    return NextResponse.json(data);
  } catch (error) {
    logError('Failed to fetch weekly habits:', error);
    return NextResponse.json({ error: 'Failed to fetch habits' }, { status: 500 });
  }
}

/**
 * POST /api/weekly-habits
 * Creates a new habit.
 */
export async function POST(request: NextRequest) {
  return withAuth(async (auth) => {
    try {
      const body = await request.json();
      const validation = validateRequest(createWeeklyHabitSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const [habit] = await db
        .insert(weeklyHabits)
        .values({
          label: validation.data.label,
          sortOrder: validation.data.sortOrder,
          createdBy: auth.userId,
        })
        .returning();

      await invalidateEntity('weekly-habits');

      return NextResponse.json({ habit: { ...habit, checks: [] } }, { status: 201 });
    } catch (error) {
      logError('Failed to create weekly habit:', error);
      return NextResponse.json({ error: 'Failed to create habit' }, { status: 500 });
    }
  }, { rateLimit: { feature: 'weekly-habits', limit: 30, windowSeconds: 60 } });
}
