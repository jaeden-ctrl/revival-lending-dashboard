import { NextResponse } from "next/server";
import { getExtensions, getCallLog, getExtensionCallLog } from "@/lib/ringcentral";
import type { CallKpis, CallPeriodStats, HourlyVolume, RepStats } from "@/types/kpi";

// In-memory cache — re-fetch at most every 55 minutes
interface CachedResult {
  data: CallKpis;
  cachedAt: number;
}
let cache: CachedResult | null = null;
const CACHE_TTL_MS = 55 * 60 * 1000;

function isMissed(result: string): boolean {
  return ["Missed", "Voicemail", "HangUp"].includes(result);
}

function buildStats(records: { direction: string; result: string; duration: number }[]): CallPeriodStats {
  const inbound = records.filter((r) => r.direction === "Inbound");
  const outbound = records.filter((r) => r.direction === "Outbound");
  const missed = records.filter((r) => isMissed(r.result));
  const answered = records.filter((r) => !isMissed(r.result));
  const totalDuration = answered.reduce((sum, r) => sum + (r.duration ?? 0), 0);

  return {
    total: records.length,
    inbound: inbound.length,
    outbound: outbound.length,
    missed: missed.length,
    avgDurationSec: answered.length > 0 ? Math.round(totalDuration / answered.length) : 0,
    answerRate: records.length > 0 ? Math.round(((records.length - missed.length) / records.length) * 100) : 0,
  };
}

function buildHourlyVolume(records: { startTime: string }[]): HourlyVolume[] {
  const counts: Record<number, number> = {};
  for (const r of records) {
    const h = new Date(r.startTime).getHours();
    counts[h] = (counts[h] ?? 0) + 1;
  }

  // Business hours 7am–9pm
  return Array.from({ length: 15 }, (_, i) => i + 7).map((h) => ({
    hour: h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`,
    calls: counts[h] ?? 0,
  }));
}

export async function GET() {
  // Serve from cache if fresh
  if (cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const now = new Date();

    // Today
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // This week (Mon–Sun)
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
    weekStart.setHours(0, 0, 0, 0);

    // This month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Fetch call log from start of month (covers all three windows)
    const [allCalls, extensions] = await Promise.all([
      getCallLog(monthStart, now),
      getExtensions(),
    ]);

    const todayCalls = allCalls.filter((r) => new Date(r.startTime) >= todayStart);
    const weekCalls = allCalls.filter((r) => new Date(r.startTime) >= weekStart);

    // Build per-rep stats using per-extension call logs for today
    const repStats: RepStats[] = await Promise.all(
      extensions.slice(0, 20).map(async (ext) => {
        const extCalls = await getExtensionCallLog(ext.id, todayStart, now);
        const stats = buildStats(extCalls);
        return {
          name: ext.name,
          extension: ext.extensionNumber,
          ...stats,
        };
      })
    );

    // Filter reps with activity
    const activeReps = repStats
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);

    const result: CallKpis = {
      today: buildStats(todayCalls),
      week: buildStats(weekCalls),
      month: buildStats(allCalls),
      hourlyVolume: buildHourlyVolume(todayCalls),
      byRep: activeReps,
      lastUpdated: new Date().toISOString(),
    };

    cache = { data: result, cachedAt: Date.now() };
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/ringcentral/calls]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
