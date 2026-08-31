/**
 *
 * ENDPOINT: /api/weekly-planner-notes
 * - GET: Get the freeform notes for a given week
 * - PUT: Upsert the notes for a given week
 *
 * QUERY PARAMETERS (GET):
 * - weekOf: Week start date (YYYY-MM-DD)
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { weeklyPlannerNotes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { upsertWeeklyPlannerNoteSchema, validateRequest } from '@/lib/validations';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/weekly-planner-notes?weekOf=YYYY-MM-DD
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ note: null });
  }

  try {
    const { searchParams } = new URL(request.url);
    const weekOf = searchParams.get('weekOf');
    if (!weekOf || !/^\d{4}-\d{2}-\d{2}$/.test(weekOf)) {
      return NextResponse.json(
        { error: 'weekOf query parameter (YYYY-MM-DD) is required' },
        { status: 400 }
      );
    }

    const cacheKey = `weekly-planner-notes:${weekOf}`;

    const data = await getCached(cacheKey, async () => {
      const [note] = await db
        .select({
          id: weeklyPlannerNotes.id,
          weekOf: weeklyPlannerNotes.weekOf,
          content: weeklyPlannerNotes.content,
          updatedAt: weeklyPlannerNotes.updatedAt,
        })
        .from(weeklyPlannerNotes)
        .where(eq(weeklyPlannerNotes.weekOf, weekOf));

      return { note: note || null };
    });

    return NextResponse.json(data);
  } catch (error) {
    logError('Failed to fetch weekly planner note:', error);
    return NextResponse.json({ error: 'Failed to fetch note' }, { status: 500 });
  }
}

/**
 * PUT /api/weekly-planner-notes
 * Upsert the note for a week.
 */
export async function PUT(request: NextRequest) {
  return withAuth(async (auth) => {
    try {
      const body = await request.json();
      const validation = validateRequest(upsertWeeklyPlannerNoteSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const { weekOf, content } = validation.data;

      const [note] = await db
        .insert(weeklyPlannerNotes)
        .values({
          weekOf,
          content,
          updatedBy: auth.userId,
        })
        .onConflictDoUpdate({
          target: weeklyPlannerNotes.weekOf,
          set: {
            content,
            updatedBy: auth.userId,
            updatedAt: new Date(),
          },
        })
        .returning();

      await invalidateEntity('weekly-planner-notes');

      return NextResponse.json({ note });
    } catch (error) {
      logError('Failed to upsert weekly planner note:', error);
      return NextResponse.json({ error: 'Failed to save note' }, { status: 500 });
    }
  }, { rateLimit: { feature: 'weekly-planner-notes', limit: 60, windowSeconds: 60 } });
}
