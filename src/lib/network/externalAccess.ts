/**
 * External (internet) vs. home-network access.
 *
 * An instance can be exposed to the internet through a Cloudflare Tunnel (see
 * the `tunnel` profile in docker-compose.yml). Everything arriving that way
 * passes through Cloudflare's edge, which stamps every request with
 * `cf-connecting-ip`. Traffic on the LAN, or over a VPN into the LAN, reaches
 * the app directly and never carries it.
 *
 * So the header's presence is the signal. It is not spoofable in the direction
 * that matters: a caller coming through the tunnel cannot remove a header
 * Cloudflare adds. A LAN caller could add it, but all that buys them is losing
 * features — nothing is unlocked by it.
 *
 * Some features only make sense at home. TV favorites hand the browser stream
 * URLs pointing at a Dispatcharr instance on a private address; from outside
 * the network those links go nowhere. Those paths answer 404 to external
 * callers (enforced in src/proxy.ts), and the UI hides them using
 * /api/context.
 */

export const EXTERNAL_ACCESS_HEADER = 'cf-connecting-ip';

type HeaderSource = { get(name: string): string | null };

/** True when the request came in through Cloudflare rather than the LAN. */
export function isExternalRequest(headers: HeaderSource): boolean {
  const value = headers.get(EXTERNAL_ACCESS_HEADER);
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Paths that only work on the home network. Matched as a prefix on a path
 * segment boundary, so '/tv' covers '/tv' and '/tv/...' but not '/tvshows'.
 */
export const LAN_ONLY_PATH_PREFIXES = ['/tv', '/api/dispatcharr-favorites'];

/** Nav hrefs to hide for external callers. */
export const LAN_ONLY_NAV_HREFS = ['/tv'];

export function isLanOnlyPath(pathname: string): boolean {
  return LAN_ONLY_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

/** Shape returned by GET /api/context. */
export type NetworkContext = {
  external: boolean;
  tvEnabled: boolean;
};

export function networkContextFor(headers: HeaderSource): NetworkContext {
  const external = isExternalRequest(headers);
  return { external, tvEnabled: !external };
}
