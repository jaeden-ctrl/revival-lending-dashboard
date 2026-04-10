import { NextResponse } from "next/server";
import { getAccessToken, getTargetQueues } from "@/lib/ringcentral";

const RC_BASE = "https://platform.ringcentral.com";

export async function GET() {
  try {
    const token = await getAccessToken();

    const now = new Date();
    // Look back 7 days
    const from = new Date(now);
    from.setDate(from.getDate() - 7);

    const queues = await getTargetQueues();

    // Fetch detailed call log for each queue
    const queueDetails = await Promise.all(
      queues.map(async (q) => {
        const res = await fetch(
          `${RC_BASE}/restapi/v1.0/account/~/extension/${q.id}/call-log?dateFrom=${from.toISOString()}&dateTo=${now.toISOString()}&direction=Inbound&view=Detailed&perPage=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = res.ok ? await res.json() : { error: res.status };
        return {
          queue: q.name,
          queueId: q.id,
          totalFetched: data.records?.length ?? 0,
          calls: (data.records ?? []).map((c: {
            id: string; startTime: string; result: string; duration: number;
            from: { phoneNumber?: string; name?: string };
            legs?: { result: string; direction: string; type: string; duration: number; extension?: { id: string; name: string; type: string } }[];
          }) => ({
            id: c.id,
            startTime: c.startTime,
            result: c.result,
            duration: c.duration,
            from: c.from?.phoneNumber ?? c.from?.name,
            legCount: c.legs?.length ?? 0,
            legs: (c.legs ?? []).map((l) => ({
              result: l.result,
              direction: l.direction,
              type: l.type,
              duration: l.duration,
              extension: l.extension ?? null,
            })),
          })),
        };
      })
    );

    // Also fetch account-level Detailed inbound (last 7 days, first 5)
    const acctRes = await fetch(
      `${RC_BASE}/restapi/v1.0/account/~/call-log?dateFrom=${from.toISOString()}&dateTo=${now.toISOString()}&direction=Inbound&view=Detailed&perPage=5`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const acctData = acctRes.ok ? await acctRes.json() : { error: acctRes.status };

    return NextResponse.json({
      serverTime: now.toISOString(),
      queuesFound: queues.map((q) => ({ id: q.id, name: q.name })),
      queueDetails,
      accountLevelSample: (acctData.records ?? []).map((c: {
        startTime: string; result: string;
        from: { name?: string; phoneNumber?: string };
        to: { name?: string; extensionId?: string };
        legs?: { result: string; extension?: { id: string; name: string; type: string } }[];
      }) => ({
        startTime: c.startTime,
        result: c.result,
        from: c.from?.name ?? c.from?.phoneNumber,
        toName: c.to?.name,
        toExtId: c.to?.extensionId,
        legCount: c.legs?.length ?? 0,
        legs: (c.legs ?? []).map((l) => ({
          result: l.result,
          extension: l.extension ?? null,
        })),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
