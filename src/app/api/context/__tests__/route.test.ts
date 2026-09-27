import { NextRequest } from 'next/server';
import { GET } from '../route';

function req(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/context', { headers: new Headers(headers) });
}

describe('GET /api/context', () => {
  it('LAN caller → tvEnabled true', async () => {
    const res = await GET(req());
    expect(await res.json()).toEqual({ external: false, tvEnabled: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('caller through Cloudflare → external, tvEnabled false', async () => {
    const res = await GET(req({ 'cf-connecting-ip': '198.51.100.4' }));
    expect(await res.json()).toEqual({ external: true, tvEnabled: false });
  });
});
