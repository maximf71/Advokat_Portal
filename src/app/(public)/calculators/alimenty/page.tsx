import { AlimentyCalculator } from "@/components/domain/AlimentyCalculator";
import { getCityBySlug, getTopLawyersByCity } from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Калькулятор алиментов онлайн",
  description: "Расчёт доли алиментов от дохода: 1/4, 1/3, 1/2 по Семейному кодексу РФ.",
  path: "/calculators/alimenty",
});

export default async function AlimentyPage() {
  const city = await getCityBySlug("moscow");
  const topLawyers = city ? await getTopLawyersByCity(city.id, 3) : [];

  return (
    <div className="space-y-6">
      <header className="border border-rule bg-surface p-5">
        <p className="section-kicker mb-2">Калькулятор</p>
        <h1 className="font-serif text-3xl">Алименты</h1>
      </header>
      <AlimentyCalculator topLawyers={topLawyers} />
    </div>
  );
}
