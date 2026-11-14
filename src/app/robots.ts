import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/admin", "/claim", "/api/", "/login", "/ui-kit"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
