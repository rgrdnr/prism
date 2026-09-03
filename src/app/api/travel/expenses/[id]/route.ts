/**
 * ENDPOINT: /api/travel/expenses/[id]
 * - PATCH:  Update a travel expense
 * - DELETE: Delete a travel expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { travelExpenses, users } from '@/lib/db/schema';
import { eq, getTableColumns } from 'drizzle-orm';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { z } from 'zod';

function formatExpense(row: typeof travelExpenses.$inferSelect & {
  createdByName: string | null;
  createdByColor: string | null;
}) {
  return {
    id: row.id,
    tripId: row.tripId,
    category: row.category,
    description: row.description,
    amount: row.amount,
    date: row.date,
    createdBy: row.createdBy ? { id: row.createdBy, name: row.createdByName, color: row.createdByColor } : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const updateExpenseSchema = z.object({
  category: z.enum(['transport', 'lodging', 'food', 'activities', 'other']).optional(),
  description: z.string().min(1).max(255).optional(),
  amount: z.number().positive().optional(),
  date: z.string().nullable().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const updates: Partial<typeof travelExpenses.$inferInsert> = {};

    if (d.category !== undefined) updates.category = d.category;
    if (d.description !== undefined) updates.description = d.description;
    if (d.amount !== undefined) updates.amount = d.amount.toString();
    if (d.date !== undefined) updates.date = d.date;
    updates.updatedAt = new Date();

    const [updated] = await db
      .update(travelExpenses)
      .set(updates)
      .where(eq(travelExpenses.id, id))
      .returning();

    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await invalidateEntity('travel');

    const [withUser] = await db
      .select({ ...getTableColumns(travelExpenses), createdByName: users.name, createdByColor: users.color })
      .from(travelExpenses)
      .leftJoin(users, eq(travelExpenses.createdBy, users.id))
      .where(eq(travelExpenses.id, id));

    return NextResponse.json(withUser ? formatExpense(withUser) : formatExpense({ ...updated, createdByName: null, createdByColor: null }));
  } catch (error) {
    logError('Error updating travel expense:', error);
    return NextResponse.json({ error: 'Failed to update travel expense' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  try {
    const [deleted] = await db
      .delete(travelExpenses)
      .where(eq(travelExpenses.id, id))
      .returning();

    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await invalidateEntity('travel');

    logActivity({
      userId: auth.userId,
      action: 'delete',
      entityType: 'travel_expense',
      entityId: id,
      summary: `Deleted travel expense: ${deleted.description}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error deleting travel expense:', error);
    return NextResponse.json({ error: 'Failed to delete travel expense' }, { status: 500 });
  }
}
