import { NextRequest, NextResponse } from "next/server";
import { saveInitialTokens } from "@/lib/ringcentral";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return new NextResponse(`
      <html><body style="background:#0a0a0a;color:#e05252;font-family:monospace;padding:40px">
        <h2>Authorization failed</h2>
        <p>${error}: ${request.nextUrl.searchParams.get("error_description") ?? ""}</p>
      </body></html>
    `, { headers: { "Content-Type": "text/html" } });
  }

  if (!code) {
    return new NextResponse("Missing authorization code", { status: 400 });
  }

  const clientId = process.env.RC_CLIENT_ID!;
  const clientSecret = process.env.RC_CLIENT_SECRET!;

  const redirectUri = process.env.RC_REDIRECT_URI ?? "http://localhost:3000/api/ringcentral/callback";

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch("https://platform.ringcentral.com/restapi/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return new NextResponse(`
      <html><body style="background:#0a0a0a;color:#e05252;font-family:monospace;padding:40px">
        <h2>Token exchange failed</h2>
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body></html>
    `, { headers: { "Content-Type": "text/html" } });
  }

  const refreshToken = data.refresh_token;

  // Save both tokens to Netlify Blobs — shared across all function instances
  let saved = false;
  try {
    await saveInitialTokens(data.access_token, data.expires_in, refreshToken);
    saved = true;
  } catch {
    saved = false;
  }

  return new NextResponse(`
    <!DOCTYPE html>
    <html>
    <head><title>RingCentral Connected</title></head>
    <body style="background:#0a0a0a;color:#f5f5f5;font-family:monospace;padding:40px;max-width:700px">
      <h2 style="color:#C48B1F;font-family:system-ui">RingCentral Connected!</h2>
      ${saved
        ? `<p style="color:#4CAF7D">✓ Refresh token automatically saved to Netlify. No action needed.</p>`
        : `<p style="color:#e05252">Could not auto-save to Netlify. Copy the token below into your Netlify env vars as <code>RC_REFRESH_TOKEN</code>:</p>
           <div style="background:#141414;border:1px solid #C48B1F;border-radius:8px;padding:16px;word-break:break-all;color:#C48B1F;font-size:13px;margin-top:12px">${refreshToken}</div>`
      }
      <p style="margin-top:32px;color:#6b6b6b;font-size:13px">
        The dashboard will now work. Tokens auto-rotate on every use — you won't need to do this again.
      </p>
      <a href="/dashboard" style="display:inline-block;margin-top:24px;background:#C48B1F;color:#0a0a0a;padding:10px 24px;border-radius:8px;text-decoration:none;font-family:system-ui;font-weight:600;font-size:14px">
        Go to Dashboard →
      </a>
    </body>
    </html>
  `, { headers: { "Content-Type": "text/html" } });
}
