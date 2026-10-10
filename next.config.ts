import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV !== "production";
const appwriteOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "").origin;
  } catch {
    return "";
  }
})();

// What the browser may load. Next.js inlines its bootstrap scripts, hence
// 'unsafe-inline' for scripts; everything else is limited to this site plus
// Plaid Link (and Sentry's error endpoint). Bank redirects (Setu) are navigations, not loads.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://cdn.plaid.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.plaid.com https://*.sentry.io ${appwriteOrigin}${isDev ? " ws: wss:" : ""}`.trim(),
  "frame-src https://cdn.plaid.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // Browsers keep using HTTPS for a year once they have seen the site over HTTPS.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Loaded at runtime on the server only (PDF text and Office decryption).
  serverExternalPackages: ["pdfjs-dist", "officecrypto-tool", "xlsx", "exceljs"],
  // The statement-reading worker is loaded by path at runtime; ship it with the server.
  outputFileTracingIncludes: { "/**": ["./.worker/**"] },
  experimental: {
    // Statement uploads go through a server action; the default 1 MB cap rejected
    // most PDF statements. Matches MAX_UPLOAD_BYTES in lib/uploadLimit.ts (plus form overhead).
    serverActions: { bodySizeLimit: "5mb" },
  },
  // Dev only: let the dev server be reached through a tunnel (Cloudflare,
  // ngrok, localtunnel) so hot reload and assets work from a public URL.
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io", "*.loca.lt"],
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Icons never change without a new file name; cache them hard.
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
  org: "chandigarh-university-yn",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Annotate React components so breadcrumbs and session replay show their names
  reactComponentAnnotation: {
    enabled: true,
  },

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers
  tunnelRoute: "/monitoring",
});
