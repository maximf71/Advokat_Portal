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
import {
  getCategoryBySlug,
  getCityBySlug,
  getCityCategoryStats,
  getLawyersByCity,
  getServiceBySlugs,
} from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { formatNumber, formatPrice } from "@/lib/utils";

type Props = {
  params: Promise<{ city: string; category: string; service: string }>;
  searchParams: Promise<{ page?: string | string[]; sort?: string | string[] }>;
};

export async function generateMetadata({ params }: Props) {
  const { city: citySlug, category: categorySlug, service: serviceSlug } = await params;
  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);
  if (!city || !category) return {};
  const service = await getServiceBySlugs(category.id, serviceSlug);
  if (!service) return {};
  const stats = await getCityCategoryStats(city.id, category.id);
  return buildPageMetadata({
    title: `${service.name} ${city.namePrepositional} — адвокаты и судебная практика`,
    description: `${service.shortTag}: подбор адвокатов ${city.nameGenitive}. В каталоге ${stats.lawyersCount} юристов по направлению.`,
    path: `/${city.slug}/${category.slug}/${service.slug}`,
    index: stats.lawyersCount > 0,
  });
}

export default async function CityCategoryServicePage({
  params,
  searchParams,
}: Props) {
  const { city: citySlug, category: categorySlug, service: serviceSlug } = await params;
  const { page: pageParam, sort: sortParam } = await searchParams;
  const [city, category] = await Promise.all([
    getCityBySlug(citySlug),
    getCategoryBySlug(categorySlug),
  ]);
  if (!city || !category) notFound();
  const service = await getServiceBySlugs(category.id, serviceSlug);
  if (!service) notFound();

  const requestedPage = parseCatalogPage(pageParam);
  const sort = parseCatalogSort(sortParam);
  const basePath = `/${city.slug}/${category.slug}/${service.slug}`;
  const [stats, listing] = await Promise.all([
    getCityCategoryStats(city.id, category.id),
    getLawyersByCity(city.id, category.id, { page: requestedPage, sort }),
  ]);

  return (
    <div className="space-y-6">
      <CityCategoryHeader
        breadcrumbs={[
          { label: "Главная", href: "/" },
          { label: city.name, href: `/${city.slug}` },
          { label: category.name, href: `/${city.slug}/${category.slug}` },
          { label: service.shortTag },
        ]}
        title={`${service.name} ${city.namePrepositional}`}
        stats={[
          { label: "Адвокатов по направлению", value: formatNumber(stats.lawyersCount) },
          { label: "Судебных актов", value: formatNumber(stats.casesCount) },
          {
            label: "Средний индекс",
            value: `${stats.avgRating.toFixed(1)} / 10`,
          },
          {
            label: "Рыночная цена от",
            value:
              service.avgMarketPrice != null
                ? formatPrice(service.avgMarketPrice)
                : stats.minPrice != null
                  ? formatPrice(stats.minPrice)
                  : "—",
          },
        ]}
      />
      <CatalogSortBar basePath={basePath} sort={sort} />

      <div className="space-y-4">
        {listing.lawyers.map((lawyer) => (
          <LawyerCard key={lawyer.id} lawyer={lawyer} />
        ))}
        {listing.lawyers.length === 0 && (
          <p className="border border-rule bg-surface px-4 py-8 text-center text-sm text-muted-ink">
            По этой услуге в городе пока нет активных профилей.
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
    </div>
  );
}
