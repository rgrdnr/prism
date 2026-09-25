import { NextResponse } from 'next/server';
import { getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { dispatcharrFavorites } from '@/lib/db/schema';
import {
  fetchPrograms,
  type DispatcharrNowProgram,
} from '@/lib/integrations/dispatcharrNow';
import { eventDescriptionToText } from '@/lib/utils/eventDescriptionText';
import { logError } from '@/lib/utils/logError';

interface ProgramPayload {
  title: string;
  description: string | null;
  start: string;
  end: string;
}

interface FavoritePrograms {
  current: ProgramPayload | null;
  next: ProgramPayload | null;
}

/** Guide data is third-party text: strip markup and decode entities, and drop entries with no usable times. */
function clean(program: DispatcharrNowProgram | null | undefined): ProgramPayload | null {
  if (!program?.start || !program.end) return null;
  const title = eventDescriptionToText(program.title);
  if (!title) return null;
  return {
    title,
    description: eventDescriptionToText(program.description) || null,
    start: program.start,
    end: program.end,
  };
}

/**
 * Current and next programme for every favorite, keyed by the favorite's id so
 * the caller can join it to GET /api/dispatcharr-favorites. Readable on the
 * unauthenticated wall display, like the favorites list itself.
 */
export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ programs: {}, serviceUnavailable: false });
  }

  try {
    const favorites = await db.select().from(dispatcharrFavorites);
    if (favorites.length === 0) {
      return NextResponse.json({ programs: {}, serviceUnavailable: false });
    }

    const byInstance = new Map<string, typeof favorites>();
    for (const f of favorites) {
      const group = byInstance.get(f.instanceId) ?? [];
      group.push(f);
      byInstance.set(f.instanceId, group);
    }

    const programs: Record<string, FavoritePrograms> = {};
    let serviceUnavailable = false;

    await Promise.all(
      Array.from(byInstance.entries()).map(async ([instanceId, rows]) => {
        try {
          const list = await fetchPrograms(instanceId, rows.map((r) => r.channelId));
          const byChannel = new Map(list.map((p) => [p.id, p]));
          for (const row of rows) {
            const p = byChannel.get(row.channelId);
            programs[row.id] = { current: clean(p?.current), next: clean(p?.next) };
          }
        } catch (error) {
          logError('Failed to fetch EPG from dispatcharr-now:', error);
          serviceUnavailable = true;
        }
      })
    );

    return NextResponse.json({ programs, serviceUnavailable });
  } catch (error) {
    logError('Failed to build TV guide:', error);
    return NextResponse.json({ error: 'Failed to fetch TV guide' }, { status: 500 });
  }
}
