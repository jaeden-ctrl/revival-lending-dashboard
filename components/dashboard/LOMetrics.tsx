"use client";

import { useQuery } from "@tanstack/react-query";
import { SectionSkeleton } from "@/components/ui/Loader";
import type { DashboardKpis } from "@/app/api/ringcentral/dashboard/route";
import type { LOInboundStats } from "@/types/kpi";
import type { DateRange } from "@/lib/dateRange";

const GOLD = "#C48B1F";
function fmt(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

async function fetchDashboard(range: DateRange): Promise<DashboardKpis> {
  const url = new URL("/api/ringcentral/dashboard", window.location.origin);
  url.searchParams.set("from", range.from);
  url.searchParams.set("to", range.to);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(e.error ?? "Failed to fetch");
  }
  return res.json();
}

// ─── LO Card ─────────────────────────────────────────────────────────────────

function LOCard({ lo }: { lo: LOInboundStats }) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Name */}
      <div className="text-sm font-semibold uppercase tracking-wider truncate" style={{ color: "var(--color-text)" }}>
        {lo.name}
      </div>

      {/* Answered */}
      <div className="rounded-lg p-3 text-center" style={{ background: "#0F0F0F" }}>
        <div className="text-2xl font-bold tabular-nums" style={{ color: GOLD }}>{lo.answered}</div>
        <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>Answered</div>
      </div>

      {/* Avg Talk */}
      <div className="pt-1" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-muted)" }}>Avg Talk</div>
        <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{fmt(lo.avgTalkTimeSec)}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function LOMetrics({ queryKey, range }: { queryKey: string; range: DateRange }) {
  const { data: dashboard, isLoading, isError, error } = useQuery<DashboardKpis>({
    queryKey: ["rc-dashboard", queryKey],
    queryFn: () => fetchDashboard(range),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });

  const byLO = dashboard?.inbound.byLO ?? [];

  return (
    <section>
      <div className="mb-5">
        <h2 className="text-base font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
          Loan Officers
        </h2>
      </div>

      {isError && (
        <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "#2a1010", border: "1px solid var(--color-danger)", color: "var(--color-danger)" }}>
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <SectionSkeleton count={4} />
      ) : byLO.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>No call data for this period.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {byLO.map((lo) => (
            <LOCard key={lo.extensionId} lo={lo} />
          ))}
        </div>
      )}
    </section>
  );
}
