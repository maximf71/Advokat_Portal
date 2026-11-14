/**
 * Clean existing GAS court cases from stored rawTextExcerpt / summary (offline).
 *
 * Usage:
 *   npx tsx scripts/parsers/reparse-gas-cases.ts
 */
import { PrismaClient, type CaseOutcome } from "@prisma/client";
import { inferOutcome } from "./case-match";
import { isPollutedGasSummary, parseGasCardText } from "./gas-clean";

const prisma = new PrismaClient();

async function main() {
  const force = process.argv.includes("--force");
  const rows = await prisma.courtCase.findMany({
    where: {
      OR: [
        { externalUid: { startsWith: "gas:" } },
        { sourceUrl: { contains: "sudrf.ru" } },
      ],
    },
  });

  let updated = 0;
  for (const row of rows) {
    const raw = row.rawTextExcerpt || row.summary || "";
    if (!raw) continue;
    if (
      !force &&
      !isPollutedGasSummary(row.summary) &&
      row.summary &&
      row.summary.length < 400 &&
      row.outcome !== "UNKNOWN"
    ) {
      continue;
    }

    const parsed = parseGasCardText(`${row.caseNumber}\n${raw}`);
    if (!parsed.summary) continue;

    let outcome: CaseOutcome = inferOutcome(`${parsed.summary}\n${parsed.cleanExcerpt}\n${raw}`);
    if ((parsed.inProgress || /\/202[5-9]/.test(row.caseNumber)) && outcome === "UNKNOWN") {
      outcome = "IN_PROGRESS";
    }

    await prisma.courtCase.update({
      where: { id: row.id },
      data: {
        summary: parsed.summary,
        rawTextExcerpt: parsed.cleanExcerpt,
        lawArticles: parsed.articles.length ? parsed.articles : row.lawArticles,
        outcome,
      },
    });
    updated += 1;
    console.log(`${row.caseNumber} [${outcome}]: ${parsed.summary.slice(0, 100)}`);
  }

  console.log(`Updated ${updated}/${rows.length} GAS cases`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
