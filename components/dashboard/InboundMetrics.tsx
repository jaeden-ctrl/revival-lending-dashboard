"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from "recharts";
import { KpiCard } from "@/components/ui/KpiCard";
import { SectionSkeleton } from "@/components/ui/Loader";
import type { LOInboundStats, CallDetail } from "@/types/kpi";
import type { DashboardKpis } from "@/app/api/ringcentral/dashboard/route";
import type { Preset, DateRange } from "@/lib/dateRange";

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
  if (d.length === 11 && d[0] === "1") return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}

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

// ─── Call Row (with inline recording player) ──────────────────────────────────

function CallRow({ call: c, isLast }: { call: CallDetail; isLast: boolean }) {
  const [playing, setPlaying] = useState(false);

  return (
    <>
      <tr style={{ borderBottom: !playing && isLast ? "none" : "1px solid #1a1a1a" }}>
        <td className="py-2 pl-4 pr-3" style={{ color: "var(--color-text)" }}>{fmtTime(c.startTime)}</td>
        <td className="py-2 px-3" style={{ color: "var(--color-muted)" }}>{fmtPhone(c.from)}</td>
        <td className="py-2 px-3">
          <span className="px-2 py-0.5 rounded text-xs" style={{ background: "#1a1a1a", color: GOLD, border: "1px solid #2a2a2a" }}>
            {c.queue || "—"}
          </span>
        </td>
        <td className="py-2 px-3 text-right" style={{ color: "var(--color-muted)" }}>{fmt(c.durationSec)}</td>
        <td className="py-2 pr-4 pl-3 text-center">
          {c.recordingId ? (
            <button
              onClick={() => setPlaying(!playing)}
              className="px-2 py-0.5 rounded text-xs font-medium transition-all"
              style={{
                background: playing ? GOLD : "#1a1a1a",
                color: playing ? "#0A0A0A" : GOLD,
                border: `1px solid ${playing ? GOLD : "#2a2a2a"}`,
              }}
            >
              {playing ? "▼" : "▶"}
            </button>
          ) : (
            <span style={{ color: "#333" }}>—</span>
          )}
        </td>
      </tr>
      {playing && c.recordingId && (
        <tr style={{ borderBottom: isLast ? "none" : "1px solid #1a1a1a" }}>
          <td colSpan={5} className="px-4 pb-3 pt-1">
            <audio
              controls
              autoPlay
              src={`/api/ringcentral/recording/${c.recordingId}`}
              style={{ width: "100%", height: 32, accentColor: GOLD }}
              onEnded={() => setPlaying(false)}
            />
          </td>
        </tr>
      )}
    </>
  );
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
        <td className="py-3 pr-4 pl-3 text-right">
          <span className="text-sm" style={{ color: "var(--color-muted)" }}>
            {fmt(lo.avgTalkTimeSec)}
          </span>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={3} className="p-0">
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
                      <th className="py-2 px-3 text-right font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Duration</th>
                      <th className="py-2 pr-4 pl-3 text-center font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>Rec</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lo.calls.map((c: CallDetail, i: number) => (
                      <CallRow key={c.id} call={c} isLast={i === lo.calls.length - 1} />
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

export function InboundMetrics({ queryKey, range, preset }: { queryKey: string; range: DateRange; preset: Preset }) {
  const { data: dashboard, isLoading, isError, error } = useQuery<DashboardKpis>({
    queryKey: ["rc-dashboard", queryKey],
    queryFn: () => fetchDashboard(range),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });
  const data = dashboard?.inbound ?? null;

  return (
    <section>
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
      </div>

      {isError && (
        <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "#2a1010", border: "1px solid var(--color-danger)", color: "var(--color-danger)" }}>
          {(error as Error).message}
        </div>
      )}

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

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Volume charts — daily + hourly stacked */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>
                Inbound Volume — Daily
              </h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={data.dailyVolume} barSize={14}>
                  <CartesianGrid vertical={false} stroke="#1F1F1F" />
                  <XAxis dataKey="hour" tick={{ fill: "#6B6B6B", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#6B6B6B", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: SURFACE_2 }}
                    contentStyle={{ background: "#141414", border: "1px solid #1F1F1F", borderRadius: 8, color: "#F5F5F5", fontSize: 12 }}
                    labelStyle={{ color: GOLD }}
                  />
                  <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                    {data.dailyVolume.map((entry, i) => (
                      <Cell key={i} fill={entry.calls > 0 ? GOLD : "#2a2010"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-xl p-5" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <h3 className="text-xs font-medium uppercase tracking-widest mb-4" style={{ color: "var(--color-muted)" }}>
                Inbound Volume — By Hour of Day
              </h3>
              <ResponsiveContainer width="100%" height={150}>
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
