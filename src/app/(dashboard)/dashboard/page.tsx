import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { DashboardCases } from "@/components/domain/DashboardCases";
import { DashboardAnswerForm } from "@/components/domain/DashboardAnswerForm";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role === "ADMIN" || session.user.role === "MODERATOR") {
    redirect("/admin");
  }

  const lawyerId = session.user.lawyerId;
  if (!lawyerId) {
    return (
      <div className="border border-rule bg-surface p-6">
        <h1 className="font-serif text-3xl">Личный кабинет</h1>
        <p className="mt-3 text-sm text-muted-ink">
          К аккаунту ещё не привязан профиль адвоката. Найдите свою анкету и нажмите «Подтвердить
          профиль», либо дождитесь одобрения заявки модератором.
        </p>
        <Link href="/" className="mt-4 inline-block text-navy hover:underline">
          Перейти в каталог →
        </Link>
      </div>
    );
  }

  const lawyer = await prisma.lawyer.findUniqueOrThrow({
    where: { id: lawyerId },
    include: {
      city: true,
      courtCases: {
        orderBy: { decisionDate: "desc" },
        include: { court: true, category: true },
      },
      leads: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  const cityQuestions = await prisma.question.findMany({
    where: {
      isPublished: true,
      OR: [{ cityId: lawyer.cityId }, { cityId: null }],
      answers: { none: { lawyerId: lawyer.id } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div className="space-y-6">
      <header className="border border-rule bg-surface p-5">
        <p className="section-kicker mb-2">Личный кабинет</p>
        <h1 className="font-serif text-3xl">{lawyer.fullName}</h1>
        <p className="mt-2 text-sm text-muted-ink">
          Рейтинг {lawyer.totalRating.toFixed(1)} / 10 · дел {lawyer.casesCount} ·{" "}
          <Link href={`/lawyers/${lawyer.slug}`} className="text-navy hover:underline">
            публичный профиль
          </Link>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Мои судебные дела</h2>
        <DashboardCases cases={lawyer.courtCases} />
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Вопросы клиентов ({lawyer.city.name})</h2>
        {cityQuestions.length === 0 ? (
          <p className="border border-rule bg-surface px-4 py-6 text-sm text-muted-ink">
            Новых вопросов без вашего ответа нет.
          </p>
        ) : (
          cityQuestions.map((q) => (
            <div key={q.id} className="border border-rule bg-surface p-4">
              <h3 className="font-medium">{q.title}</h3>
              <p className="mt-1 text-sm text-muted-ink line-clamp-3">{q.body}</p>
              <DashboardAnswerForm questionId={q.id} />
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Заявки (лиды)</h2>
        <div className="overflow-x-auto border border-rule bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-rule bg-paper">
              <tr>
                <th className="section-kicker px-3 py-3">Клиент</th>
                <th className="section-kicker px-3 py-3">Телефон</th>
                <th className="section-kicker px-3 py-3">Ситуация</th>
                <th className="section-kicker px-3 py-3">Статус</th>
              </tr>
            </thead>
            <tbody>
              {lawyer.leads.map((lead) => (
                <tr key={lead.id} className="border-b border-rule last:border-0 align-top">
                  <td className="px-3 py-3">{lead.clientName}</td>
                  <td className="px-3 py-3 font-mono text-xs">{lead.clientPhone}</td>
                  <td className="px-3 py-3 text-muted-ink">{lead.problemText}</td>
                  <td className="px-3 py-3 font-mono text-xs">{lead.status}</td>
                </tr>
              ))}
              {lawyer.leads.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-ink">
                    Заявок пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
