import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Horizon is a signed-in app: only the public entry pages are crawlable.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/sign-in", "/sign-up", "/privacy", "/terms"],
        disallow: ["/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
