/**
 * @jest-environment jsdom
 */

import { isIOS, vlcHref } from '../vlc';

function setNavigator(overrides: { userAgent?: string; platform?: string; maxTouchPoints?: number }) {
  Object.defineProperty(navigator, 'userAgent', { value: overrides.userAgent ?? '', configurable: true });
  Object.defineProperty(navigator, 'platform', { value: overrides.platform ?? '', configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: overrides.maxTouchPoints ?? 0, configurable: true });
}

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const DESKTOP_MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const WINDOWS_CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

describe('isIOS', () => {
  it('detects an iPhone by user agent', () => {
    setNavigator({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5 });
    expect(isIOS()).toBe(true);
  });

  it('detects an iPad, which reports as MacIntel but has touch support', () => {
    setNavigator({ userAgent: IPAD_UA, platform: 'MacIntel', maxTouchPoints: 5 });
    expect(isIOS()).toBe(true);
  });

  it('does not treat a real Mac (MacIntel, no touch) as iOS', () => {
    setNavigator({ userAgent: DESKTOP_MAC_UA, platform: 'MacIntel', maxTouchPoints: 0 });
    expect(isIOS()).toBe(false);
  });

  it('does not treat Windows Chrome as iOS', () => {
    setNavigator({ userAgent: WINDOWS_CHROME_UA, platform: 'Win32', maxTouchPoints: 0 });
    expect(isIOS()).toBe(false);
  });
});

describe('vlcHref', () => {
  const watchUrl = 'http://192.168.0.149:9090/proxy/ts/stream/abc-123?output_profile=1';

  it('uses vlc-x-callback:// on iOS', () => {
    setNavigator({ userAgent: IPHONE_UA, platform: 'iPhone', maxTouchPoints: 5 });
    expect(vlcHref(watchUrl)).toBe(
      `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(watchUrl)}`
    );
  });

  it('uses a bare vlc:// link everywhere else', () => {
    setNavigator({ userAgent: DESKTOP_MAC_UA, platform: 'MacIntel', maxTouchPoints: 0 });
    expect(vlcHref(watchUrl)).toBe(`vlc://${watchUrl}`);
  });
});
