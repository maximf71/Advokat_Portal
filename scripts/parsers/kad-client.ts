/**
 * Playwright client for kad.arbitr.ru.
 * Uses UI + window.doSearchRequest() (direct fetch is blocked by DDoS-Guard).
 */
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { LawyerProbe, RawCaseHit } from "./case-types";
import { buildKadSummary, stripKadChrome } from "./kad-clean";

const KAD_ORIGIN = "https://kad.arbitr.ru";

/** АС Самарской области в КАД — тег/префикс A55; плюс апелляция/кассация Поволжья. */
export const KAD_SAMARA_COURTS = ["A55", "11AP", "F06"];

export type KadSearchOptions = {
  courts?: string[];
  delayMs?: number;
  maxCards?: number;
};

type KadSession = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
};

let session: KadSession | null = null;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      headless: true,
      channel: "chrome",
      args: ["--disable-blink-features=AutomationControlled"],
    });
  } catch {
    return chromium.launch({
      headless: true,
      args: ["--disable-blink-features=AutomationControlled"],
    });
  }
}

export async function openKadSession() {
  if (session) return session;
  const browser = await launchBrowser();
  const context = await browser.newContext({
    locale: "ru-RU",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    viewport: { width: 1400, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();
  await page.goto(KAD_ORIGIN, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(5000);
  await dismissPromo(page);
  session = { browser, context, page };
  return session;
}

export async function closeKadSession() {
  if (!session) return;
  await session.browser.close().catch(() => undefined);
  session = null;
}

async function dismissPromo(page: Page) {
  await page.evaluate(() => {
    document
      .querySelectorAll(".b-promo_notification, .b-promo_notification-popup_wrapper")
      .forEach((el) => el.remove());
  });
}

function parseCardIdsFromHtml(html: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const re = /\/Card\/([0-9a-fA-F-]{36})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    ids.push(m[1]);
  }
  return ids;
}

async function uiSearch(page: Page, sideName: string): Promise<string[]> {
  await page.goto(KAD_ORIGIN, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await sleep(4000);
  await dismissPromo(page);

  const ta = page.locator("#sug-participants textarea").first();
  await ta.waitFor({ state: "attached", timeout: 20_000 });
  await ta.click({ force: true });
  await ta.fill("");
  await ta.type(sideName, { delay: 25 });
  await sleep(1500);

  // Prefer selecting a suggest item when available
  const suggest = page
    .locator(
      ".b-form-suggest .b-form-suggest-item, .b-combo-suggest_list li, .ui-menu-item, .suggest .item"
    )
    .first();
  if (await suggest.count()) {
    await suggest.click({ force: true }).catch(() => undefined);
    await sleep(400);
  }

  const responsePromise = page
    .waitForResponse(
      (res) => /SearchInstances/i.test(res.url()) && res.request().method() === "POST",
      { timeout: 45_000 }
    )
    .catch(() => null);

  await page.evaluate(() => {
    const w = window as unknown as { doSearchRequest?: () => void };
    if (typeof w.doSearchRequest === "function") {
      w.doSearchRequest();
      return;
    }
    const btn = document.querySelector("#b-form-submit button") as HTMLButtonElement | null;
    btn?.click();
  });

  const res = await responsePromise;
  let ids: string[] = [];
  if (res) {
    const status = res.status();
    const body = await res.text().catch(() => "");
    console.log(`  KAD SearchInstances HTTP ${status}, ${body.length} bytes`);
    if (status === 200) ids = parseCardIdsFromHtml(body);
  }

  if (ids.length === 0) {
    await sleep(3000);
    ids = await page.locator('a[href*="/Card/"]').evaluateAll((as) => {
      const out: string[] = [];
      const seen = new Set<string>();
      for (const a of as) {
        const m = (a.getAttribute("href") ?? "").match(/\/Card\/([0-9a-fA-F-]{36})/i);
        if (!m || seen.has(m[1])) continue;
        seen.add(m[1]);
        out.push(m[1]);
      }
      return out;
    });
  }

  return ids;
}

export async function parseCard(page: Page, caseId: string): Promise<RawCaseHit | null> {
  const url = `${KAD_ORIGIN}/Card/${caseId}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await dismissPromo(page);

  // Wait until case content appears (not just chrome spinner)
  try {
    await page.waitForFunction(
      `(() => {
        const t = document.body && document.body.innerText ? document.body.innerText : "";
        return /А\\d{2}-\\d+\\/\\d{4}/.test(t) && /истц|ответчик|участник/i.test(t);
      })()`,
      { timeout: 45_000 }
    );
  } catch {
    await sleep(4000);
  }
  await sleep(800);
  await dismissPromo(page);

  // Use string form so tsx/esbuild does not inject __name into the browser context
  const data = await page.evaluate(`(() => {
    const text = document.body && document.body.innerText ? document.body.innerText : "";
    if (/страница не найдена|ошибка 404/i.test(text)) {
      return { notFound: true };
    }

    function collectLinks(selector) {
      const out = [];
      const nodes = document.querySelectorAll(selector);
      for (let i = 0; i < nodes.length; i++) {
        const t = (nodes[i].textContent || "").replace(/\\s+/g, " ").trim();
        if (t.length >= 3 && t.length <= 220 && out.indexOf(t) === -1) out.push(t);
      }
      return out;
    }

    const caseNumberMatch = text.match(/А\\d{2}-\\d+\\/\\d{4}/);
    const caseNumber = (caseNumberMatch && caseNumberMatch[0]) || "";

    const courtMatch = text.match(/Арбитражный суд[^\\n]{3,80}|АС\\s+Самарской области|АС\\s+[А-Яа-яЁё][^\\n]{2,60}/);
    let courtName = courtMatch ? courtMatch[0].replace(/\\s+/g, " ").trim() : "Арбитражный суд Самарской области";
    courtName = courtName.replace(/\\s*войти\\s*/gi, "").replace(/^АС$/i, "").trim();
    if (!courtName || courtName.length < 5) courtName = "Арбитражный суд Самарской области";

    const caseTypeMatch = text.match(/экономические споры[^\\n]{0,80}|банкротн[^\\n]{0,60}|административн[^\\n]{0,60}/i);
    const caseType = caseTypeMatch ? caseTypeMatch[0].replace(/\\s+/g, " ").trim() : undefined;

    const plaintiffs = collectLinks("td.plaintiffs a, td.plaintiffs .js-rollover > a");
    const respondents = collectLinks("td.defendants a, td.defendants .js-rollover > a");
    const thirds = collectLinks("td.third a, td.third .js-rollover > a");
    const others = collectLinks("td.others a, td.others .js-rollover > a");

    const reps = [];
    const allParties = plaintiffs.concat(respondents, thirds, others);
    for (let i = 0; i < allParties.length; i++) {
      if (/представител|адвокат/i.test(allParties[i]) && reps.indexOf(allParties[i]) === -1) {
        reps.push(allParties[i]);
      }
    }
    // Also scan full text for counsel role lines
    const lines = text.split(/\\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\\s+/g, " ").trim();
      if (/представител|адвокат/i.test(line) && line.length > 8 && line.length < 280) {
        if (reps.indexOf(line) === -1) reps.push(line);
      }
    }

    const resultMatch = text.match(/удовлетворить[^\\n]{0,140}|отказать[^\\n]{0,120}|отменить[^\\n]{0,120}|миров[^\\n]{0,100}/i);
    const resultLine = resultMatch ? resultMatch[0].replace(/\\s+/g, " ").trim() : undefined;

    const dateWord = text.match(/(\\d{1,2}\\s+[а-яё]+\\s+\\d{4})/i);
    const dateDot = text.match(/(\\d{2}\\.\\d{2}\\.\\d{4})/);
    const decisionDateRaw = (dateWord && dateWord[1]) || (dateDot && dateDot[1]) || undefined;

    const sidesParts = [];
    for (let i = 0; i < plaintiffs.length; i++) sidesParts.push("Истец: " + plaintiffs[i]);
    for (let i = 0; i < respondents.length; i++) sidesParts.push("Ответчик: " + respondents[i]);
    for (let i = 0; i < thirds.length; i++) sidesParts.push("Третье лицо: " + thirds[i]);
    for (let i = 0; i < others.length; i++) sidesParts.push("Иное лицо: " + others[i]);

    return {
      notFound: false,
      caseNumber: caseNumber,
      courtName: courtName,
      caseType: caseType,
      plaintiffs: plaintiffs,
      respondents: respondents,
      others: thirds.concat(others),
      reps: reps,
      sidesText: sidesParts.join("\\n"),
      representativesText: reps.join("\\n"),
      resultLine: resultLine,
      rawText: text.slice(0, 8000),
      decisionDateRaw: decisionDateRaw,
      title: [caseNumber, courtName].filter(Boolean).join(" — "),
    };
  })()`) as {
    notFound?: boolean;
    caseNumber: string;
    courtName?: string;
    caseType?: string;
    plaintiffs: string[];
    respondents: string[];
    others: string[];
    reps: string[];
    sidesText: string;
    representativesText: string;
    resultLine?: string;
    rawText: string;
    decisionDateRaw?: string;
    title: string;
  };

  if (data.notFound) {
    console.warn(`  KAD 404 for Card/${caseId}`);
    return null;
  }
  if (!data.caseNumber && !data.rawText) return null;

  const isCounselLabel = (x: string) => /представител|адвокат/i.test(x);
  const plaintiffs = (data.plaintiffs ?? []).filter((x) => !isCounselLabel(x));
  const respondents = (data.respondents ?? []).filter((x) => !isCounselLabel(x));
  const others = (data.others ?? []).filter((x) => !isCounselLabel(x));
  const repExtra = [
    ...(data.plaintiffs ?? []),
    ...(data.respondents ?? []),
    ...(data.others ?? []),
  ].filter(isCounselLabel);
  const representativesText = [...new Set([data.representativesText, ...repExtra].filter(Boolean))].join(
    "\n"
  );

  const summary = buildKadSummary({
    caseNumber: data.caseNumber,
    courtName: data.courtName,
    plaintiffs,
    respondents,
    others,
    resultLine: data.resultLine,
    caseType: data.caseType,
  });

  const cleanRaw = stripKadChrome(data.rawText).slice(0, 4000);

  return {
    source: "kad",
    externalUid: `kad:${caseId}`,
    caseNumber: data.caseNumber || caseId,
    title: data.title || `Арбитражное дело ${data.caseNumber || caseId}`,
    courtName: data.courtName,
    courtCode: "A55",
    courtSlug: "as-samara",
    sourceUrl: url,
    decisionDate: data.decisionDateRaw
      ? toIsoDate(data.decisionDateRaw) ?? parseRussianDate(data.decisionDateRaw)
      : undefined,
    summary,
    rawTextExcerpt: cleanRaw,
    sidesText: data.sidesText,
    representativesText,
    categoryHint: "arbitrazh",
  };
}

function parseRussianDate(raw: string): string | undefined {
  const months: Record<string, string> = {
    января: "01",
    февраля: "02",
    марта: "03",
    апреля: "04",
    мая: "05",
    июня: "06",
    июля: "07",
    августа: "08",
    сентября: "09",
    октября: "10",
    ноября: "11",
    декабря: "12",
  };
  const m = raw.toLowerCase().match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/);
  if (!m) return undefined;
  const mm = months[m[2]];
  if (!mm) return undefined;
  return `${m[3]}-${mm}-${m[1].padStart(2, "0")}`;
}

function toIsoDate(ddmmyyyy: string): string | undefined {
  const m = ddmmyyyy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function searchKadForLawyer(
  lawyer: LawyerProbe,
  opts: KadSearchOptions = {}
): Promise<RawCaseHit[]> {
  const s = await openKadSession();
  const delay = opts.delayMs ?? 1100;
  const maxCards = opts.maxCards ?? 8;

  const ids = await uiSearch(s.page, lawyer.fullName);
  console.log(`  KAD card ids: ${ids.length}`);

  const hits: RawCaseHit[] = [];
  for (const id of ids.slice(0, maxCards)) {
    try {
      const card = await parseCard(s.page, id);
      if (card) hits.push(card);
    } catch (e) {
      console.warn(`  KAD card ${id}:`, (e as Error).message);
    }
    await sleep(delay);
  }
  return hits;
}
