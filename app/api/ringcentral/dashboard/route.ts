import { NextRequest, NextResponse } from "next/server";
import {
  getAccessToken,
  getTargetQueues,
  getQueueInboundCalls,
  getUserExtensions,
  extractAgentFromLegs,
  type RCDetailedCallRecord,
} from "@/lib/ringcentral";
import { areaCodeToState } from "@/lib/areaCodes";
import type { InboundKpis, LOInboundStats, HourlyVolume, CallDetail, StateVolume } from "@/types/kpi";

export interface DashboardKpis {
  inbound: InboundKpis;
}

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

/** Calls aggregated by hour-of-day (7am–9pm Pacific), across all days in range. */
function buildHourlyVolume(records: { startTime: string }[]): HourlyVolume[] {
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
}

/** Calls grouped by US state (derived from caller area code). */
function buildByState(records: { from?: { phoneNumber?: string } }[]): StateVolume[] {
  const counts: Record<string, number> = {};
  for (const r of records) {
    const phone = r.from?.phoneNumber ?? "";
    const state = areaCodeToState(phone);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([state, calls]) => ({ state, calls }))
    .sort((a, b) => b.calls - a.calls);
}

/** Calls by calendar day (Pacific), one bar per day in the range. */
function buildDailyVolume(records: { startTime: string }[], dateFrom: Date, dateTo: Date): HourlyVolume[] {
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const dateFrom = fromParam ? new Date(fromParam) : pacificTodayStart();
  const dateTo = toParam ? new Date(toParam) : now;

  // For rolling "to=now" queries, round to the hour so the cache actually hits.
  // For explicit custom date ranges, use full precision so different to-dates don't collide.
  const toKey = toParam ? dateTo.toISOString() : dateTo.toISOString().slice(0, 13);
  const cacheKey = `${dateFrom.toISOString()}|${toKey}`;
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    await getAccessToken();

    // Fetch queues and user extensions in parallel
    const [queues, userExtensions] = await Promise.all([
      getTargetQueues(),
      getUserExtensions(),
    ]);

    // Build ID → name map for agent name lookup (legs don't include names)
    const agentNames = new Map(userExtensions.map((u) => [String(u.id), u.name]));

    const queueCallSets = await Promise.all(
      queues.map(async (q) => {
        const calls = await getQueueInboundCalls(q.id, dateFrom, dateTo);
        return calls.map((c) => ({ ...c, queueName: q.name, queueId: q.id }));
      })
    );

    // Deduplicate by call ID — same call can appear in multiple queue logs.
    // When it does, prefer the entry whose queueId actually appears in the call's
    // legs (true routing path) over one that inherited the call via overflow.
    const callMap = new Map<string, (typeof queueCallSets)[0][0]>();
    for (const call of queueCallSets.flat()) {
      const existing = callMap.get(call.id);
      if (!existing) {
        callMap.set(call.id, call);
        continue;
      }
      const thisInLegs  = call.legs.some((l) => l.extension?.id === call.queueId);
      const existInLegs = existing.legs.some((l) => l.extension?.id === existing.queueId);
      if (thisInLegs && !existInLegs) callMap.set(call.id, call);
    }
    const allInbound = Array.from(callMap.values());

    allInbound.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const answeredIn = allInbound.filter((c) => !isMissed(c.result));
    const missedIn = allInbound.filter((c) => isMissed(c.result));
    const totalInTalk = answeredIn.reduce((s, c) => s + (c.duration ?? 0), 0);

    // Build per-LO stats — skip queue's own leg when finding the answering agent
    const loMap = new Map<string, {
      name: string; extensionId: string;
      answered: (RCDetailedCallRecord & { queueName: string })[]; missed: number;
    }>();

    for (const call of allInbound) {
      const agent = extractAgentFromLegs(call.legs ?? [], call.queueId);
      if (!agent) continue;

      const agentName = agentNames.get(agent.id) ?? agent.id;
      if (!loMap.has(agent.id)) {
        loMap.set(agent.id, { name: agentName, extensionId: agent.id, answered: [], missed: 0 });
      }
      const lo = loMap.get(agent.id)!;
      if (!isMissed(call.result)) lo.answered.push(call);
      else lo.missed++;
    }

    const byLO: LOInboundStats[] = Array.from(loMap.values())
      .map(({ name, extensionId, answered, missed }) => {
        // Deduplicate by caller phone number — keep the longest call per unique caller
        const longestByPhone = new Map<string, typeof answered[0]>();
        for (const call of answered) {
          const phone = call.from?.phoneNumber ?? call.from?.name ?? "Unknown";
          const existing = longestByPhone.get(phone);
          if (!existing || (call.duration ?? 0) > (existing.duration ?? 0)) {
            longestByPhone.set(phone, call);
          }
        }
        const deduped = Array.from(longestByPhone.values());
        const talk = deduped.reduce((s, c) => s + (c.duration ?? 0), 0);
        return {
          name, extensionId,
          answered: deduped.length,
          missed,
          avgTalkTimeSec: deduped.length > 0 ? Math.round(talk / deduped.length) : 0,
          calls: deduped.map((c): CallDetail => ({
            id: c.id,
            startTime: c.startTime,
            durationSec: c.duration ?? 0,
            result: "Answered",
            queue: c.queueName,
            from: c.from?.phoneNumber ?? c.from?.name ?? "Unknown",
            recordingId: c.recording?.id,
          })),
        };
      })
      .sort((a, b) => b.answered - a.answered);

    const missedCallDetails: CallDetail[] = missedIn.map((c) => ({
      id: c.id,
      startTime: c.startTime,
      durationSec: c.duration ?? 0,
      result: c.result,
      queue: (c as typeof c & { queueName: string }).queueName ?? "",
      from: c.from?.phoneNumber ?? c.from?.name ?? "Unknown",
    }));

    const uniqueCallers = new Set(
      allInbound.map((c) => c.from?.phoneNumber).filter(Boolean)
    ).size;

    const inbound: InboundKpis = {
      period: {
        answered: answeredIn.length,
        missed: missedIn.length,
        total: allInbound.length,
        uniqueCallers,
        avgTalkTimeSec: answeredIn.length > 0 ? Math.round(totalInTalk / answeredIn.length) : 0,
      },
      byLO,
      missedCalls: missedCallDetails,
      hourlyVolume: buildHourlyVolume(allInbound),
      dailyVolume: buildDailyVolume(allInbound, dateFrom, dateTo),
      byState: buildByState(allInbound),
      lastUpdated: now.toISOString(),
    };

    const result: DashboardKpis = { inbound };
    cacheMap.set(cacheKey, { data: result, cachedAt: Date.now() });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ringcentral/dashboard]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
