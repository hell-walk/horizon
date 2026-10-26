import type { Metadata } from "next";

// The pages search engines may index: the public entry pages and the price
// list and policies (everything else is behind sign-in and says noindex in
// app/layout.tsx). Each gets its own title and description, a canonical link
// (the www address, from metadataBase) and the same title when shared.

// The picture shown when a link is shared (app/opengraph-image.tsx draws it).
// A page that sets its own openGraph loses the inherited one, so it is named here.
const PREVIEW = { url: "/opengraph-image", width: 1200, height: 630, alt: "Horizon: every bank account, one place" };

/** Metadata for a public page that search engines may list. `path` starts with "/". */
export function publicPage(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    robots: { index: true, follow: true },
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "website", siteName: "Horizon", locale: "en_IN", images: [PREVIEW] },
    twitter: { card: "summary_large_image", title, description, images: [PREVIEW.url] },
  };
}

/** Structured data search engines read (schema.org), as the JSON text for a script tag. */
export function jsonLd(data: Record<string, unknown>) {
  // "<" is escaped so the text can never close the script tag early.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
