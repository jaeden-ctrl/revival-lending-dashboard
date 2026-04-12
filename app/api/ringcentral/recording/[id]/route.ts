import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ringcentral";

const RC_BASE = "https://platform.ringcentral.com";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = await getAccessToken();

    const res = await fetch(
      `${RC_BASE}/restapi/v1.0/account/~/recording/${id}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      return new NextResponse("Recording not found", { status: res.status });
    }

    const contentType = res.headers.get("content-type") ?? "audio/mpeg";

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    return new NextResponse((err as Error).message, { status: 500 });
  }
}
