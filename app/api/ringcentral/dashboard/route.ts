/**
 * Single endpoint that returns all RingCentral KPIs in one request.
 * This ensures only one token refresh happens per page load, avoiding 429s
 * that occurred when inbound + outbound routes each refreshed independently.
 */
import { NextResponse } from "next/server";
import {
  getAccessToken,
  getTargetQueues,
  getQueueInboundCalls,
  extractAgentFromLegs,
  getUserExtensions,
  getExtensionOutboundCalls,
  type RCDetailedCallRecord,
} from "@/lib/ringcentral";
import type {
  InboundKpis, LOInboundStats, OutboundKpis, LOOutboundStats,
  HourlyVolume, CallDetail,
} from "@/types/kpi";

export interface DashboardKpis {
  inbound: InboundKpis;
  outbound: OutboundKpis;
}

interface Cache { data: DashboardKpis; cachedAt: number }
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
    // Single token refresh for the entire request
    await getAccessToken();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // Fetch queues and extensions in parallel (token already cached)
    const [queues, extensions] = await Promise.all([
      getTargetQueues(),
      getUserExtensions(),
    ]);

    // Fetch all call data in parallel
    const [queueCallSets, outboundCallSets] = await Promise.all([
      Promise.all(
        queues.map(async (q) => {
          const calls = await getQueueInboundCalls(q.id, todayStart, now);
          return calls.map((c) => ({ ...c, queueName: q.name }));
        })
      ),
      Promise.all(
        extensions.slice(0, 30).map(async (ext) => {
          const calls = await getExtensionOutboundCalls(ext.id, todayStart, now);
          return { ext, calls };
        })
      ),
    ]);

    // ── Build Inbound KPIs ────────────────────────────────────────────────────
    const allInbound = queueCallSets.flat();
    const answeredIn = allInbound.filter((c) => !isMissed(c.result));
    const missedIn = allInbound.filter((c) => isMissed(c.result));
    const totalInTalk = answeredIn.reduce((s, c) => s + (c.duration ?? 0), 0);

    const loInMap = new Map<string, { name: string; extensionId: string; answered: RCDetailedCallRecord[]; missed: number }>();
    for (const call of allInbound) {
      const agent = extractAgentFromLegs(call.legs ?? []);
      if (agent) {
        if (!loInMap.has(agent.id)) {
          loInMap.set(agent.id, { name: agent.name, extensionId: agent.id, answered: [], missed: 0 });
        }
        const lo = loInMap.get(agent.id)!;
        if (!isMissed(call.result)) lo.answered.push(call);
        else lo.missed++;
      }
    }

    const byLOInbound: LOInboundStats[] = Array.from(loInMap.values())
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

    const inbound: InboundKpis = {
      period: {
        answered: answeredIn.length,
        missed: missedIn.length,
        total: allInbound.length,
        avgTalkTimeSec: answeredIn.length > 0 ? Math.round(totalInTalk / answeredIn.length) : 0,
      },
      byLO: byLOInbound,
      hourlyVolume: buildHourly(allInbound),
      lastUpdated: now.toISOString(),
    };

    // ── Build Outbound KPIs ───────────────────────────────────────────────────
    const allOutbound = outboundCallSets.flatMap((r) => r.calls);
    const totalOutTalk = allOutbound.reduce((s, c) => s + (c.duration ?? 0), 0);

    const byLOOutbound: LOOutboundStats[] = outboundCallSets
      .filter((r) => r.calls.length > 0)
      .map(({ ext, calls }) => {
        const talk = calls.reduce((s, c) => s + (c.duration ?? 0), 0);
        return {
          name: ext.name,
          extensionId: ext.id,
          total: calls.length,
          avgTalkTimeSec: calls.length > 0 ? Math.round(talk / calls.length) : 0,
          calls: calls.map((c): CallDetail => ({
            id: c.id,
            startTime: c.startTime,
            durationSec: c.duration ?? 0,
            result: c.result,
            queue: "",
            from: c.to?.phoneNumber ?? c.to?.name ?? "Unknown",
          })),
        };
      })
      .sort((a, b) => b.total - a.total);

    const outbound: OutboundKpis = {
      period: {
        total: allOutbound.length,
        avgTalkTimeSec: allOutbound.length > 0 ? Math.round(totalOutTalk / allOutbound.length) : 0,
      },
      byLO: byLOOutbound,
      hourlyVolume: buildHourly(allOutbound),
      lastUpdated: now.toISOString(),
    };

    const result: DashboardKpis = { inbound, outbound };
    cache = { data: result, cachedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ringcentral/dashboard]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
