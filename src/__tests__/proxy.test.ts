import { NextRequest } from 'next/server';
import { proxy } from '../proxy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(
  path: string,
  {
    method = 'GET',
    headers = {},
  }: { method?: string; headers?: Record<string, string> } = {},
): NextRequest {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url, { method, headers: new Headers(headers) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('proxy', () => {
  describe('x-request-id injection', () => {
    it('GET request — response includes x-request-id header', async () => {
      const req = makeRequest('/api/foo');
      const res = await proxy(req);

      const requestId = res.headers.get('x-request-id');
      expect(requestId).not.toBeNull();
      expect(requestId).toHaveLength(24);
    });

    it('POST with no x-request-id — response gets a generated 24-char hex id', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await proxy(req);

      const requestId = res.headers.get('x-request-id');
      expect(requestId).not.toBeNull();
      expect(requestId).toMatch(/^[0-9a-f]{24}$/);
    });

    it('POST with existing x-request-id — response propagates the same value', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
          'x-request-id': 'existing-id',
        },
      });
      const res = await proxy(req);

      expect(res.headers.get('x-request-id')).toBe('existing-id');
    });
  });

  describe('CSRF protection', () => {
    it('POST with matching Origin/Host — passes through (200)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
        },
      });
      const res = await proxy(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('POST with mismatched Origin — returns 403 with x-request-id', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await proxy(req);

      expect(res.status).toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('POST with no Origin header — passes through (non-browser client)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'POST',
        headers: { host: 'localhost:3000' },
      });
      const res = await proxy(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('CSRF-exempt path /api/away-mode with cross-origin POST — passes through', async () => {
      const req = makeRequest('/api/away-mode', {
        method: 'POST',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await proxy(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('GET with mismatched Origin — passes through (CSRF only applies to mutations)', async () => {
      const req = makeRequest('/api/foo', {
        method: 'GET',
        headers: {
          host: 'localhost:3000',
          origin: 'http://evil.example.com',
        },
      });
      const res = await proxy(req);

      expect(res.status).not.toBe(403);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });
  });

  describe('DEMO_MODE', () => {
    afterEach(() => {
      delete process.env.DEMO_MODE;
    });

    it('off by default — POST passes through', async () => {
      const req = makeRequest('/api/events', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).not.toBe(403);
    });

    it('on — POST to mutation route returns 403 with demo_mode error', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/events', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('demo_mode');
      expect(body.message).toMatch(/read-only demo/i);
      expect(res.headers.get('x-request-id')).not.toBeNull();
    });

    it('on — DELETE blocked the same as POST', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/events/abc', {
        method: 'DELETE',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('demo_mode');
    });

    it('on — GET passes through (reads always allowed)', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/events', {
        method: 'GET',
        headers: { host: 'localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).not.toBe(403);
    });

    it('on — login allowed so visitors can switch members', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/auth/login', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).not.toBe(403);
    });

    it('on — logout allowed so visitors don\'t get stuck', async () => {
      process.env.DEMO_MODE = 'true';
      const req = makeRequest('/api/auth/logout', {
        method: 'POST',
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      });
      const res = await proxy(req);
      expect(res.status).not.toBe(403);
    });
  });
  describe('home-network-only paths (TV favorites)', () => {
    const external = { 'cf-connecting-ip': '203.0.113.7' };

    it('external API call to dispatcharr-favorites → 404 JSON', async () => {
      const res = await proxy(makeRequest('/api/dispatcharr-favorites', { headers: external }));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'Not found' });
      expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f]{24}$/);
    });

    it('external call to a nested TV API route (logo, epg) → 404', async () => {
      for (const path of ['/api/dispatcharr-favorites/epg', '/api/dispatcharr-favorites/logo/1/2']) {
        const res = await proxy(makeRequest(path, { headers: external }));
        expect(res.status).toBe(404);
      }
    });

    it('external mutation to TV API → 404, not a CSRF 403', async () => {
      const res = await proxy(
        makeRequest('/api/dispatcharr-favorites/reorder', {
          method: 'POST',
          headers: { ...external, host: 'prism.example.com', origin: 'https://evil.example' },
        }),
      );
      expect(res.status).toBe(404);
    });

    it('external request for the /tv page → rewritten to the not-found page with 404', async () => {
      const res = await proxy(makeRequest('/tv', { headers: external }));
      expect(res.status).toBe(404);
      expect(res.headers.get('x-middleware-rewrite')).toContain('/_lan-only');
    });

    it('LAN request (no cf-connecting-ip) to TV routes passes through', async () => {
      for (const path of ['/tv', '/api/dispatcharr-favorites']) {
        const res = await proxy(makeRequest(path));
        expect(res.status).not.toBe(404);
        expect(res.headers.get('x-middleware-rewrite')).toBeNull();
      }
    });

    it('external request to other routes is unaffected', async () => {
      const res = await proxy(makeRequest('/api/tasks', { headers: external }));
      expect(res.status).not.toBe(404);
    });

    it('does not match paths that merely start with "tv"', async () => {
      const res = await proxy(makeRequest('/tvshows', { headers: external }));
      expect(res.headers.get('x-middleware-rewrite')).toBeNull();
    });

    it('an empty cf-connecting-ip header does not count as external', async () => {
      const res = await proxy(makeRequest('/api/dispatcharr-favorites', { headers: { 'cf-connecting-ip': ' ' } }));
      expect(res.status).not.toBe(404);
    });
  });
});
