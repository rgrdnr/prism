import { NextResponse } from 'next/server';
import { requireAuth, requireRole } from '@/lib/auth';
import { fetchInstances } from '@/lib/integrations/dispatcharrNow';
import { logError } from '@/lib/utils/logError';

/** Settings-only: backs the favorites picker's instance dropdown. */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canModifySettings');
  if (forbidden) return forbidden;

  try {
    const instances = await fetchInstances();
    // Never send url/username to the browser — the picker only needs id/name.
    return NextResponse.json({
      instances: instances.map((i) => ({ id: i.id, name: i.name })),
    });
  } catch (error) {
    logError('Failed to fetch dispatcharr-now instances:', error);
    return NextResponse.json({ error: 'Could not reach the TV service' }, { status: 502 });
  }
}
