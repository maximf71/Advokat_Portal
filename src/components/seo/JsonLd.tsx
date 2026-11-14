export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function attorneyJsonLd(lawyer: {
  fullName: string;
  slug: string;
  bio?: string | null;
  totalRating: number;
  reviewsCount: number;
  cityName: string;
  image?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Attorney",
    name: lawyer.fullName,
    url: `https://localhost:3000/lawyers/${lawyer.slug}`,
    description: lawyer.bio ?? undefined,
    image: lawyer.image ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: lawyer.cityName,
      addressCountry: "RU",
    },
    aggregateRating:
      lawyer.reviewsCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: lawyer.totalRating,
            bestRating: 10,
            ratingCount: lawyer.reviewsCount,
          }
        : undefined,
  };
}

export function faqJsonLd(items: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}
