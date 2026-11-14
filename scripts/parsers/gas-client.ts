/**
 * Playwright client for СОЮ (ГАС «Правосудие») — regional court sites *.sudrf.ru.
 *
 * Name-search forms require captcha. We scan public case listings, open cards,
 * switch to the «СТОРОНЫ» tab (where «Защитник (адвокат)» appears), and match.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { createHash } from "node:crypto";
import type { LawyerProbe, RawCaseHit } from "./case-types";
import { hasAdvocateRoleNearName, nameAppears } from "./case-match";
import { parseGasCardText } from "./gas-clean";

export type GasCourtTarget = {
  slug: string;
  name: string;
  baseUrl: string;
  servers: number[];
};

export const GAS_TOLYATTI_COURTS: GasCourtTarget[] = [
  {
    slug: "avtozavodsky-tolyatti",
    name: "Автозаводский районный суд г. Тольятти",
    baseUrl: "https://avtozavodsky.sam.sudrf.ru",
    servers: [1, 2],
  },
  {
    slug: "centralny-tolyatti",
    name: "Центральный районный суд г. Тольятти",
    baseUrl: "https://centralny.sam.sudrf.ru",
    servers: [1],
  },
  {
    slug: "komsomolsky-tolyatti",
    name: "Комсомольский районный суд г. Тольятти",
    baseUrl: "https://komsomolsky.sam.sudrf.ru",
    servers: [1],
  },
  {
    slug: "samara-oblastnoj",
    name: "Самарский областной суд",
    baseUrl: "https://oblsud.sam.sudrf.ru",
    servers: [1],
  },
];

export type GasSearchOptions = {
  courts?: GasCourtTarget[];
  delayMs?: number;
  maxCasesPerServer?: number;
  lawyers?: LawyerProbe[];
  /** Weekdays back via H_date calendar (finished hearings / sentences). 0 = skip. */
  calendarDays?: number;
  /** Also open current criminal listing delo_id=1540006 */
  criminalListing?: boolean;
  /** Only open cards whose number looks like first-instance criminal (1-N/YYYY) */
  criminalOnly?: boolean;
  /** Soft cap on cards opened across all courts */
  maxCardsTotal?: number;
};

type GasSession = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

let session: GasSession | null = null;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function launchGasBrowser(headless: boolean) {
  const args = ["--disable-blink-features=AutomationControlled"];
  // Prefer system Chrome — Playwright's bundled chromium may be missing in sandbox caches.
  try {
    return await chromium.launch({ headless, channel: "chrome", args });
  } catch (e1) {
    const candidates = [
      process.env.CHROME_PATH,
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    ].filter(Boolean) as string[];
    for (const executablePath of candidates) {
      try {
        return await chromium.launch({ headless, executablePath, args });
      } catch {
        /* try next */
      }
    }
    try {
      return await chromium.launch({ headless, args });
    } catch (e2) {
      throw new Error(
        `GAS browser launch failed. channel/chrome: ${(e1 as Error).message}; bundled: ${(e2 as Error).message}`
      );
    }
  }
}

export async function openGasSession(headless = true) {
  if (session) return session;
  const browser = await launchGasBrowser(headless);
  const context = await browser.newContext({
    locale: "ru-RU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1365, height: 900 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  session = { browser, context, page };
  return session;
}

export async function closeGasSession() {
  if (!session) return;
  await session.browser.close().catch(() => undefined);
  session = null;
}

function uidFor(courtSlug: string, caseNumber: string, caseUid?: string) {
  const h = createHash("sha1")
    .update(`${courtSlug}|${caseNumber}|${caseUid ?? ""}`)
    .digest("hex")
    .slice(0, 16);
  return `gas:${courtSlug}:${caseUid ?? h}`;
}

type CaseLink = {
  href: string;
  text: string;
  caseUid?: string;
  hearingDate?: string;
  likelyFinished?: boolean;
};

function formatRuDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Past weekdays (skip Sat/Sun), newest first. */
export function iterHearingDates(daysBack: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 1; i <= daysBack; i++) {
    const x = new Date(today);
    x.setDate(today.getDate() - i);
    const wd = x.getDay();
    if (wd === 0 || wd === 6) continue;
    out.push(formatRuDate(x));
  }
  return out;
}

function isCriminalCaseNumber(text: string): boolean {
  return /\b1-\d+(?:\.\d+)?\/\d{4}\b/.test(text);
}

async function collectCaseLinksFromUrl(
  page: Page,
  court: GasCourtTarget,
  url: string,
  hearingDate?: string
): Promise<CaseLink[]> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(500);

  const links = await page.evaluate((base) => {
    const out: { href: string; text: string; caseUid?: string; likelyFinished?: boolean }[] =
      [];
    const seen = new Set<string>();
    for (const a of Array.from(document.querySelectorAll("a[href*='name_op=case']"))) {
      const hrefRaw = a.getAttribute("href") ?? "";
      const href = hrefRaw.startsWith("http") ? hrefRaw : new URL(hrefRaw, base).toString();
      if (seen.has(href)) continue;
      seen.add(href);
      const text = (a.textContent ?? "").replace(/\s+/g, " ").trim();
      const uid =
        href.match(/case_uid=([0-9a-f-]{36})/i)?.[1] ??
        href.match(/_uid=([0-9a-f-]{36})/i)?.[1];
      const row = (a.closest("tr")?.innerText ?? "").replace(/\s+/g, " ");
      const likelyFinished = /приговор|постановление|решение|определение/i.test(row);
      out.push({ href, text, caseUid: uid, likelyFinished });
    }
    return out;
  }, court.baseUrl);

  return links.map((l) => ({ ...l, hearingDate }));
}

async function collectListingLinks(
  page: Page,
  court: GasCourtTarget,
  srv: number
): Promise<CaseLink[]> {
  const url = `${court.baseUrl}/modules.php?name=sud_delo&srv_num=${srv}`;
  return collectCaseLinksFromUrl(page, court, url);
}

async function collectCriminalListingLinks(
  page: Page,
  court: GasCourtTarget,
  srv: number
): Promise<CaseLink[]> {
  const url = `${court.baseUrl}/modules.php?name=sud_delo&srv_num=${srv}&delo_id=1540006`;
  return collectCaseLinksFromUrl(page, court, url);
}

async function collectCalendarLinks(
  page: Page,
  court: GasCourtTarget,
  srv: number,
  dateRu: string
): Promise<CaseLink[]> {
  const url = `${court.baseUrl}/modules.php?name=sud_delo&srv_num=${srv}&H_date=${encodeURIComponent(dateRu)}`;
  return collectCaseLinksFromUrl(page, court, url, dateRu);
}

async function openSidesTab(page: Page) {
  // Tabs are often plain text links / table cells
  const candidates = [
    page.getByRole("link", { name: /СТОРОНЫ/i }),
    page.locator("a", { hasText: /^СТОРОНЫ$/i }),
    page.locator("td a, .tab a, a").filter({ hasText: /^СТОРОНЫ$/i }),
  ];
  for (const loc of candidates) {
    if ((await loc.count()) === 0) continue;
    try {
      await loc.first().click({ force: true, timeout: 3000 });
      await sleep(900);
      return true;
    } catch {
      /* next */
    }
  }
  // Fallback: navigate via hash / query if present in page HTML
  const sidesHref = await page.evaluate(() => {
    const a = Array.from(document.querySelectorAll("a")).find((el) =>
      /^СТОРОНЫ$/i.test((el.textContent ?? "").trim())
    );
    return a?.getAttribute("href") ?? null;
  });
  if (sidesHref) {
    const abs = sidesHref.startsWith("http")
      ? sidesHref
      : new URL(sidesHref, page.url()).toString();
    await page.goto(abs, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await sleep(700);
    return true;
  }
  return false;
}

function extractCaseNumber(text: string, linkText?: string): string | undefined {
  const fromLink =
    linkText?.match(/\b(\d{1,2}-\d+(?:\.\d+)?\/\d{4})\b/)?.[1] ??
    linkText?.match(/\b(\d+\/\d{4})\b/)?.[1];
  const fromBody =
    text.match(/ДЕЛО\s*№\s*([\d./-]+)/i)?.[1] ??
    text.match(/\b(\d{1,2}-\d+(?:\.\d+)?\/\d{4})\b/)?.[1];
  return fromBody || fromLink;
}

async function readBodyText(page: Page): Promise<string> {
  // String evaluate — avoid tsx __name injection in browser context
  return (await page.evaluate(`(() => {
    return document.body && document.body.innerText ? document.body.innerText.slice(0, 14000) : "";
  })()`)) as string;
}

async function parseCaseCard(
  page: Page,
  court: GasCourtTarget,
  link: CaseLink
): Promise<RawCaseHit | null> {
  await page.goto(link.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(450);

  // Main «ДЕЛО» tab first — here is «Результат рассмотрения»
  const mainText = await readBodyText(page);

  await openSidesTab(page);
  const sidesText = await readBodyText(page);

  const rawText = `${mainText}\n${sidesText}`;
  const parsed = parseGasCardText(rawText);
  const caseNumber = extractCaseNumber(rawText, link.text);
  if (!caseNumber) return null;

  if (
    parsed.counsel.length === 0 &&
    !/защитник|адвокат|представител/i.test(rawText)
  ) {
    return null;
  }

  const categoryHint =
    (/уголовн/i.test(rawText) && "уголовное") ||
    (/гражданск/i.test(rawText) && "гражданское") ||
    (/административн/i.test(rawText) && "административное") ||
    undefined;

  const dateRaw =
    rawText.match(/дата рассмотрения\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1] ??
    rawText.match(/дата поступления\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1] ??
    rawText.match(/опубликовано\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1] ??
    link.hearingDate;

  const resultFromMain =
    mainText.match(/результат рассмотрения\s*[:\s]*([^\n]{3,160})/i)?.[0] ??
    mainText.match(/приговор[^\n]{0,80}/i)?.[0];

  let summary = parsed.summary;
  if (resultFromMain) {
    summary = [summary, resultFromMain.replace(/\s+/g, " ").trim()]
      .filter(Boolean)
      .join(". ");
  } else if (link.likelyFinished) {
    summary = [summary, "Результат: вынесен приговор"].filter(Boolean).join(". ");
  }

  return {
    source: "gas",
    externalUid: uidFor(court.slug, caseNumber, link.caseUid),
    caseNumber,
    title: `${court.name}: дело ${caseNumber}`,
    courtName: court.name,
    courtSlug: court.slug,
    sourceUrl: link.href,
    decisionDate: dateRaw ? toIsoDate(dateRaw) : undefined,
    lawArticles: parsed.articles,
    summary,
    rawTextExcerpt: parsed.cleanExcerpt,
    sidesText: parsed.cleanExcerpt,
    representativesText: parsed.counsel.join("\n") || parsed.cleanExcerpt,
    categoryHint:
      categoryHint ??
      (isCriminalCaseNumber(caseNumber) || isCriminalCaseNumber(link.text)
        ? "уголовное"
        : undefined),
    likelyFinished: Boolean(link.likelyFinished || resultFromMain),
  };
}

function toIsoDate(ddmmyyyy: string): string | undefined {
  const m = ddmmyyyy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function hitMatchesAnyLawyer(hit: RawCaseHit, lawyers: LawyerProbe[]): boolean {
  const blob = `${hit.representativesText ?? ""}\n${hit.sidesText ?? ""}`;
  return lawyers.some(
    (lw) =>
      hasAdvocateRoleNearName(blob, lw) ||
      (nameAppears(blob, lw) && /адвокат|защитник|представител/i.test(blob))
  );
}

export async function scanGasCourts(opts: GasSearchOptions = {}): Promise<RawCaseHit[]> {
  const s = await openGasSession();
  const courts = opts.courts ?? GAS_TOLYATTI_COURTS;
  const maxCases = opts.maxCasesPerServer ?? 40;
  const delay = opts.delayMs ?? 650;
  const lawyers = opts.lawyers;
  const calendarDays = opts.calendarDays ?? 0;
  const criminalListing = opts.criminalListing ?? calendarDays > 0;
  const criminalOnly = opts.criminalOnly ?? calendarDays > 0;
  const maxCardsTotal = opts.maxCardsTotal ?? 800;
  const all: RawCaseHit[] = [];
  const seenUid = new Set<string>();
  const pendingByHref = new Map<string, { court: GasCourtTarget; link: CaseLink }>();

  const pushLinks = (
    court: GasCourtTarget,
    links: CaseLink[],
    label: string,
    limit?: number,
    silent = false
  ) => {
    let added = 0;
    const slice = limit != null ? links.slice(0, limit) : links;
    for (const link of slice) {
      if (criminalOnly && !isCriminalCaseNumber(link.text) && !isCriminalCaseNumber(link.href)) {
        continue;
      }
      // Prefer finished-looking row when same href appears again
      const prev = pendingByHref.get(link.href);
      if (prev && !(link.likelyFinished && !prev.link.likelyFinished)) continue;
      pendingByHref.set(link.href, { court, link });
      added += 1;
    }
    if (!silent) {
      console.log(`  GAS ${label}: +${added} (queue ${pendingByHref.size})`);
    }
  };

  // 1) Default «сегодня» listing (mixed types) — keep for in-progress coverage
  if (calendarDays === 0) {
    for (const court of courts) {
      for (const srv of court.servers) {
        try {
          const links = await collectListingLinks(s.page, court, srv);
          pushLinks(court, links, `${court.slug} srv${srv} listing`, maxCases);
        } catch (e) {
          console.warn(`  GAS list ${court.slug} srv${srv}:`, (e as Error).message);
        }
      }
    }
  }

  // 2) Current criminal first-instance boards
  if (criminalListing) {
    for (const court of courts) {
      for (const srv of court.servers) {
        try {
          const links = await collectCriminalListingLinks(s.page, court, srv);
          pushLinks(court, links, `${court.slug} srv${srv} ugolov`, maxCases);
        } catch (e) {
          console.warn(`  GAS ugolov ${court.slug} srv${srv}:`, (e as Error).message);
        }
      }
    }
  }

  // 3) Calendar H_date — finished hearings / sentences without captcha
  if (calendarDays > 0) {
    const dates = iterHearingDates(calendarDays);
    console.log(`  GAS calendar: ${dates.length} weekdays (span ${calendarDays}d)`);
    for (const court of courts) {
      for (const srv of court.servers) {
        const before = pendingByHref.size;
        for (const dateRu of dates) {
          try {
            const links = await collectCalendarLinks(s.page, court, srv, dateRu);
            // Prefer rows marked with приговор etc., but keep all criminal numbers
            const ranked = [
              ...links.filter((l) => l.likelyFinished && isCriminalCaseNumber(l.text)),
              ...links.filter((l) => isCriminalCaseNumber(l.text) && !l.likelyFinished),
            ];
            pushLinks(court, ranked, `${court.slug} srv${srv} ${dateRu}`, undefined, true);
          } catch (e) {
            console.warn(
              `  GAS calendar ${court.slug} srv${srv} ${dateRu}:`,
              (e as Error).message
            );
          }
          await sleep(180);
        }
        console.log(
          `  GAS calendar done ${court.slug} srv${srv}: +${pendingByHref.size - before} (queue ${pendingByHref.size})`
        );
      }
    }
  }

  // Finished calendar rows first — otherwise maxCardsTotal eats only «в производстве»
  const rankedQueue = [...pendingByHref.values()].sort((a, b) => {
    const af = a.link.likelyFinished ? 1 : 0;
    const bf = b.link.likelyFinished ? 1 : 0;
    if (af !== bf) return bf - af;
    return 0;
  });
  const queue = rankedQueue.slice(0, maxCardsTotal);
  const finishedQueued = queue.filter((q) => q.link.likelyFinished).length;
  console.log(
    `  GAS opening ${queue.length}/${pendingByHref.size} cards (finished-first: ${finishedQueued})…`
  );

  let opened = 0;
  for (const { court, link } of queue) {
    opened += 1;
    if (opened % 25 === 0) {
      console.log(`  GAS progress ${opened}/${queue.length}, matched ${all.length}`);
    }
    try {
      const hit = await parseCaseCard(s.page, court, link);
      if (!hit) continue;
      if (seenUid.has(hit.externalUid)) continue;
      if (lawyers && lawyers.length > 0 && !hitMatchesAnyLawyer(hit, lawyers)) {
        continue;
      }
      seenUid.add(hit.externalUid);
      all.push(hit);
    } catch (e) {
      console.warn(`  GAS card fail:`, (e as Error).message);
    }
    await sleep(delay);
  }

  return all;
}

export async function searchGasForLawyer(
  lawyer: LawyerProbe,
  opts: GasSearchOptions = {}
): Promise<RawCaseHit[]> {
  return scanGasCourts({
    ...opts,
    lawyers: [lawyer],
    maxCasesPerServer: opts.maxCasesPerServer ?? 25,
  });
}
