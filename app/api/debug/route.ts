import { NextResponse } from "next/server";
import { getAccessToken, getTargetQueues, getQueueInboundCalls, extractAgentFromLegs } from "@/lib/ringcentral";

const RC_BASE = "https://platform.ringcentral.com";

export async function GET() {
  try {
    const token = await getAccessToken();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Find the target queues
    const queues = await getTargetQueues();

    // Fetch calls for each queue + show raw data
    const queueDetails = await Promise.all(
      queues.map(async (q) => {
        const calls = await getQueueInboundCalls(q.id, todayStart, now);
        return {
          queueId: q.id,
          queueName: q.name,
          queueType: q.type,
          totalCallsFetched: calls.length,
          calls: calls.slice(0, 10).map((c) => {
            const agent = extractAgentFromLegs(c.legs ?? []);
            return {
              id: c.id,
              startTime: c.startTime,
              result: c.result,
              direction: c.direction,
              duration: c.duration,
              from: c.from?.phoneNumber ?? c.from?.name,
              agent: agent ? { id: agent.id, name: agent.name } : null,
              legCount: c.legs?.length ?? 0,
              legs: (c.legs ?? []).map((l) => ({
                result: l.result,
                direction: l.direction,
                type: l.type,
                extType: l.extension?.type,
                extName: l.extension?.name,
                duration: l.duration,
              })),
            };
          }),
        };
      })
    );

    // Also fetch account-level call log for comparison
    const allCallsRes = await fetch(
      `${RC_BASE}/restapi/v1.0/account/~/call-log?dateFrom=${todayStart.toISOString()}&dateTo=${now.toISOString()}&direction=Inbound&perPage=10&view=Simple`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const allCalls = allCallsRes.ok ? await allCallsRes.json() : { error: allCallsRes.status };

    return NextResponse.json({
      serverTime: now.toISOString(),
      todayStart: todayStart.toISOString(),
      queuesFound: queues.map((q) => ({ id: q.id, name: q.name, type: q.type })),
      queueDetails,
      accountLevelInboundToday: {
        count: allCalls.records?.length ?? 0,
        sample: (allCalls.records ?? []).slice(0, 5).map((r: { startTime: string; result: string; from: { name?: string; phoneNumber?: string }; to: { name?: string; extensionId?: string } }) => ({
          startTime: r.startTime,
          result: r.result,
          from: r.from?.name ?? r.from?.phoneNumber,
          to: r.to?.name,
          toExtId: r.to?.extensionId,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
