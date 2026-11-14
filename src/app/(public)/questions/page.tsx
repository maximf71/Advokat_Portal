import Link from "next/link";
import { getPublishedQuestions } from "@/lib/db/queries";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata = buildPageMetadata({
  title: "Вопрос–ответ юристам",
  description: "Бесплатные консультации адвокатов: вопросы клиентов и ответы практикующих юристов.",
  path: "/questions",
});

export default async function QuestionsIndexPage() {
  const questions = await getPublishedQuestions();

  return (
    <div className="space-y-6">
      <header className="border border-rule bg-surface p-5">
        <p className="section-kicker mb-2">UGC</p>
        <h1 className="font-serif text-3xl">Вопрос–ответ</h1>
        <p className="mt-2 text-sm text-muted-ink">
          Публичные консультации. Ответы адвокатов повышают их рейтинг на портале.
        </p>
      </header>
      <ul className="border border-rule bg-surface divide-y divide-rule">
        {questions.map((q) => (
          <li key={q.id}>
            <Link href={`/questions/${q.slug}`} className="block px-4 py-4 hover:bg-paper">
              <h2 className="font-medium text-ink">{q.title}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-muted-ink">{q.body}</p>
              <p className="mt-2 font-mono text-[11px] text-muted-ink">
                {q.city?.name ?? "РФ"}
                {q.category ? ` · ${q.category.name}` : ""}
                {` · ответов: ${q._count.answers}`}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
