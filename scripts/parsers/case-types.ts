import type { CaseOutcome } from "@prisma/client";

export type CaseSource = "gas" | "kad";

export type ParsedCaseRow = {
  externalUid: string;
  caseNumber: string;
  title: string;
  lawyerRegistryNumber: string;
  lawArticles?: string[];
  outcome?: CaseOutcome;
  courtSlug?: string;
  summary?: string;
  rawTextExcerpt?: string;
  sourceUrl?: string;
  decisionDate?: string; // ISO date
  categorySlug?: string;
  source: CaseSource;
  matchConfidence: "high" | "medium";
};

export type LawyerProbe = {
  id: string;
  registryNumber: string;
  fullName: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  initialsSearch: string;
};

export type RawCaseHit = {
  source: CaseSource;
  externalUid: string;
  caseNumber: string;
  title: string;
  courtName?: string;
  courtCode?: string;
  courtSlug?: string;
  sourceUrl?: string;
  decisionDate?: string;
  lawArticles?: string[];
  summary?: string;
  rawTextExcerpt?: string;
  sidesText?: string;
  representativesText?: string;
  categoryHint?: string;
  /** Listing row had «Приговор» / act link */
  likelyFinished?: boolean;
};
