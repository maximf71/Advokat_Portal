import type { Metadata } from "next";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Портал адвокатов — рейтинг юристов России",
    template: "%s | Портал адвокатов",
  },
  description:
    "Всероссийский агрегатор адвокатов с судебной практикой, реестром Минюста и объективным рейтингом.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="font-sans bg-paper text-ink antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
