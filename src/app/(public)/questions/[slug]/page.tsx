import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuestionBySlug } from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const question = await getQuestionBySlug(slug);
  if (!question) return {};
  return buildPageMetadata({
    title: question.title,
    description: question.body.slice(0, 160),
    path: `/questions/${question.slug}`,
  });
}

export default async function QuestionPage({ params }: Props) {
  const { slug } = await params;
  const question = await getQuestionBySlug(slug);
  if (!question) notFound();

  return (
    <article className="space-y-6">
      <header className="border border-rule bg-surface p-5 md:p-6">
        <p className="section-kicker mb-2">Вопрос</p>
        <h1 className="font-serif text-3xl">{question.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink">{question.body}</p>
        <p className="mt-3 text-xs text-muted-ink">
          {question.authorName}
          {question.city ? ` · ${question.city.name}` : ""}
          {question.category ? ` · ${question.category.name}` : ""}
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Ответы адвокатов</h2>
        {question.answers.map((a) => (
          <div key={a.id} className="border border-rule bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/lawyers/${a.lawyer.slug}`} className="font-medium hover:text-navy">
                {a.lawyer.fullName}
              </Link>
              {a.isBestAnswer && (
                <span className="text-[11px] uppercase tracking-wider text-bronze">Лучший ответ</span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink">{a.body}</p>
          </div>
        ))}
        {question.answers.length === 0 && (
          <p className="border border-rule bg-surface px-4 py-6 text-sm text-muted-ink">
            Ответов пока нет.
          </p>
        )}
      </section>
    </article>
  );
}
