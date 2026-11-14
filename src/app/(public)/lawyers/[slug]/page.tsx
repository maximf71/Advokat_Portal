import Link from "next/link";
import { notFound } from "next/navigation";
import { CourtCasesTable } from "@/components/domain/CourtCasesTable";
import { LeadForm } from "@/components/domain/LeadForm";
import { RatingBreakdownCard } from "@/components/domain/RatingBreakdownCard";
import { UnclaimedBanner } from "@/components/domain/UnclaimedBanner";
import { Badge } from "@/components/ui/badge";
import { JsonLd, attorneyJsonLd } from "@/components/seo/JsonLd";
import { getLawyerBySlug } from "@/lib/db/queries";
import { buildPageMetadata, lawyerTitle } from "@/lib/seo/metadata";
import { experienceYears, formatPrice } from "@/lib/utils";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const lawyer = await getLawyerBySlug(slug);
  if (!lawyer) return {};
  return buildPageMetadata({
    title: lawyerTitle(lawyer.fullName, lawyer.city.name),
    description:
      lawyer.bio?.slice(0, 160) ||
      `Профиль адвоката ${lawyer.fullName}: судебная практика, рейтинг ${lawyer.totalRating.toFixed(1)}, реестр Минюста.`,
    path: `/lawyers/${lawyer.slug}`,
  });
}

export default async function LawyerProfilePage({ params }: Props) {
  const { slug } = await params;
  const lawyer = await getLawyerBySlug(slug);
  if (!lawyer) notFound();
  const years = experienceYears(lawyer.experienceStartYear);

  return (
    <div className="space-y-6">
      <JsonLd
        data={attorneyJsonLd({
          fullName: lawyer.fullName,
          slug: lawyer.slug,
          bio: lawyer.bio,
          totalRating: lawyer.totalRating,
          reviewsCount: lawyer.reviewsCount,
          cityName: lawyer.city.name,
          image: lawyer.photoUrl,
        })}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <header className="border border-rule bg-surface">
            <div className="border-b border-rule px-4 py-2 font-mono text-[11px] text-muted-ink md:px-6">
              <Link href="/" className="hover:text-navy">
                Главная
              </Link>
              <span className="mx-1.5">/</span>
              <Link href={`/${lawyer.city.slug}`} className="hover:text-navy">
                {lawyer.city.name}
              </Link>
              <span className="mx-1.5">/</span>
              <span className="text-ink">{lawyer.fullName}</span>
            </div>
            <div className="space-y-3 p-5 md:p-6">
              <p className="section-kicker">Профиль адвоката</p>
              <h1 className="font-serif text-3xl md:text-4xl">{lawyer.fullName}</h1>
              <div className="flex flex-wrap gap-2">
                {lawyer.registryNumber && (
                  <Badge tone="green">Минюст РФ: № {lawyer.registryNumber}</Badge>
                )}
                {lawyer.isClaimed && lawyer.isVerifiedDocuments && (
                  <Badge tone="bronze">Личность проверена</Badge>
                )}
                {lawyer.lawFirm && (
                  <Link
                    href={`/firms/${lawyer.lawFirm.slug}`}
                    className="text-sm text-navy hover:underline"
                  >
                    {lawyer.lawFirm.name}
                  </Link>
                )}
              </div>
              <p className="text-sm text-muted-ink">
                {lawyer.city.name}
                {years != null && ` · стаж с ${lawyer.experienceStartYear} г. (${years} лет)`}
                {` · дел в базе: ${lawyer.casesCount}`}
              </p>
              <p className="max-w-3xl text-xs leading-relaxed text-muted-ink">
                Сведения о статусе и реестровом номере — по открытым данным ЕГРЮА Минюста РФ.
                Карточка носит справочный характер и не заменяет официальный реестр.
              </p>
              {lawyer.bio && (
                <p className="max-w-3xl text-sm leading-relaxed text-ink">{lawyer.bio}</p>
              )}
            </div>
          </header>

          {!lawyer.isClaimed && (
            <UnclaimedBanner
              lawyerName={lawyer.fullName}
              claimHref={`/claim/${lawyer.id}`}
            />
          )}

          <section>
            <h2 className="mb-3 font-serif text-2xl">Судебные дела в базах</h2>
            <CourtCasesTable
              cases={lawyer.courtCases.map((c) => ({
                id: c.id,
                slug: c.slug,
                caseNumber: c.caseNumber,
                courtName: c.court?.name,
                categoryName: c.category?.name,
                lawArticles: c.lawArticles,
                summary: c.summary,
                title: c.title,
                outcome: c.outcome,
                sourceUrl: c.sourceUrl,
                decisionDate: c.decisionDate,
              }))}
            />
          </section>

          <section className="border border-rule bg-surface p-5">
            <h2 className="font-serif text-2xl">Специализация</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {lawyer.specializations.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/${lawyer.city.slug}/${s.category.slug}`}
                    className="border border-rule px-3 py-1.5 text-sm hover:border-navy"
                  >
                    {s.category.name}
                    <span className="ml-2 font-mono text-xs text-muted-ink">
                      {s.casesInCategory}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {lawyer.servicePrices.length > 0 && (
            <section className="border border-rule bg-surface p-5">
              <h2 className="font-serif text-2xl">Прайс-лист</h2>
              <table className="mt-3 w-full text-sm">
                <tbody>
                  {lawyer.servicePrices.map((p) => (
                    <tr key={p.id} className="border-t border-rule">
                      <td className="py-2 pr-4">{p.service.name}</td>
                      <td className="py-2 text-right font-mono tabular-nums">
                        от {formatPrice(p.priceFrom)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {lawyer.answers.length > 0 && (
            <section className="border border-rule bg-surface p-5">
              <h2 className="font-serif text-2xl">Ответы на вопросы</h2>
              <ul className="mt-3 space-y-3">
                {lawyer.answers.map((a) => (
                  <li key={a.id} className="border-t border-rule pt-3 first:border-t-0 first:pt-0">
                    <Link href={`/questions/${a.question.slug}`} className="font-medium hover:text-navy">
                      {a.question.title}
                    </Link>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-ink">{a.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="border border-rule bg-[#FAF9F5] p-5">
            <div className="font-serif text-4xl tabular-nums">
              {lawyer.totalRating.toFixed(1)}
            </div>
            <div className="text-sm text-muted-ink">рейтинг из 10</div>
            {lawyer.minConsultationPrice != null && (
              <p className="mt-3 text-sm">
                Консультация от{" "}
                <span className="font-mono">{formatPrice(lawyer.minConsultationPrice)}</span>
              </p>
            )}
            <div id="contacts" className="mt-4 space-y-1 text-sm">
              {lawyer.isClaimed && lawyer.publicPhone ? (
                <p className="font-mono">{lawyer.publicPhone}</p>
              ) : (
                <p className="text-muted-ink">
                  Прямой телефон скрыт до подтверждения профиля
                </p>
              )}
            </div>
          </div>
          <RatingBreakdownCard
            practiceScore={lawyer.practiceScore}
            statusAndExpScore={lawyer.statusAndExpScore}
            reputationScore={lawyer.reputationScore}
            totalRating={lawyer.totalRating}
          />
          <LeadForm
            lawyerId={lawyer.id}
            cityId={lawyer.cityId}
            categoryId={lawyer.specializations[0]?.categoryId}
          />
        </aside>
      </div>
    </div>
  );
}
