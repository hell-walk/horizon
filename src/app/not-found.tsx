import Link from "next/link";

import Logo from "@/components/logo";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo compact />
      <p className="eyebrow">{"Error // 404"}</p>
      <h1 className="h-display">Page not found</h1>
      <p className="max-w-md text-14 text-ink-muted">
        The page you are looking for does not exist or has moved. Your accounts and transactions are safe on the home page.
      </p>
      <Link href="/" className="btn-primary">
        Back to home
      </Link>
    </main>
  );
}
