import { DduCalculator } from "@/components/domain/DduCalculator";
import { getCityBySlug, getTopLawyersByCity } from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Калькулятор неустойки по ДДУ",
  description: "Онлайн-расчёт неустойки за просрочку передачи объекта по договору долевого участия.",
  path: "/calculators/neustojka-ddu",
});

export default async function DduPage() {
  const city = await getCityBySlug("moscow");
  const topLawyers = city ? await getTopLawyersByCity(city.id, 3) : [];

  return (
    <div className="space-y-6">
      <header className="border border-rule bg-surface p-5">
        <p className="section-kicker mb-2">Калькулятор</p>
        <h1 className="font-serif text-3xl">Неустойка по ДДУ</h1>
      </header>
      <DduCalculator topLawyers={topLawyers} />
    </div>
  );
}
