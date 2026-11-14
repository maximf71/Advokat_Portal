"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";

type TopLawyer = { slug: string; fullName: string; totalRating: number };

export function DduCalculator({ topLawyers = [] }: { topLawyers?: TopLawyer[] }) {
  const [contractPrice, setContractPrice] = useState("5000000");
  const [daysDelay, setDaysDelay] = useState("90");

  const penalty = useMemo(() => {
    const price = Number(contractPrice.replace(/\s/g, "")) || 0;
    const days = Number(daysDelay) || 0;
    // Упрощённо: 1/300 ставки рефинансирования (~16%) * 2 для гражданина-потребителя ≈ 0.001066 * price * days
    const rate = 0.16;
    return Math.round(price * (rate / 300) * 2 * days);
  }, [contractPrice, daysDelay]);

  return (
    <section className="border-2 border-ink bg-surface">
      <div className="border-b border-rule bg-paper px-4 py-3">
        <p className="section-kicker">ДДУ / 214-ФЗ</p>
        <h2 className="font-serif text-2xl">Калькулятор неустойки по ДДУ</h2>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="space-y-4 border-b border-rule p-4 md:border-b-0 md:border-r md:p-6">
          <div>
            <Label>Цена договора, ₽</Label>
            <Input
              className="mt-2 font-mono text-lg"
              value={contractPrice}
              onChange={(e) => setContractPrice(e.target.value)}
            />
          </div>
          <div>
            <Label>Дней просрочки</Label>
            <Input
              className="mt-2 font-mono text-lg"
              value={daysDelay}
              onChange={(e) => setDaysDelay(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-4 p-4 md:p-6">
          <div>
            <p className="section-kicker">Неустойка (ориентир)</p>
            <p className="font-serif text-4xl tabular-nums">{formatPrice(penalty)}</p>
            <p className="mt-2 text-sm text-muted-ink">
              Расчёт по формуле 214-ФЗ для участника долевого строительства (ставка ЦБ 16% —
              ориентир). Суд вправе снизить неустойку.
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
