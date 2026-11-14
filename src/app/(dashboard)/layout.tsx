import Link from "next/link";
import { auth } from "@/lib/auth";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="font-serif text-xl text-ink">
            Портал адвокатов
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            {session?.user ? (
              <>
                <span className="hidden text-muted-ink sm:inline">{session.user.email}</span>
                <Link href="/dashboard" className="hover:text-navy">
                  Кабинет
                </Link>
                {(session.user.role === "ADMIN" || session.user.role === "MODERATOR") && (
                  <Link href="/admin" className="hover:text-navy">
                    Админка
                  </Link>
                )}
                <Link href="/api/auth/signout" className="text-navy hover:underline">
                  Выйти
                </Link>
              </>
            ) : (
              <Link href="/login" className="text-navy hover:underline">
                Войти
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">{children}</main>
    </div>
  );
}
