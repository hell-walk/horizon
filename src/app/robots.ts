import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Horizon is a signed-in app: only the landing page (the root, for visitors),
// the public entry pages, the price list and the policies are crawlable (the
// same list as the sitemap). "/landing" is the same page as the root, so it
// stays out; its canonical link points at the root anyway.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/sign-in", "/sign-up", "/pricing", "/privacy", "/terms", "/refunds", "/contact"],
        disallow: ["/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
