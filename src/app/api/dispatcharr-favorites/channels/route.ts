import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { searchChannels } from '@/lib/integrations/dispatcharrNow';
import { logError } from '@/lib/utils/logError';

/** Settings-only: backs the favorites picker's channel search box. */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get('instanceId');
  const q = searchParams.get('q') ?? undefined;

  if (!instanceId) {
    return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
  }

  try {
    const channels = await searchChannels(instanceId, q);
    return NextResponse.json({ channels });
  } catch (error) {
    logError('Failed to search dispatcharr-now channels:', error);
    return NextResponse.json({ error: 'Could not reach the TV service' }, { status: 502 });
  }
}
