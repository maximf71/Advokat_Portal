import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { ClaimForm } from "@/components/domain/ClaimForm";

type Props = { params: Promise<{ lawyerId: string }> };

export default async function ClaimPage({ params }: Props) {
  const { lawyerId } = await params;
  const lawyer = await prisma.lawyer.findUnique({ where: { id: lawyerId } });
  if (!lawyer) notFound();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header className="border border-rule bg-surface p-5">
        <p className="section-kicker mb-2">Подтверждение профиля</p>
        <h1 className="font-serif text-3xl">Это мой профиль</h1>
        <p className="mt-2 text-sm text-muted-ink">
          {lawyer.fullName}
          {lawyer.registryNumber ? ` · реестр № ${lawyer.registryNumber}` : ""}
        </p>
        {lawyer.isClaimed && (
          <p className="mt-3 text-sm text-registry-green">
            Профиль уже подтверждён и привязан к аккаунту.
          </p>
        )}
      </header>
      {!lawyer.isClaimed && <ClaimForm lawyerId={lawyer.id} lawyerName={lawyer.fullName} />}
    </div>
  );
}
