/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// Stub WidgetContainer/WidgetEmpty so we don't pull in Radix UI, etc.
jest.mock('../WidgetContainer', () => ({
  WidgetContainer: function MockWidgetContainer({
    children,
    title,
    loading,
  }: {
    children: React.ReactNode;
    title?: string;
    loading?: boolean;
  }) {
    if (loading) return <div data-testid="loading-state">Loading</div>;
    return (
      <div data-testid="widget-container">
        {title && <div data-testid="widget-title">{title}</div>}
        {children}
      </div>
    );
  },
  WidgetEmpty: function MockWidgetEmpty({ message }: { message: string }) {
    return <div data-testid="empty-state">{message}</div>;
  },
}));

// useVisibilityPolling just needs to not blow up in jsdom; the widget's own
// initial fetch (not this hook) is what these tests exercise.
jest.mock('@/lib/hooks/useVisibilityPolling', () => ({
  useVisibilityPolling: () => {},
}));

import { DispatcharrFavoritesWidget } from '../DispatcharrFavoritesWidget';

function mockFetchOnce(body: unknown, ok = true) {
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok, json: () => Promise.resolve(body) })
  ) as unknown as typeof fetch;
}

afterEach(() => {
  delete (global as { fetch?: unknown }).fetch;
  jest.restoreAllMocks();
});

describe('DispatcharrFavoritesWidget', () => {
  it('shows the empty state when there are no favorites', async () => {
    mockFetchOnce({ favorites: [] });
    render(<DispatcharrFavoritesWidget />);
    await waitFor(() => expect(screen.queryByTestId('empty-state')).not.toBeNull());
    expect(screen.queryByText('No favorite channels yet')).not.toBeNull();
  });

  it('renders favorite channels with a working vlc:// href', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: 'Windows NT 10.0', configurable: true });
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });

    mockFetchOnce({
      favorites: [
        {
          id: 'fav-1',
          channelName: 'ESPN HD',
          channelNumber: '206',
          logoUrl: '/api/dispatcharr-favorites/logo/inst1/42',
          watchUrl: 'http://192.168.0.149:9090/proxy/ts/stream/abc-123?output_profile=1',
        },
      ],
    });

    render(<DispatcharrFavoritesWidget />);
    await waitFor(() => expect(screen.queryByText('ESPN HD')).not.toBeNull());

    const link = screen.getByText('ESPN HD').closest('a');
    expect(link?.getAttribute('href')).toBe(
      'vlc://http://192.168.0.149:9090/proxy/ts/stream/abc-123?output_profile=1'
    );
    expect(link?.getAttribute('aria-disabled')).toBe('false');
  });

  it('disables the tile when watchUrl is null (service unreachable)', async () => {
    mockFetchOnce({
      favorites: [
        {
          id: 'fav-2',
          channelName: 'Local News',
          channelNumber: null,
          logoUrl: '/api/dispatcharr-favorites/logo/inst1/7',
          watchUrl: null,
        },
      ],
      serviceUnavailable: true,
    });

    render(<DispatcharrFavoritesWidget />);
    await waitFor(() => expect(screen.queryByText('Local News')).not.toBeNull());

    const link = screen.getByText('Local News').closest('a');
    expect(link?.getAttribute('aria-disabled')).toBe('true');
    expect(link?.getAttribute('href')).toBeNull();
    expect(screen.queryByText("Can't reach the TV service right now")).not.toBeNull();
  });
});
