/**
 * Re-fetch KAD cards already in DB and refresh summary/outcome/sides.
 *
 * Usage:
 *   npx tsx scripts/parsers/reparse-kad-cases.ts
 *   npx tsx scripts/parsers/reparse-kad-cases.ts --limit=20
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { matchHitToLawyer } from "./case-match";
import type { LawyerProbe, ParsedCaseRow } from "./case-types";
import { closeKadSession, openKadSession, parseCard } from "./kad-client";
import { isPollutedKadSummary } from "./kad-clean";
import { recalculateLawyerRating } from "../../src/lib/rating/calculator";

const prisma = new PrismaClient();
const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "data", "parsed", "cases-kad-refresh.json");

function parseArgs(argv: string[]) {
  let limit = 0;
  let force = false;
  for (const a of argv) {
    if (a.startsWith("--limit=")) limit = Number(a.slice(8)) || 0;
    if (a === "--force") force = true;
  }
  return { limit, force };
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
  await prisma.lawyerSpecialization.updateMany({
    where: { lawyerId, categoryId: primaryId ? { not: primaryId } : undefined },
    data: { isPrimary: false },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = await prisma.courtCase.findMany({
    where: {
      OR: [
        { externalUid: { startsWith: "kad:" } },
        { sourceUrl: { contains: "kad.arbitr.ru/Card/" } },
      ],
    },
    include: {
      lawyer: {
        select: {
          id: true,
          registryNumber: true,
          fullName: true,
          lastName: true,
          firstName: true,
          middleName: true,
          initialsSearch: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: args.limit > 0 ? args.limit : undefined,
  });

  const targets = rows.filter(
    (r) => args.force || isPollutedKadSummary(r.summary) || !r.summary
  );
  console.log(`KAD cases in DB: ${rows.length}, to refresh: ${targets.length}`);

  const session = await openKadSession();
  const refreshed: ParsedCaseRow[] = [];
  const touched = new Set<string>();

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    const uid = row.externalUid?.replace(/^kad:/, "") ??
      row.sourceUrl?.match(/\/Card\/([0-9a-fA-F-]{36})/i)?.[1];
    if (!uid || !row.lawyer.registryNumber) {
      console.warn(`Skip ${row.caseNumber}: no card id`);
      continue;
    }

    const lawyer: LawyerProbe = {
      id: row.lawyer.id,
      registryNumber: row.lawyer.registryNumber,
      fullName: row.lawyer.fullName,
      lastName: row.lawyer.lastName,
      firstName: row.lawyer.firstName,
      middleName: row.lawyer.middleName,
      initialsSearch: row.lawyer.initialsSearch,
    };

    console.log(`[${i + 1}/${targets.length}] ${row.caseNumber} (${lawyer.fullName})`);
    try {
      const hit = await parseCard(session.page, uid);
      if (!hit) {
        console.warn("  empty card");
        continue;
      }
      // Always attach to this lawyer (already in DB) — bypass role rematch if needed
      const matched =
        matchHitToLawyer(hit, lawyer) ??
        ({
          externalUid: hit.externalUid,
          caseNumber: hit.caseNumber,
          title: hit.title,
          lawyerRegistryNumber: lawyer.registryNumber,
          lawArticles: hit.lawArticles ?? [],
          outcome: "UNKNOWN",
          courtSlug: hit.courtSlug,
          summary: hit.summary,
          rawTextExcerpt: hit.rawTextExcerpt,
          sourceUrl: hit.sourceUrl,
          decisionDate: hit.decisionDate,
          categorySlug: "arbitrazh",
          source: "kad" as const,
          matchConfidence: "medium" as const,
        } satisfies ParsedCaseRow);

      await prisma.courtCase.update({
        where: { id: row.id },
        data: {
          title: matched.title,
          summary: matched.summary,
          rawTextExcerpt: matched.rawTextExcerpt,
          outcome: matched.outcome ?? row.outcome,
          decisionDate: matched.decisionDate ? new Date(matched.decisionDate) : row.decisionDate,
          sourceUrl: matched.sourceUrl ?? row.sourceUrl,
          lawArticles: matched.lawArticles?.length ? matched.lawArticles : row.lawArticles,
        },
      });
      refreshed.push(matched);
      touched.add(row.lawyer.id);
      console.log(`  OK: ${(matched.summary ?? "").slice(0, 100)}`);
    } catch (e) {
      console.warn(`  fail:`, (e as Error).message);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  for (const lawyerId of touched) {
    await syncSpecializations(lawyerId);
    await recalculateLawyerRating(lawyerId);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ cases: refreshed }, null, 2), "utf8");
  console.log(`Refreshed ${refreshed.length} → ${OUT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await closeKadSession();
    await prisma.$disconnect();
  });
