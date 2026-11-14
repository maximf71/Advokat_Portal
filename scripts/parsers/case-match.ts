import type { CaseOutcome } from "@prisma/client";
import type { LawyerProbe, ParsedCaseRow, RawCaseHit } from "./case-types";
import { inferKadOutcome } from "./kad-clean";

const ROLE_RE =
  /(?:адвокат|защитник|представител\w*|представитель)/i;

const ARTICLE_RE =
  /(?:ст\.?\s*|статьи?\s+|ст\s+)(\d+(?:\.\d+)?)\s*(?:УК|ГК|КоАП|ТК|НК|АПК|ГПК|ЖК)?(?:\s*РФ)?/gi;

export function normalizePersonKey(lastName: string, firstName: string, middleName?: string | null) {
  const ln = lastName.trim().toLowerCase();
  const fi = firstName.trim().charAt(0).toLowerCase();
  const mi = middleName?.trim().charAt(0).toLowerCase() ?? "";
  return `${ln}|${fi}|${mi}`;
}

export function initialsFromParts(lastName: string, firstName: string, middleName?: string | null) {
  const m = middleName ? ` ${middleName[0]}.` : "";
  return `${lastName} ${firstName[0]}.${m}`.replace(/\s+/g, " ").trim();
}

/** True if text mentions advocate/defender/representative role near the lawyer name. */
export function hasAdvocateRoleNearName(text: string, lawyer: LawyerProbe): boolean {
  if (!text) return false;
  const hay = text.replace(/\s+/g, " ");
  const last = escapeRegExp(lawyer.lastName);
  const fi = escapeRegExp(lawyer.firstName.charAt(0));
  const mi = lawyer.middleName ? escapeRegExp(lawyer.middleName.charAt(0)) : null;

  // Иванов И.И. / Иванов Иван Иванович / Иванов И.
  const namePatterns = [
    new RegExp(`${last}\\s+${fi}\\.\\s*${mi ? `${mi}\\.?` : ""}`, "i"),
    new RegExp(
      `${last}\\s+${escapeRegExp(lawyer.firstName)}${lawyer.middleName ? `\\s+${escapeRegExp(lawyer.middleName)}` : ""}`,
      "i"
    ),
    new RegExp(`${last}\\s+${fi}\\.`, "i"),
  ];

  for (const np of namePatterns) {
    const m = np.exec(hay);
    if (!m) continue;
    const start = Math.max(0, m.index - 80);
    const end = Math.min(hay.length, m.index + m[0].length + 80);
    const window = hay.slice(start, end);
    if (ROLE_RE.test(window)) return true;
  }

  // Role anywhere + name anywhere in representatives block (stricter block already filtered)
  if (ROLE_RE.test(hay) && namePatterns.some((np) => np.test(hay))) return true;
  return false;
}

export function nameAppears(text: string, lawyer: LawyerProbe): boolean {
  if (!text) return false;
  const hay = text.replace(/\s+/g, " ");
  const last = escapeRegExp(lawyer.lastName);
  const fi = escapeRegExp(lawyer.firstName.charAt(0));
  const mi = lawyer.middleName ? escapeRegExp(lawyer.middleName.charAt(0)) : null;
  const patterns = [
    new RegExp(`${last}\\s+${fi}\\.\\s*${mi ? `${mi}\\.?` : ""}`, "i"),
    new RegExp(
      `${last}\\s+${escapeRegExp(lawyer.firstName)}${lawyer.middleName ? `\\s+${escapeRegExp(lawyer.middleName)}` : ""}`,
      "i"
    ),
  ];
  return patterns.some((p) => p.test(hay));
}

export function extractLawArticles(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(ARTICLE_RE.source, ARTICLE_RE.flags);
  while ((m = re.exec(text)) !== null) {
    const code = m[0].replace(/\s+/g, " ").trim();
    if (code.length < 40) found.add(code);
  }
  return [...found].slice(0, 12);
}

export function inferCategorySlug(hit: RawCaseHit): string {
  if (hit.source === "kad") {
    const t = `${hit.title ?? ""} ${hit.summary ?? ""} ${hit.categoryHint ?? ""}`.toLowerCase();
    if (/банкрот|несостоятел/.test(t)) return "bankrotstvo";
    return "arbitrazh";
  }

  const blob = `${hit.categoryHint ?? ""} ${hit.title ?? ""} ${hit.summary ?? ""} ${(hit.lawArticles ?? []).join(" ")}`;
  if (/УК\s*РФ|уголовн/i.test(blob)) return "ugolovnoe-pravo";
  if (/КоАП|административн/i.test(blob)) return "administrativnoe-pravo";
  if (/ТК\s*РФ|трудов/i.test(blob)) return "trudovoe-pravo";
  if (/ЖК\s*РФ|жилищн/i.test(blob)) return "zhilishchnoe-pravo";
  if (/сем[еь]йн|алимент|развод/i.test(blob)) return "semeynoe-pravo";
  if (/наслед/i.test(blob)) return "nasledstvo";
  return "grazhdanskoe-pravo";
}

export function inferOutcome(text: string | undefined): CaseOutcome {
  if (!text) return "UNKNOWN";
  const t = text.toLowerCase();
  if (/удовлетворить частично|частично удовлетвор/.test(t)) return "PARTIAL";
  if (/миров(?:ое|ым)\s+соглашени/.test(t)) return "SETTLEMENT";
  if (/отказать в удовлетворении|в иске отказать|оставить без удовлетворения/.test(t))
    return "LOSS";
  // Уголовные: исход для подзащитного (оправдание = WIN, обвинительный = LOSS)
  if (/оправдать|прекратить уголовное преследование|оправдательн/.test(t)) return "WIN";
  if (/признать виновн|обвинительн(?:ый|ого)\s+приговор|вынесен\s+обвинительн/.test(t))
    return "LOSS";
  // Listing/calendar marked sentence without detailed act text
  if (/результат:\s*вынесен приговор|вынесен приговор/.test(t)) return "LOSS";
  if (/удовлетворить иск|иск удовлетвор/.test(t)) return "WIN";
  // SOYU / GAS unfinished signals
  if (
    /назначено судебное заседание|заседание отложено|в производстве/.test(t) &&
    !/вынесен[ао]\s+решени|приговор|итог рассмотрения|дело рассмотрено/.test(t)
  ) {
    return "IN_PROGRESS";
  }
  return "UNKNOWN";
}

export function matchHitToLawyer(
  hit: RawCaseHit,
  lawyer: LawyerProbe
): ParsedCaseRow | null {
  const rep = hit.representativesText ?? "";
  const sides = hit.sidesText ?? "";
  const blob = `${rep}\n${sides}\n${hit.summary ?? ""}\n${hit.rawTextExcerpt ?? ""}\n${hit.title ?? ""}`;

  const roleOk = hasAdvocateRoleNearName(rep, lawyer) || hasAdvocateRoleNearName(blob, lawyer);
  const kadRepOnly = hit.source === "kad" && !!rep && nameAppears(rep, lawyer);
  if (!roleOk && !kadRepOnly) {
    return null;
  }

  const articles =
    hit.lawArticles && hit.lawArticles.length > 0
      ? hit.lawArticles
      : extractLawArticles(blob);

  let outcome: CaseOutcome =
    hit.source === "kad"
      ? inferKadOutcome(`${hit.summary ?? ""}\n${blob}`)
      : inferOutcome(blob);

  const finishedAct =
    hit.likelyFinished === true ||
    /вынесен[ао]\s+решени|приговор|итог рассмотрения|дело рассмотрено|оправдать|признать виновн|результат:\s*вынесен/i.test(
      blob
    );

  // Current-year СОЮ / KAD cards without a final act → in progress
  if (
    outcome === "UNKNOWN" &&
    /\/202[5-9]\b/.test(hit.caseNumber ?? "") &&
    !finishedAct
  ) {
    outcome = "IN_PROGRESS";
  }

  return {
    externalUid: hit.externalUid,
    caseNumber: hit.caseNumber,
    title: hit.title || `Дело ${hit.caseNumber}`,
    lawyerRegistryNumber: lawyer.registryNumber,
    lawArticles: articles,
    outcome,
    courtSlug: hit.courtSlug,
    summary: hit.summary,
    rawTextExcerpt: hit.rawTextExcerpt?.slice(0, 4000),
    sourceUrl: hit.sourceUrl,
    decisionDate: hit.decisionDate,
    categorySlug: inferCategorySlug({ ...hit, lawArticles: articles }),
    source: hit.source,
    matchConfidence: roleOk ? "high" : "medium",
  };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
