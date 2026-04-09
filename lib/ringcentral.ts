/**
 * RingCentral API client.
 * Handles token refresh, queue discovery, and detailed call log fetching.
 */

const RC_BASE = "https://platform.ringcentral.com";

// ─── Token Management ─────────────────────────────────────────────────────────

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;
// In-flight refresh promise — all concurrent callers share one request
let refreshInFlight: Promise<string> | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  // If a refresh is already in progress, wait for it instead of firing another
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const clientId = process.env.RC_CLIENT_ID;
    const clientSecret = process.env.RC_CLIENT_SECRET;
    const refreshToken = process.env.RC_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error("RingCentral credentials not configured");
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch(`${RC_BASE}/restapi/oauth/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`RingCentral token refresh failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };

    // Auto-rotate: save the new refresh token back to Netlify so it never expires
    if (data.refresh_token && data.refresh_token !== refreshToken) {
      persistRefreshToken(data.refresh_token).catch(() => {
        // Non-fatal — log but don't break the request
        console.warn("[RC] Failed to persist new refresh token to Netlify");
      });
    }

    return tokenCache.accessToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

async function fetchWithToken(url: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

/**
 * Persists a new refresh token to Netlify env vars so the token auto-rotates
 * and never expires as long as the dashboard is used within the token window.
 */
async function persistRefreshToken(newToken: string): Promise<void> {
  const netlifyToken = process.env.NETLIFY_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!netlifyToken || !siteId) return;

  await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/env/RC_REFRESH_TOKEN`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${netlifyToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [{ context: "all", value: newToken }] }),
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RCExtension {
  id: string;
  extensionNumber: string;
  name: string;
  type: string; // "User", "Department", "Queue", etc.
  status: string;
}

export interface RCCallLeg {
  startTime: string;
  duration: number;
  result: string;
  type: string;
  direction: string;
  extension?: {
    id: string;
    name: string;
    extensionNumber?: string;
    type?: string;
  };
}

export interface RCDetailedCallRecord {
  id: string;
  startTime: string;
  duration: number;
  result: string;
  direction: "Inbound" | "Outbound";
  from: { phoneNumber?: string; name?: string; extensionId?: string };
  to: { phoneNumber?: string; name?: string; extensionId?: string };
  legs: RCCallLeg[];
}

// ─── Extensions ───────────────────────────────────────────────────────────────

/** Fetch all user (agent) extensions */
export async function getUserExtensions(): Promise<RCExtension[]> {
  const res = await fetchWithToken(
    `${RC_BASE}/restapi/v1.0/account/~/extension?type=User&status=Enabled&perPage=250`
  );
  if (!res.ok) throw new Error(`Extensions fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.records ?? []) as RCExtension[];
}

/** Find call queue extensions by name (case-insensitive) */
export async function findQueuesByName(names: string[]): Promise<RCExtension[]> {
  const lower = names.map((n) => n.toLowerCase());

  // RingCentral queues can be type "Department" or "Queue"
  const res = await fetchWithToken(
    `${RC_BASE}/restapi/v1.0/account/~/extension?type=Department,Queue&status=Enabled&perPage=250`
  );
  if (!res.ok) throw new Error(`Queue fetch failed: ${res.status}`);
  const data = await res.json();
  const all = (data.records ?? []) as RCExtension[];
  return all.filter((ext) => lower.includes(ext.name.toLowerCase()));
}

// Queue ID cache — persist across warm invocations
let queueCache: { queues: RCExtension[]; cachedAt: number } | null = null;

export async function getTargetQueues(): Promise<RCExtension[]> {
  if (queueCache && Date.now() - queueCache.cachedAt < 60 * 60 * 1000) {
    return queueCache.queues;
  }
  const queues = await findQueuesByName(["get that bag", "fresh leads"]);
  queueCache = { queues, cachedAt: Date.now() };
  return queues;
}

// ─── Call Log ─────────────────────────────────────────────────────────────────

async function fetchAllPages<T>(
  url: string,
  params: URLSearchParams
): Promise<T[]> {
  const res = await fetchWithToken(`${url}?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  const records: T[] = data.records ?? [];

  let nextPage = data.navigation?.nextPage?.uri;
  while (nextPage) {
    const token = await getAccessToken();
    const pageRes = await fetch(nextPage, { headers: { Authorization: `Bearer ${token}` } });
    if (!pageRes.ok) break;
    const pageData = await pageRes.json();
    records.push(...(pageData.records ?? []));
    nextPage = pageData.navigation?.nextPage?.uri;
  }

  return records;
}

/**
 * Fetch detailed inbound call log for a specific queue extension.
 * The `legs` array lets us identify which LO answered each call.
 */
export async function getQueueInboundCalls(
  queueId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<RCDetailedCallRecord[]> {
  const params = new URLSearchParams({
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    direction: "Inbound",
    view: "Detailed",
    perPage: "250",
    withRecording: "false",
  });
  return fetchAllPages<RCDetailedCallRecord>(
    `${RC_BASE}/restapi/v1.0/account/~/extension/${queueId}/call-log`,
    params
  );
}

/**
 * Fetch outbound call log for a specific user extension.
 */
export async function getExtensionOutboundCalls(
  extensionId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<RCDetailedCallRecord[]> {
  const params = new URLSearchParams({
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    direction: "Outbound",
    view: "Simple",
    perPage: "250",
    withRecording: "false",
  });
  return fetchAllPages<RCDetailedCallRecord>(
    `${RC_BASE}/restapi/v1.0/account/~/extension/${extensionId}/call-log`,
    params
  );
}

/**
 * From a queue call's legs, find the agent (User) who answered.
 * Returns null if no agent leg found (missed/voicemail).
 */
export function extractAgentFromLegs(
  legs: RCCallLeg[]
): { id: string; name: string } | null {
  // Find the leg where a User-type extension handled the call
  for (const leg of legs) {
    if (
      leg.extension &&
      leg.extension.type === "User" &&
      leg.result === "Accepted"
    ) {
      return { id: leg.extension.id, name: leg.extension.name };
    }
  }
  // Fallback: any user extension in legs
  for (const leg of legs) {
    if (leg.extension && leg.extension.type === "User") {
      return { id: leg.extension.id, name: leg.extension.name };
    }
  }
  return null;
}

/** Legacy: account-level call log (used by old /api/ringcentral/calls route) */
export async function getCallLog(
  dateFrom: Date,
  dateTo: Date
): Promise<RCDetailedCallRecord[]> {
  const params = new URLSearchParams({
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    perPage: "250",
    view: "Simple",
    withRecording: "false",
  });
  return fetchAllPages<RCDetailedCallRecord>(
    `${RC_BASE}/restapi/v1.0/account/~/call-log`,
    params
  );
}

/** Legacy: per-extension call log */
export async function getExtensionCallLog(
  extensionId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<RCDetailedCallRecord[]> {
  const params = new URLSearchParams({
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    perPage: "100",
    view: "Simple",
  });
  return fetchAllPages<RCDetailedCallRecord>(
    `${RC_BASE}/restapi/v1.0/account/~/extension/${extensionId}/call-log`,
    params
  );
}

export async function getExtensions(): Promise<RCExtension[]> {
  return getUserExtensions();
}
