import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// Only pages that exist without a session belong in the sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${siteUrl}/sign-in`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${siteUrl}/sign-up`, lastModified, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/pricing`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/refunds`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/contact`, lastModified, changeFrequency: "yearly", priority: 0.4 },
  ];
}
