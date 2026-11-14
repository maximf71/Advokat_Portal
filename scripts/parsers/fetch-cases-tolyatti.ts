/**
 * Fetch court cases for ACTIVE Tolyatti lawyers from GAS (СОЮ) + KAD (arbitration).
 *
 * Usage:
 *   npx tsx scripts/parsers/fetch-cases-tolyatti.ts --city=tolyatti
 *   npx tsx scripts/parsers/fetch-cases-tolyatti.ts --city=tolyatti --only=kad --limit=5
 *   npx tsx scripts/parsers/fetch-cases-tolyatti.ts --city=tolyatti --only=gas --limit=20
 *   npx tsx scripts/parsers/fetch-cases-tolyatti.ts --resume
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { matchHitToLawyer } from "./case-match";
import type { LawyerProbe, ParsedCaseRow, RawCaseHit } from "./case-types";
import { closeGasSession, scanGasCourts } from "./gas-client";
import { closeKadSession, searchKadForLawyer } from "./kad-client";
import { ensureTolyattiCourts } from "./ensure-courts";

const prisma = new PrismaClient();
const ROOT = path.resolve(__dirname, "../..");
const RAW_GAS = path.join(ROOT, "data", "raw", "gas-tolyatti");
const RAW_KAD = path.join(ROOT, "data", "raw", "kad-tolyatti");
const PARSED = path.join(ROOT, "data", "parsed");
const PROGRESS = path.join(ROOT, "data", "raw", "cases-tolyatti-progress.json");

type Progress = {
  doneLawyerIds: string[];
  gasScanned?: boolean;
  cases: ParsedCaseRow[];
};

function parseArgs(argv: string[]) {
  const out = {
    city: "tolyatti",
    only: "all" as "all" | "gas" | "kad",
    limit: 0,
    resume: false,
    forceGas: false,
    gasMax: 30,
    /** Past calendar days for H_date archive (closed hearings). */
    gasDays: 0,
    gasCards: 600,
  };
  for (const a of argv) {
    if (a.startsWith("--city=")) out.city = a.slice(7);
    else if (a.startsWith("--only=")) {
      const v = a.slice(7);
      if (v === "gas" || v === "kad" || v === "all") out.only = v;
    } else if (a.startsWith("--limit=")) out.limit = Number(a.slice(8)) || 0;
    else if (a.startsWith("--gas-max=")) out.gasMax = Number(a.slice(10)) || 30;
    else if (a.startsWith("--gas-days=")) out.gasDays = Number(a.slice(11)) || 0;
    else if (a.startsWith("--gas-cards=")) out.gasCards = Number(a.slice(12)) || 600;
    else if (a === "--resume") out.resume = true;
    else if (a === "--force-gas") out.forceGas = true;
  }
  return out;
}

function ensureDirs() {
  fs.mkdirSync(RAW_GAS, { recursive: true });
  fs.mkdirSync(RAW_KAD, { recursive: true });
  fs.mkdirSync(PARSED, { recursive: true });
}

function loadProgress(): Progress {
  if (!fs.existsSync(PROGRESS)) return { doneLawyerIds: [], cases: [] };
  try {
    return JSON.parse(fs.readFileSync(PROGRESS, "utf8")) as Progress;
  } catch {
    return { doneLawyerIds: [], cases: [] };
  }
}

function saveProgress(p: Progress) {
  fs.writeFileSync(PROGRESS, JSON.stringify(p, null, 2), "utf8");
}

function writeRaw(dir: string, name: string, data: unknown) {
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2), "utf8");
}

function caseQuality(r: ParsedCaseRow): number {
  let s = 0;
  if (r.matchConfidence === "high") s += 2;
  if (r.outcome && !["UNKNOWN", "IN_PROGRESS"].includes(r.outcome)) s += 4;
  if (r.outcome === "IN_PROGRESS") s += 1;
  const summary = r.summary ?? "";
  if (summary.length > 60) s += 1;
  if (!/развернуть|sudrf\.ru|версия для слабовидящих/i.test(summary)) s += 2;
  if (/^1-/.test(r.caseNumber)) s += 1;
  return s;
}

function dedupeCases(rows: ParsedCaseRow[]): ParsedCaseRow[] {
  const map = new Map<string, ParsedCaseRow>();
  for (const r of rows) {
    const key = `${r.lawyerRegistryNumber}|${r.externalUid}`;
    const prev = map.get(key);
    if (!prev || caseQuality(r) >= caseQuality(prev)) {
      map.set(key, r);
    }
  }
  return [...map.values()];
}

async function loadLawyers(citySlug: string, limit: number): Promise<LawyerProbe[]> {
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error(`City not found: ${citySlug}`);

  const rows = await prisma.lawyer.findMany({
    where: {
      cityId: city.id,
      registryStatus: { in: ["ACTIVE", "UNKNOWN"] },
      registryNumber: { not: null },
    },
    select: {
      id: true,
      registryNumber: true,
      fullName: true,
      lastName: true,
      firstName: true,
      middleName: true,
      initialsSearch: true,
    },
    orderBy: { lastName: "asc" },
    take: limit > 0 ? limit : undefined,
  });

  return rows
    .filter((r) => r.registryNumber)
    .map((r) => ({
      id: r.id,
      registryNumber: r.registryNumber!,
      fullName: r.fullName,
      lastName: r.lastName,
      firstName: r.firstName,
      middleName: r.middleName,
      initialsSearch: r.initialsSearch,
    }));
}

function matchHitsToLawyers(hits: RawCaseHit[], lawyers: LawyerProbe[]): ParsedCaseRow[] {
  const out: ParsedCaseRow[] = [];
  for (const hit of hits) {
    for (const lawyer of lawyers) {
      const row = matchHitToLawyer(hit, lawyer);
      if (row) out.push(row);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureDirs();

  console.log("Ensuring courts…");
  console.log(`  Courts upserted: ${await ensureTolyattiCourts()}`);

  // GAS is court-centric: match against all city lawyers.
  // --limit applies to KAD per-lawyer walk.
  const allLawyers = await loadLawyers(args.city, 0);
  const kadLawyers = args.limit > 0 ? allLawyers.slice(0, args.limit) : allLawyers;
  console.log(
    `Lawyers (${args.city}): gas-match=${allLawyers.length}, kad=${kadLawyers.length} [only=${args.only}]`
  );

  const progress = args.resume
    ? loadProgress()
    : { doneLawyerIds: [] as string[], cases: [] as ParsedCaseRow[], gasScanned: false };
  const done = new Set(progress.doneLawyerIds);

  // ——— GAS: one batch scan against all lawyers ———
  if (args.only === "all" || args.only === "gas") {
    const skipGas = args.resume && progress.gasScanned && !args.forceGas && args.gasDays === 0;
    if (skipGas) {
      console.log("GAS: skip (already scanned, --resume); use --force-gas or --gas-days=N");
    } else {
      const mode =
        args.gasDays > 0
          ? `calendar ${args.gasDays}d + criminal boards (≤${args.gasCards} cards)`
          : `listings (≤${args.gasMax} cards/server)`;
      console.log(`\nGAS: scanning ${mode}…`);
      try {
        const gasHits = await scanGasCourts({
          lawyers: allLawyers,
          maxCasesPerServer: args.gasMax,
          delayMs: args.gasDays > 0 ? 400 : 550,
          calendarDays: args.gasDays,
          // Calendar pass: skip live board so finished sentences aren't crowded out
          criminalListing: false,
          criminalOnly: args.gasDays > 0,
          maxCardsTotal: args.gasCards,
        });
        writeRaw(RAW_GAS, args.gasDays > 0 ? "calendar-scan" : "batch-scan", gasHits);
        console.log(`  GAS raw matched cards: ${gasHits.length}`);
        const matched = matchHitsToLawyers(gasHits, allLawyers);
        console.log(`  GAS matched for import: ${matched.length}`);
        progress.cases.push(...matched);
        progress.gasScanned = true;
        saveProgress(progress);
      } catch (e) {
        console.warn("  GAS error:", (e as Error).message);
        writeRaw(RAW_GAS, args.gasDays > 0 ? "calendar-scan" : "batch-scan", []);
        // Do not mark gasScanned — allow retry on next --resume
        saveProgress(progress);
      }
    }
  }

  // ——— KAD: per-lawyer search ———
  if (args.only === "all" || args.only === "kad") {
    let i = 0;
    for (const lawyer of kadLawyers) {
      i += 1;
      if (done.has(lawyer.id)) {
        console.log(`KAD skip (resume): ${lawyer.fullName}`);
        continue;
      }
      console.log(`\nKAD [${i}/${kadLawyers.length}] ${lawyer.fullName} (${lawyer.registryNumber})`);
      try {
        const kadHits = await searchKadForLawyer(lawyer, {
          maxCards: 2,
          delayMs: 1200,
        });
        writeRaw(RAW_KAD, lawyer.id, kadHits);
        console.log(`  KAD raw hits: ${kadHits.length}`);
        const matched = matchHitsToLawyers(kadHits, [lawyer]);
        console.log(`  KAD matched: ${matched.length}`);
        progress.cases.push(...matched);
      } catch (e) {
        console.warn(`  KAD error:`, (e as Error).message);
        writeRaw(RAW_KAD, lawyer.id, []);
      }
      progress.doneLawyerIds.push(lawyer.id);
      done.add(lawyer.id);
      saveProgress(progress);
    }
  }

  const cases = dedupeCases(progress.cases);
  const outPath = path.join(PARSED, `cases-${args.city}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ cases }, null, 2), "utf8");
  console.log(`\nWrote ${cases.length} cases → ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await closeKadSession();
    await closeGasSession();
    await prisma.$disconnect();
  });
