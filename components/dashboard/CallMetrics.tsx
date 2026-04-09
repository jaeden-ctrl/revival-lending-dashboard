"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionSkeleton } from "@/components/ui/Loader";
import type { CallKpis } from "@/types/kpi";

const GOLD = "#C9A84C";
const GOLD_DIM = "#8A6E2F";
const SURFACE_2 = "#1A1A1A";

function formatDuration(sec: number): string {
  if (sec === 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatLastUpdated(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

async function fetchCallKpis(): Promise<CallKpis> {
  const res = await fetch("/api/ringcentral/calls");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error ?? "Failed to fetch call data");
  }
  return res.json();
}

type Period = "today" | "week" | "month";

export function CallMetrics() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useQuery<CallKpis>({
    queryKey: ["ringcentral-calls"],
    queryFn: fetchCallKpis,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 60 * 60 * 1000,
  });

  const [period, setPeriod] = useState<Period>("today");

  const stats = data ? data[period] : null;

  return (
    <section>
      {/* Section Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold uppercase tracking-widest" style={{ color: "var(--color-gold)" }}>
            Call Activity
          </h2>
          {data && (
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              Updated {formatLastUpdated(data.lastUpdated)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Period toggle */}
          <div
            className="flex rounded-lg overflow-hidden text-xs font-medium"
            style={{ border: "1px solid var(--color-border)" }}
          >
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1.5 capitalize transition-all"
                style={{
                  background: period === p ? "var(--color-gold)" : "var(--color-surface)",
                  color: period === p ? "#0A0A0A" : "var(--color-muted)",
                }}
              >
                {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["ringcentral-calls"] })}
            title="Refresh data"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-muted)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-gold)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-gold)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-muted)";
            }}
          >
            ↺
          </button>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div
          className="rounded-xl p-4 mb-4 text-sm"
          style={{ background: "#2a1010", border: "1px solid var(--color-danger)", color: "var(--color-danger)" }}
        >
          Failed to load call data: {(error as Error).message}
        </div>
      )}

      {/* KPI Cards */}
      {isLoading ? (
        <SectionSkeleton count={5} />
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
          <KpiCard label="Total Calls" value={stats.total} highlight />
          <KpiCard label="Inbound" value={stats.inbound} />
          <KpiCard label="Outbound" value={stats.outbound} />
          <KpiCard label="Missed" value={stats.missed} />
          <KpiCard
            label="Avg Duration"
            value={formatDuration(stats.avgDurationSec)}
            sub={`${stats.answerRate}% answer rate`}
          />
        </div>
      ) : null}

      {/* Charts Row */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Hourly Volume */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>
              Today — Hourly Volume
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.hourlyVolume} barSize={12}>
                <CartesianGrid vertical={false} stroke="#1F1F1F" />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: "#6B6B6B", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#6B6B6B", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: SURFACE_2 }}
                  contentStyle={{
                    background: "#141414",
                    border: "1px solid #1F1F1F",
                    borderRadius: 8,
                    color: "#F5F5F5",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: GOLD }}
                />
                <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                  {data.hourlyVolume.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        data.hourlyVolume[i].calls > 0
                          ? GOLD
                          : GOLD_DIM
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Calls by Rep */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          >
            <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>
              Calls by Rep — Today
            </h3>
            {data.byRep.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                No call activity yet today.
              </p>
            ) : (
              <div className="space-y-3">
                {data.byRep.slice(0, 8).map((rep) => {
                  const max = data.byRep[0].total;
                  const pct = max > 0 ? (rep.total / max) * 100 : 0;
                  return (
                    <div key={rep.extension} className="flex items-center gap-3">
                      <span
                        className="text-xs w-28 truncate shrink-0"
                        style={{ color: "var(--color-text)" }}
                        title={rep.name}
                      >
                        {rep.name}
                      </span>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: SURFACE_2 }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: GOLD }}
                        />
                      </div>
                      <span className="text-xs w-6 text-right shrink-0" style={{ color: GOLD }}>
                        {rep.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// useState import fix — needs to be at top
import { useState } from "react";
