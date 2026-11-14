import Link from "next/link";
import { notFound } from "next/navigation";
import { CourtCasesTable } from "@/components/domain/CourtCasesTable";
import { LawyerCard } from "@/components/domain/LawyerCard";
import { getCourtBySlug, getTopLawyersForCourt } from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const court = await getCourtBySlug(slug);
  if (!court) return {};
  return buildPageMetadata({
    title: `${court.name} — адвокаты и судебные дела`,
    description: `Страница суда ${court.name}: топ практикующих адвокатов и база привязанных дел.`,
    path: `/courts/${court.slug}`,
  });
}

export default async function CourtPage({ params }: Props) {
  const { slug } = await params;
  const court = await getCourtBySlug(slug);
  if (!court) notFound();
  const topLawyers = await getTopLawyersForCourt(court.id);

  return (
    <div className="space-y-6">
      <header className="border border-rule bg-surface p-5 md:p-6">
        <p className="section-kicker mb-2">Суд</p>
        <h1 className="font-serif text-3xl md:text-4xl">{court.name}</h1>
        <p className="mt-2 text-sm text-muted-ink">
          <Link href={`/${court.city.slug}`} className="hover:text-navy">
            {court.city.name}
          </Link>
          {court.courtCode && (
            <span className="ml-3 font-mono">код {court.courtCode}</span>
          )}
        </p>
        {court.address && <p className="mt-1 text-sm text-muted-ink">{court.address}</p>}
      </header>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl">Топ адвокатов в этом суде</h2>
        {topLawyers.map((lawyer) =>
          lawyer ? <LawyerCard key={lawyer.id} lawyer={lawyer} /> : null
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-2xl">Дела суда</h2>
        <CourtCasesTable
          cases={court.cases.map((c) => ({
            id: c.id,
            slug: c.slug,
            caseNumber: c.caseNumber,
            courtName: court.name,
            categoryName: c.category?.name,
            lawArticles: c.lawArticles,
            summary: c.summary,
            title: c.title,
            outcome: c.outcome,
            sourceUrl: c.sourceUrl,
          }))}
        />
      </section>
    </div>
  );
}
