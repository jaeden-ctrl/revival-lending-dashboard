import { QueryProvider } from "@/components/dashboard/QueryProvider";
import { InboundMetrics } from "@/components/dashboard/InboundMetrics";
import { LogoutButton } from "@/components/dashboard/LogoutButton";

export default function DashboardPage() {
  return (
    <QueryProvider>
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        {/* Top Nav */}
        <header
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{
            background: "rgba(10,10,10,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-lg font-bold tracking-widest uppercase"
              style={{ color: "var(--color-gold)" }}
            >
              Revival Lending
            </span>
            <span
              className="text-xs uppercase tracking-wider hidden sm:block"
              style={{ color: "var(--color-muted)" }}
            >
              / Dashboard
            </span>
          </div>
          <LogoutButton />
        </header>

        {/* Main Content */}
        <main className="px-6 py-8 max-w-7xl mx-auto space-y-12">
          <InboundMetrics />

          {/* Coming Soon */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <ComingSoonCard
              title="Lead Pipeline"
              source="GoHighLevel"
              description="Lead volume, pipeline stages, source breakdown, and conversion rates."
            />
            <ComingSoonCard
              title="Loan Activity"
              source="ARIVE LOS"
              description="Loans in process, funded volume, stage tracking, and closings."
            />
          </section>
        </main>
      </div>
    </QueryProvider>
  );
}

function ComingSoonCard({ title, source, description }: { title: string; source: string; description: string }) {
  return (
    <div
      className="rounded-xl p-6 flex flex-col gap-2"
      style={{ background: "var(--color-surface)", border: "1px dashed var(--color-border)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--color-text)" }}>{title}</span>
        <span className="text-xs px-2 py-0.5 rounded-full uppercase tracking-widest" style={{ background: "var(--color-surface-2)", color: "var(--color-muted)" }}>
          {source}
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--color-muted)" }}>{description}</p>
      <span className="text-xs mt-1 font-medium uppercase tracking-wider" style={{ color: "var(--color-gold-dim)" }}>
        Phase 2
      </span>
    </div>
  );
}
