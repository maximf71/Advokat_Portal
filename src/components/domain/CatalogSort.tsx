import Link from "next/link";

export type CatalogSort = "rating" | "name" | "cases";

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: "rating", label: "По рейтингу" },
  { value: "name", label: "По алфавиту" },
  { value: "cases", label: "По числу дел" },
];

export function parseCatalogSort(raw: string | string[] | undefined): CatalogSort {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "name" || value === "cases" || value === "rating") return value;
  return "rating";
}

/** Build catalog path with page + sort query (page 1 and default sort omitted). */
export function catalogHref(
  basePath: string,
  opts: { page?: number; sort?: CatalogSort } = {}
): string {
  const page = opts.page ?? 1;
  const sort = opts.sort ?? "rating";
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (sort !== "rating") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function CatalogSortBar({
  basePath,
  sort,
}: {
  basePath: string;
  sort: CatalogSort;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 border border-rule bg-surface px-4 py-2.5"
      role="group"
      aria-label="Сортировка списка адвокатов"
    >
      <span className="section-kicker mr-1">Сортировка</span>
      {SORT_OPTIONS.map((opt) => {
        const active = opt.value === sort;
        return (
          <Link
            key={opt.value}
            href={catalogHref(basePath, { sort: opt.value, page: 1 })}
            aria-current={active ? "true" : undefined}
            className={
              active
                ? "border border-navy bg-navy px-3 py-1.5 text-xs text-white"
                : "border border-rule bg-paper px-3 py-1.5 text-xs text-ink hover:border-navy"
            }
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
