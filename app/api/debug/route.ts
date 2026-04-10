import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/ringcentral";

const RC_BASE = "https://platform.ringcentral.com";

export async function GET() {
  try {
    const token = await getAccessToken();

    // Fetch all extensions to see what types/names exist
    const [deptRes, queueRes, userRes] = await Promise.all([
      fetch(`${RC_BASE}/restapi/v1.0/account/~/extension?type=Department&status=Enabled&perPage=250`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${RC_BASE}/restapi/v1.0/account/~/extension?type=Queue&status=Enabled&perPage=250`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${RC_BASE}/restapi/v1.0/account/~/extension?type=User&status=Enabled&perPage=10`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    const deptData = deptRes.ok ? await deptRes.json() : { error: deptRes.status };
    const queueData = queueRes.ok ? await queueRes.json() : { error: queueRes.status };
    const userData = userRes.ok ? await userRes.json() : { error: userRes.status };

    // Try fetching today's call log (just first page)
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const callRes = await fetch(
      `${RC_BASE}/restapi/v1.0/account/~/call-log?dateFrom=${todayStart.toISOString()}&dateTo=${now.toISOString()}&perPage=5&view=Simple`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const callData = callRes.ok ? await callRes.json() : { error: callRes.status };

    return NextResponse.json({
      tokenOk: true,
      departments: (deptData.records ?? []).map((r: { id: string; name: string; type: string }) => ({ id: r.id, name: r.name, type: r.type })),
      queues: (queueData.records ?? []).map((r: { id: string; name: string; type: string }) => ({ id: r.id, name: r.name, type: r.type })),
      sampleUsers: (userData.records ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })),
      recentCallCount: callData.records?.length ?? 0,
      recentCallSample: (callData.records ?? []).slice(0, 3).map((r: { startTime: string; direction: string; result: string; from: { name?: string }; to: { name?: string } }) => ({
        startTime: r.startTime,
        direction: r.direction,
        result: r.result,
        from: r.from?.name,
        to: r.to?.name,
      })),
    });
  } catch (err) {
    return NextResponse.json({ tokenOk: false, error: (err as Error).message }, { status: 500 });
  }
}
