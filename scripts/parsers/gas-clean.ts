/**
 * Clean ГАС/СОЮ card text into a short human summary.
 */

const DROP_LINE =
  /^(развернуть|о суде|судейское сообщество|нормативные акты|документы суда|судебное делопроизводство|справочная информация|пресс-служба|управление судебного|суды субъекта|муниципальные органы|вакансии|противодействие коррупции|обращения граждан|внепроцессуальные|территориальная подсудность|калькулятор госпошлины|версия для слабовидящих|подача процессуальных|выбрать другой сервер|вывести список дел|поиск информации по делам|вернуться к списку дел|дело|движение дела|лица|стороны|вид лица|лицо,? участвующее|инн|кпп|огрн|огрнип|запросы опфр|государственная автоматизированная|2006-\d{4})/i;

export function stripGasChrome(text: string): string {
  return text
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => {
      if (!l || l.length < 2) return false;
      if (DROP_LINE.test(l)) return false;
      if (/^[\d\s,.-]+$/.test(l) && l.length < 8) return false;
      if (/@sudrf\.ru|тел\.:|^\d{6},/i.test(l)) return false;
      return true;
    })
    .join("\n");
}

export function buildGasSummary(parts: {
  caseNumber?: string;
  instanceType?: string;
  counsel?: string[];
  parties?: string[];
  articles?: string[];
  judge?: string;
  resultLine?: string;
}): string {
  const bits: string[] = [];
  if (parts.instanceType) bits.push(parts.instanceType);
  if (parts.counsel?.length) bits.push(parts.counsel.slice(0, 3).join("; "));
  if (parts.parties?.length) bits.push(`Участники: ${parts.parties.slice(0, 3).join("; ")}`);
  if (parts.articles?.length) bits.push(parts.articles.slice(0, 4).join(", "));
  if (parts.judge) bits.push(`Судья: ${parts.judge}`);
  if (parts.resultLine) bits.push(parts.resultLine);
  const out = bits.join(". ").replace(/\s{2,}/g, " ").trim();
  return out.slice(0, 500) || (parts.caseNumber ? `Дело ${parts.caseNumber}` : "");
}

export function parseGasCardText(raw: string): {
  caseNumber?: string;
  instanceType?: string;
  counsel: string[];
  parties: string[];
  articles: string[];
  judge?: string;
  resultLine?: string;
  inProgress: boolean;
  finished: boolean;
  summary: string;
  cleanExcerpt: string;
} {
  const clean = stripGasChrome(raw);
  const caseNumber =
    clean.match(/ДЕЛО\s*№\s*([\d./-]+)/i)?.[1] ??
    clean.match(/\b(\d{1,2}-\d+\/\d{4})\b/)?.[0];

  const instanceType =
    clean.match(/уголовн[^\n.]{0,40}(?:первая инстанция|апелляция)?/i)?.[0] ??
    clean.match(/гражданск[^\n.]{0,40}(?:первая инстанция|апелляция)?/i)?.[0] ??
    clean.match(/административн[^\n.]{0,40}/i)?.[0];

  const counsel: string[] = [];
  const parties: string[] = [];
  for (const line of clean.split("\n")) {
    const t = line.trim();
    if (/защитник|адвокат|представител/i.test(t)) {
      const normalized = t
        .replace(/^вид лица[^\t]*/i, "")
        .replace(/\t+/g, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
      // "Защитник (адвокат) Багдасарян Яна Лазаревна"
      const m = normalized.match(
        /((?:защитник|адвокат|представител\w*)[^\n]{0,40}?)\s+([А-ЯЁ][а-яёА-ЯЁ-]+(?:\s+[А-ЯЁ][а-яёА-ЯЁ.-]+){1,3})/i
      );
      if (m) {
        const role = m[1].replace(/\s+/g, " ").trim();
        const name = m[2].trim();
        const label = `${role}: ${name}`.replace(/\s+/g, " ");
        if (!counsel.includes(label)) counsel.push(label);
      } else if (normalized.length < 180 && !counsel.includes(normalized)) {
        counsel.push(normalized);
      }
    }
  }

  // Persons table rows without counsel role
  const personLines = clean.match(/^[А-ЯЁ][а-яёА-ЯЁ-]+(?:\s+[А-ЯЁ][а-яёА-ЯЁ.-]+){1,3}$/gm) ?? [];
  for (const p of personLines.slice(0, 5)) {
    if (!counsel.some((c) => c.includes(p)) && !parties.includes(p)) parties.push(p);
  }

  const articles: string[] = [];
  const artRe =
    /(?:ст\.?\s*|статьи?\s+)(\d+(?:\.\d+)?(?:\s*ч\.\s*\d+)?(?:\s*п\.?\s*[а-яa-z0-9,]+)?)\s*(УК|ГК|КоАП|ТК|НК|ГПК|ЖК)?(?:\s*РФ)?/gi;
  let m: RegExpExecArray | null;
  while ((m = artRe.exec(clean)) !== null) {
    const a = m[0].replace(/\s+/g, " ").trim();
    if (!articles.includes(a)) articles.push(a);
    if (articles.length >= 8) break;
  }

  const judge = clean.match(/судья\s+([А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ]\.?){0,2}[а-яёА-ЯЁ.-]*)/i)?.[1]?.trim();

  const resultLine =
    clean.match(
      /оправдать[^\n.]{0,80}|признать виновн[^\n.]{0,80}|удовлетворить[^\n.]{0,80}|отказать[^\n.]{0,80}|прекратить[^\n.]{0,80}|назначено судебное заседание[^\n.]{0,40}|заседание отложено[^\n.]{0,40}/i
    )?.[0]
      ?.replace(/\s+/g, " ")
      .trim();

  const finished = /вынесен[ао]\s+решени|приговор|итог рассмотрения|дело рассмотрено/i.test(
    `${clean}\n${raw}`
  );
  const year = Number(
    (caseNumber ?? "").match(/\/(\d{4})$/)?.[1] ??
      raw.match(/ДЕЛО\s*№\s*[\d./-]+\/(\d{4})/i)?.[1] ??
      0
  );
  const currentYear = new Date().getFullYear();
  const inProgress =
    !finished &&
    (/назначено судебное заседание|заседание отложено|в производстве/i.test(`${clean}\n${raw}`) ||
      (year >= currentYear - 0 && year <= currentYear + 1));

  const summary = buildGasSummary({
    caseNumber,
    instanceType: instanceType?.replace(/\s+/g, " ").trim(),
    counsel,
    parties,
    articles,
    judge,
    resultLine: resultLine ?? (inProgress ? "В производстве" : undefined),
  });

  return {
    caseNumber,
    instanceType,
    counsel,
    parties,
    articles,
    judge,
    resultLine,
    inProgress,
    finished,
    summary,
    cleanExcerpt: clean.slice(0, 4000),
  };
}

export function isPollutedGasSummary(summary: string | null | undefined): boolean {
  if (!summary) return true;
  const s = summary.toLowerCase();
  return (
    s.includes("калькулятор госпошлины") ||
    s.includes("версия для слабовидящих") ||
    s.includes("@sudrf.ru") ||
    (s.includes("развернуть") && s.includes("судебное делопроизводство")) ||
    summary.length > 900
  );
}
