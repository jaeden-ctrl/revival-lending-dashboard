import type { Config } from "@netlify/functions";
import { getAccessToken } from "../../lib/ringcentral";

export default async function handler() {
  try {
    await getAccessToken();
    console.log("[rc-token-refresh] Token refreshed successfully");
    return new Response("OK", { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[rc-token-refresh] Failed:", message);
    // Don't throw — a failed scheduled function shouldn't retry infinitely
    return new Response(message, { status: 500 });
  }
}

export const config: Config = {
  schedule: "0 */6 * * *", // every 6 hours — well within RC's 7-day refresh token window
};
