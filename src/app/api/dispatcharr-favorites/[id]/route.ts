import { NextResponse, NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { dispatcharrFavorites } from '@/lib/db/schema';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(async () => {
    const { id } = await params;

    try {
      const [deleted] = await db.delete(dispatcharrFavorites)
        .where(eq(dispatcharrFavorites.id, id))
        .returning();

      if (!deleted) {
        return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
      }

      await invalidateEntity('dispatcharr-favorites');
      return NextResponse.json({ success: true });
    } catch (error) {
      logError('Failed to delete dispatcharr favorite:', error);
      return NextResponse.json({ error: 'Failed to delete favorite' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
