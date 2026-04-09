"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionSkeleton } from "@/components/ui/Loader";
import type { OutboundKpis, LOOutboundStats, CallDetail } from "@/types/kpi";
import type { DashboardKpis } from "@/app/api/ringcentral/dashboard/route";

const GOLD = "#C48B1F";
const SURFACE_2 = "#1A1A1A";

function fmt(sec: number) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtPhone(raw: string) {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return raw;
}

async function fetchDashboard(): Promise<DashboardKpis> {
  const res = await fetch("/api/ringcentral/dashboard");
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(e.error ?? "Failed to fetch call data");
  }
  return res.json();
}

// ─── Drill-down Row ───────────────────────────────────────────────────────────

function LORow({ lo, isLast }: { lo: LOOutboundStats; isLast: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className="cursor-pointer transition-colors"
        style={{ borderBottom: isLast && !open ? "none" : "1px solid var(--color-border)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = SURFACE_2)}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <td className="py-3 pl-4 pr-2">
          <div className="flex items-center gap-2">
            <span
              className="text-xs inline-block"
              style={{ color: "var(--color-muted)", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            >
              ▶
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>{lo.name}</span>
          </div>
        </td>
        <td className="py-3 px-3 text-center">
          <span className="text-sm font-semibold" style={{ color: GOLD }}>{lo.total}</span>
        </td>
        <td className="py-3 pr-4 pl-3 text-right">
          <span className="text-sm" style={{ color: "var(--color-muted)" }}>{fmt(lo.avgTalkTimeSec)}</span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={3} className="p-0">
            <div className="mx-2 mb-2 rounded-lg overflow-hidden" style={{ background: "#0F0F0F", border: "1px solid var(--color-border)" }}>
              {lo.calls.length === 0 ? (
                <p className="text-xs p-3" style={{ color: "var(--color-muted)" }}>No call details available.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <th className="py-2 pl-4 pr-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Time</th>
                      <th className="py-2 px-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>To</th>
                      <th className="py-2 pr-4 pl-3 text-right font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lo.calls.map((c: CallDetail, i: number) => (
                      <tr key={c.id} style={{ borderBottom: i < lo.calls.length - 1 ? "1px solid #1a1a1a" : "none" }}>
                        <td className="py-2 pl-4 pr-3" style={{ color: "var(--color-text)" }}>{fmtTime(c.startTime)}</td>
                        <td className="py-2 px-3" style={{ color: "var(--color-muted)" }}>{fmtPhone(c.from)}</td>
                        <td className="py-2 pr-4 pl-3 text-right" style={{ color: "var(--color-muted)" }}>{fmt(c.durationSec)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OutboundMetrics() {
  const queryClient = useQueryClient();
  const { data: dashboard, isLoading, isError, error } = useQuery<DashboardKpis>({
    queryKey: ["rc-dashboard"],
    queryFn: fetchDashboard,
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });
  const data = dashboard?.outbound ?? null;

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
            Outbound Calls
          </h2>
          {data && (
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>
              Updated {new Date(data.lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>
        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: ["rc-dashboard"] })}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-muted)"; }}
        >
          ↺
        </button>
      </div>

      {isError && (
        <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "#2a1010", border: "1px solid var(--color-danger)", color: "var(--color-danger)" }}>
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <SectionSkeleton count={2} />
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <KpiCard label="Total Outbound" value={data.period.total} highlight />
          <KpiCard label="Avg Talk Time" value={fmt(data.period.avgTalkTimeSec)} />
        </div>
      ) : null}

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Hourly chart */}
          <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>
              Outbound Volume — Today
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.hourlyVolume} barSize={12}>
                <CartesianGrid vertical={false} stroke="#1F1F1F" />
                <XAxis dataKey="hour" tick={{ fill: "#6B6B6B", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B6B6B", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: SURFACE_2 }}
                  contentStyle={{ background: "#141414", border: "1px solid #1F1F1F", borderRadius: 8, color: "#F5F5F5", fontSize: 12 }}
                  labelStyle={{ color: GOLD }}
                />
                <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                  {data.hourlyVolume.map((entry, i) => (
                    <Cell key={i} fill={entry.calls > 0 ? GOLD : "#2a2010"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* LO Table */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <h3 className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
                By Loan Officer — click to expand
              </h3>
            </div>
            {data.byLO.length === 0 ? (
              <p className="text-sm p-4" style={{ color: "var(--color-muted)" }}>No outbound calls yet today.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <th className="py-2 pl-4 pr-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Loan Officer</th>
                    <th className="py-2 px-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Calls</th>
                    <th className="py-2 pr-4 pl-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Avg Talk</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byLO.map((lo, i) => (
                    <LORow key={lo.extensionId} lo={lo} isLast={i === data.byLO.length - 1} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
