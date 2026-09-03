/**
 * ENDPOINT: /api/travel/expenses
 * - GET:  List all travel expenses (budget line items across all trips)
 * - POST: Create a new travel expense
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { travelExpenses, users } from '@/lib/db/schema';
import { eq, asc, getTableColumns } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';
import { z } from 'zod';

const createExpenseSchema = z.object({
  tripId: z.string().uuid(),
  category: z.enum(['transport', 'lodging', 'food', 'activities', 'other']).default('other'),
  description: z.string().min(1).max(255),
  amount: z.number().positive(),
  date: z.string().nullable().optional(),
});

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

export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) return NextResponse.json({ expenses: [] });

  try {
    const data = await getCached('travel:expenses', async () => {
      const rows = await db
        .select({
          ...getTableColumns(travelExpenses),
          createdByName: users.name,
          createdByColor: users.color,
        })
        .from(travelExpenses)
        .leftJoin(users, eq(travelExpenses.createdBy, users.id))
        .orderBy(asc(travelExpenses.date), asc(travelExpenses.createdAt));

      return { expenses: rows.map(formatExpense) };
    }, 300);

    return NextResponse.json(data);
  } catch (error) {
    logError('Error fetching travel expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch travel expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const d = parsed.data;

    const rows = await db
      .insert(travelExpenses)
      .values({
        tripId: d.tripId,
        category: d.category,
        description: d.description,
        amount: d.amount.toString(),
        date: d.date || null,
        createdBy: auth.userId,
      })
      .returning();

    const newExpense = rows[0];
    if (!newExpense) return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });

    await invalidateEntity('travel');

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'travel_expense',
      entityId: newExpense.id,
      summary: `Added travel expense: ${d.description}`,
    });

    const [withUser] = await db
      .select({ ...getTableColumns(travelExpenses), createdByName: users.name, createdByColor: users.color })
      .from(travelExpenses)
      .leftJoin(users, eq(travelExpenses.createdBy, users.id))
      .where(eq(travelExpenses.id, newExpense.id));

    return NextResponse.json(
      withUser ? formatExpense(withUser) : formatExpense({ ...newExpense, createdByName: null, createdByColor: null }),
      { status: 201 }
    );
  } catch (error) {
    logError('Error creating travel expense:', error);
    return NextResponse.json({ error: 'Failed to create travel expense' }, { status: 500 });
  }
}
