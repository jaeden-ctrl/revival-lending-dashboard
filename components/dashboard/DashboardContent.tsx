"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { InboundMetrics } from "@/components/dashboard/InboundMetrics";
import { LOMetrics } from "@/components/dashboard/LOMetrics";
import { StateBreakdown } from "@/components/dashboard/StateBreakdown";
import type { Preset, DateRange } from "@/lib/dateRange";
import { PRESETS, getRange, getCustomRange } from "@/lib/dateRange";

const GOLD = "#C48B1F";

// Both date inputs use tomorrow as max so today is never at the boundary.
// getCustomRange() caps the actual API query at now regardless.
function tomorrowDateStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export function DashboardContent() {
  const queryClient = useQueryClient();

  // Active preset driving the current data
  const [preset, setPreset] = useState<Preset>("today");

  // Draft values shown in the inputs — don't drive the query until Enter is clicked
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");

  // Committed values — only update when Enter is clicked
  const [committedFrom, setCommittedFrom] = useState("");
  const [committedTo, setCommittedTo] = useState("");

  const range: DateRange =
    preset === "custom" && committedFrom && committedTo
      ? getCustomRange(committedFrom, committedTo)
      : getRange(preset === "custom" ? "today" : preset);

  const queryKey = preset === "custom" ? `custom:${committedFrom}:${committedTo}` : preset;

  const canEnter = draftFrom && draftTo;

  function handlePreset(p: Preset) {
    setPreset(p);
    queryClient.invalidateQueries({ queryKey: ["rc-dashboard", p] });
  }

  function handleEnter() {
    if (!canEnter) return;
    setCommittedFrom(draftFrom);
    setCommittedTo(draftTo);
    setPreset("custom");
    // key will update after state flush; invalidate the new key
    const newKey = `custom:${draftFrom}:${draftTo}`;
    queryClient.invalidateQueries({ queryKey: ["rc-dashboard", newKey] });
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["rc-dashboard", queryKey] });
  }

  return (
    <div className="space-y-12">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          {PRESETS.filter((p) => p.key !== "custom").map((p) => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className="px-3 py-1.5 rounded text-xs font-medium transition-all"
              style={{
                background: preset === p.key ? GOLD : "var(--color-surface)",
                color: preset === p.key ? "#0A0A0A" : "var(--color-muted)",
                border: `1px solid ${preset === p.key ? GOLD : "var(--color-border)"}`,
              }}
            >
              {p.label}
            </button>
          ))}

          {/* Divider */}
          <span style={{ color: "var(--color-border)" }}>|</span>

          {/* Custom date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={draftFrom}
              max={tomorrowDateStr()}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="rounded px-2 py-1 text-xs"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${preset === "custom" ? GOLD : "var(--color-border)"}`,
                color: draftFrom ? "var(--color-text)" : "var(--color-muted)",
                colorScheme: "dark",
              }}
            />
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>to</span>
            <input
              type="date"
              value={draftTo}
              min={draftFrom || undefined}
              max={tomorrowDateStr()}
              onChange={(e) => setDraftTo(e.target.value)}
              className="rounded px-2 py-1 text-xs"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${preset === "custom" ? GOLD : "var(--color-border)"}`,
                color: draftTo ? "var(--color-text)" : "var(--color-muted)",
                colorScheme: "dark",
              }}
            />
            <button
              onClick={handleEnter}
              disabled={!canEnter}
              className="px-3 py-1 rounded text-xs font-medium transition-all"
              style={{
                background: canEnter ? GOLD : "var(--color-surface)",
                color: canEnter ? "#0A0A0A" : "var(--color-muted)",
                border: `1px solid ${canEnter ? GOLD : "var(--color-border)"}`,
                cursor: canEnter ? "pointer" : "not-allowed",
                opacity: canEnter ? 1 : 0.5,
              }}
            >
              Enter
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: "var(--color-muted)" }}>
            {range.label}
          </span>
          <button
            onClick={handleRefresh}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-muted)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = GOLD; e.currentTarget.style.color = GOLD; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-muted)"; }}
          >
            ↺
          </button>
        </div>
      </div>

      <InboundMetrics queryKey={queryKey} range={range} preset={preset} />
      <LOMetrics queryKey={queryKey} range={range} />
      <StateBreakdown queryKey={queryKey} range={range} />
    </div>
  );
}
