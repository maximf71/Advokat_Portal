/**
 * Public registry of advocacy formations — Палата адвокатов Самарской области (PASO).
 * https://paso.ru/reestr-advokatskix-obrazovanij.html
 *
 * Used only to recover city (Tolyatti) when Minjust EGRA has empty org link (field_8).
 * Lawyer status always comes from Minjust, never from PASO.
 */
import { chromium, type Browser } from "playwright";
import { addressLooksLikeTolyatti } from "./minjust-client";

export const PASO_ORGS_URL =
  "https://paso.ru/reestr-advokatskix-obrazovanij.html";

export type PasoOrgRow = {
  orgName: string;
  address: string;
  phone?: string;
  email?: string;
  members: string[]; // UPPERCASE FIO as published
  page: number;
};

export type PasoMemberHit = {
  fullNameKey: string;
  fullNameRaw: string;
  orgName: string;
  address: string;
  phone?: string;
};

const NON_PERSON =
  /^(ИНН|КПП|БИК|Наименование|Корр\.|Расчетный|Банковские|Состав|Коллегия|Адвокатский)/i;

export function normalizePersonKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/Ё/g, "Е")
    .replace(/[^А-ЯA-Z\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPersonName(text: string): boolean {
  const t = text.trim();
  if (t.length < 8 || t.length > 80) return false;
  if (NON_PERSON.test(t)) return false;
  if (/\d/.test(t)) return false;
  // «ФАМИЛИЯ ИМЯ» or «ФАМИЛИЯ ИМЯ ОТЧЕСТВО»
  return /^[А-ЯЁA-Z][А-ЯЁA-Z\-]+(?:\s+[А-ЯЁA-Z][А-ЯЁA-Z\-]+){1,3}$/.test(
    normalizePersonKey(t)
  );
}

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({
      headless: true,
      channel: "chrome",
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function scrapePage(
  page: import("playwright").Page,
  pageNum: number
): Promise<PasoOrgRow[]> {
  const url =
    pageNum <= 1 ? PASO_ORGS_URL : `${PASO_ORGS_URL}?page=${pageNum}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(600);

  return page.evaluate((pnum) => {
    const rows = Array.from(document.querySelectorAll("table tr")).slice(1);
    const out: {
      orgName: string;
      address: string;
      phone?: string;
      email?: string;
      members: string[];
      page: number;
    }[] = [];

    for (const tr of rows) {
      const tds = Array.from(tr.querySelectorAll("td"));
      if (tds.length < 2) continue;
      const orgName = (tds[0]?.innerText || "")
        .split("\n")[0]
        .replace(/\s+/g, " ")
        .trim();
      if (!orgName) continue;
      const address = (tds[1]?.innerText || "").replace(/\s+/g, " ").trim();
      const email = (tds[2]?.innerText || "").replace(/\s+/g, " ").trim() || undefined;
      const phone = (tds[3]?.innerText || "").replace(/\s+/g, " ").trim() || undefined;
      const members = Array.from(tr.querySelectorAll(".child-menu-ul a"))
        .map((a) => (a.textContent || "").replace(/\s+/g, " ").trim())
        .filter(Boolean);
      out.push({ orgName, address, phone, email, members, page: pnum });
    }
    return out;
  }, pageNum);
}

export async function fetchPasoOrgs(opts?: {
  maxPages?: number;
  onPage?: (page: number, rows: number) => void;
}): Promise<PasoOrgRow[]> {
  const browser = await launchBrowser();
  const context = await browser.newContext({
    locale: "ru-RU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const all: PasoOrgRow[] = [];

  try {
    // Discover last page from pager on page 1
    await page.goto(PASO_ORGS_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(700);
    const lastPage = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll("a.page-link"));
      let max = 1;
      for (const a of links) {
        const href = a.getAttribute("href") || "";
        const m = href.match(/[?&]page=(\d+)/);
        if (m) max = Math.max(max, Number(m[1]));
        const t = (a.textContent || "").trim();
        if (/^\d+$/.test(t)) max = Math.max(max, Number(t));
      }
      return max;
    });

    const limit = Math.min(opts?.maxPages ?? lastPage, lastPage);
    for (let p = 1; p <= limit; p++) {
      const rows = await scrapePage(page, p);
      all.push(...rows);
      opts?.onPage?.(p, rows.length);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  return all;
}

/** Index PASO members whose formation address is in Tolyatti. */
export function buildTolyattiPasoIndex(orgs: PasoOrgRow[]): {
  byName: Map<string, PasoMemberHit[]>;
  orgCount: number;
  memberCount: number;
} {
  const byName = new Map<string, PasoMemberHit[]>();
  let orgCount = 0;
  let memberCount = 0;

  for (const org of orgs) {
    if (!addressLooksLikeTolyatti(org.address)) continue;
    orgCount += 1;
    const people = org.members.filter(isPersonName);
    for (const raw of people) {
      const key = normalizePersonKey(raw);
      if (!key) continue;
      memberCount += 1;
      const hit: PasoMemberHit = {
        fullNameKey: key,
        fullNameRaw: raw,
        orgName: org.orgName,
        address: org.address,
        phone: org.phone,
      };
      const list = byName.get(key) ?? [];
      list.push(hit);
      byName.set(key, list);
    }
  }

  return { byName, orgCount, memberCount };
}

/** Unique PASO Tolyatti hit for a Minjust FIO, or null if missing/ambiguous. */
export function matchPasoTolyatti(
  fullName: string,
  index: Map<string, PasoMemberHit[]>
): PasoMemberHit | null {
  const key = normalizePersonKey(fullName);
  const hits = index.get(key);
  if (!hits || hits.length === 0) return null;
  // Same person listed once per org is fine if all hits share same address+org
  const uniqOrgs = new Set(hits.map((h) => `${h.orgName}|${h.address}`));
  if (uniqOrgs.size > 1) return null;
  return hits[0];
}
