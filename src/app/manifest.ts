import type { MetadataRoute } from "next";

// Lets Horizon be added to a phone's home screen and open like an app. On an
// iPhone that is also what allows reminders (web push works only for sites
// added to the home screen there).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Horizon",
    short_name: "Horizon",
    description: "Every Indian bank account in one place: spending sorted, hidden bank charges found, every EMI by lender.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icons/app/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/app/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/app/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
