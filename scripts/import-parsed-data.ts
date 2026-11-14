/**
 * Import parsed lawyers and court cases from JSON.
 *
 * Usage:
 *   npx tsx scripts/import-parsed-data.ts path/to/data.json
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type CaseOutcome, type RegistryStatus } from "@prisma/client";
import { recalculateLawyerRating } from "../src/lib/rating/calculator";

const prisma = new PrismaClient();
const BATCH = 100;

type LawyerRow = {
  externalId?: string;
  registryNumber: string;
  fullName: string;
  lastName: string;
  firstName: string;
  middleName?: string;
  citySlug: string;
  registryStatus?: RegistryStatus;
  identityCardNumber?: string;
  chamberName?: string;
  regionCode?: string;
  officeAddress?: string;
  publicPhone?: string;
  experienceStartYear?: number;
};

type CaseRow = {
  externalUid?: string;
  caseNumber: string;
  title: string;
  lawyerRegistryNumber: string;
  lawArticles?: string[];
  outcome?: CaseOutcome;
  courtSlug?: string;
  summary?: string;
  rawTextExcerpt?: string;
  sourceUrl?: string;
  decisionDate?: string;
  categorySlug?: string;
};

/** ASCII slug for public URLs — Cyrillic А55 must not become «а55» (lookalike). */
function slugify(input: string) {
  const map: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
  };
  return input
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function chamberSlug(regionCode: string, name: string) {
  return slugify(`ap-${regionCode}-${name}`).slice(0, 80);
}

function initials(lastName: string, firstName: string, middleName?: string) {
  const m = middleName ? ` ${middleName[0]}.` : "";
  return `${lastName} ${firstName[0]}.${m}`.replace(/\s+/g, " ").trim();
}

async function ensureChambers(rows: LawyerRow[]) {
  const byRegion = new Map<string, { name: string; regionCode: string }>();
  for (const row of rows) {
    if (!row.regionCode || !row.chamberName) continue;
    if (!byRegion.has(row.regionCode)) {
      byRegion.set(row.regionCode, {
        name: row.chamberName,
        regionCode: row.regionCode,
      });
    }
  }

  const map = new Map<string, string>();
  for (const [regionCode, info] of byRegion) {
    const chamber = await prisma.advocateChamber.upsert({
      where: { regionCode },
      create: {
        slug: chamberSlug(regionCode, info.name),
        name: info.name,
        regionCode,
      },
      update: { name: info.name },
    });
    map.set(regionCode, chamber.id);
  }

  // Also load existing chambers for regions without name in payload
  const existing = await prisma.advocateChamber.findMany();
  for (const c of existing) {
    if (!map.has(c.regionCode)) map.set(c.regionCode, c.id);
  }
  return map;
}

async function importLawyers(rows: LawyerRow[]) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const cities = await prisma.city.findMany();
  const cityBySlug = new Map(cities.map((c) => [c.slug, c]));
  const chamberByRegion = await ensureChambers(rows);

  const existing = await prisma.lawyer.findMany({
    select: {
      id: true,
      externalId: true,
      registryNumber: true,
      cityId: true,
      registryStatus: true,
      slug: true,
    },
  });
  const byExternal = new Map(
    existing.filter((e) => e.externalId).map((e) => [e.externalId!, e])
  );
  const byRegistry = new Map(
    existing.filter((e) => e.registryNumber).map((e) => [e.registryNumber!, e])
  );

  const cityDelta = new Map<string, number>();
  const bump = (cityId: string, n: number) => {
    cityDelta.set(cityId, (cityDelta.get(cityId) ?? 0) + n);
  };

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        const city = cityBySlug.get(row.citySlug);
        if (!city) {
          skipped += 1;
          continue;
        }

        const found =
          (row.externalId ? byExternal.get(row.externalId) : undefined) ??
          byRegistry.get(row.registryNumber);

        const status = row.registryStatus ?? found?.registryStatus ?? "ACTIVE";
        const wasActive =
          !!found &&
          (found.registryStatus === "ACTIVE" || found.registryStatus === "UNKNOWN");
        const willBeActive = status === "ACTIVE" || status === "UNKNOWN";
        const chamberId = row.regionCode
          ? chamberByRegion.get(row.regionCode)
          : undefined;

        const data = {
          fullName: row.fullName,
          lastName: row.lastName,
          firstName: row.firstName,
          middleName: row.middleName,
          initialsSearch: initials(row.lastName, row.firstName, row.middleName),
          externalId: row.externalId,
          registryNumber: row.registryNumber,
          registryStatus: status,
          statusUpdatedAt: new Date(),
          identityCardNumber: row.identityCardNumber,
          experienceStartYear: row.experienceStartYear,
          officeAddress: row.officeAddress,
          publicPhone: row.publicPhone,
          cityId: city.id,
          chamberId: chamberId ?? undefined,
        };

        if (found) {
          await tx.lawyer.update({
            where: { id: found.id },
            data,
          });
          updated += 1;
          if (found.cityId !== city.id) {
            if (wasActive) bump(found.cityId, -1);
            if (willBeActive) bump(city.id, 1);
          } else if (wasActive !== willBeActive) {
            bump(city.id, willBeActive ? 1 : -1);
          }
          found.cityId = city.id;
          found.registryStatus = status;
          if (row.externalId) byExternal.set(row.externalId, found);
          byRegistry.set(row.registryNumber, found);
        } else {
          const slug = slugify(
            `${row.lastName}-${row.firstName}-${row.middleName ?? ""}-${row.registryNumber}`
          );
          const createdRow = await tx.lawyer.create({
            data: {
              ...data,
              slug,
              isClaimed: false,
            },
            select: {
              id: true,
              externalId: true,
              registryNumber: true,
              cityId: true,
              registryStatus: true,
              slug: true,
            },
          });
          created += 1;
          if (willBeActive) bump(city.id, 1);
          if (createdRow.externalId) byExternal.set(createdRow.externalId, createdRow);
          if (createdRow.registryNumber) {
            byRegistry.set(createdRow.registryNumber, createdRow);
          }
        }
      }
    });
    process.stdout.write(
      `\r  Import lawyers ${Math.min(i + BATCH, rows.length)}/${rows.length}`
    );
  }
  process.stdout.write("\n");

  for (const [cityId, delta] of cityDelta) {
    if (delta === 0) continue;
    await prisma.city.update({
      where: { id: cityId },
      data: { activeLawyersCount: { increment: delta } },
    });
  }

  // Recompute absolute counts for pilot cities to avoid drift
  for (const slug of ["moscow", "tolyatti"]) {
    const city = cityBySlug.get(slug);
    if (!city) continue;
    const active = await prisma.lawyer.count({
      where: {
        cityId: city.id,
        registryStatus: { in: ["ACTIVE", "UNKNOWN"] },
      },
    });
    await prisma.city.update({
      where: { id: city.id },
      data: { activeLawyersCount: active },
    });
  }

  return { created, updated, skipped };
}

async function resolveCategoryId(slug?: string) {
  if (!slug) return null;
  const cat = await prisma.category.findUnique({ where: { slug } });
  return cat?.id ?? null;
}

function parseDecisionDate(raw?: string): Date | undefined {
  if (!raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

async function syncSpecializations(lawyerId: string) {
  const cases = await prisma.courtCase.findMany({
    where: { lawyerId, isHiddenByLawyer: false, categoryId: { not: null } },
    select: { categoryId: true },
  });
  const counts = new Map<string, number>();
  for (const c of cases) {
    if (!c.categoryId) continue;
    counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1);
  }

  let primaryId: string | null = null;
  let primaryCount = -1;
  for (const [categoryId, n] of counts) {
    if (n > primaryCount) {
      primaryCount = n;
      primaryId = categoryId;
    }
  }

  for (const [categoryId, n] of counts) {
    await prisma.lawyerSpecialization.upsert({
      where: { lawyerId_categoryId: { lawyerId, categoryId } },
      create: {
        lawyerId,
        categoryId,
        casesInCategory: n,
        isPrimary: categoryId === primaryId,
      },
      update: {
        casesInCategory: n,
        isPrimary: categoryId === primaryId,
      },
    });
  }

  // Clear isPrimary on categories no longer present / not top
  await prisma.lawyerSpecialization.updateMany({
    where: {
      lawyerId,
      categoryId: primaryId ? { not: primaryId } : undefined,
    },
    data: { isPrimary: false },
  });
}

async function importCases(rows: CaseRow[]) {
  let created = 0;
  let updated = 0;
  const touchedLawyers = new Set<string>();

  for (const row of rows) {
    const lawyer = await prisma.lawyer.findUnique({
      where: { registryNumber: row.lawyerRegistryNumber },
    });
    if (!lawyer) {
      console.warn(`Skip case ${row.caseNumber}: lawyer ${row.lawyerRegistryNumber} not found`);
      continue;
    }
    const court = row.courtSlug
      ? await prisma.court.findUnique({ where: { slug: row.courtSlug } })
      : null;
    const categoryId = await resolveCategoryId(row.categorySlug);
    const decisionDate = parseDecisionDate(row.decisionDate);

    const slug = slugify(`delo-${row.caseNumber}-${row.externalUid ?? created + updated}`);

    const shared = {
      title: row.title,
      summary: row.summary,
      rawTextExcerpt: row.rawTextExcerpt,
      lawArticles: row.lawArticles ?? [],
      outcome: row.outcome,
      sourceUrl: row.sourceUrl,
      decisionDate,
      courtId: court?.id,
      categoryId: categoryId ?? undefined,
    };

    if (row.externalUid) {
      const byUid = await prisma.courtCase.findUnique({ where: { externalUid: row.externalUid } });
      if (byUid) {
        await prisma.courtCase.update({
          where: { id: byUid.id },
          data: {
            title: shared.title,
            summary: shared.summary,
            rawTextExcerpt: shared.rawTextExcerpt ?? byUid.rawTextExcerpt,
            lawArticles: shared.lawArticles.length ? shared.lawArticles : byUid.lawArticles,
            outcome: shared.outcome ?? byUid.outcome,
            sourceUrl: shared.sourceUrl ?? byUid.sourceUrl,
            decisionDate: shared.decisionDate ?? byUid.decisionDate,
            courtId: shared.courtId ?? byUid.courtId,
            categoryId: shared.categoryId ?? byUid.categoryId,
            lawyerId: lawyer.id,
          },
        });
        updated += 1;
        touchedLawyers.add(lawyer.id);
        continue;
      }
    }

    const byNumber = await prisma.courtCase.findFirst({
      where: { caseNumber: row.caseNumber, lawyerId: lawyer.id },
    });
    if (byNumber) {
      await prisma.courtCase.update({
        where: { id: byNumber.id },
        data: {
          title: shared.title,
          summary: shared.summary ?? byNumber.summary,
          rawTextExcerpt: shared.rawTextExcerpt ?? byNumber.rawTextExcerpt,
          lawArticles: shared.lawArticles.length ? shared.lawArticles : byNumber.lawArticles,
          outcome: shared.outcome ?? byNumber.outcome,
          sourceUrl: shared.sourceUrl ?? byNumber.sourceUrl,
          externalUid: row.externalUid ?? byNumber.externalUid,
          decisionDate: shared.decisionDate ?? byNumber.decisionDate,
          courtId: shared.courtId ?? byNumber.courtId,
          categoryId: shared.categoryId ?? byNumber.categoryId,
        },
      });
      updated += 1;
    } else {
      await prisma.courtCase.create({
        data: {
          slug,
          externalUid: row.externalUid,
          caseNumber: row.caseNumber,
          title: shared.title,
          summary: shared.summary,
          rawTextExcerpt: shared.rawTextExcerpt,
          lawArticles: shared.lawArticles,
          outcome: shared.outcome ?? "UNKNOWN",
          sourceUrl: shared.sourceUrl,
          decisionDate: shared.decisionDate,
          lawyerId: lawyer.id,
          courtId: shared.courtId,
          categoryId: shared.categoryId,
        },
      });
      created += 1;
    }
    touchedLawyers.add(lawyer.id);
  }

  for (const lawyerId of touchedLawyers) {
    await syncSpecializations(lawyerId);
    await recalculateLawyerRating(lawyerId);
  }

  return { created, updated, lawyersUpdated: touchedLawyers.size };
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/import-parsed-data.ts <file.json>");
    process.exit(1);
  }
  const abs = path.resolve(file);
  const raw = JSON.parse(fs.readFileSync(abs, "utf8")) as {
    lawyers?: LawyerRow[];
    cases?: CaseRow[];
  };

  if (raw.lawyers?.length) {
    const result = await importLawyers(raw.lawyers);
    console.log("Lawyers:", result);
  }
  if (raw.cases?.length) {
    const result = await importCases(raw.cases);
    console.log("Cases:", result);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
