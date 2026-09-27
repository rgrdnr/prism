/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useNetworkContext, __resetNetworkContextForTests } from '../useNetworkContext';
import { useHiddenPages } from '../useHiddenPages';
import { ALL_NAV_ITEMS } from '@/lib/constants/navItems';

function mockFetch(context: { external: boolean; tvEnabled: boolean }) {
  global.fetch = jest.fn((url: RequestInfo | URL) => {
    const body = String(url).includes('/api/context') ? context : { settings: { hiddenPages: [] } };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
  }) as jest.Mock;
}

describe('useNetworkContext', () => {
  beforeEach(() => {
    __resetNetworkContextForTests();
    localStorage.clear();
  });

  it('assumes the LAN until told otherwise', () => {
    mockFetch({ external: false, tvEnabled: true });
    const { result } = renderHook(() => useNetworkContext());
    expect(result.current).toEqual({ external: false, tvEnabled: true });
  });

  it('picks up an external context from /api/context', async () => {
    mockFetch({ external: true, tvEnabled: false });
    const { result } = renderHook(() => useNetworkContext());
    await waitFor(() => expect(result.current.tvEnabled).toBe(false));
    expect(result.current.external).toBe(true);
  });

  it('useHiddenPages drops /tv externally without saving it as a preference', async () => {
    mockFetch({ external: true, tvEnabled: false });
    const { result } = renderHook(() => useHiddenPages());
    await waitFor(() => expect(result.current.isPageHidden('/tv')).toBe(true));
    expect(result.current.filterNavItems(ALL_NAV_ITEMS).some((i) => i.href === '/tv')).toBe(false);
    expect(result.current.hiddenPages).not.toContain('/tv');
  });

  it('useHiddenPages keeps /tv on the LAN', async () => {
    mockFetch({ external: false, tvEnabled: true });
    const { result } = renderHook(() => useHiddenPages());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.isPageHidden('/tv')).toBe(false);
  });
});
