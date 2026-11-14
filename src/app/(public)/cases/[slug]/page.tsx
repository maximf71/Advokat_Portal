import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { getCaseBySlug } from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ slug: string }> };

const OUTCOME_LABEL: Record<string, { label: string; tone: "green" | "bronze" | "muted" | "navy" }> = {
  WIN: { label: "Победа", tone: "green" },
  PARTIAL: { label: "Частично", tone: "bronze" },
  LOSS: { label: "Отказ", tone: "muted" },
  SETTLEMENT: { label: "Мировое", tone: "navy" },
  IN_PROGRESS: { label: "В производстве", tone: "muted" },
  UNKNOWN: { label: "Не определён", tone: "muted" },
};

function looksLikeSiteChrome(text: string) {
  const s = text.toLowerCase();
  return (
    s.includes("калькулятор госпошлины") ||
    s.includes("@sudrf.ru") ||
    (s.includes("картотека") && s.includes("страж")) ||
    (s.includes("развернуть") && s.includes("судебное делопроизводство"))
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const courtCase = await getCaseBySlug(slug);
  if (!courtCase) return {};
  const desc =
    courtCase.summary && !looksLikeSiteChrome(courtCase.summary)
      ? courtCase.summary.slice(0, 160)
      : `Судебное дело ${courtCase.caseNumber}. Адвокат ${courtCase.lawyer.fullName}.`;
  return buildPageMetadata({
    title: `${courtCase.caseNumber} — ${courtCase.title}`,
    description: desc,
    path: `/cases/${courtCase.slug}`,
  });
}

export default async function CasePage({ params }: Props) {
  const { slug } = await params;
  const courtCase = await getCaseBySlug(slug);
  if (!courtCase) notFound();

  const outcome = OUTCOME_LABEL[courtCase.outcome] ?? OUTCOME_LABEL.UNKNOWN;
  const summary =
    courtCase.summary && !looksLikeSiteChrome(courtCase.summary)
      ? courtCase.summary
      : null;
  const excerpt =
    courtCase.rawTextExcerpt && !looksLikeSiteChrome(courtCase.rawTextExcerpt)
      ? courtCase.rawTextExcerpt
      : null;

  return (
    <article className="space-y-6">
      <header className="border border-rule bg-surface p-5 md:p-6">
        <p className="section-kicker mb-2">Судебное дело</p>
        <p className="font-mono text-sm text-navy">{courtCase.caseNumber}</p>
        <h1 className="mt-2 font-serif text-3xl">{courtCase.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={outcome.tone}>{outcome.label}</Badge>
          {courtCase.lawArticles.map((a) => (
            <Badge key={a} tone="muted">
              {a}
            </Badge>
          ))}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="border border-rule bg-surface p-5">
          <h2 className="font-serif text-xl">Суть и результат</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink">
            {summary || "Краткое описание дела формируется из открытых данных суда."}
          </p>
          {excerpt && excerpt !== summary && (
            <blockquote className="mt-4 border-l-2 border-navy bg-paper p-3 text-sm text-muted-ink whitespace-pre-line">
              {excerpt.slice(0, 1200)}
            </blockquote>
          )}
          {courtCase.sourceUrl && (
            <a
              href={courtCase.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm text-navy hover:underline"
            >
              Открыть первоисточник →
            </a>
          )}
        </section>

        <aside className="space-y-3 border border-rule bg-surface p-4 text-sm">
          <div>
            <p className="section-kicker">Адвокат</p>
            <Link href={`/lawyers/${courtCase.lawyer.slug}`} className="font-medium hover:text-navy">
              {courtCase.lawyer.fullName}
            </Link>
          </div>
          {courtCase.court && (
            <div>
              <p className="section-kicker">Суд</p>
              <Link href={`/courts/${courtCase.court.slug}`} className="hover:text-navy">
                {courtCase.court.name}
              </Link>
            </div>
          )}
          {courtCase.category && (
            <div>
              <p className="section-kicker">Категория</p>
              <Link
                href={`/${courtCase.lawyer.city.slug}/${courtCase.category.slug}`}
                className="hover:text-navy"
              >
                {courtCase.category.name}
              </Link>
            </div>
          )}
          {courtCase.decisionDate && (
            <div>
              <p className="section-kicker">Дата решения</p>
              <p className="font-mono">
                {new Date(courtCase.decisionDate).toLocaleDateString("ru-RU")}
              </p>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
