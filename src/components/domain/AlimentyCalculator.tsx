"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";

type TopLawyer = { slug: string; fullName: string; totalRating: number };

export function AlimentyCalculator({ topLawyers = [] }: { topLawyers?: TopLawyer[] }) {
  const [income, setIncome] = useState("80000");
  const [children, setChildren] = useState(1);

  const amount = useMemo(() => {
    const n = Number(income.replace(/\s/g, "")) || 0;
    const share = children === 1 ? 0.25 : children === 2 ? 1 / 3 : 0.5;
    return Math.round(n * share);
  }, [income, children]);

  return (
    <section className="border-2 border-ink bg-surface">
      <div className="border-b border-rule bg-paper px-4 py-3">
        <p className="section-kicker">Семейное право</p>
        <h2 className="font-serif text-2xl">Калькулятор алиментов</h2>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="space-y-4 border-b border-rule p-4 md:border-b-0 md:border-r md:p-6">
          <div>
            <Label>Доход плательщика, ₽/мес</Label>
            <Input
              className="mt-2 font-mono text-lg"
              value={income}
              onChange={(e) => setIncome(e.target.value)}
            />
          </div>
          <div>
            <Label>Количество детей</Label>
            <div className="mt-2 grid grid-cols-3 border border-rule">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setChildren(n)}
                  className={`py-2 text-sm ${
                    children === n ? "bg-navy text-white" : "bg-surface"
                  } ${n > 1 ? "border-l border-rule" : ""}`}
                >
                  {n === 3 ? "3+" : n}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4 md:p-6">
          <div>
            <p className="section-kicker">Ориентир по СК РФ</p>
            <p className="font-serif text-4xl tabular-nums">{formatPrice(amount)}</p>
            <p className="mt-2 text-sm text-muted-ink">
              1/4 дохода на одного ребёнка, 1/3 на двух, 1/2 на трёх и более. Суд может отступить от
              доли.
            </p>
          </div>
          {topLawyers.length > 0 && (
            <ul className="border border-rule bg-paper p-3 text-sm space-y-2">
              {topLawyers.map((l) => (
                <li key={l.slug} className="flex justify-between">
                  <Link href={`/lawyers/${l.slug}`} className="hover:text-navy">
                    {l.fullName}
                  </Link>
                  <span className="font-mono text-muted-ink">{l.totalRating.toFixed(1)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
