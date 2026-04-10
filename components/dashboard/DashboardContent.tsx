"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { InboundMetrics } from "@/components/dashboard/InboundMetrics";
import { LOMetrics } from "@/components/dashboard/LOMetrics";
import type { Preset } from "@/lib/dateRange";
import { PRESETS, getRange } from "@/lib/dateRange";

const GOLD = "#C48B1F";

export function DashboardContent() {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>("today");
  const range = getRange(preset);

  function handlePreset(p: Preset) {
    setPreset(p);
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["rc-dashboard", preset] });
  }

  return (
    <div className="space-y-12">
      {/* Shared date range controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
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

      <InboundMetrics preset={preset} />
      <LOMetrics preset={preset} />
    </div>
  );
}
