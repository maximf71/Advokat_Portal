import Link from "next/link";
import {
  catalogHref,
  type CatalogSort,
} from "@/components/domain/CatalogSort";
import { formatNumber } from "@/lib/utils";

type Props = {
  basePath: string;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  sort?: CatalogSort;
};

function hrefFor(basePath: string, page: number, sort?: CatalogSort) {
  return catalogHref(basePath, { page, sort });
}

function pageWindow(current: number, total: number): number[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, total, current]);
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p);
  }
  return [...pages].sort((a, b) => a - b);
}

export function CatalogPagination({
  basePath,
  page,
  totalPages,
  total,
  pageSize,
  sort,
}: Props) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const pages = pageWindow(page, totalPages);

  return (
    <nav
      className="flex flex-col gap-3 border border-rule bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Страницы каталога"
    >
      <p className="font-mono text-xs text-muted-ink tabular-nums">
        {formatNumber(from)}–{formatNumber(to)} из {formatNumber(total)}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {page > 1 ? (
          <Link
            href={hrefFor(basePath, page - 1, sort)}
            className="border border-rule px-3 py-1.5 text-sm text-ink hover:border-navy"
            rel="prev"
          >
            Назад
          </Link>
        ) : (
          <span className="border border-rule px-3 py-1.5 text-sm text-muted-ink opacity-40">
            Назад
          </span>
        )}

        {pages.map((p, idx) => {
          const prev = pages[idx - 1];
          const showGap = prev != null && p - prev > 1;
          return (
            <span key={p} className="contents">
              {showGap && (
                <span className="px-1 font-mono text-xs text-muted-ink">…</span>
              )}
              {p === page ? (
                <span
                  aria-current="page"
                  className="border border-navy bg-navy px-3 py-1.5 font-mono text-sm tabular-nums text-white"
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={hrefFor(basePath, p, sort)}
                  className="border border-rule px-3 py-1.5 font-mono text-sm tabular-nums text-ink hover:border-navy"
                >
                  {p}
                </Link>
              )}
            </span>
          );
        })}

        {page < totalPages ? (
          <Link
            href={hrefFor(basePath, page + 1, sort)}
            className="border border-rule px-3 py-1.5 text-sm text-ink hover:border-navy"
            rel="next"
          >
            Вперёд
          </Link>
        ) : (
          <span className="border border-rule px-3 py-1.5 text-sm text-muted-ink opacity-40">
            Вперёд
          </span>
        )}
      </div>
    </nav>
  );
}

export function parseCatalogPage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
