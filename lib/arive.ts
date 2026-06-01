import { getStore } from "@netlify/blobs";
import type { ARIVELoan, ARIVEWebhookPayload } from "@/types/arive";

// Maps the milestone slug Zapier sends → the loan date field it populates
export const MILESTONE_FIELD_MAP: Record<string, keyof ARIVELoan> = {
  credit_report:             "creditReportDate",
  loan_setup:                "loanSetupDate",
  disclosed:                 "disclosedDate",
  submitted_to_uw:           "submittedToUWDate",
  approved_with_conditions:  "approvedWithConditionsDate",
  funded:                    "fundedDate",
  adverse:                   "adverseDate",
};

function getAriveStore() {
  return getStore({
    name: "arive-loans",
    token: process.env.NETLIFY_TOKEN!,
    siteID: process.env.NETLIFY_SITE_ID!,
  });
}

function parseAmount(raw: string | number | undefined): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return raw;
  return parseFloat(raw.replace(/[$,]/g, "")) || 0;
}

/** Create or update a loan record when a Zapier webhook fires. */
export async function upsertLoan(payload: ARIVEWebhookPayload): Promise<ARIVELoan> {
  const store = getAriveStore();
  const key = `loan-${payload.loan_number}`;
  const now = new Date().toISOString();

  const raw = await store.get(key, { type: "text" }).catch(() => null);
  const existing: ARIVELoan | null = raw ? (JSON.parse(raw) as ARIVELoan) : null;

  const dateField = MILESTONE_FIELD_MAP[payload.milestone];
  const milestoneUpdate: Partial<ARIVELoan> = dateField ? { [dateField]: payload.date } : {};

  const loan: ARIVELoan = {
    // Preserve all previously recorded milestone dates
    ...(existing ?? {}),
    // Always refresh core loan fields from the latest payload
    loanNumber:   payload.loan_number,
    borrowerName: payload.borrower_name,
    loanOfficer:  payload.loan_officer ?? existing?.loanOfficer ?? "",
    loanAmount:   parseAmount(payload.loan_amount),
    loanType:     payload.loan_type ?? existing?.loanType ?? "",
    loanPurpose:  payload.loan_purpose ?? existing?.loanPurpose ?? "",
    // Record the milestone date that triggered this webhook
    ...milestoneUpdate,
    createdAt:    existing?.createdAt ?? now,
    lastUpdated:  now,
  };

  await store.set(key, JSON.stringify(loan));
  return loan;
}

/** Fetch every loan stored in Blobs. */
export async function getAllLoans(): Promise<ARIVELoan[]> {
  const store = getAriveStore();

  let blobs: { key: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.list({ prefix: "loan-", ...(cursor ? { cursor } : {}) });
    blobs.push(...page.blobs);
    cursor = (page as { nextCursor?: string }).nextCursor;
  } while (cursor);

  if (blobs.length === 0) return [];

  const loans = await Promise.all(
    blobs.map(async (b) => {
      try {
        const raw = await store.get(b.key, { type: "text" });
        return raw ? (JSON.parse(raw) as ARIVELoan) : null;
      } catch {
        return null;
      }
    })
  );

  return loans.filter((l): l is ARIVELoan => l !== null);
}
