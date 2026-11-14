import { notFound } from "next/navigation";
import { LawyerCard, type LawyerCardData } from "@/components/domain/LawyerCard";
import { getFirmBySlug } from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const firm = await getFirmBySlug(slug);
  if (!firm) return {};
  return buildPageMetadata({
    title: `${firm.name} — адвокаты коллегии`,
    description: `${firm.name} (${firm.city.name}): состав адвокатов и контакты.`,
    path: `/firms/${firm.slug}`,
  });
}

export default async function FirmPage({ params }: Props) {
  const { slug } = await params;
  const firm = await getFirmBySlug(slug);
  if (!firm) notFound();

  return (
    <div className="space-y-6">
      <header className="border border-rule bg-surface p-5 md:p-6">
        <p className="section-kicker mb-2">Коллегия / бюро</p>
        <h1 className="font-serif text-3xl md:text-4xl">{firm.name}</h1>
        <p className="mt-2 text-sm text-muted-ink">
          {firm.city.name}
          {firm.address ? ` · ${firm.address}` : ""}
          {firm.inn ? ` · ИНН ${firm.inn}` : ""}
        </p>
      </header>
      <div className="space-y-4">
        {firm.lawyers.map((lawyer) => {
          const card: LawyerCardData = {
            id: lawyer.id,
            slug: lawyer.slug,
            fullName: lawyer.fullName,
            registryNumber: lawyer.registryNumber,
            registryStatus: lawyer.registryStatus,
            isClaimed: lawyer.isClaimed,
            isVerifiedDocuments: lawyer.isVerifiedDocuments,
            photoUrl: lawyer.photoUrl,
            experienceStartYear: lawyer.experienceStartYear,
            lawFirmName: firm.name,
            totalRating: lawyer.totalRating,
            practiceScore: lawyer.practiceScore,
            statusAndExpScore: lawyer.statusAndExpScore,
            reputationScore: lawyer.reputationScore,
            casesCount: lawyer.casesCount,
            minConsultationPrice: lawyer.minConsultationPrice,
            freeFirstCheck: lawyer.freeFirstCheck,
            specializations: lawyer.specializations.map((s) => s.category.name),
            recentCases: lawyer.courtCases.map((c) => ({
              caseNumber: c.caseNumber,
              title: c.title,
              lawArticles: c.lawArticles,
              outcomeLabel: c.outcome,
            })),
          };
          return <LawyerCard key={lawyer.id} lawyer={card} />;
        })}
      </div>
    </div>
  );
}
