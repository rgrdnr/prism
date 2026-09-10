/**
 * vlc:// / vlc-x-callback:// launch helpers, ported from dispatcharr-now's
 * web/src/App.jsx (isIOS() / vlcHref()) — see that file for the full
 * rationale. Desktop VLC does not register vlc:// out of the box (needs a
 * separately-installed protocol handler, e.g. stefansundin/vlc-protocol);
 * there is no way to detect its absence from the page, so a vlc:// link on
 * a machine without one just does nothing. VLC for iOS registers
 * vlc-x-callback:// itself when installed — no extra setup needed there.
 */

/** iPadOS reports as "MacIntel" but, unlike a real Mac, has touch support. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/** Builds a link that hands `watchUrl` off to VLC. */
export function vlcHref(watchUrl: string): string {
  if (isIOS()) {
    return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(watchUrl)}`;
  }
  return `vlc://${watchUrl}`;
}
