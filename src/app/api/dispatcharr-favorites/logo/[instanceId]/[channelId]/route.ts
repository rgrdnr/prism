import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fetchLogo } from '@/lib/integrations/dispatcharrNow';

/** Proxies a channel logo through dispatcharr-now so the browser never needs to reach it directly. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ instanceId: string; channelId: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { instanceId, channelId } = await params;

  try {
    const upstream = await fetchLogo(instanceId, channelId);
    if (!upstream.ok) return NextResponse.json({ error: 'Logo not found' }, { status: 404 });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=14400',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Logo not found' }, { status: 404 });
  }
}
