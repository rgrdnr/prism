/**
 * Client for the dispatcharr-now companion service — a separate, small,
 * always-running Express app that already handles everything hard about
 * talking to Dispatcharr (multiple instances, auth, channel/EPG resolution).
 * Prism treats it as its own internal REST API and never talks to
 * Dispatcharr directly.
 *
 * DISPATCHARR_NOW_URL is almost always a private LAN address (that's where a
 * self-hosted Dispatcharr box lives), so every call goes through safeFetch()
 * — same as src/lib/integrations/immich.ts — which requires the operator to
 * list that host in PRISM_ALLOWED_INTERNAL_HOSTS (see .env.example). That's
 * the existing, sanctioned way Prism allows a trusted self-hosted LAN
 * service, not a special case for this feature.
 */

import { safeFetch } from '@/lib/utils/safeFetch';

export interface DispatcharrNowInstance {
  id: string;
  name: string;
  url: string;
  username: string;
}

export interface DispatcharrNowChannel {
  id: string;
  uuid: string | null;
  name: string;
  number: string | number | null;
  logoId: string | number | null;
}

export class DispatcharrNowUnconfiguredError extends Error {
  constructor() {
    super('DISPATCHARR_NOW_URL is not configured');
  }
}

function baseUrl(): string | null {
  const url = process.env.DISPATCHARR_NOW_URL?.trim();
  return url ? url.replace(/\/+$/, '') : null;
}

async function callJson<T>(path: string, timeoutMs = 5000): Promise<T> {
  const base = baseUrl();
  if (!base) throw new DispatcharrNowUnconfiguredError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await safeFetch(`${base}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`dispatcharr-now ${path} -> ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchInstances(): Promise<DispatcharrNowInstance[]> {
  const data = await callJson<{ instances: DispatcharrNowInstance[] }>('/api/instances');
  return data.instances ?? [];
}

export async function searchChannels(instanceId: string, q?: string): Promise<DispatcharrNowChannel[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const data = await callJson<{ channels: DispatcharrNowChannel[] }>(
    `/api/instances/${encodeURIComponent(instanceId)}/channels${qs}`
  );
  return data.channels ?? [];
}

/** Verified no-auth-required MPEG-TS endpoint — safe to hand to an external player. */
export function buildWatchUrl(instanceBaseUrl: string, channelUuid: string): string {
  return `${instanceBaseUrl.replace(/\/+$/, '')}/proxy/ts/stream/${channelUuid}?output_profile=1`;
}

export function logoProxyPath(instanceId: string, channelId: string): string {
  return `/api/logo/${encodeURIComponent(instanceId)}/${encodeURIComponent(channelId)}`;
}

export async function fetchLogo(instanceId: string, channelId: string): Promise<Response> {
  const base = baseUrl();
  if (!base) throw new DispatcharrNowUnconfiguredError();
  return safeFetch(`${base}${logoProxyPath(instanceId, channelId)}`);
}
