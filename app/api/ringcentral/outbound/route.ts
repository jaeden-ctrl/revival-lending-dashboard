import { NextResponse } from "next/server";
import { getUserExtensions, getExtensionOutboundCalls } from "@/lib/ringcentral";
import type { OutboundKpis, LOOutboundStats, HourlyVolume, CallDetail } from "@/types/kpi";

interface Cache { data: OutboundKpis; cachedAt: number }
let cache: Cache | null = null;
const CACHE_TTL = 55 * 60 * 1000;

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

    const extensions = await getUserExtensions();

    // Fetch outbound calls per extension in parallel (cap at 30 extensions)
    const loResults = await Promise.all(
      extensions.slice(0, 30).map(async (ext) => {
        const calls = await getExtensionOutboundCalls(ext.id, todayStart, now);
        return { ext, calls };
      })
    );

    const allCalls = loResults.flatMap((r) => r.calls);

    // Per-LO stats
    const byLO: LOOutboundStats[] = loResults
      .filter((r) => r.calls.length > 0)
      .map(({ ext, calls }) => {
        const totalTalk = calls.reduce((s, c) => s + (c.duration ?? 0), 0);
        return {
          name: ext.name,
          extensionId: ext.id,
          total: calls.length,
          avgTalkTimeSec: calls.length > 0 ? Math.round(totalTalk / calls.length) : 0,
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

    const totalTalk = allCalls.reduce((s, c) => s + (c.duration ?? 0), 0);

    const result: OutboundKpis = {
      period: {
        total: allCalls.length,
        avgTalkTimeSec: allCalls.length > 0 ? Math.round(totalTalk / allCalls.length) : 0,
      },
      byLO,
      hourlyVolume: buildHourly(allCalls),
      lastUpdated: new Date().toISOString(),
    };

    cache = { data: result, cachedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ringcentral/outbound]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
