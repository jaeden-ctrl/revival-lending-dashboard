"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionSkeleton } from "@/components/ui/Loader";
import { KpiCard } from "@/components/ui/KpiCard";
import type { ARIVELoan } from "@/types/arive";
import { PIPELINE_STAGES } from "@/types/arive";
import type { ARIVELoansResponse } from "@/app/api/arive/loans/route";
import type { DashboardKpis } from "@/app/api/ringcentral/dashboard/route";
import type { DateRange } from "@/lib/dateRange";

const GOLD = "#C48B1F";
const SURFACE_2 = "#1A1A1A";

function fmtDollars(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(d?: string) {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${m}/${day}/${y.slice(2)}`;
}

function fmtPct(num: number, den: number): string {
  if (den === 0) return "—";
  return `${Math.round((num / den) * 1000) / 10}%`;
}

function currentStageLabel(loan: ARIVELoan): string {
  if (loan.adverseDate) return "Adverse";
  if (loan.fundedDate) return "Funded";
  if (loan.approvedWithConditionsDate) return "Approved";
  if (loan.submittedToUWDate) return "In UW";
  if (loan.disclosedDate) return "Disclosed";
  if (loan.loanSetupDate) return "Setup";
  return "Credit Report";
}

function computePipeline(loans: ARIVELoan[]): Record<string, number> {
  const pipeline: Record<string, number> = {};
  for (const stage of PIPELINE_STAGES) {
    pipeline[stage.key] = loans.filter((l) => l[stage.dateField as keyof ARIVELoan]).length;
  }
  return pipeline;
}

async function fetchLoans(range: DateRange): Promise<ARIVELoansResponse> {
  const url = new URL("/api/arive/loans", window.location.origin);
  url.searchParams.set("from", range.from);
  if (!range.dynamic) url.searchParams.set("to", range.to);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const e = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(e.error ?? "Failed to fetch ARIVE data");
  }
  return res.json();
}

async function fetchRCDashboard(range: DateRange): Promise<DashboardKpis> {
  const url = new URL("/api/ringcentral/dashboard", window.location.origin);
  url.searchParams.set("from", range.from);
  if (!range.dynamic) url.searchParams.set("to", range.to);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error("Failed to fetch call data");
  return res.json();
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const STAGES: { label: string; color: string }[] = [
  { label: "Credit Report", color: GOLD },
  { label: "Setup",         color: GOLD },
  { label: "Disclosed",     color: GOLD },
  { label: "In UW",         color: GOLD },
  { label: "Approved",      color: "#4fa8e8" },
  { label: "Funded",        color: "#34c77b" },
  { label: "Adverse",       color: "#e05252" },
];

// ─── Milestone Accordion ──────────────────────────────────────────────────────

function LoanRows({ loans }: { loans: ARIVELoan[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid #222" }}>
            {["Loan #", "Borrower", "Loan Officer", "Amount", "Type", "Purpose", "Setup", "Disclosed", "Submitted", "Approved", "Funded", "Adverse"].map((h) => (
              <th
                key={h}
                className="py-2 px-3 text-left font-medium uppercase tracking-wider whitespace-nowrap"
                style={{ color: "var(--color-muted)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loans.map((loan, i) => (
            <tr
              key={loan.loanNumber}
              style={{ borderBottom: i === loans.length - 1 ? "none" : "1px solid #1a1a1a" }}
            >
              <td className="py-2 px-3 font-mono whitespace-nowrap" style={{ color: GOLD }}>
                {loan.loanNumber}
              </td>
              <td className="py-2 px-3 whitespace-nowrap" style={{ color: "var(--color-text)" }}>
                {loan.borrowerName}
              </td>
              <td className="py-2 px-3 whitespace-nowrap" style={{ color: "var(--color-text)" }}>
                {loan.loanOfficer || "—"}
              </td>
              <td className="py-2 px-3 whitespace-nowrap tabular-nums" style={{ color: "var(--color-text)" }}>
                {loan.loanAmount ? fmtDollars(loan.loanAmount) : "—"}
              </td>
              <td className="py-2 px-3 whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                {loan.loanType || "—"}
              </td>
              <td className="py-2 px-3 whitespace-nowrap" style={{ color: "var(--color-muted)" }}>
                {loan.loanPurpose || "—"}
              </td>
              <td className="py-2 px-3 whitespace-nowrap tabular-nums" style={{ color: "var(--color-muted)" }}>
                {fmtDate(loan.loanSetupDate)}
              </td>
              <td className="py-2 px-3 whitespace-nowrap tabular-nums" style={{ color: "var(--color-muted)" }}>
                {fmtDate(loan.disclosedDate)}
              </td>
              <td className="py-2 px-3 whitespace-nowrap tabular-nums" style={{ color: "var(--color-muted)" }}>
                {fmtDate(loan.submittedToUWDate)}
              </td>
              <td className="py-2 px-3 whitespace-nowrap tabular-nums" style={{ color: "var(--color-muted)" }}>
                {fmtDate(loan.approvedWithConditionsDate)}
              </td>
              <td className="py-2 px-3 whitespace-nowrap tabular-nums" style={{ color: "var(--color-muted)" }}>
                {fmtDate(loan.fundedDate)}
              </td>
              <td className="py-2 px-3 whitespace-nowrap tabular-nums" style={{ color: "var(--color-muted)" }}>
                {fmtDate(loan.adverseDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MilestoneAccordion({ loans }: { loans: ARIVELoan[] }) {
  const [open, setOpen] = useState<string | null>(null);

  const grouped = new Map<string, ARIVELoan[]>();
  for (const stage of STAGES) grouped.set(stage.label, []);
  for (const loan of loans) {
    const label = currentStageLabel(loan);
    grouped.get(label)?.push(loan);
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h3 className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
          Pipeline by Stage
        </h3>
      </div>

      {STAGES.map((stage, i) => {
        const stageLoans = grouped.get(stage.label) ?? [];
        const count = stageLoans.length;
        const isOpen = open === stage.label;
        const isLast = i === STAGES.length - 1;

        return (
          <div key={stage.label}>
            <button
              onClick={() => setOpen(isOpen ? null : stage.label)}
              className="w-full flex items-center justify-between px-5 py-4 transition-colors text-left"
              style={{
                borderBottom: isOpen || !isLast ? "1px solid var(--color-border)" : "none",
                background: isOpen ? `${stage.color}08` : "transparent",
              }}
              onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = "#ffffff08"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isOpen ? `${stage.color}08` : "transparent"; }}
            >
              <div className="flex items-center gap-4">
                <span
                  className="text-sm font-medium w-36"
                  style={{ color: count > 0 ? stage.color : "var(--color-muted)" }}
                >
                  {stage.label}
                </span>
                <span
                  className="text-xl font-bold tabular-nums"
                  style={{ color: count > 0 ? stage.color : "var(--color-muted)" }}
                >
                  {count}
                </span>
                {count > 0 && (
                  <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                    {count === 1 ? "loan" : "loans"}
                  </span>
                )}
              </div>
              <span
                className="text-xs transition-transform"
                style={{
                  color: "var(--color-muted)",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}
              >
                ▾
              </span>
            </button>

            {isOpen && count > 0 && (
              <div style={{ borderBottom: isLast ? "none" : "1px solid var(--color-border)", background: "#0d0d0d" }}>
                <LoanRows loans={stageLoans} />
              </div>
            )}
            {isOpen && count === 0 && (
              <div
                className="px-5 py-4 text-xs"
                style={{ color: "var(--color-muted)", borderBottom: isLast ? "none" : "1px solid var(--color-border)", background: "#0d0d0d" }}
              >
                No loans currently at this stage.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Conversion Rates ─────────────────────────────────────────────────────────

interface ConversionMetric {
  label: string;
  num: number;
  den: number;
  denLabel: string;
}

function ConversionCard({ label, num, den, denLabel }: ConversionMetric) {
  const pct = fmtPct(num, den);
  const hasData = den > 0;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1.5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <span className="text-xs uppercase tracking-wider" style={{ color: "var(--color-muted)" }}>
        {label}
      </span>
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: hasData ? GOLD : "var(--color-muted)" }}
      >
        {pct}
      </span>
      <span className="text-xs tabular-nums" style={{ color: "var(--color-muted)" }}>
        {num} / {den} {denLabel}
      </span>
    </div>
  );
}

function ConversionRates({
  pipeline,
  adverseCount,
  totalCalls,
}: {
  pipeline: Record<string, number>;
  adverseCount: number;
  totalCalls: number | null;
}) {
  const disclosed     = pipeline["disclosed"] ?? 0;
  const submittedToUW = pipeline["submittedToUW"] ?? 0;
  const approved      = pipeline["approvedWithConditions"] ?? 0;
  const funded        = pipeline["funded"] ?? 0;
  const calls         = totalCalls ?? 0;

  const metrics: ConversionMetric[] = [
    { label: "Callers → Disclosed",    num: disclosed,    den: calls,          denLabel: "callers" },
    { label: "Disclosed → Submitted", num: submittedToUW, den: disclosed,     denLabel: "disclosed" },
    { label: "Submitted → Approved",  num: approved,     den: submittedToUW,  denLabel: "submitted" },
    { label: "Approved → Funded",     num: funded,       den: approved,       denLabel: "approved" },
    { label: "Callers → Funded",       num: funded,       den: calls,          denLabel: "callers" },
    { label: "Disclosed → Funded",    num: funded,       den: disclosed,      denLabel: "disclosed" },
    { label: "Disclosed → Adverse",   num: adverseCount, den: disclosed,      denLabel: "disclosed" },
  ];

  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
    >
      <h3 className="text-xs font-medium uppercase tracking-widest mb-5" style={{ color: "var(--color-muted)" }}>
        Conversion Rates
        {totalCalls === null && (
          <span className="ml-2 normal-case" style={{ color: "#e05252" }}>
            (call data unavailable)
          </span>
        )}
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {metrics.map((m) => (
          <ConversionCard key={m.label} {...m} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ARIVEMetrics({ queryKey, range }: { queryKey: string; range: DateRange }) {
  const [selectedLO, setSelectedLO] = useState<string>("all");

  const { data, isLoading, isError, error } = useQuery<ARIVELoansResponse>({
    queryKey: ["arive-loans", queryKey],
    queryFn: () => fetchLoans(range),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: rcData } = useQuery<DashboardKpis>({
    queryKey: ["rc-dashboard", queryKey],
    queryFn: () => fetchRCDashboard(range),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const totalCalls = rcData?.inbound?.period?.uniqueCallers ?? null;

  // Build LO list from all loans
  const loanOfficers = data
    ? Array.from(new Set(data.loans.map((l) => l.loanOfficer ?? "").filter(Boolean))).sort()
    : [];

  // Filter loans by selected LO
  const filteredLoans = data
    ? selectedLO === "all"
      ? data.loans
      : data.loans.filter((l) => l.loanOfficer === selectedLO)
    : [];

  // Recompute pipeline + KPIs from filtered loans
  const filteredPipeline = computePipeline(filteredLoans);
  const filteredAdverse = filteredLoans.filter((l) => l.adverseDate).length;
  const filteredFunded = filteredLoans.filter((l) => l.fundedDate).length;
  const filteredSetup = filteredPipeline["loanSetup"] ?? 0;
  const filteredVolume = filteredLoans.filter((l) => l.fundedDate).reduce((s, l) => s + l.loanAmount, 0);
  const filteredConvRate = filteredSetup > 0 ? Math.round((filteredFunded / filteredSetup) * 1000) / 10 : 0;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <h2 className="text-base font-semibold uppercase tracking-widest" style={{ color: GOLD }}>
          Loan Pipeline
        </h2>
        <span
          className="text-xs px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline"
          style={{ background: SURFACE_2, color: "var(--color-muted)", border: "1px solid var(--color-border)" }}
        >
          ARIVE · Direct Mail
        </span>
      </div>

      {isError && (
        <div className="rounded-xl p-4 mb-4 text-sm" style={{ background: "#2a1010", border: "1px solid var(--color-danger)", color: "var(--color-danger)" }}>
          {(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <SectionSkeleton count={4} />
      ) : !data || data.loans.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: "var(--color-surface)", border: "1px dashed var(--color-border)" }}
        >
          <p className="text-sm mb-1" style={{ color: "var(--color-text)" }}>No loan data for this period</p>
          <p className="text-xs" style={{ color: "var(--color-muted)" }}>
            Configure your Zapier zaps to send data to{" "}
            <span className="font-mono" style={{ color: GOLD }}>/api/arive/webhook</span>
          </p>
        </div>
      ) : (
        <>
          {/* Loan Officer filter */}
          {loanOfficers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-xs uppercase tracking-widest" style={{ color: "var(--color-muted)" }}>
                Loan Officer
              </span>
              {["all", ...loanOfficers].map((lo) => (
                <button
                  key={lo}
                  onClick={() => setSelectedLO(lo)}
                  className="px-3 py-1.5 rounded text-xs font-medium transition-all"
                  style={{
                    background: selectedLO === lo ? GOLD : "var(--color-surface)",
                    color: selectedLO === lo ? "#0A0A0A" : "var(--color-muted)",
                    border: `1px solid ${selectedLO === lo ? GOLD : "var(--color-border)"}`,
                  }}
                >
                  {lo === "all" ? "All" : lo}
                </button>
              ))}
            </div>
          )}

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <KpiCard label="Loans Setup"   value={filteredSetup} highlight />
            <KpiCard label="Funded"        value={filteredFunded} />
            <KpiCard label="Funded Volume" value={fmtDollars(filteredVolume)} />
            <KpiCard label="Adverse"       value={filteredAdverse} />
            <KpiCard label="Conv. Rate"    value={`${filteredConvRate}%`} />
          </div>

          <div className="flex flex-col gap-5">
            <ConversionRates
              pipeline={filteredPipeline}
              adverseCount={filteredAdverse}
              totalCalls={selectedLO === "all" ? totalCalls : null}
            />
            <MilestoneAccordion loans={filteredLoans} />
          </div>
        </>
      )}
    </section>
  );
}
