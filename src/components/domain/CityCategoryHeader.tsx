import Link from "next/link";
import { formatNumber } from "@/lib/utils";

export type StatCell = { label: string; value: string };
export type QuickTag = { label: string; count?: number; href: string };

export function CityCategoryHeader({
  breadcrumbs,
  title,
  stats,
  tags,
}: {
  breadcrumbs: { label: string; href?: string }[];
  title: string;
  stats: StatCell[];
  tags?: QuickTag[];
}) {
  return (
    <header className="border border-rule bg-surface">
      <nav className="border-b border-rule px-4 py-2 text-[11px] font-mono text-muted-ink md:px-6">
        {breadcrumbs.map((crumb, i) => (
          <span key={`${crumb.label}-${i}`}>
            {i > 0 && <span className="mx-1.5 text-rule">/</span>}
            {crumb.href ? (
              <Link href={crumb.href} className="hover:text-navy">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-ink">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="grid gap-0 md:grid-cols-[1fr_auto]">
        <div className="px-4 py-5 md:px-6 md:py-6">
          <p className="section-kicker mb-2">Каталог юристов</p>
          <h1 className="font-serif text-3xl font-normal tracking-tight text-ink md:text-4xl">
            {title}
          </h1>
        </div>

        <div className="grid grid-cols-2 border-t border-rule md:grid-cols-4 md:border-t-0 md:border-l">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`px-4 py-4 ${i % 2 === 1 ? "border-l border-rule" : ""} ${
                i >= 2 ? "border-t border-rule md:border-t-0" : ""
              } ${i > 0 ? "md:border-l md:border-rule" : ""}`}
            >
              <div className="section-kicker mb-1">{stat.label}</div>
              <div className="font-serif text-xl tabular-nums text-ink md:text-2xl">
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-rule bg-paper px-4 py-3 md:px-6">
          <span className="section-kicker mr-2 self-center">Быстрые теги</span>
          {tags.map((tag) => (
            <Link
              key={tag.href}
              href={tag.href}
              className="border border-rule bg-surface px-3 py-1.5 text-xs text-ink hover:border-navy"
            >
              {tag.label}
              {typeof tag.count === "number" && (
                <span className="ml-1.5 font-mono tabular-nums text-muted-ink">
                  [{formatNumber(tag.count)}]
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
