/**
 * RingCentral API client.
 *
 * Auth flow:
 *   - Admin performs one-time OAuth2 Authorization Code flow to get a refresh token
 *   - RC_REFRESH_TOKEN env var holds that token
 *   - This module exchanges it for an access token on each server request
 *   - In-memory cache avoids hammering the token endpoint (tokens are valid ~60 min)
 */

const RC_BASE = "https://platform.ringcentral.com";

interface TokenCache {
  accessToken: string;
  expiresAt: number; // unix ms
}

// Module-level cache (valid for lifetime of serverless warm instance)
let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

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
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RingCentral token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.accessToken;
}

interface RCCallRecord {
  direction: "Inbound" | "Outbound";
  result: string; // "Accepted", "Missed", "Voicemail", etc.
  duration: number; // seconds
  startTime: string; // ISO 8601
  from: { extensionId?: string; name?: string };
  to: { extensionId?: string; name?: string };
}

interface RCExtension {
  id: string;
  extensionNumber: string;
  name: string;
  type: string;
  status: string;
}

async function fetchWithToken(url: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** Fetch all user extensions on the account */
export async function getExtensions(): Promise<RCExtension[]> {
  const res = await fetchWithToken(
    `${RC_BASE}/restapi/v1.0/account/~/extension?type=User&status=Enabled&perPage=250`
  );
  if (!res.ok) throw new Error(`Extensions fetch failed: ${res.status}`);
  const data = await res.json();
  return (data.records ?? []) as RCExtension[];
}

/** Fetch call log for all extensions within a date range */
export async function getCallLog(
  dateFrom: Date,
  dateTo: Date
): Promise<RCCallRecord[]> {
  const params = new URLSearchParams({
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    perPage: "250",
    view: "Simple",
    withRecording: "false",
  });

  const res = await fetchWithToken(
    `${RC_BASE}/restapi/v1.0/account/~/call-log?${params}`
  );

  if (!res.ok) throw new Error(`Call log fetch failed: ${res.status}`);

  const data = await res.json();
  const records: RCCallRecord[] = data.records ?? [];

  // Handle pagination
  let nextPage = data.navigation?.nextPage?.uri;
  while (nextPage) {
    const token = await getAccessToken();
    const pageRes = await fetch(nextPage, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!pageRes.ok) break;
    const pageData = await pageRes.json();
    records.push(...(pageData.records ?? []));
    nextPage = pageData.navigation?.nextPage?.uri;
  }

  return records;
}

/** Get per-extension call log */
export async function getExtensionCallLog(
  extensionId: string,
  dateFrom: Date,
  dateTo: Date
): Promise<RCCallRecord[]> {
  const params = new URLSearchParams({
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    perPage: "100",
    view: "Simple",
  });

  const res = await fetchWithToken(
    `${RC_BASE}/restapi/v1.0/account/~/extension/${extensionId}/call-log?${params}`
  );

  if (!res.ok) return [];

  const data = await res.json();
  return (data.records ?? []) as RCCallRecord[];
}
