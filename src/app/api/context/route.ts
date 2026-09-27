import { NextRequest, NextResponse } from 'next/server';
import { networkContextFor } from '@/lib/network/externalAccess';

/**
 * Where the caller is reaching Prism from, and which home-network-only
 * features follow from that. The UI uses it to hide what won't work; the
 * enforcement itself lives in src/proxy.ts.
 *
 * Never cached: the same browser can be on the LAN one minute and on cellular
 * through the tunnel the next.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return NextResponse.json(networkContextFor(request.headers), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
