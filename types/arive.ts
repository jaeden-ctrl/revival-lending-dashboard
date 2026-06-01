export interface ARIVELoan {
  loanNumber: string;
  borrowerName: string;
  loanOfficer?: string;
  loanAmount: number;
  loanType: string;
  loanPurpose: string;

  // Milestone dates (YYYY-MM-DD)
  creditReportDate?: string;
  loanSetupDate?: string;
  disclosedDate?: string;
  submittedToUWDate?: string;
  approvedWithConditionsDate?: string;
  fundedDate?: string;
  adverseDate?: string;

  createdAt: string;
  lastUpdated: string;
}

// Zapier sends one of these per milestone event
export interface ARIVEWebhookPayload {
  milestone: string; // see MILESTONE_FIELD_MAP in lib/arive.ts
  loan_number: string;
  borrower_name: string;
  loan_officer?: string;
  loan_amount?: string | number;
  loan_type?: string;
  loan_purpose?: string;
  date: string; // YYYY-MM-DD
}

export const PIPELINE_STAGES = [
  { key: "creditReport",            label: "Credit Report",         dateField: "creditReportDate"           },
  { key: "loanSetup",               label: "Loan Setup",            dateField: "loanSetupDate"              },
  { key: "disclosed",               label: "Disclosed",             dateField: "disclosedDate"              },
  { key: "submittedToUW",           label: "Submitted to UW",       dateField: "submittedToUWDate"          },
  { key: "approvedWithConditions",  label: "Approved w/ Conditions",dateField: "approvedWithConditionsDate" },
  { key: "funded",                  label: "Funded",                dateField: "fundedDate"                 },
] as const;

export type StageKey = typeof PIPELINE_STAGES[number]["key"];
