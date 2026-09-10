import { NextResponse, NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { dispatcharrFavorites } from '@/lib/db/schema';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    try {
      const body = await request.json() as { id: string; sortOrder: number }[];

      if (!Array.isArray(body) || body.some(item => !item.id || typeof item.sortOrder !== 'number')) {
        return NextResponse.json({ error: 'Invalid reorder payload' }, { status: 400 });
      }

      await db.transaction(async (tx) => {
        for (const { id, sortOrder } of body) {
          await tx.update(dispatcharrFavorites)
            .set({ sortOrder, updatedAt: new Date() })
            .where(eq(dispatcharrFavorites.id, id));
        }
      });

      await invalidateEntity('dispatcharr-favorites');
      return NextResponse.json({ success: true });
    } catch (error) {
      logError('Failed to reorder dispatcharr favorites:', error);
      return NextResponse.json({ error: 'Failed to reorder favorites' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
