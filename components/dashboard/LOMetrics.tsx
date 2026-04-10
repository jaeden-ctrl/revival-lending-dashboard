"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { SectionSkeleton } from "@/components/ui/Loader";
import type { DashboardKpis } from "@/app/api/ringcentral/dashboard/route";
import type { LOInboundStats } from "@/types/kpi";
import type { DateRange } from "@/lib/dateRange";

const GOLD = "#C48B1F";
const GOLD_DIM = "#7A5811";
const SURFACE_2 = "#1A1A1A";
const DANGER = "#E05252";

function fmt(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function answerRate(answered: number, missed: number): string {
  const total = answered + missed;
  if (total === 0) return "—";
  return `${Math.round((answered / total) * 100)}%`;
}

function firstLast(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
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
  const rate = lo.answered + lo.missed > 0
    ? Math.round((lo.answered / (lo.answered + lo.missed)) * 100)
    : null;

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-4"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      {/* Name */}
      <div className="text-sm font-semibold uppercase tracking-wider truncate" style={{ color: "var(--color-text)" }}>
        {lo.name}
      </div>

      {/* Answered / Missed */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg p-3 text-center" style={{ background: "#0F0F0F" }}>
          <div className="text-2xl font-bold tabular-nums" style={{ color: GOLD }}>{lo.answered}</div>
          <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>Answered</div>
        </div>
        <div className="rounded-lg p-3 text-center" style={{ background: "#0F0F0F" }}>
          <div
            className="text-2xl font-bold tabular-nums"
            style={{ color: lo.missed > 0 ? DANGER : "var(--color-muted)" }}
          >
            {lo.missed}
          </div>
          <div className="text-xs uppercase tracking-wider mt-1" style={{ color: "var(--color-muted)" }}>Missed</div>
        </div>
      </div>

      {/* Avg Talk / Answer Rate */}
      <div className="grid grid-cols-2 gap-3 pt-1" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-muted)" }}>Avg Talk</div>
          <div className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{fmt(lo.avgTalkTimeSec)}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: "var(--color-muted)" }}>Answer Rate</div>
          <div
            className="text-sm font-medium"
            style={{ color: rate !== null && rate >= 80 ? GOLD : rate !== null && rate < 60 ? DANGER : "var(--color-text)" }}
          >
            {rate !== null ? `${rate}%` : "—"}
          </div>
        </div>
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

  // Chart data: abbreviated names for chart axis
  const chartData = byLO.map((lo) => ({
    name: firstLast(lo.name),
    answered: lo.answered,
    missed: lo.missed,
  }));

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
        <div className="space-y-6">
          {/* LO Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {byLO.map((lo) => (
              <LOCard key={lo.extensionId} lo={lo} />
            ))}
          </div>

          {/* Answered vs Missed bar chart */}
          {chartData.length > 0 && (
            <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>
                Calls by Loan Officer
              </h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} barSize={18} barGap={4} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fill: "#6B6B6B", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6B6B6B", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: SURFACE_2 }}
                    contentStyle={{ background: "#141414", border: "1px solid #1F1F1F", borderRadius: 8, color: "#F5F5F5", fontSize: 12 }}
                    labelStyle={{ color: GOLD }}
                  />
                  <Bar dataKey="answered" name="Answered" radius={[4, 4, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={GOLD} />)}
                  </Bar>
                  <Bar dataKey="missed" name="Missed" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.missed > 0 ? DANGER : GOLD_DIM} fillOpacity={0.4} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
