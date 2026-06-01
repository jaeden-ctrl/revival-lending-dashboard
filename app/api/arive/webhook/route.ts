import { NextRequest, NextResponse } from "next/server";
import { upsertLoan, MILESTONE_FIELD_MAP } from "@/lib/arive";
import type { ARIVEWebhookPayload } from "@/types/arive";

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!process.env.ARIVE_WEBHOOK_SECRET || secret !== process.env.ARIVE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: ARIVEWebhookPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload.loan_number) {
    return NextResponse.json({ error: "Missing required field: loan_number" }, { status: 400 });
  }
  if (!payload.milestone || !(payload.milestone in MILESTONE_FIELD_MAP)) {
    return NextResponse.json(
      { error: `Unknown milestone "${payload.milestone}". Valid values: ${Object.keys(MILESTONE_FIELD_MAP).join(", ")}` },
      { status: 400 }
    );
  }
  if (!payload.date) {
    return NextResponse.json({ error: "Missing required field: date (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const loan = await upsertLoan(payload);
    return NextResponse.json({ ok: true, loanNumber: loan.loanNumber, milestone: payload.milestone });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/arive/webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
