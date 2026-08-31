/**
 *
 * ENDPOINT: /api/weekly-habits/[id]
 * - PATCH:  Update a habit (label, sortOrder, archived)
 * - DELETE: Permanently delete a habit and its checks
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { weeklyHabits } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateWeeklyHabitSchema, validateRequest } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const validation = validateRequest(updateWeeklyHabitSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ id: weeklyHabits.id })
      .from(weeklyHabits)
      .where(eq(weeklyHabits.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    const [habit] = await db
      .update(weeklyHabits)
      .set({ ...validation.data, updatedAt: new Date() })
      .where(eq(weeklyHabits.id, id))
      .returning();

    await invalidateEntity('weekly-habits');

    return NextResponse.json({ habit });
  } catch (error) {
    logError('Failed to update weekly habit:', error);
    return NextResponse.json({ error: 'Failed to update habit' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: weeklyHabits.id })
      .from(weeklyHabits)
      .where(eq(weeklyHabits.id, id));

    if (!existing) {
      return NextResponse.json({ error: 'Habit not found' }, { status: 404 });
    }

    await db.delete(weeklyHabits).where(eq(weeklyHabits.id, id));

    await invalidateEntity('weekly-habits');

    return NextResponse.json({ message: 'Habit deleted' });
  } catch (error) {
    logError('Failed to delete weekly habit:', error);
    return NextResponse.json({ error: 'Failed to delete habit' }, { status: 500 });
  }
}
