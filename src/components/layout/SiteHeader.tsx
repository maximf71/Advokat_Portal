import Link from "next/link";

const NAV = [
  { href: "/moscow", label: "Москва" },
  { href: "/ekaterinburg", label: "Екатеринбург" },
  { href: "/kazan", label: "Казань" },
  { href: "/calculators/gosposhlina", label: "Калькуляторы" },
  { href: "/questions", label: "Вопрос–ответ" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-rule bg-surface">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="font-serif text-xl tracking-tight text-ink md:text-2xl">
          Портал адвокатов
        </Link>
        <nav className="hidden items-center gap-5 text-sm text-muted-ink md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-navy">
              {item.label}
            </Link>
          ))}
          <Link href="/dashboard" className="border border-navy px-3 py-1.5 text-navy hover:bg-navy hover:text-white">
            Кабинет
          </Link>
        </nav>
        <Link
          href="/dashboard"
          className="border border-navy px-3 py-1.5 text-sm text-navy md:hidden"
        >
          Кабинет
        </Link>
      </div>
    </header>
  );
}
