import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-rule bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 md:grid-cols-3 md:px-6">
        <div>
          <p className="font-serif text-lg text-ink">Портал адвокатов</p>
          <p className="mt-2 text-sm text-muted-ink">
            Агрегатор адвокатов России с судебной практикой и реестром Минюста.
          </p>
        </div>
        <div>
          <p className="section-kicker mb-2">Разделы</p>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/moscow" className="hover:text-navy">
                Каталог по городам
              </Link>
            </li>
            <li>
              <Link href="/calculators/gosposhlina" className="hover:text-navy">
                Калькуляторы
              </Link>
            </li>
            <li>
              <Link href="/questions" className="hover:text-navy">
                Вопрос–ответ
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="section-kicker mb-2">Для адвокатов</p>
          <ul className="space-y-1 text-sm">
            <li>
              <Link href="/dashboard" className="hover:text-navy">
                Личный кабинет
              </Link>
            </li>
            <li>
              <Link href="/admin" className="hover:text-navy">
                Модерация
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-rule px-4 py-3 text-center text-xs text-muted-ink md:px-6">
        © {new Date().getFullYear()} Портал адвокатов. Справочный агрегатор: не официальный реестр
        Минюста РФ и не сайт адвокатской палаты. Статус — по ЕГРЮА Минюста; судебные данные — из
        открытых источников ГАС «Правосудие» и КАД «Арбитр».
      </div>
    </footer>
  );
}
