import { NextRequest, NextResponse } from "next/server";
import { getAllLoans } from "@/lib/arive";
import type { ARIVELoan } from "@/types/arive";
import { PIPELINE_STAGES } from "@/types/arive";

export interface ARIVELoansResponse {
  loans: ARIVELoan[];
  pipeline: Record<string, number>; // stageKey → count of loans that have reached that stage
  adverseCount: number;
  kpis: {
    totalSetup: number;
    funded: number;
    fundedVolume: number;
    adverse: number;
    conversionRate: number; // funded / totalSetup * 100, rounded
  };
  lastUpdated: string;
}

// Short-lived in-memory cache — blobs reads are slow
const cacheMap = new Map<string, { data: ARIVELoansResponse; cachedAt: number }>();
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes

function filterByRange(loans: ARIVELoan[], from: Date | null, to: Date | null): ARIVELoan[] {
  if (!from && !to) return loans;
  return loans.filter((loan) => {
    // Anchor on loanSetupDate; fall back to creditReportDate for early-stage loans
    const anchor = loan.loanSetupDate ?? loan.creditReportDate;
    if (!anchor) return false;
    const d = new Date(anchor);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

function buildResponse(loans: ARIVELoan[]): ARIVELoansResponse {
  const pipeline: Record<string, number> = {};
  for (const stage of PIPELINE_STAGES) {
    pipeline[stage.key] = loans.filter((l) => l[stage.dateField as keyof ARIVELoan]).length;
  }
  const adverseCount = loans.filter((l) => l.adverseDate).length;
  const totalSetup = pipeline["loanSetup"] ?? 0;
  const funded = pipeline["funded"] ?? 0;
  const fundedVolume = loans
    .filter((l) => l.fundedDate)
    .reduce((sum, l) => sum + l.loanAmount, 0);

  return {
    loans,
    pipeline,
    adverseCount,
    kpis: {
      totalSetup,
      funded,
      fundedVolume,
      adverse: adverseCount,
      conversionRate: totalSetup > 0 ? Math.round((funded / totalSetup) * 1000) / 10 : 0,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const now = new Date();
  const dateFrom = fromParam ? new Date(fromParam) : null;
  const dateTo = toParam ? new Date(toParam) : now;

  const cacheKey = `${fromParam ?? ""}|${toParam ?? dateTo.toISOString().slice(0, 13)}`;
  const cached = cacheMap.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const all = await getAllLoans();
    const filtered = filterByRange(all, dateFrom, dateTo);
    const data = buildResponse(filtered);
    cacheMap.set(cacheKey, { data, cachedAt: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/arive/loans]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
