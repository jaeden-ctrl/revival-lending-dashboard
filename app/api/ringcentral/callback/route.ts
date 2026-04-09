import { NextRequest, NextResponse } from "next/server";

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
  const redirectUri = "http://localhost:3000/api/ringcentral/callback";

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

  return new NextResponse(`
    <!DOCTYPE html>
    <html>
    <head><title>RingCentral Connected</title></head>
    <body style="background:#0a0a0a;color:#f5f5f5;font-family:monospace;padding:40px;max-width:700px">
      <h2 style="color:#C9A84C">RingCentral Connected!</h2>
      <p>Copy the refresh token below and add it to your <code>.env.local</code> file:</p>
      <p style="color:#6b6b6b;font-size:13px">RC_REFRESH_TOKEN=</p>
      <div style="background:#141414;border:1px solid #C9A84C;border-radius:8px;padding:16px;word-break:break-all;color:#C9A84C;font-size:14px">
        ${refreshToken}
      </div>
      <p style="margin-top:24px;color:#6b6b6b;font-size:13px">
        Also add this to your Netlify environment variables as <code>RC_REFRESH_TOKEN</code>.
        Then restart your dev server.
      </p>
    </body>
    </html>
  `, { headers: { "Content-Type": "text/html" } });
}
