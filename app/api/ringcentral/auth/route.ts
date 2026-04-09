import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.RC_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "RC_CLIENT_ID not set" }, { status: 500 });
  }

  const redirectUri = "http://localhost:3000/api/ringcentral/callback";
  const authUrl = new URL("https://platform.ringcentral.com/restapi/oauth/authorize");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);

  return NextResponse.redirect(authUrl.toString());
}
