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
        allow: [
          "/$",
          "/sign-in",
          "/sign-up",
          "/pricing",
          "/privacy",
          "/terms",
          "/refunds",
          "/contact",
          // What those pages are drawn with: Google renders a page with its
          // styles, scripts and pictures, and ranks it lower when it cannot.
          "/_next/static/",
          "/_next/image",
          "/landing/",
          "/opengraph-image",
          "/icon.svg",
          "/favicon.ico",
          "/apple-icon.png",
          "/manifest.webmanifest",
          "/icons/app/",
        ],
        disallow: ["/"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
