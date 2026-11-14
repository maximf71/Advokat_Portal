import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { AdminClaimActions } from "@/components/domain/AdminClaimActions";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN" && session.user.role !== "MODERATOR") {
    redirect("/dashboard");
  }

  const [claims, leads, reviews] = await Promise.all([
    prisma.claimRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { lawyer: true },
    }),
    prisma.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { lawyer: true, city: true },
    }),
    prisma.review.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { lawyer: true },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8">
      <header className="border border-rule bg-surface p-5">
        <p className="section-kicker mb-2">Модерация</p>
        <h1 className="font-serif text-3xl">Админка портала</h1>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Заявки на подтверждение профиля</h2>
        {claims.length === 0 ? (
          <p className="border border-rule bg-surface px-4 py-6 text-sm text-muted-ink">
            Нет ожидающих заявок
          </p>
        ) : (
          claims.map((claim) => (
            <div key={claim.id} className="border border-rule bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{claim.lawyer.fullName}</p>
                  <p className="text-sm text-muted-ink">
                    {claim.applicantName} · {claim.workEmail} · {claim.workPhone}
                  </p>
                  <p className="mt-1 font-mono text-xs text-navy">{claim.idCardScanUrl}</p>
                  {claim.comment && <p className="mt-2 text-sm">{claim.comment}</p>}
                </div>
                <AdminClaimActions claimId={claim.id} />
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Лиды</h2>
        <div className="overflow-x-auto border border-rule bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-rule bg-paper">
              <tr>
                <th className="section-kicker px-3 py-3">Клиент</th>
                <th className="section-kicker px-3 py-3">Адвокат / город</th>
                <th className="section-kicker px-3 py-3">Текст</th>
                <th className="section-kicker px-3 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-rule last:border-0 align-top">
                  <td className="px-3 py-3">
                    <div>{lead.clientName}</div>
                    <div className="font-mono text-xs">{lead.clientPhone}</div>
                  </td>
                  <td className="px-3 py-3">
                    {lead.lawyer?.fullName ?? "—"}
                    <div className="text-xs text-muted-ink">{lead.city?.name}</div>
                  </td>
                  <td className="px-3 py-3 text-muted-ink">{lead.problemText}</td>
                  <td className="px-3 py-3 font-mono text-xs">{lead.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Отзывы на модерации</h2>
        {reviews.length === 0 ? (
          <p className="border border-rule bg-surface px-4 py-6 text-sm text-muted-ink">
            Нет отзывов на проверке
          </p>
        ) : (
          reviews.map((review) => (
            <div key={review.id} className="border border-rule bg-surface p-4 text-sm">
              <p className="font-medium">
                {review.lawyer.fullName} · оценка {review.rating}/5
              </p>
              <p className="mt-1 text-muted-ink">{review.comment}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
