export function KpiCardSkeleton() {
  return (
    <div
      className="rounded-xl p-5 animate-pulse"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="h-3 w-20 rounded mb-3" style={{ background: "var(--color-border)" }} />
      <div className="h-8 w-16 rounded" style={{ background: "var(--color-surface-2)" }} />
    </div>
  );
}

export function SectionSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <KpiCardSkeleton key={i} />
      ))}
    </div>
  );
}
