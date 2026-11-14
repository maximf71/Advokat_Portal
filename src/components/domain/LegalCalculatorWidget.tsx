"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";

type TopLawyer = { slug: string; fullName: string; totalRating: number };

function calcGosposhlina(amount: number, court: "general" | "arbitration", benefit: boolean) {
  if (benefit) return 0;
  if (amount <= 0) return 0;

  if (court === "general") {
    // Упрощённая шкала ст. 333.19 НК РФ (имущественные иски 2026, ориентир)
    if (amount <= 100_000) return Math.max(400, amount * 0.04);
    if (amount <= 200_000) return 4_000 + (amount - 100_000) * 0.03;
    if (amount <= 1_000_000) return 7_000 + (amount - 200_000) * 0.02;
    if (amount <= 2_000_000) return 23_000 + (amount - 1_000_000) * 0.01;
    return Math.min(900_000, 33_000 + (amount - 2_000_000) * 0.005);
  }

  // Арбитраж — упрощённая шкала ст. 333.21
  if (amount <= 100_000) return Math.max(2_000, amount * 0.04);
  if (amount <= 200_000) return 4_000 + (amount - 100_000) * 0.03;
  if (amount <= 1_000_000) return 7_000 + (amount - 200_000) * 0.02;
  if (amount <= 2_000_000) return 23_000 + (amount - 1_000_000) * 0.01;
  return Math.min(200_000, 33_000 + (amount - 2_000_000) * 0.005);
}

export function LegalCalculatorWidget({
  title = "Калькулятор госпошлины",
  topLawyers = [],
}: {
  title?: string;
  topLawyers?: TopLawyer[];
}) {
  const [court, setCourt] = useState<"general" | "arbitration">("general");
  const [amountStr, setAmountStr] = useState("1500000");
  const [benefit, setBenefit] = useState(false);

  const amount = Number(amountStr.replace(/\s/g, "")) || 0;
  const fee = useMemo(() => calcGosposhlina(amount, court, benefit), [amount, court, benefit]);

  return (
    <section className="border-2 border-ink bg-surface">
      <div className="border-b border-rule bg-paper px-4 py-3">
        <p className="section-kicker">SEO-калькулятор</p>
        <h2 className="font-serif text-2xl text-ink">{title}</h2>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="space-y-4 border-b border-rule p-4 md:border-b-0 md:border-r md:p-6">
          <div>
            <Label>Тип суда</Label>
            <div className="mt-2 grid grid-cols-2 border border-rule">
              <button
                type="button"
                onClick={() => setCourt("general")}
                className={`py-2 text-sm ${
                  court === "general" ? "bg-navy text-white" : "bg-surface text-ink"
                }`}
              >
                Общей юрисдикции
              </button>
              <button
                type="button"
                onClick={() => setCourt("arbitration")}
                className={`border-l border-rule py-2 text-sm ${
                  court === "arbitration" ? "bg-navy text-white" : "bg-surface text-ink"
                }`}
              >
                Арбитраж
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="claim-amount">Цена иска, ₽</Label>
            <Input
              id="claim-amount"
              className="mt-2 font-mono text-lg tabular-nums"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={benefit}
              onChange={(e) => setBenefit(e.target.checked)}
              className="rounded-none border-rule"
            />
            Льготная категория (освобождение от пошлины)
          </label>
        </div>

        <div className="space-y-4 p-4 md:p-6">
          <div>
            <p className="section-kicker mb-1">Госпошлина составит</p>
            <p className="font-serif text-4xl tabular-nums text-ink">{formatPrice(Math.round(fee))}</p>
            <p className="mt-2 text-sm text-muted-ink">
              Расчёт по ст. {court === "general" ? "333.19" : "333.21"} НК РФ (ориентир). Пошлину
              можно взыскать с ответчика через суд.
            </p>
          </div>

          {topLawyers.length > 0 && (
            <div className="border border-rule bg-paper p-3">
              <p className="section-kicker mb-2">ТОП адвокатов по взысканию</p>
              <ul className="space-y-2">
                {topLawyers.slice(0, 3).map((l) => (
                  <li key={l.slug} className="flex items-center justify-between text-sm">
                    <Link href={`/lawyers/${l.slug}`} className="hover:text-navy">
                      {l.fullName}
                    </Link>
                    <span className="font-mono tabular-nums text-muted-ink">
                      {l.totalRating.toFixed(1)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            type="button"
            variant="primary"
            size="full"
            onClick={() => {
              document.getElementById("lead")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            Подобрать адвоката по делу
          </Button>
        </div>
      </div>
    </section>
  );
}

export { calcGosposhlina };
