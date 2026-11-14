import { Prisma, RegistryStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { LawyerCardData } from "@/components/domain/LawyerCard";

const ACTIVE_REGISTRY: RegistryStatus[] = [
  RegistryStatus.ACTIVE,
  RegistryStatus.UNKNOWN,
];

const lawyerCardInclude = {
  lawFirm: true,
  specializations: { include: { category: true }, orderBy: { casesInCategory: "desc" as const } },
  courtCases: {
    where: { isHiddenByLawyer: false },
    orderBy: { decisionDate: "desc" as const },
    take: 2,
    include: { court: true },
  },
} as const;

function mapLawyerCard(
  lawyer: Awaited<ReturnType<typeof prisma.lawyer.findFirstOrThrow>> & {
    lawFirm: { name: string } | null;
    specializations: { category: { name: string } }[];
    courtCases: {
      caseNumber: string;
      title: string;
      lawArticles: string[];
      outcome: string;
      court: { name: string } | null;
    }[];
  }
): LawyerCardData {
  return {
    id: lawyer.id,
    slug: lawyer.slug,
    fullName: lawyer.fullName,
    registryNumber: lawyer.registryNumber,
    registryStatus: lawyer.registryStatus,
    isClaimed: lawyer.isClaimed,
    isVerifiedDocuments: lawyer.isVerifiedDocuments,
    photoUrl: lawyer.photoUrl,
    experienceStartYear: lawyer.experienceStartYear,
    lawFirmName: lawyer.lawFirm?.name ?? null,
    totalRating: lawyer.totalRating,
    practiceScore: lawyer.practiceScore,
    statusAndExpScore: lawyer.statusAndExpScore,
    reputationScore: lawyer.reputationScore,
    casesCount: lawyer.casesCount,
    minConsultationPrice: lawyer.minConsultationPrice,
    freeFirstCheck: lawyer.freeFirstCheck,
    specializations: lawyer.specializations.map((s) => s.category.name),
    courtHighlights: [
      ...new Set(
        lawyer.courtCases
          .map((c) => c.court?.name)
          .filter((name): name is string => Boolean(name))
      ),
    ].slice(0, 2),
    recentCases: lawyer.courtCases.map((c) => ({
      caseNumber: c.caseNumber,
      title: c.title,
      lawArticles: c.lawArticles,
      outcomeLabel: c.outcome,
    })),
  };
}

export async function getCityBySlug(slug: string) {
  return prisma.city.findUnique({ where: { slug } });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: { services: { orderBy: { name: "asc" } } },
  });
}

export async function getServiceBySlugs(categoryId: string, serviceSlug: string) {
  return prisma.service.findUnique({
    where: { categoryId_slug: { categoryId, slug: serviceSlug } },
  });
}

export const CATALOG_PAGE_SIZE = 48;

export type LawyerCatalogSort = "rating" | "name" | "cases";

function catalogOrderBy(sort: LawyerCatalogSort = "rating") {
  if (sort === "name") {
    return [{ lastName: "asc" as const }, { firstName: "asc" as const }, { middleName: "asc" as const }];
  }
  if (sort === "cases") {
    return [
      { casesCount: "desc" as const },
      { lastName: "asc" as const },
      { firstName: "asc" as const },
    ];
  }
  return [
    { isClaimed: "desc" as const },
    { isPromoted: "desc" as const },
    { totalRating: "desc" as const },
    { casesCount: "desc" as const },
  ];
}

export async function getLawyersByCity(
  cityId: string,
  categoryId?: string,
  options?: { page?: number; pageSize?: number; sort?: LawyerCatalogSort }
) {
  const pageSize = options?.pageSize ?? CATALOG_PAGE_SIZE;
  const page = Math.max(1, options?.page ?? 1);
  const sort = options?.sort ?? "rating";
  const where: Prisma.LawyerWhereInput = {
    cityId,
    registryStatus: { in: ACTIVE_REGISTRY },
    ...(categoryId
      ? { specializations: { some: { categoryId } } }
      : {}),
  };

  const [total, lawyers] = await Promise.all([
    prisma.lawyer.count({ where }),
    prisma.lawyer.findMany({
      where,
      include: lawyerCardInclude,
      orderBy: catalogOrderBy(sort),
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    lawyers: lawyers.map(mapLawyerCard),
    total,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
  };
}

export async function getCityCategoryStats(cityId: string, categoryId?: string) {
  const lawyerWhere: Prisma.LawyerWhereInput = {
    cityId,
    registryStatus: { in: ACTIVE_REGISTRY },
    ...(categoryId ? { specializations: { some: { categoryId } } } : {}),
  };
  const [lawyersCount, casesCount, avgRating, minPrice] = await Promise.all([
    prisma.lawyer.count({ where: lawyerWhere }),
    prisma.courtCase.count({
      where: {
        isHiddenByLawyer: false,
        lawyer: { cityId, registryStatus: { in: ACTIVE_REGISTRY } },
        ...(categoryId ? { categoryId } : {}),
      },
    }),
    prisma.lawyer.aggregate({
      where: lawyerWhere,
      _avg: { totalRating: true },
    }),
    prisma.lawyer.aggregate({
      where: {
        ...lawyerWhere,
        minConsultationPrice: { not: null },
      },
      _min: { minConsultationPrice: true },
    }),
  ]);

  return {
    lawyersCount,
    casesCount,
    avgRating: avgRating._avg.totalRating ?? 0,
    minPrice: minPrice._min.minConsultationPrice,
  };
}

export async function getLawyerBySlug(slug: string) {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    decoded = slug;
  }

  return prisma.lawyer.findUnique({
    where: { slug: decoded },
    include: {
      city: true,
      lawFirm: true,
      chamber: true,
      specializations: { include: { category: true } },
      servicePrices: { include: { service: true } },
      courtCases: {
        where: { isHiddenByLawyer: false },
        orderBy: { decisionDate: "desc" },
        include: { court: true, category: true },
      },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      answers: {
        include: { question: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });
}

export async function getCourtBySlug(slug: string) {
  return prisma.court.findUnique({
    where: { slug },
    include: {
      city: true,
      cases: {
        where: { isHiddenByLawyer: false },
        orderBy: { decisionDate: "desc" },
        take: 50,
        include: {
          lawyer: true,
          category: true,
        },
      },
    },
  });
}

export async function getTopLawyersForCourt(courtId: string, take = 10) {
  const grouped = await prisma.courtCase.groupBy({
    by: ["lawyerId"],
    where: { courtId, isHiddenByLawyer: false },
    _count: { lawyerId: true },
    orderBy: { _count: { lawyerId: "desc" } },
    take,
  });
  const ids = grouped.map((g) => g.lawyerId);
  const lawyers = await prisma.lawyer.findMany({
    where: { id: { in: ids } },
    include: lawyerCardInclude,
  });
  const byId = new Map(lawyers.map((l) => [l.id, l]));
  return grouped
    .map((g) => {
      const lawyer = byId.get(g.lawyerId);
      if (!lawyer) return null;
      return { ...mapLawyerCard(lawyer), casesInCourt: g._count.lawyerId };
    })
    .filter(Boolean);
}

function normalizeCaseSlug(slug: string) {
  let s = slug;
  try {
    s = decodeURIComponent(slug);
  } catch {
    /* keep raw */
  }
  // Cyrillic lookalikes that appear in А55… case numbers → Latin
  const lookalikes: Record<string, string> = {
    а: "a",
    е: "e",
    о: "o",
    р: "p",
    с: "c",
    у: "y",
    х: "x",
    А: "a",
    Е: "e",
    О: "o",
    Р: "p",
    С: "c",
    У: "y",
    Х: "x",
  };
  return s
    .split("")
    .map((ch) => lookalikes[ch] ?? ch)
    .join("")
    .toLowerCase();
}

export async function getCaseBySlug(slug: string) {
  const include = {
    lawyer: { include: { city: true } },
    court: true,
    category: true,
    service: true,
  } as const;

  const decoded = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  const ascii = normalizeCaseSlug(slug);

  const direct =
    (await prisma.courtCase.findUnique({ where: { slug }, include })) ??
    (decoded !== slug
      ? await prisma.courtCase.findUnique({ where: { slug: decoded }, include })
      : null);
  if (direct) return direct;

  if (ascii !== slug && ascii !== decoded) {
    const byAscii = await prisma.courtCase.findUnique({ where: { slug: ascii }, include });
    if (byAscii) return byAscii;
  }

  // Last resort: match by externalUid tail from slug «…-kad-<uuid>»
  const kadUid = ascii.match(/kad-([0-9a-f-]{36})$/i)?.[1];
  if (kadUid) {
    return prisma.courtCase.findFirst({
      where: { externalUid: `kad:${kadUid}` },
      include,
    });
  }
  const gasTail = ascii.match(/gas-[a-z0-9-]+-([0-9a-f]{8,})$/i)?.[1];
  if (gasTail) {
    return prisma.courtCase.findFirst({
      where: { externalUid: { contains: gasTail } },
      include,
    });
  }

  return null;
}

export async function getFirmBySlug(slug: string) {
  return prisma.lawFirm.findUnique({
    where: { slug },
    include: {
      city: true,
      lawyers: {
        include: lawyerCardInclude,
        orderBy: { totalRating: "desc" },
      },
    },
  });
}

export async function getQuestionBySlug(slug: string) {
  return prisma.question.findUnique({
    where: { slug },
    include: {
      city: true,
      category: true,
      answers: {
        include: { lawyer: true },
        orderBy: [{ isBestAnswer: "desc" }, { createdAt: "asc" }],
      },
    },
  });
}

export async function getPublishedQuestions(take = 30) {
  return prisma.question.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "desc" },
    take,
    include: { city: true, category: true, _count: { select: { answers: true } } },
  });
}

export async function getTopLawyersByCity(cityId: string, take = 3) {
  const lawyers = await prisma.lawyer.findMany({
    where: { cityId },
    orderBy: [{ totalRating: "desc" }, { casesCount: "desc" }],
    take,
    select: { slug: true, fullName: true, totalRating: true },
  });
  return lawyers;
}

export async function getCategoriesForCityLinks(cityId: string, citySlug: string) {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      specializations: {
        where: { lawyer: { cityId } },
        select: { id: true },
      },
    },
  });
  return categories
    .map((c) => ({
      label: c.name,
      count: c.specializations.length,
      href: `/${citySlug}/${c.slug}`,
    }))
    .filter((c) => c.count > 0);
}

export async function getMajorCities() {
  return prisma.city.findMany({
    where: { isMajor: true },
    orderBy: { population: "desc" },
  });
}
