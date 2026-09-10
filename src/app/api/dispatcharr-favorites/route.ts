import { NextResponse, NextRequest } from 'next/server';
import { asc, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth';
import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/db/client';
import { dispatcharrFavorites } from '@/lib/db/schema';
import { validateRequest, createDispatcharrFavoriteSchema } from '@/lib/validations';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { fetchInstances, buildWatchUrl } from '@/lib/integrations/dispatcharrNow';
import { logError } from '@/lib/utils/logError';

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const favorites = await db.select().from(dispatcharrFavorites)
      .orderBy(asc(dispatcharrFavorites.sortOrder), asc(dispatcharrFavorites.channelName));

    if (favorites.length === 0) {
      return NextResponse.json({ favorites: [] });
    }

    let instanceUrls = new Map<string, string>();
    let serviceUnavailable = false;
    try {
      const instances = await fetchInstances();
      instanceUrls = new Map(instances.map((i) => [i.id, i.url]));
    } catch (error) {
      logError('Failed to reach dispatcharr-now for favorites resolution:', error);
      serviceUnavailable = true;
    }

    const resolved = favorites.map((f) => {
      const instanceUrl = instanceUrls.get(f.instanceId);
      return {
        id: f.id,
        channelName: f.channelName,
        channelNumber: f.channelNumber,
        sortOrder: f.sortOrder,
        logoUrl: `/api/dispatcharr-favorites/logo/${f.instanceId}/${f.channelId}`,
        watchUrl: instanceUrl ? buildWatchUrl(instanceUrl, f.channelUuid) : null,
        instanceAvailable: Boolean(instanceUrl),
      };
    });

    return NextResponse.json({ favorites: resolved, serviceUnavailable });
  } catch (error) {
    logError('Failed to fetch dispatcharr favorites:', error);
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withAuth(async () => {
    try {
      const body = await request.json();
      const validation = validateRequest(createDispatcharrFavoriteSchema, body);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: validation.error.issues },
          { status: 400 }
        );
      }

      const [maxSort] = await db
        .select({ max: sql<number>`COALESCE(MAX(${dispatcharrFavorites.sortOrder}), -1)` })
        .from(dispatcharrFavorites);

      const [favorite] = await db.insert(dispatcharrFavorites).values({
        instanceId: validation.data.instanceId,
        channelUuid: validation.data.channelUuid,
        channelId: validation.data.channelId,
        channelName: validation.data.channelName,
        channelNumber: validation.data.channelNumber,
        logoId: validation.data.logoId,
        sortOrder: (maxSort?.max ?? -1) + 1,
      }).returning();

      await invalidateEntity('dispatcharr-favorites');
      return NextResponse.json(favorite, { status: 201 });
    } catch (error) {
      logError('Failed to create dispatcharr favorite:', error);
      return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 });
    }
  }, { permission: 'canModifySettings' });
}
