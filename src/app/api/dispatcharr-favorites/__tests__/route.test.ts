/**
 * @jest-environment node
 *
 * Covers the GET route's custom resolution logic (the reason this route
 * exists at all): skip the companion-server call when there are no
 * favorites, resolve watchUrl per favorite when it's reachable, and degrade
 * to serviceUnavailable rather than a 500 when it isn't. POST/DELETE/reorder
 * mirror bus-tracking's already-tested withAuth/permission plumbing exactly,
 * so they're not re-verified here.
 */

const mockSelect = jest.fn();
const mockFetchInstances = jest.fn();
const mockRequireAuth = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: { select: (...a: unknown[]) => mockSelect(...a) },
}));
jest.mock('@/lib/db/schema', () => ({
  dispatcharrFavorites: { sortOrder: 'sortOrder', channelName: 'channelName' },
}));
jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('drizzle-orm', () => ({ asc: jest.fn(), sql: jest.fn() }));
// route.ts also exports POST (same file) — importing GET still evaluates
// POST's imports, and cacheKeys.ts pulls in a real Redis client at module
// load time, so this needs stubbing even though these tests only exercise GET.
jest.mock('@/lib/cache/redis', () => ({ getCached: jest.fn() }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/integrations/dispatcharrNow', () => ({
  fetchInstances: (...a: unknown[]) => mockFetchInstances(...a),
  buildWatchUrl: (instanceUrl: string, channelUuid: string) =>
    `${instanceUrl}/proxy/ts/stream/${channelUuid}?output_profile=1`,
}));

import { GET } from '../route';

function primeFavorites(rows: unknown[]) {
  mockSelect.mockReturnValue({ from: () => ({ orderBy: () => rows }) });
}

describe('GET /api/dispatcharr-favorites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  });

  it('returns an empty list without calling dispatcharr-now', async () => {
    primeFavorites([]);
    const res = await GET();
    const body = await res.json();

    expect(body).toEqual({ favorites: [] });
    expect(mockFetchInstances).not.toHaveBeenCalled();
  });

  it('resolves watchUrl for each favorite from the matching instance', async () => {
    primeFavorites([
      {
        id: 'f1',
        instanceId: 'inst1',
        channelUuid: 'uuid-1',
        channelId: '42',
        channelName: 'ESPN HD',
        channelNumber: '206',
        sortOrder: 0,
      },
    ]);
    mockFetchInstances.mockResolvedValue([{ id: 'inst1', name: 'Living Room', url: 'http://10.0.0.50:9090', username: 'admin' }]);

    const res = await GET();
    const body = await res.json();

    expect(body.serviceUnavailable).toBe(false);
    expect(body.favorites).toEqual([
      {
        id: 'f1',
        channelName: 'ESPN HD',
        channelNumber: '206',
        sortOrder: 0,
        logoUrl: '/api/dispatcharr-favorites/logo/inst1/42',
        watchUrl: 'http://10.0.0.50:9090/proxy/ts/stream/uuid-1?output_profile=1',
        instanceAvailable: true,
      },
    ]);
  });

  it('degrades to serviceUnavailable with null watchUrl when dispatcharr-now cannot be reached', async () => {
    primeFavorites([
      {
        id: 'f1',
        instanceId: 'inst1',
        channelUuid: 'uuid-1',
        channelId: '42',
        channelName: 'ESPN HD',
        channelNumber: '206',
        sortOrder: 0,
      },
    ]);
    mockFetchInstances.mockRejectedValue(new Error('dispatcharr-now unreachable'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.serviceUnavailable).toBe(true);
    expect(body.favorites[0].watchUrl).toBeNull();
    expect(body.favorites[0].instanceAvailable).toBe(false);
  });
});
