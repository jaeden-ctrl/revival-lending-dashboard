import { NextRequest, NextResponse } from "next/server";
import {
  getAccessToken,
  getTargetQueues,
  getQueueInboundCalls,
  getUserExtensions,
  getUserInboundCalls,
  extractAgentFromLegs,
  type RCDetailedCallRecord,
  type RCExtension,
} from "@/lib/ringcentral";
import type { InboundKpis, LOInboundStats, HourlyVolume, CallDetail } from "@/types/kpi";

export interface LOStats {
  name: string;
  extensionId: string;
  answered: number;
  missed: number;
  avgTalkTimeSec: number;
  calls: CallDetail[];
}

export interface DashboardKpis {
  inbound: InboundKpis;
  loStats: LOStats[];
}

// Cache keyed by "fromISO|toHour" so different date ranges cache independently
const cacheMap = new Map<string, { data: DashboardKpis; cachedAt: number }>();
const CACHE_TTL = 55 * 60 * 1000;

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

function isMissed(result: string) {
  return ["Missed", "Voicemail", "HangUp", "Declined"].includes(result);
}

function buildVolume(records: { startTime: string }[], dateFrom: Date, dateTo: Date): HourlyVolume[] {
  const daysDiff = (dateTo.getTime() - dateFrom.getTime()) / (1000 * 60 * 60 * 24);

  if (daysDiff <= 1.5) {
    const counts: Record<number, number> = {};
    for (const r of records) {
      const h = parseInt(
        new Intl.DateTimeFormat("en-US", {
          timeZone: TZ, hour: "numeric", hour12: false, hourCycle: "h23",
        }).format(new Date(r.startTime))
      );
      counts[h] = (counts[h] ?? 0) + 1;
    }
    return Array.from({ length: 15 }, (_, i) => i + 7).map((h) => ({
      hour: h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`,
      calls: counts[h] ?? 0,
    }));
  } else {
    const counts: Record<string, number> = {};
    for (const r of records) {
      const d = new Date(r.startTime).toLocaleDateString("en-CA", { timeZone: TZ });
      counts[d] = (counts[d] ?? 0) + 1;
    }
    const result: HourlyVolume[] = [];
    const cursor = new Date(dateFrom);
    while (cursor < dateTo) {
      const dateStr = cursor.toLocaleDateString("en-CA", { timeZone: TZ });
      const label = cursor.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
      result.push({ hour: label, calls: counts[dateStr] ?? 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return result;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const dateFrom = fromParam ? new Date(fromParam) : pacificTodayStart();
  const dateTo = toParam ? new Date(toParam) : now;

  const cacheKey = `${dateFrom.toISOString()}|${dateTo.toISOString().slice(0, 13)}`;
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    await getAccessToken();

    // Fetch queue totals and user extensions in parallel
    const [queues, userExtensions] = await Promise.all([
      getTargetQueues(),
      getUserExtensions(),
    ]);

    // Queue-level inbound (for company totals + hourly chart)
    const queueCallSets = await Promise.all(
      queues.map(async (q) => {
        const calls = await getQueueInboundCalls(q.id, dateFrom, dateTo);
        return calls.map((c) => ({ ...c, queueName: q.name }));
      })
    );
    const allInbound = queueCallSets.flat();
    const answeredIn = allInbound.filter((c) => !isMissed(c.result));
    const missedIn = allInbound.filter((c) => isMissed(c.result));
    const totalInTalk = answeredIn.reduce((s, c) => s + (c.duration ?? 0), 0);

    // byLO from queue legs (kept for the drill-down table in InboundMetrics)
    const loMap = new Map<string, { name: string; extensionId: string; answered: RCDetailedCallRecord[]; missed: number }>();
    for (const call of allInbound) {
      const agent = extractAgentFromLegs(call.legs ?? []);
      if (agent) {
        if (!loMap.has(agent.id)) loMap.set(agent.id, { name: agent.name, extensionId: agent.id, answered: [], missed: 0 });
        const lo = loMap.get(agent.id)!;
        if (!isMissed(call.result)) lo.answered.push(call);
        else lo.missed++;
      }
    }
    const byLO: LOInboundStats[] = Array.from(loMap.values())
      .map(({ name, extensionId, answered, missed }) => {
        const talk = answered.reduce((s, c) => s + (c.duration ?? 0), 0);
        return {
          name, extensionId,
          answered: answered.length,
          missed,
          avgTalkTimeSec: answered.length > 0 ? Math.round(talk / answered.length) : 0,
          calls: answered.map((c): CallDetail => ({
            id: c.id,
            startTime: c.startTime,
            durationSec: c.duration ?? 0,
            result: "Answered",
            queue: (c as typeof c & { queueName: string }).queueName ?? "",
            from: c.from?.phoneNumber ?? c.from?.name ?? "Unknown",
          })),
        };
      })
      .sort((a, b) => b.answered - a.answered);

    // Per-user inbound call logs (direct, not filtered to queues)
    const userCallSets = await Promise.all(
      userExtensions.map(async (u: RCExtension) => {
        const calls = await getUserInboundCalls(u.id, dateFrom, dateTo);
        return { user: u, calls };
      })
    );

    const loStats: LOStats[] = userCallSets
      .map(({ user, calls }) => {
        const answered = calls.filter((c) => !isMissed(c.result));
        const missed = calls.filter((c) => isMissed(c.result));
        const talk = answered.reduce((s, c) => s + (c.duration ?? 0), 0);
        return {
          name: user.name,
          extensionId: user.id,
          answered: answered.length,
          missed: missed.length,
          avgTalkTimeSec: answered.length > 0 ? Math.round(talk / answered.length) : 0,
          calls: answered.map((c): CallDetail => ({
            id: c.id,
            startTime: c.startTime,
            durationSec: c.duration ?? 0,
            result: "Answered",
            queue: "",
            from: c.from?.phoneNumber ?? c.from?.name ?? "Unknown",
          })),
        };
      })
      .filter((lo) => lo.answered + lo.missed > 0)
      .sort((a, b) => b.answered - a.answered);

    const inbound: InboundKpis = {
      period: {
        answered: answeredIn.length,
        missed: missedIn.length,
        total: allInbound.length,
        avgTalkTimeSec: answeredIn.length > 0 ? Math.round(totalInTalk / answeredIn.length) : 0,
      },
      byLO,
      hourlyVolume: buildVolume(allInbound, dateFrom, dateTo),
      lastUpdated: now.toISOString(),
    };

    const result: DashboardKpis = { inbound, loStats };
    cacheMap.set(cacheKey, { data: result, cachedAt: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ringcentral/dashboard]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
