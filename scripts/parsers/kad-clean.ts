/**
 * Clean KAD card text: strip site chrome, build human-readable summary.
 */

const CHROME_LINE =
  /^(картотека|страж|банк решений|календарь|перерывы|мой арбитр|проверка эп|о нас|войти|как это работает|фильтр дел|электронный страж|руководство|отслеживать дело|отправить на печать|подать документы|ввести код|нажмите,? чтобы|участники дела|суды и судьи|судебные акты|карточки|онлайн-заседания|электронное дело)$/i;

const CHROME_CHUNK =
  /картотека|страж|банк решений|календарь|перерывы|мой арбитр|проверка эп|о нас|войти|фильтр дел|электронный страж|руководство по использованию/gi;

export function stripKadChrome(text: string): string {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1 && !CHROME_LINE.test(l))
    .join("\n")
    .replace(CHROME_CHUNK, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function buildKadSummary(parts: {
  caseNumber?: string;
  courtName?: string;
  plaintiffs?: string[];
  respondents?: string[];
  others?: string[];
  resultLine?: string;
  caseType?: string;
}): string {
  const bits: string[] = [];
  if (parts.caseType) bits.push(parts.caseType);
  if (parts.plaintiffs?.length) bits.push(`Истец: ${parts.plaintiffs.slice(0, 3).join("; ")}`);
  if (parts.respondents?.length) bits.push(`Ответчик: ${parts.respondents.slice(0, 3).join("; ")}`);
  if (parts.others?.length) bits.push(`Иные: ${parts.others.slice(0, 2).join("; ")}`);
  if (parts.resultLine) bits.push(parts.resultLine);
  if (
    parts.courtName &&
    parts.courtName.length >= 8 &&
    !/войти/i.test(parts.courtName) &&
    !bits.some((b) => b.includes(parts.courtName!))
  ) {
    bits.push(parts.courtName);
  }
  const out = bits
    .join(". ")
    .replace(/\s*АС\s*ВОЙТИ/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out.slice(0, 600) || (parts.caseNumber ? `Арбитражное дело ${parts.caseNumber}` : "");
}

export function inferKadOutcome(text: string): "WIN" | "PARTIAL" | "LOSS" | "SETTLEMENT" | "IN_PROGRESS" | "UNKNOWN" {
  const t = text.toLowerCase();
  if (/удовлетворить частично|частично удовлетвор/.test(t)) return "PARTIAL";
  if (/миров(?:ое|ым)\s+соглашени/.test(t)) return "SETTLEMENT";
  if (/отказать в удовлетворении|в иске отказать|оставить без удовлетворения|отказать полностью/.test(t))
    return "LOSS";
  if (/удовлетворить иск|удовлетворить требование полностью|иск удовлетвор|отменить решение полностью и принять/.test(t))
    return "WIN";
  // Explicit unfinished
  if (
    /рассмотрение дела не завершено|в производстве/.test(t) ||
    (/назначено судебное заседание|заседание отложено/.test(t) &&
      !/рассмотрение дела завершено/.test(t))
  ) {
    return "IN_PROGRESS";
  }
  // Finished but result wording unclear
  return "UNKNOWN";
}

/** True if summary looks like polluted nav dump. */
export function isPollutedKadSummary(summary: string | null | undefined): boolean {
  if (!summary) return true;
  const s = summary.toLowerCase();
  const hits = ["картотека", "страж", "мой арбитр", "банк решений"].filter((w) => s.includes(w));
  return hits.length >= 2 || s.trim().length < 20;
}
