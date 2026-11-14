import { notFound } from "next/navigation";
import {
  CatalogPagination,
  parseCatalogPage,
} from "@/components/domain/CatalogPagination";
import {
  CatalogSortBar,
  parseCatalogSort,
} from "@/components/domain/CatalogSort";
import { CityCategoryHeader } from "@/components/domain/CityCategoryHeader";
import { LawyerCard } from "@/components/domain/LawyerCard";
import { JsonLd, faqJsonLd } from "@/components/seo/JsonLd";
import {
  getCategoriesForCityLinks,
  getCityBySlug,
  getCityCategoryStats,
  getLawyersByCity,
} from "@/lib/db/queries";
import { buildPageMetadata, cityTitle } from "@/lib/seo/metadata";
import { formatNumber, formatPrice } from "@/lib/utils";

type Props = {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string | string[]; sort?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { city: slug } = await params;
  const city = await getCityBySlug(slug);
  if (!city) return {};
  const stats = await getCityCategoryStats(city.id);
  const index = stats.lawyersCount > 0;
  return buildPageMetadata({
    title: cityTitle(city.nameGenitive, stats.lawyersCount),
    description: `Адвокаты ${city.nameGenitive}: ${stats.lawyersCount} юристов, ${stats.casesCount} судебных актов. Рейтинг по данным Минюста и ГАС «Правосудие».`,
    path: `/${city.slug}`,
    index,
  });
}

export default async function CityPage({ params, searchParams }: Props) {
  const { city: slug } = await params;
  const { page: pageParam, sort: sortParam } = await searchParams;
  const city = await getCityBySlug(slug);
  if (!city) notFound();

  const requestedPage = parseCatalogPage(pageParam);
  const sort = parseCatalogSort(sortParam);
  const basePath = `/${city.slug}`;
  const [stats, listing, categoryLinks] = await Promise.all([
    getCityCategoryStats(city.id),
    getLawyersByCity(city.id, undefined, { page: requestedPage, sort }),
    getCategoriesForCityLinks(city.id, city.slug),
  ]);

  const faq = [
    {
      question: `Сколько адвокатов ${city.namePrepositional}?`,
      answer: `В базе портала ${stats.lawyersCount} адвокатов ${city.nameGenitive}, проанализировано ${stats.casesCount} судебных актов.`,
    },
    {
      question: "Как формируется рейтинг?",
      answer:
        "Рейтинг учитывает судебную практику, статус в реестре Минюста, стаж, отзывы и активность в разделе «Вопрос–ответ».",
    },
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={faqJsonLd(faq)} />
      <CityCategoryHeader
        breadcrumbs={[
          { label: "Главная", href: "/" },
          { label: city.regionName },
          { label: city.name },
        ]}
        title={`Адвокаты ${city.namePrepositional}`}
        stats={[
          { label: "В реестре города", value: formatNumber(stats.lawyersCount) },
          { label: "Проанализировано актов", value: formatNumber(stats.casesCount) },
          {
            label: "Средний индекс практики",
            value: `${stats.avgRating.toFixed(1)} / 10`,
          },
          {
            label: "Консультация от",
            value: stats.minPrice != null ? formatPrice(stats.minPrice) : "—",
          },
        ]}
        tags={categoryLinks}
      />

      <CatalogSortBar basePath={basePath} sort={sort} />

      <div className="space-y-4">
        {listing.lawyers.map((lawyer) => (
          <LawyerCard key={lawyer.id} lawyer={lawyer} />
        ))}
        {listing.lawyers.length === 0 && (
          <p className="border border-rule bg-surface px-4 py-8 text-center text-sm text-muted-ink">
            В этом городе пока нет активных профилей.
          </p>
        )}
      </div>

      <CatalogPagination
        basePath={basePath}
        page={listing.page}
        totalPages={listing.totalPages}
        total={listing.total}
        pageSize={listing.pageSize}
        sort={sort}
      />

      <section className="border border-rule bg-surface p-5">
        <h2 className="font-serif text-2xl">Частые вопросы</h2>
        <dl className="mt-4 space-y-4">
          {faq.map((item) => (
            <div key={item.question}>
              <dt className="font-medium text-ink">{item.question}</dt>
              <dd className="mt-1 text-sm text-muted-ink">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
