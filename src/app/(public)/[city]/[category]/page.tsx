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
  getCategoryBySlug,
  getCityBySlug,
  getCityCategoryStats,
  getLawyersByCity,
} from "@/lib/db/queries";
import {
  buildPageMetadata,
  cityCategoryH1,
  cityCategoryTitle,
} from "@/lib/seo/metadata";
import { formatNumber, formatPrice } from "@/lib/utils";

type Props = {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<{ page?: string | string[]; sort?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { city: citySlug, category: categorySlug } = await params;
  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);
  if (!city || !category) return {};
  const stats = await getCityCategoryStats(city.id, category.id);
  return buildPageMetadata({
    title: cityCategoryTitle(city.nameGenitive, category.name, stats.lawyersCount),
    description: `${category.lawyerTitlePlural} ${city.namePrepositional}: ${stats.lawyersCount} юристов, ${stats.casesCount} судебных актов.`,
    path: `/${city.slug}/${category.slug}`,
    index: stats.lawyersCount > 0,
  });
}

export default async function CityCategoryPage({ params, searchParams }: Props) {
  const { city: citySlug, category: categorySlug } = await params;
  const { page: pageParam, sort: sortParam } = await searchParams;
  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);
  if (!city || !category) notFound();

  const requestedPage = parseCatalogPage(pageParam);
  const sort = parseCatalogSort(sortParam);
  const basePath = `/${city.slug}/${category.slug}`;
  const [stats, listing] = await Promise.all([
    getCityCategoryStats(city.id, category.id),
    getLawyersByCity(city.id, category.id, { page: requestedPage, sort }),
  ]);

  const tags = category.services.map((s) => ({
    label: s.shortTag,
    href: `/${city.slug}/${category.slug}/${s.slug}`,
  }));

  const faq = [
    {
      question: `Сколько ${category.lawyerTitlePlural.toLowerCase()} ${city.namePrepositional}?`,
      answer: `Найдено ${stats.lawyersCount} адвокатов, проанализировано ${stats.casesCount} судебных актов по направлению «${category.name}».`,
    },
    {
      question: "Как выбрать адвоката?",
      answer:
        "Смотрите число дел в категории, статус в реестре Минюста, верификацию профиля и прозрачный рейтинг практики.",
    },
  ];

  return (
    <div className="space-y-6">
      <JsonLd data={faqJsonLd(faq)} />
      <CityCategoryHeader
        breadcrumbs={[
          { label: "Главная", href: "/" },
          { label: city.regionName },
          { label: city.name, href: `/${city.slug}` },
          { label: category.name },
        ]}
        title={cityCategoryH1(category.lawyerTitlePlural, city.namePrepositional)}
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
        tags={tags}
      />

      <CatalogSortBar basePath={basePath} sort={sort} />

      <div className="space-y-4">
        {listing.lawyers.map((lawyer) => (
          <LawyerCard key={lawyer.id} lawyer={lawyer} />
        ))}
        {listing.lawyers.length === 0 && (
          <p className="border border-rule bg-surface px-4 py-8 text-center text-sm text-muted-ink">
            По этому направлению в городе пока нет активных профилей.
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
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 text-sm text-muted-ink">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
