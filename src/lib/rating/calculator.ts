import type { CaseOutcome, Lawyer, RegistryStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type CaseInput = {
  outcome: CaseOutcome;
  isHiddenByLawyer: boolean;
  categoryId: string | null;
};

type LawyerRatingInput = Pick<
  Lawyer,
  | "registryStatus"
  | "experienceStartYear"
  | "isClaimed"
  | "isVerifiedDocuments"
  | "bio"
  | "education"
  | "minConsultationPrice"
  | "reviewsCount"
  | "answersCount"
> & {
  courtCases: CaseInput[];
  servicePricesCount: number;
};

/**
 * Objective rating 0–10:
 * - practiceScore 0–5 (log of cases + win rate + category diversity)
 * - statusAndExpScore 0–3 (registry + experience)
 * - reputationScore 0–2 (reviews + Q&A)
 * Bonuses only after claim / profile completeness (capped at 10).
 */
export function calculateLawyerRating(input: LawyerRatingInput) {
  const visibleCases = input.courtCases.filter((c) => !c.isHiddenByLawyer);
  const casesCount = visibleCases.length;
  const wonCasesCount = visibleCases.filter((c) => c.outcome === "WIN" || c.outcome === "PARTIAL").length;
  const categories = new Set(visibleCases.map((c) => c.categoryId).filter(Boolean)).size;

  // Practice 0–5: log volume + quality
  const volumeScore = Math.min(3.2, Math.log10(casesCount + 1) * 2.1);
  const winRate = casesCount > 0 ? wonCasesCount / casesCount : 0;
  const qualityScore = winRate * 1.3;
  const diversityScore = Math.min(0.5, categories * 0.12);
  let practiceScore = Math.min(5, volumeScore + qualityScore + diversityScore);

  // Status & experience 0–3
  let statusAndExpScore = 0;
  if (input.registryStatus === "ACTIVE") statusAndExpScore += 1.6;
  else if (input.registryStatus === "UNKNOWN") statusAndExpScore += 0.6;
  else if (input.registryStatus === "SUSPENDED") statusAndExpScore += 0.3;

  const years = input.experienceStartYear
    ? Math.max(0, new Date().getFullYear() - input.experienceStartYear)
    : 0;
  statusAndExpScore += Math.min(1.4, years * 0.08);
  statusAndExpScore = Math.min(3, statusAndExpScore);

  // Reputation 0–2
  let reputationScore = Math.min(1.2, input.reviewsCount * 0.25 + input.answersCount * 0.15);

  // Claim / completeness bonuses (motivation to enter dashboard)
  if (input.isClaimed) {
    practiceScore = Math.min(5, practiceScore + 0.3);
    statusAndExpScore = Math.min(3, statusAndExpScore + 0.4);
    reputationScore = Math.min(2, reputationScore + 0.3);
  }
  if (input.isVerifiedDocuments) {
    statusAndExpScore = Math.min(3, statusAndExpScore + 0.3);
  }
  if (input.bio && input.education) {
    reputationScore = Math.min(2, reputationScore + 0.2);
  }
  if (input.servicePricesCount > 0 || input.minConsultationPrice != null) {
    reputationScore = Math.min(2, reputationScore + 0.2);
  }
  if (input.answersCount > 0) {
    reputationScore = Math.min(2, reputationScore + 0.1);
  }

  practiceScore = round1(practiceScore);
  statusAndExpScore = round1(statusAndExpScore);
  reputationScore = round1(reputationScore);
  const totalRating = round1(
    Math.min(10, practiceScore + statusAndExpScore + reputationScore)
  );

  return {
    practiceScore,
    statusAndExpScore,
    reputationScore,
    totalRating,
    casesCount,
    wonCasesCount,
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export async function recalculateLawyerRating(lawyerId: string) {
  const lawyer = await prisma.lawyer.findUniqueOrThrow({
    where: { id: lawyerId },
    include: {
      courtCases: {
        select: { outcome: true, isHiddenByLawyer: true, categoryId: true },
      },
      _count: { select: { servicePrices: true } },
    },
  });

  const scores = calculateLawyerRating({
    ...lawyer,
    servicePricesCount: lawyer._count.servicePrices,
  });

  return prisma.lawyer.update({
    where: { id: lawyerId },
    data: {
      practiceScore: scores.practiceScore,
      statusAndExpScore: scores.statusAndExpScore,
      reputationScore: scores.reputationScore,
      totalRating: scores.totalRating,
      casesCount: scores.casesCount,
      wonCasesCount: scores.wonCasesCount,
    },
  });
}

export async function recalculateAllLawyerRatings() {
  const ids = await prisma.lawyer.findMany({ select: { id: true } });
  let updated = 0;
  for (const { id } of ids) {
    await recalculateLawyerRating(id);
    updated += 1;
  }
  return updated;
}

export function baseScoreFromRegistry(status: RegistryStatus): number {
  switch (status) {
    case "ACTIVE":
      return 1.6;
    case "UNKNOWN":
      return 0.6;
    case "SUSPENDED":
      return 0.3;
    default:
      return 0;
  }
}
