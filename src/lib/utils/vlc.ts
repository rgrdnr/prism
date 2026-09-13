/**
 * vlc:// / vlc-x-callback:// / channels:// launch helpers, ported from
 * dispatcharr-now's web/src/App.jsx (isIOS() / launchHref()) — see that file
 * for the full rationale. Desktop VLC does not register vlc:// out of the
 * box (needs a separately-installed protocol handler, e.g.
 * stefansundin/vlc-protocol); there is no way to detect its absence from the
 * page, so a vlc:// link on a machine without one just does nothing. VLC for
 * iOS registers vlc-x-callback:// itself when installed — no extra setup
 * needed there.
 *
 * Channels (getchannels.com) deep-links to a channel by its guide *name*,
 * not its guide number — confirmed against a live server: an M3U-imported
 * channel's `id` in Channels DVR is the same string as the channel's name,
 * so Dispatcharr's own channel name already matches it with no lookup
 * needed. Only works for channels a Channels DVR server already has
 * imported (e.g. via M3U from the same Dispatcharr instance), and the deep
 * link itself is iOS/tvOS only.
 */

const PLAYER_KEY = 'prism.dispatcharrPlayer';

export type Player = 'vlc' | 'channels';

export const PLAYER_LABELS: Record<Player, string> = { vlc: 'VLC', channels: 'Channels' };

/** iPadOS reports as "MacIntel" but, unlike a real Mac, has touch support. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function getPreferredPlayer(): Player {
  if (typeof localStorage === 'undefined') return 'vlc';
  return localStorage.getItem(PLAYER_KEY) === 'channels' ? 'channels' : 'vlc';
}

export function setPreferredPlayer(player: Player): void {
  localStorage.setItem(PLAYER_KEY, player);
}

/** Builds a link that hands a channel off to the preferred player. */
export function launchHref(watchUrl: string, channelName: string): string {
  if (getPreferredPlayer() === 'channels') {
    return `channels://play/channel/${encodeURIComponent(channelName)}`;
  }
  if (isIOS()) {
    return `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(watchUrl)}`;
  }
  return `vlc://${watchUrl}`;
}
