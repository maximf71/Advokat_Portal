import { LegalCalculatorWidget } from "@/components/domain/LegalCalculatorWidget";
import { getCityBySlug, getTopLawyersByCity } from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Калькулятор госпошлины в суд 2026",
  description:
    "Онлайн-расчёт госпошлины по ст. 333.19 и 333.21 НК РФ для судов общей юрисдикции и арбитража.",
  path: "/calculators/gosposhlina",
});

export default async function GosposhlinaPage() {
  const city = await getCityBySlug("moscow");
  const topLawyers = city ? await getTopLawyersByCity(city.id, 3) : [];

  return (
    <div className="space-y-6">
      <header className="border border-rule bg-surface p-5">
        <p className="section-kicker mb-2">Калькулятор</p>
        <h1 className="font-serif text-3xl">Госпошлина в суд</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-ink">
          Ориентировочный расчёт государственной пошлины. После расчёта можно подобрать адвоката по
          взысканию долгов.
        </p>
      </header>
      <LegalCalculatorWidget
        title="Калькулятор госпошлины (ст. 333.19 / 333.21 НК РФ)"
        topLawyers={topLawyers}
      />
    </div>
  );
}
