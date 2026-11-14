import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { formatNumber } from "@/lib/utils";

/** Свежие счётчики из БД (не залипать на seed с момента next build). */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [cities, lawyersCount, casesCount] = await Promise.all([
    prisma.city.findMany({
      where: { isMajor: true },
      orderBy: { population: "desc" },
      take: 8,
      include: { _count: { select: { lawyers: true } } },
    }),
    prisma.lawyer.count(),
    prisma.courtCase.count({ where: { isHiddenByLawyer: false } }),
  ]);

  return (
    <div className="space-y-10">
      <section className="border border-rule bg-surface">
        <div className="border-b border-rule px-5 py-8 md:px-8 md:py-12">
          <p className="section-kicker mb-3">Всероссийский юридический агрегатор</p>
          <h1 className="max-w-3xl font-serif text-4xl tracking-tight text-ink md:text-5xl">
            Портал адвокатов
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-ink md:text-lg">
            Рейтинг юристов по открытым данным Минюста и судебных актов. Без промо-шума — только
            практика, статус реестра и проверяемые отзывы.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/moscow"
              className="bg-navy px-5 py-2.5 text-sm font-medium text-white hover:bg-[#152a4a]"
            >
              Смотреть каталог
            </Link>
            <Link
              href="/calculators/gosposhlina"
              className="border border-rule bg-paper px-5 py-2.5 text-sm hover:border-navy"
            >
              Калькулятор госпошлины
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-rule">
          <div className="px-5 py-4">
            <div className="section-kicker">Адвокатов в базе</div>
            <div className="font-serif text-3xl tabular-nums">{formatNumber(lawyersCount)}</div>
          </div>
          <div className="px-5 py-4">
            <div className="section-kicker">Судебных актов</div>
            <div className="font-serif text-3xl tabular-nums">{formatNumber(casesCount)}</div>
          </div>
          <div className="px-5 py-4">
            <div className="section-kicker">Городов</div>
            <div className="font-serif text-3xl tabular-nums">{formatNumber(cities.length)}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-2xl">Крупные города</h2>
        <div className="grid gap-0 border border-rule md:grid-cols-2">
          {cities.map((city, i) => (
            <Link
              key={city.id}
              href={`/${city.slug}`}
              className={`flex items-center justify-between bg-surface px-4 py-4 hover:bg-paper ${
                i % 2 === 0 ? "md:border-r md:border-rule" : ""
              } ${i < cities.length - 2 ? "border-b border-rule" : i < cities.length - (cities.length % 2 === 0 ? 2 : 1) ? "border-b border-rule md:border-b-0" : ""} ${
                i < cities.length - 1 ? "border-b border-rule md:border-b" : ""
              }`}
            >
              <div>
                <div className="font-serif text-xl text-ink">{city.name}</div>
                <div className="text-xs text-muted-ink">{city.regionName}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-sm tabular-nums text-navy">
                  {formatNumber(city._count.lawyers)}
                </div>
                <div className="text-[11px] text-muted-ink">адвокатов</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
