import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const clientId = process.env.RC_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "RC_CLIENT_ID not set" }, { status: 500 });
  }

  // Use the actual host so this works on both localhost and Netlify
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/ringcentral/callback`;

  const authUrl = new URL("https://platform.ringcentral.com/restapi/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(authUrl.toString());
}
