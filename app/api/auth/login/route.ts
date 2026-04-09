import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  const expected = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.COOKIE_SECRET;

  if (!expected || !secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (password !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = createHmac("sha256", secret).update(password).digest("hex");

  const response = NextResponse.json({ ok: true });
  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return response;
}
