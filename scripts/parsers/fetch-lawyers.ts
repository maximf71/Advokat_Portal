/**
 * Fetch lawyers from Minjust EGRA for Moscow + Tolyatti and write import JSON.
 *
 * Tolyatti city binding:
 *  1) Minjust org link (field_8) → advocacy firm address contains Тольятти
 *  2) Fallback: PASO formations registry (composition + address in Тольятти)
 * Status always from Minjust EGRA.
 *
 * Usage:
 *   npx tsx scripts/parsers/fetch-lawyers.ts
 *   npx tsx scripts/parsers/fetch-lawyers.ts --skip-fetch   # reuse Minjust raw
 *   npx tsx scripts/parsers/fetch-lawyers.ts --skip-fetch --skip-paso
 */
import fs from "node:fs";
import path from "node:path";
import {
  FIRMS_REGISTRY_ID,
  LAWYERS_REGISTRY_ID,
  addressLooksLikeTolyatti,
  fetchAllRegistryValues,
  parseOrgIds,
  type RegistryValue,
} from "./minjust-client";
import {
  isCatalogStatus,
  mapRegistryStatus,
  normalizeLawyer,
  type ImportLawyerRow,
} from "./normalize";
import {
  PASO_ORGS_URL,
  buildTolyattiPasoIndex,
  fetchPasoOrgs,
  matchPasoTolyatti,
  normalizePersonKey,
  type PasoOrgRow,
} from "./paso-client";

const ROOT = path.resolve(__dirname, "../..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const PARSED_DIR = path.join(ROOT, "data", "parsed");

function ensureDirs() {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(PARSED_DIR, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeJsonl(filePath: string, rows: RegistryValue[]) {
  const stream = fs.createWriteStream(filePath, { encoding: "utf8" });
  for (const row of rows) {
    stream.write(`${JSON.stringify(row)}\n`);
  }
  stream.end();
}

function readJsonl(filePath: string): RegistryValue[] {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RegistryValue);
}

function firmAddress(row: RegistryValue): string {
  // Firms registry: field_2_s = address
  return String(row.field_2_s ?? "");
}

function firmPhone(row: RegistryValue): string | undefined {
  const phone = String(row.field_3_s ?? "").trim();
  return phone || undefined;
}

async function loadMoscow(skipFetch: boolean): Promise<RegistryValue[]> {
  const outPath = path.join(RAW_DIR, "moscow-active.jsonl");
  if (skipFetch && fs.existsSync(outPath)) {
    console.log(`Reuse ${outPath}`);
    return readJsonl(outPath);
  }

  console.log("Fetching Moscow ACTIVE+SUSPENDED lawyers…");
  const rows = await fetchAllRegistryValues({
    registryId: LAWYERS_REGISTRY_ID,
    facets: {
      field_3_s: ["Москва"],
      field_5_s: ["Действующий", "Приостановлен"],
    },
    onPage: (_page, fetched) => {
      process.stdout.write(`\r  Moscow fetched ${fetched}`);
    },
  });
  process.stdout.write("\n");
  writeJsonl(outPath, rows);
  console.log(`Saved ${rows.length} Moscow rows → ${outPath}`);
  return rows;
}

async function loadSamara(skipFetch: boolean): Promise<RegistryValue[]> {
  const outPath = path.join(RAW_DIR, "samara-oblast.jsonl");
  if (skipFetch && fs.existsSync(outPath)) {
    console.log(`Reuse ${outPath}`);
    return readJsonl(outPath);
  }

  console.log("Fetching Samara Oblast lawyers (all statuses for join)…");
  const rows = await fetchAllRegistryValues({
    registryId: LAWYERS_REGISTRY_ID,
    facets: {
      field_3_s: ["Самарская область"],
    },
    onPage: (_page, fetched) => {
      process.stdout.write(`\r  Samara fetched ${fetched}`);
    },
  });
  process.stdout.write("\n");
  writeJsonl(outPath, rows);
  console.log(`Saved ${rows.length} Samara rows → ${outPath}`);
  return rows;
}

async function loadFirms(skipFetch: boolean): Promise<Map<string, RegistryValue>> {
  // Prefer Tolyatti-scoped dump (fast). Fall back to full orgs file if present.
  const scopedPath = path.join(RAW_DIR, "advocacy-orgs-tolyatti.jsonl");
  const fullPath = path.join(RAW_DIR, "advocacy-orgs.jsonl");
  let rows: RegistryValue[];

  if (skipFetch && fs.existsSync(scopedPath)) {
    console.log(`Reuse ${scopedPath}`);
    rows = readJsonl(scopedPath);
  } else if (skipFetch && fs.existsSync(fullPath)) {
    console.log(`Reuse ${fullPath}`);
    rows = readJsonl(fullPath).filter((r) => addressLooksLikeTolyatti(firmAddress(r)));
  } else {
    console.log('Fetching advocacy organizations matching "Тольятти"…');
    const searched = await fetchAllRegistryValues({
      registryId: FIRMS_REGISTRY_ID,
      search: "Тольятти",
      onPage: (_page, fetched) => {
        process.stdout.write(`\r  Orgs fetched ${fetched}`);
      },
    });
    process.stdout.write("\n");
    rows = searched.filter((r) => addressLooksLikeTolyatti(firmAddress(r)));
    writeJsonl(scopedPath, rows);
    console.log(`Saved ${rows.length} Tolyatti org rows → ${scopedPath}`);
  }

  const map = new Map<string, RegistryValue>();
  for (const row of rows) {
    map.set(row.id.toLowerCase(), row);
  }
  return map;
}

function pickTolyattiExtras(
  lawyer: RegistryValue,
  orgs: Map<string, RegistryValue>
): { officeAddress?: string; publicPhone?: string; matched: boolean } {
  const orgIds = parseOrgIds(lawyer.field_8_s);
  for (const orgId of orgIds) {
    const org = orgs.get(orgId);
    if (!org) continue;
    const address = firmAddress(org);
    if (addressLooksLikeTolyatti(address)) {
      return {
        matched: true,
        officeAddress: address || undefined,
        publicPhone: firmPhone(org),
      };
    }
  }
  return { matched: false };
}

async function loadPaso(skipPaso: boolean): Promise<PasoOrgRow[]> {
  const outPath = path.join(RAW_DIR, "paso-orgs-samara.json");
  if (skipPaso && fs.existsSync(outPath)) {
    console.log(`Reuse ${outPath}`);
    return JSON.parse(fs.readFileSync(outPath, "utf8")) as PasoOrgRow[];
  }

  console.log("Fetching PASO advocacy formations registry…");
  const rows = await fetchPasoOrgs({
    onPage: (page, n) => {
      process.stdout.write(`\r  PASO page ${page}: ${n} orgs`);
    },
  });
  process.stdout.write("\n");
  writeJson(outPath, rows);
  console.log(`Saved ${rows.length} PASO orgs → ${outPath}`);
  return rows;
}

function buildImportPayload(
  moscow: RegistryValue[],
  samara: RegistryValue[],
  orgs: Map<string, RegistryValue>,
  pasoOrgs: PasoOrgRow[]
): { lawyers: ImportLawyerRow[]; stats: Record<string, number> } {
  const lawyers: ImportLawyerRow[] = [];
  let moscowKept = 0;
  let moscowSkippedStatus = 0;
  let tolyattiViaMinjust = 0;
  let tolyattiViaPaso = 0;
  let tolyattiNoOrg = 0;
  let tolyattiOtherCity = 0;
  let pasoAmbiguous = 0;
  let pasoNoHit = 0;

  const pasoIndex = buildTolyattiPasoIndex(pasoOrgs);
  const keptRegistry = new Set<string>();

  for (const row of moscow) {
    const normalized = normalizeLawyer(row, "moscow");
    if (!normalized) continue;
    if (!isCatalogStatus(normalized.registryStatus)) {
      moscowSkippedStatus += 1;
      continue;
    }
    if (normalized.registryStatus === "ACTIVE" || normalized.registryStatus === "SUSPENDED") {
      lawyers.push(normalized);
      moscowKept += 1;
      keptRegistry.add(normalized.registryNumber);
    }
  }

  for (const row of samara) {
    const extras = pickTolyattiExtras(row, orgs);
    if (extras.matched) {
      const normalized = normalizeLawyer(row, "tolyatti", {
        officeAddress: extras.officeAddress,
        publicPhone: extras.publicPhone,
      });
      if (!normalized || !isCatalogStatus(normalized.registryStatus)) continue;
      normalized.cityMatchSource = "minjust_org";
      lawyers.push(normalized);
      keptRegistry.add(normalized.registryNumber);
      tolyattiViaMinjust += 1;
      continue;
    }

    if (parseOrgIds(row.field_8_s).length > 0) {
      tolyattiOtherCity += 1;
      continue;
    }
    tolyattiNoOrg += 1;

    // Fallback: PASO composition + Tolyatti address (empty Minjust field_8)
    if (!isCatalogStatus(mapRegistryStatus(row.field_5_s))) continue;
    const fullName = (row.field_1_s ?? "").trim();
    const pasoHit = matchPasoTolyatti(fullName, pasoIndex.byName);
    if (!pasoHit) {
      const keyHits = pasoIndex.byName.get(normalizePersonKey(fullName));
      if (keyHits && new Set(keyHits.map((h) => `${h.orgName}|${h.address}`)).size > 1) {
        pasoAmbiguous += 1;
      } else {
        pasoNoHit += 1;
      }
      continue;
    }

    const normalized = normalizeLawyer(row, "tolyatti", {
      officeAddress: pasoHit.address,
      publicPhone: pasoHit.phone,
    });
    if (!normalized || !isCatalogStatus(normalized.registryStatus)) continue;
    if (keptRegistry.has(normalized.registryNumber)) continue;
    normalized.cityMatchSource = "paso";
    normalized.lawFirmName = pasoHit.orgName;
    lawyers.push(normalized);
    keptRegistry.add(normalized.registryNumber);
    tolyattiViaPaso += 1;
  }

  return {
    lawyers,
    stats: {
      moscowKept,
      moscowSkippedStatus,
      tolyattiViaMinjust,
      tolyattiViaPaso,
      tolyattiKept: tolyattiViaMinjust + tolyattiViaPaso,
      tolyattiNoOrg,
      tolyattiOtherCity,
      pasoOrgsTotal: pasoOrgs.length,
      pasoTolyattiOrgs: pasoIndex.orgCount,
      pasoTolyattiMembers: pasoIndex.memberCount,
      pasoAmbiguous,
      pasoNoHit,
      total: lawyers.length,
    },
  };
}

async function main() {
  const skipFetch = process.argv.includes("--skip-fetch");
  const skipPaso = process.argv.includes("--skip-paso");
  ensureDirs();

  const moscow = await loadMoscow(skipFetch);
  const samara = await loadSamara(skipFetch);
  const orgs = await loadFirms(skipFetch);
  const pasoOrgs = await loadPaso(skipPaso);

  const { lawyers, stats } = buildImportPayload(moscow, samara, orgs, pasoOrgs);
  const outFile = path.join(PARSED_DIR, "lawyers-moscow-tolyatti.json");
  const fetchedAt = new Date().toISOString();
  writeJson(outFile, {
    disclaimer:
      "Справочный агрегатор. Не является официальным реестром Минюста РФ или адвокатской палаты. Статус адвоката — по ЕГРЮА Минюста; город каталога для части записей уточнён по открытому реестру образований ПАСО.",
    sources: {
      minjust:
        "https://minjust.gov.ru/ru/pages/advokaty-rossijskoj-federacii/",
      paso: PASO_ORGS_URL,
    },
    fetchedAt,
    stats,
    lawyers,
  });

  console.log("Stats:", stats);
  console.log(`Wrote ${lawyers.length} lawyers → ${outFile}`);
  const naumov = lawyers.find((l) => l.registryNumber === "63/2742");
  console.log(
    "Naumov 63/2742:",
    naumov
      ? `${naumov.fullName} city=${naumov.citySlug} via=${naumov.cityMatchSource}`
      : "NOT FOUND"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
