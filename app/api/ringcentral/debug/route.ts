import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getTargetQueues, getQueueInboundCalls } from "@/lib/ringcentral";

const RC_BASE = "https://platform.ringcentral.com";

const TZ = "America/Los_Angeles";

function pacificMidnight(dateStr: string): Date {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`);
  const noonHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour: "numeric", hour12: false, hourCycle: "h23",
    }).format(noonUTC)
  );
  const offsetHours = noonHour - 12;
  return new Date(`${dateStr}T${String(-offsetHours).padStart(2, "0")}:00:00.000Z`);
}

function pacificTodayStart(): Date {
  const now = new Date();
  return pacificMidnight(now.toLocaleDateString("en-CA", { timeZone: TZ }));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const dateFrom = fromParam ? new Date(fromParam) : pacificTodayStart();
  const dateTo = toParam ? new Date(toParam) : now;

  try {
    const token = await getAccessToken();

    // Fetch every Department + Queue extension so we can see exact names
    const [deptRes, queueRes] = await Promise.all([
      fetch(`${RC_BASE}/restapi/v1.0/account/~/extension?type=Department&status=Enabled&perPage=250`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${RC_BASE}/restapi/v1.0/account/~/extension?type=Queue&status=Enabled&perPage=250`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    const allQueues = [
      ...((deptRes.ok ? (await deptRes.json()).records : []) ?? []),
      ...((queueRes.ok ? (await queueRes.json()).records : []) ?? []),
    ] as { id: string; name: string; type: string }[];

    const queues = await getTargetQueues();

    const queueResults = await Promise.all(
      queues.map(async (q) => {
        const calls = await getQueueInboundCalls(q.id, dateFrom, dateTo);
        const byDay: Record<string, number> = {};
        for (const c of calls) {
          const d = new Date(c.startTime).toLocaleDateString("en-CA", { timeZone: TZ });
          byDay[d] = (byDay[d] ?? 0) + 1;
        }
        return {
          queueId: q.id,
          queueName: q.name,
          rawCount: calls.length,
          byDay,
          callIds: calls.map((c) => c.id),
        };
      })
    );

    // Cross-queue duplicate IDs
    const allIds = queueResults.flatMap((r) => r.callIds);
    const idCounts: Record<string, number> = {};
    for (const id of allIds) idCounts[id] = (idCounts[id] ?? 0) + 1;
    const duplicateIds = Object.entries(idCounts)
      .filter(([, n]) => n > 1)
      .map(([id, n]) => ({ id, appearsInQueues: n }));

    const uniqueCount = new Set(allIds).size;

    return NextResponse.json({
      dateRange: {
        from: dateFrom.toISOString(),
        to: dateTo.toISOString(),
        fromPacific: dateFrom.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }),
        toPacific: dateTo.toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }),
      },
      allQueuesInRingCentral: allQueues.map((q) => ({ id: q.id, name: q.name, type: q.type })),
      matchedQueues: queues.map((q) => ({ id: q.id, name: q.name })),
      perQueue: queueResults.map(({ callIds: _, ...rest }) => rest),
      totalRawAcrossQueues: allIds.length,
      duplicateIdsAcrossQueues: duplicateIds,
      uniqueByCallId: uniqueCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
