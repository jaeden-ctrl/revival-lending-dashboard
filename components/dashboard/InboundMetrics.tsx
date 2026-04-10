"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionSkeleton } from "@/components/ui/Loader";
import type { LOInboundStats, CallDetail } from "@/types/kpi";
import type { DashboardKpis } from "@/app/api/ringcentral/dashboard/route";

const GOLD = "#C48B1F";
const SURFACE_2 = "#1A1A1A";
const TZ = "America/Los_Angeles";

// ─── Date Range Helpers ───────────────────────────────────────────────────────

function pacificMidnightISO(dateStr: string): string {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`);
  const noonHour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hour12: false, hourCycle: "h23" }).format(noonUTC)
  );
  const offsetHours = noonHour - 12;
  return `${dateStr}T${String(-offsetHours).padStart(2, "0")}:00:00.000Z`;
}

type Preset = "today" | "yesterday" | "week" | "7days" | "month";

interface DateRange { from: string; to: string; label: string }

function getRange(preset: Preset): DateRange {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });

  switch (preset) {
    case "today":
      return { from: pacificMidnightISO(todayStr), to: now.toISOString(), label: "Today" };
    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const yStr = d.toLocaleDateString("en-CA", { timeZone: TZ });
      return { from: pacificMidnightISO(yStr), to: pacificMidnightISO(todayStr), label: "Yesterday" };
    }
    case "week": {
      // Find Monday of current week in Pacific time
      const weekdayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
      const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now);
      const dow = weekdayNames.indexOf(weekdayStr); // 0=Sun, 1=Mon, ...
      const daysBack = dow === 0 ? 6 : dow - 1; // days since Monday
      const monday = new Date(now);
      monday.setDate(monday.getDate() - daysBack);
      const wStr = monday.toLocaleDateString("en-CA", { timeZone: TZ });
      return { from: pacificMidnightISO(wStr), to: now.toISOString(), label: "This Week" };
    }
    case "7days": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      const wStr = d.toLocaleDateString("en-CA", { timeZone: TZ });
      return { from: pacificMidnightISO(wStr), to: now.toISOString(), label: "Last 7 Days" };
    }
    case "month": {
      const monthStart = `${todayStr.slice(0, 8)}01`;
      return { from: pacificMidnightISO(monthStart), to: now.toISOString(), label: "This Month" };
    }
  }
}

// ─── Formatters ───────────────────────────────────────────────────────────────

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
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchDashboard(range: DateRange): Promise<DashboardKpis> {
  const url = new URL("/api/ringcentral/dashboard", window.location.origin);
  url.searchParams.set("from", range.from);
  url.searchParams.set("to", range.to);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(e.error ?? "Failed to fetch call data");
  }
  return res.json();
}

// ─── Drill-down Row ───────────────────────────────────────────────────────────

function LORow({ lo, isLast }: { lo: LOInboundStats; isLast: boolean }) {
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
              className="text-xs transition-transform inline-block"
              style={{ color: "var(--color-muted)", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▶
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--color-text)" }}>
              {lo.name}
            </span>
          </div>
        </td>
        <td className="py-3 px-3 text-center">
          <span className="text-sm font-semibold" style={{ color: GOLD }}>{lo.answered}</span>
        </td>
        <td className="py-3 px-3 text-center">
          <span className="text-sm" style={{ color: lo.missed > 0 ? "var(--color-danger)" : "var(--color-muted)" }}>
            {lo.missed}
          </span>
        </td>
        <td className="py-3 pr-4 pl-3 text-right">
          <span className="text-sm" style={{ color: "var(--color-muted)" }}>
            {fmt(lo.avgTalkTimeSec)}
          </span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={4} className="p-0">
            <div
              className="mx-2 mb-2 rounded-lg overflow-hidden"
              style={{ background: "#0F0F0F", border: "1px solid var(--color-border)" }}
            >
              {lo.calls.length === 0 ? (
                <p className="text-xs p-3" style={{ color: "var(--color-muted)" }}>No call details available.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                      <th className="py-2 pl-4 pr-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Time</th>
                      <th className="py-2 px-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>From</th>
                      <th className="py-2 px-3 text-left font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Queue</th>
                      <th className="py-2 pr-4 pl-3 text-right font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lo.calls.map((c: CallDetail, i: number) => (
                      <tr
                        key={c.id}
                        style={{ borderBottom: i < lo.calls.length - 1 ? "1px solid #1a1a1a" : "none" }}
                      >
                        <td className="py-2 pl-4 pr-3" style={{ color: "var(--color-text)" }}>{fmtTime(c.startTime)}</td>
                        <td className="py-2 px-3" style={{ color: "var(--color-muted)" }}>{fmtPhone(c.from)}</td>
                        <td className="py-2 px-3">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{ background: "#1a1a1a", color: GOLD, border: "1px solid #2a2a2a" }}
                          >
                            {c.queue || "—"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 pl-3 text-right" style={{ color: "var(--color-muted)" }}>
                          {fmt(c.durationSec)}
                        </td>
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

// ─── Date Range Selector ──────────────────────────────────────────────────────

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "7days", label: "7 Days" },
  { key: "month", label: "Month" },
];

function DateRangeSelector({
  active,
  onChange,
}: {
  active: Preset;
  onChange: (p: Preset) => void;
}) {
  return (
    <div className="flex gap-1">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className="px-3 py-1 rounded text-xs font-medium transition-all"
          style={{
            background: active === p.key ? GOLD : "var(--color-surface)",
            color: active === p.key ? "#0A0A0A" : "var(--color-muted)",
            border: `1px solid ${active === p.key ? GOLD : "var(--color-border)"}`,
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function InboundMetrics() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>("today");
  const range = getRange(preset);

  const { data: dashboard, isLoading, isError, error } = useQuery<DashboardKpis>({
    queryKey: ["rc-dashboard", preset],
    queryFn: () => fetchDashboard(range),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });
  const data = dashboard?.inbound ?? null;

  function handlePresetChange(p: Preset) {
    setPreset(p);
    queryClient.invalidateQueries({ queryKey: ["rc-dashboard", p] });
  }

  return (
    <section>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
            Inbound Calls
          </h2>
          <span
            className="text-xs px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline"
            style={{ background: SURFACE_2, color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
          >
            Get That Bag · Fresh Leads
          </span>
          {data && (
            <span className="text-xs hidden sm:block" style={{ color: "var(--color-muted)" }}>
              Updated {new Date(data.lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DateRangeSelector active={preset} onChange={handlePresetChange} />
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["rc-dashboard", preset] })}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-muted)"; }}
          >
            ↺
          </button>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "#2a1010", border: "1px solid var(--color-danger)", color: "var(--color-danger)" }}>
          {(error as Error).message}
        </div>
      )}

      {/* Company Totals */}
      {isLoading ? (
        <SectionSkeleton count={4} />
      ) : data ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <KpiCard label="Total Inbound" value={data.period.total} highlight />
          <KpiCard label="Answered" value={data.period.answered} />
          <KpiCard label="Missed" value={data.period.missed} />
          <KpiCard label="Avg Talk Time" value={fmt(data.period.avgTalkTimeSec)} />
        </div>
      ) : null}

      {/* Charts + LO Table */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Volume chart */}
          <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>
              {preset === "today" || preset === "yesterday" ? "Inbound Volume — Hourly" : "Inbound Volume — Daily"}
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

          {/* LO Table with drill-down */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
              <h3 className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
                By Loan Officer — click to expand
              </h3>
            </div>
            {data.byLO.length === 0 ? (
              <p className="text-sm p-4" style={{ color: "var(--color-muted)" }}>No inbound calls for this period.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <th className="py-2 pl-4 pr-2 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Loan Officer</th>
                    <th className="py-2 px-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Ans</th>
                    <th className="py-2 px-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Miss</th>
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
