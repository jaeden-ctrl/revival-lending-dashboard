"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { InboundMetrics } from "@/components/dashboard/InboundMetrics";
import { LOMetrics } from "@/components/dashboard/LOMetrics";
import type { Preset, DateRange } from "@/lib/dateRange";
import { PRESETS, getRange, getCustomRange } from "@/lib/dateRange";

const GOLD = "#C48B1F";

function todayDateStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

export function DashboardContent() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range: DateRange =
    preset === "custom" && customFrom && customTo
      ? getCustomRange(customFrom, customTo)
      : getRange(preset === "custom" ? "today" : preset);

  // Unique query key — for custom use the date strings, for presets use the preset name
  const queryKey = preset === "custom" ? `custom:${customFrom}:${customTo}` : preset;

  function handlePreset(p: Preset) {
    setPreset(p);
    if (p !== "custom") {
      queryClient.invalidateQueries({ queryKey: ["rc-dashboard", p] });
    }
  }

  function handleApplyCustom() {
    if (customFrom && customTo) {
      queryClient.invalidateQueries({ queryKey: ["rc-dashboard", queryKey] });
    }
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
              value={customFrom}
              max={todayDateStr()}
              onChange={(e) => {
                setCustomFrom(e.target.value);
                setPreset("custom");
              }}
              className="rounded px-2 py-1 text-xs"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${preset === "custom" ? GOLD : "var(--color-border)"}`,
                color: customFrom ? "var(--color-text)" : "var(--color-muted)",
                colorScheme: "dark",
              }}
            />
            <span className="text-xs" style={{ color: "var(--color-muted)" }}>to</span>
            <input
              type="date"
              value={customTo}
              max={todayDateStr()}
              onChange={(e) => {
                setCustomTo(e.target.value);
                setPreset("custom");
              }}
              className="rounded px-2 py-1 text-xs"
              style={{
                background: "var(--color-surface)",
                border: `1px solid ${preset === "custom" ? GOLD : "var(--color-border)"}`,
                color: customTo ? "var(--color-text)" : "var(--color-muted)",
                colorScheme: "dark",
              }}
            />
            {preset === "custom" && customFrom && customTo && (
              <button
                onClick={handleApplyCustom}
                className="px-3 py-1 rounded text-xs font-medium transition-all"
                style={{ background: GOLD, color: "#0A0A0A", border: `1px solid ${GOLD}` }}
              >
                Apply
              </button>
            )}
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
    </div>
  );
}
