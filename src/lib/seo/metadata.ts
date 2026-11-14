import type { Metadata } from "next";

const SITE = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export function absoluteUrl(path: string): string {
  return `${SITE.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildPageMetadata({
  title,
  description,
  path,
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    robots: index ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: absoluteUrl(path),
      locale: "ru_RU",
      type: "website",
    },
  };
}

export function cityCategoryH1(categoryPlural: string, cityPrepositional: string): string {
  return `${categoryPlural} ${cityPrepositional}`;
}

export function cityCategoryTitle(
  cityGenitive: string,
  categoryName: string,
  count: number
): string {
  return `Рейтинг адвокатов ${cityGenitive} по направлению ${categoryName} — ${count} проверенных юристов`;
}

export function cityTitle(cityGenitive: string, count: number): string {
  return `Адвокаты ${cityGenitive} — рейтинг ${count} юристов с судебной практикой`;
}

export function lawyerTitle(fullName: string, cityName: string): string {
  return `${fullName} — адвокат ${cityName}: дела, рейтинг, контакты`;
}
