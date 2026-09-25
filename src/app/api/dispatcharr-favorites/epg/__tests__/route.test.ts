/**
 * @jest-environment node
 *
 * Covers the EPG route's own logic: readable without a session (display auth),
 * skips the companion-server call when there are no favorites, joins programmes
 * back to favorites by id across instances, cleans third-party guide text, and
 * degrades to serviceUnavailable instead of a 500 when dispatcharr-now is down.
 */

const mockSelect = jest.fn();
const mockFetchPrograms = jest.fn();
const mockGetDisplayAuth = jest.fn();

jest.mock('@/lib/db/client', () => ({
  db: { select: (...a: unknown[]) => mockSelect(...a) },
}));
jest.mock('@/lib/db/schema', () => ({ dispatcharrFavorites: {} }));
jest.mock('@/lib/auth', () => ({
  getDisplayAuth: (...a: unknown[]) => mockGetDisplayAuth(...a),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));
jest.mock('@/lib/integrations/dispatcharrNow', () => ({
  fetchPrograms: (...a: unknown[]) => mockFetchPrograms(...a),
}));

import { GET } from '../route';

function primeFavorites(rows: unknown[]) {
  mockSelect.mockReturnValue({ from: () => rows });
}

const program = (title: string, start: string, end: string, description: string | null = null) => ({
  title,
  description,
  start,
  end,
});

describe('GET /api/dispatcharr-favorites/epg', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplayAuth.mockResolvedValue({ userId: 'guest', role: 'guest' });
  });

  it('returns nothing without display auth and never touches the database', async () => {
    mockGetDisplayAuth.mockResolvedValue(null);
    const res = await GET();

    expect(await res.json()).toEqual({ programs: {}, serviceUnavailable: false });
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('does not call dispatcharr-now when there are no favorites', async () => {
    primeFavorites([]);
    const res = await GET();

    expect(await res.json()).toEqual({ programs: {}, serviceUnavailable: false });
    expect(mockFetchPrograms).not.toHaveBeenCalled();
  });

  it('keys programmes by favorite id, one call per instance, with guide text cleaned', async () => {
    primeFavorites([
      { id: 'f1', instanceId: 'inst1', channelId: '10' },
      { id: 'f2', instanceId: 'inst1', channelId: '11' },
      { id: 'f3', instanceId: 'inst2', channelId: '10' },
    ]);
    mockFetchPrograms.mockImplementation(async (instanceId: string) =>
      instanceId === 'inst1'
        ? [
            {
              id: '10',
              current: program('Today &amp; Tomorrow', '2026-09-25T16:00:00Z', '2026-09-25T17:00:00Z', 'A <b>bold</b> plan &amp; more'),
              next: program('News', '2026-09-25T17:00:00Z', '2026-09-25T17:30:00Z'),
            },
            { id: '11', current: null, next: null },
          ]
        : [{ id: '10', current: program('Other', '2026-09-25T16:00:00Z', '2026-09-25T18:00:00Z'), next: null }]
    );

    const res = await GET();
    const body = await res.json();

    expect(mockFetchPrograms).toHaveBeenCalledTimes(2);
    expect(mockFetchPrograms).toHaveBeenCalledWith('inst1', ['10', '11']);
    expect(mockFetchPrograms).toHaveBeenCalledWith('inst2', ['10']);
    expect(body.serviceUnavailable).toBe(false);
    expect(body.programs.f1.current).toEqual({
      title: 'Today & Tomorrow',
      description: 'A bold plan & more',
      start: '2026-09-25T16:00:00Z',
      end: '2026-09-25T17:00:00Z',
    });
    expect(body.programs.f1.next.title).toBe('News');
    expect(body.programs.f2).toEqual({ current: null, next: null });
    // Same channel id on a different instance must not collide with f1.
    expect(body.programs.f3.current.title).toBe('Other');
  });

  it('drops programmes that have no title or no times', async () => {
    primeFavorites([{ id: 'f1', instanceId: 'inst1', channelId: '10' }]);
    mockFetchPrograms.mockResolvedValue([
      {
        id: '10',
        current: { title: null, description: null, start: '2026-09-25T16:00:00Z', end: '2026-09-25T17:00:00Z' },
        next: { title: 'No times', description: null, start: null, end: null },
      },
    ]);

    const body = await (await GET()).json();

    expect(body.programs.f1).toEqual({ current: null, next: null });
  });

  it('reports serviceUnavailable, not a 500, when dispatcharr-now cannot be reached', async () => {
    primeFavorites([{ id: 'f1', instanceId: 'inst1', channelId: '10' }]);
    mockFetchPrograms.mockRejectedValue(new Error('unreachable'));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.serviceUnavailable).toBe(true);
    expect(body.programs).toEqual({});
  });
});
