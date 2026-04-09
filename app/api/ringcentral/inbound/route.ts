import { NextResponse } from "next/server";
import {
  getTargetQueues,
  getQueueInboundCalls,
  extractAgentFromLegs,
  type RCDetailedCallRecord,
} from "@/lib/ringcentral";
import type {
  InboundKpis,
  LOInboundStats,
  HourlyVolume,
  CallDetail,
} from "@/types/kpi";

interface Cache { data: InboundKpis; cachedAt: number }
let cache: Cache | null = null;
const CACHE_TTL = 55 * 60 * 1000;

function isMissed(result: string) {
  return ["Missed", "Voicemail", "HangUp", "Declined"].includes(result);
}

function buildHourly(records: { startTime: string }[]): HourlyVolume[] {
  const counts: Record<number, number> = {};
  for (const r of records) {
    const h = new Date(r.startTime).getHours();
    counts[h] = (counts[h] ?? 0) + 1;
  }
  return Array.from({ length: 15 }, (_, i) => i + 7).map((h) => ({
    hour: h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`,
    calls: counts[h] ?? 0,
  }));
}

export async function GET() {
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Discover queues
    const queues = await getTargetQueues();
    if (queues.length === 0) {
      return NextResponse.json(
        { error: 'No queues found matching "Get That Bag" or "Fresh Leads". Check queue names in RingCentral.' },
        { status: 404 }
      );
    }

    // Fetch call logs from all target queues in parallel
    const allQueueCalls = await Promise.all(
      queues.map(async (q) => {
        const calls = await getQueueInboundCalls(q.id, todayStart, now);
        return calls.map((c) => ({ ...c, queueName: q.name }));
      })
    );
    const allCalls = allQueueCalls.flat();

    // Aggregate company totals
    const answered = allCalls.filter((c) => !isMissed(c.result));
    const missed = allCalls.filter((c) => isMissed(c.result));
    const totalTalk = answered.reduce((s, c) => s + (c.duration ?? 0), 0);

    // Build per-LO breakdown
    const loMap = new Map<string, {
      name: string;
      extensionId: string;
      answered: RCDetailedCallRecord[];
      missed: number;
    }>();

    for (const call of allCalls) {
      const agent = extractAgentFromLegs(call.legs ?? []);
      if (agent) {
        if (!loMap.has(agent.id)) {
          loMap.set(agent.id, { name: agent.name, extensionId: agent.id, answered: [], missed: 0 });
        }
        const lo = loMap.get(agent.id)!;
        if (!isMissed(call.result)) {
          lo.answered.push(call);
        } else {
          lo.missed++;
        }
      }
      // Missed calls with no agent attribution: counted in company total only
    }

    const byLO: LOInboundStats[] = Array.from(loMap.values())
      .map(({ name, extensionId, answered: ans, missed: m }) => {
        const totalLOTalk = ans.reduce((s, c) => s + (c.duration ?? 0), 0);
        return {
          name,
          extensionId,
          answered: ans.length,
          missed: m,
          avgTalkTimeSec: ans.length > 0 ? Math.round(totalLOTalk / ans.length) : 0,
          calls: ans.map((c): CallDetail => ({
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

    const result: InboundKpis = {
      period: {
        answered: answered.length,
        missed: missed.length,
        total: allCalls.length,
        avgTalkTimeSec: answered.length > 0 ? Math.round(totalTalk / answered.length) : 0,
      },
      byLO,
      hourlyVolume: buildHourly(allCalls),
      lastUpdated: new Date().toISOString(),
    };

    cache = { data: result, cachedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ringcentral/inbound]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
