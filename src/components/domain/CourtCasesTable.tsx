import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export type CourtCaseRow = {
  id: string;
  slug: string;
  caseNumber: string;
  courtName?: string | null;
  categoryName?: string | null;
  lawArticles: string[];
  summary?: string | null;
  title: string;
  outcome: string;
  sourceUrl?: string | null;
  decisionDate?: string | Date | null;
};

const OUTCOME_LABEL: Record<string, { label: string; tone: "green" | "bronze" | "muted" | "navy" }> = {
  WIN: { label: "Победа", tone: "green" },
  PARTIAL: { label: "Частично", tone: "bronze" },
  LOSS: { label: "Отказ", tone: "muted" },
  SETTLEMENT: { label: "Мировое", tone: "navy" },
  IN_PROGRESS: { label: "В производстве", tone: "muted" },
  UNKNOWN: { label: "Не определён", tone: "muted" },
};

const KAD_CHROME =
  /картотека|страж|банк решений|мой арбитр|проверка эп|фильтр дел|электронный страж/i;

function isPollutedSummary(summary?: string | null) {
  if (!summary) return true;
  const s = summary.toLowerCase();
  const kadHits = ["картотека", "страж", "мой арбитр", "банк решений"].filter((w) =>
    s.includes(w)
  );
  if (kadHits.length >= 2) return true;
  if (s.includes("калькулятор госпошлины") || s.includes("@sudrf.ru")) return true;
  if (s.includes("развернуть") && s.includes("судебное делопроизводство")) return true;
  return summary.length > 700;
}

function displayTitle(row: CourtCaseRow) {
  // Avoid showing case number twice when title is just «А55-…»
  if (!row.title || row.title === row.caseNumber) return row.caseNumber;
  if (row.title.startsWith(row.caseNumber)) return row.title;
  return row.title;
}

function displaySummary(row: CourtCaseRow) {
  if (!row.summary || isPollutedSummary(row.summary)) return null;
  const cleaned = row.summary.replace(KAD_CHROME, " ").replace(/\s{2,}/g, " ").trim();
  if (cleaned.length < 12) return null;
  return cleaned;
}

export function CourtCasesTable({ cases }: { cases: CourtCaseRow[] }) {
  if (cases.length === 0) {
    return (
      <div className="border border-rule bg-surface px-4 py-8 text-center text-sm text-muted-ink">
        Судебные дела пока не привязаны
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-rule bg-surface">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule bg-paper">
            <th className="section-kicker px-3 py-3 font-semibold">№ дела / суд</th>
            <th className="section-kicker px-3 py-3 font-semibold">Категория и статья</th>
            <th className="section-kicker px-3 py-3 font-semibold">Суть и результат</th>
            <th className="section-kicker px-3 py-3 font-semibold">Исход</th>
            <th className="section-kicker px-3 py-3 font-semibold">Источник</th>
          </tr>
        </thead>
        <tbody>
          {cases.map((row) => {
            const outcome = OUTCOME_LABEL[row.outcome] ?? OUTCOME_LABEL.UNKNOWN;
            return (
              <tr key={row.id} className="border-b border-rule last:border-b-0 align-top">
                <td className="px-3 py-3">
                  <Link
                    href={`/cases/${row.slug}`}
                    className="font-mono text-xs text-navy underline-offset-2 hover:underline"
                  >
                    {row.caseNumber}
                  </Link>
                  {row.courtName && (
                    <div className="mt-1 text-xs text-muted-ink">{row.courtName}</div>
                  )}
                </td>
                <td className="px-3 py-3">
                  {row.categoryName && <div className="text-ink">{row.categoryName}</div>}
                  <div className="mt-1 font-mono text-xs text-muted-ink">
                    {row.lawArticles.join(", ") || "—"}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="font-medium text-ink">{displayTitle(row)}</div>
                  {displaySummary(row) && (
                    <p className="mt-1 line-clamp-3 text-xs text-muted-ink">{displaySummary(row)}</p>
                  )}
                </td>
                <td className="px-3 py-3">
                  <Badge tone={outcome.tone}>{outcome.label}</Badge>
                </td>
                <td className="px-3 py-3">
                  {row.sourceUrl ? (
                    <a
                      href={row.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-navy underline-offset-2 hover:underline"
                    >
                      Первоисточник
                    </a>
                  ) : (
                    <span className="text-xs text-muted-ink">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
