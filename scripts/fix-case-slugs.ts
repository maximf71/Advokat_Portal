/**
 * Rewrite CourtCase.slug to ASCII-only (fix Cyrillic А55 → a55 lookalike 404s).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugifyAscii(input: string) {
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

async function main() {
  const rows = await prisma.courtCase.findMany({
    select: { id: true, slug: true, caseNumber: true, externalUid: true },
  });

  let updated = 0;
  const used = new Set<string>();

  for (const row of rows) {
    const base = slugifyAscii(
      `delo-${row.caseNumber}-${row.externalUid ?? row.id}`
    );
    let next = base;
    let n = 2;
    while (used.has(next)) {
      next = `${base}-${n++}`.slice(0, 100);
    }
    used.add(next);

    if (next === row.slug) continue;
    await prisma.courtCase.update({
      where: { id: row.id },
      data: { slug: next },
    });
    console.log(`${row.caseNumber}\n  ${row.slug}\n→ ${next}`);
    updated += 1;
  }

  console.log(`Updated ${updated}/${rows.length} slugs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
