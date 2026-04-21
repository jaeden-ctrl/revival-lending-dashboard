"use client";

import { useQuery } from "@tanstack/react-query";
import { SectionSkeleton } from "@/components/ui/Loader";
import type { DashboardKpis } from "@/app/api/ringcentral/dashboard/route";
import type { DateRange } from "@/lib/dateRange";

const GOLD = "#C48B1F";

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

export function StateBreakdown({ queryKey, range }: { queryKey: string; range: DateRange }) {
  const { data: dashboard, isLoading } = useQuery<DashboardKpis>({
    queryKey: ["rc-dashboard", queryKey],
    queryFn: () => fetchDashboard(range),
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });

  const states = dashboard?.inbound?.byState ?? [];
  const max = states[0]?.calls ?? 1;

  return (
    <section>
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-base font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
          Calls by State
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline"
          style={{ background: "#1A1A1A", color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
        >
          By Area Code
        </span>
      </div>

      {isLoading ? (
        <SectionSkeleton count={3} />
      ) : states.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>No call data for this period.</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th className="py-2 pl-4 pr-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  State
                </th>
                <th className="py-2 px-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
                  Volume
                </th>
                <th className="py-2 pr-4 pl-3 text-right text-xs font-medium uppercase tracking-wider w-16" style={{ color: "var(--color-muted)" }}>
                  Calls
                </th>
              </tr>
            </thead>
            <tbody>
              {states.map((s, i) => (
                <tr
                  key={s.state}
                  style={{ borderBottom: i === states.length - 1 ? "none" : "1px solid #111" }}
                >
                  <td className="py-2.5 pl-4 pr-3 text-sm w-40" style={{ color: "var(--color-text)" }}>
                    {s.state}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(4, Math.round((s.calls / max) * 100))}%`,
                          background: s.calls === max ? GOLD : "#2a2010",
                          minWidth: 4,
                        }}
                      />
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 pl-3 text-right text-sm font-semibold" style={{ color: GOLD }}>
                    {s.calls}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
