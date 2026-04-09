interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}

export function KpiCard({ label, value, sub, highlight }: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1 transition-all"
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${highlight ? "var(--color-gold)" : "var(--color-border)"}`,
        boxShadow: highlight ? "0 0 16px var(--color-gold-glow)" : "none",
      }}
    >
      <span
        className="text-xs font-medium uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </span>
      <span
        className="text-3xl font-bold leading-none"
        style={{ color: highlight ? "var(--color-gold)" : "var(--color-text)" }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-xs mt-1" style={{ color: "var(--color-muted)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}
