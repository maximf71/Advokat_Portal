import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db/prisma";

const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cities, categories, lawyers, cases, courts, firms, questions] = await Promise.all([
    prisma.city.findMany({
      where: { activeLawyersCount: { gt: 0 } },
      select: { slug: true },
    }),
    prisma.category.findMany({ select: { slug: true } }),
    prisma.lawyer.findMany({ select: { slug: true, updatedAt: true } }),
    prisma.courtCase.findMany({
      where: { isHiddenByLawyer: false },
      select: { slug: true },
    }),
    prisma.court.findMany({ select: { slug: true } }),
    prisma.lawFirm.findMany({ select: { slug: true } }),
    prisma.question.findMany({
      where: { isPublished: true },
      select: { slug: true, createdAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/questions`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/calculators/gosposhlina`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/calculators/alimenty`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/calculators/neustojka-ddu`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const cityRoutes = cities.map((c) => ({
    url: `${base}/${c.slug}`,
    changeFrequency: "daily" as const,
    priority: 0.9,
  }));

  const cityCategoryRoutes = cities.flatMap((city) =>
    categories.map((cat) => ({
      url: `${base}/${city.slug}/${cat.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    }))
  );

  return [
    ...staticRoutes,
    ...cityRoutes,
    ...cityCategoryRoutes,
    ...lawyers.map((l) => ({
      url: `${base}/lawyers/${l.slug}`,
      lastModified: l.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
    ...cases.map((c) => ({
      url: `${base}/cases/${c.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...courts.map((c) => ({
      url: `${base}/courts/${c.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...firms.map((f) => ({
      url: `${base}/firms/${f.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...questions.map((q) => ({
      url: `${base}/questions/${q.slug}`,
      lastModified: q.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.55,
    })),
  ];
}
