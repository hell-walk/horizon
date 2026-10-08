import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-gray-25 px-6 text-center font-inter">
      <Image src="/icons/logo.svg" width={48} height={48} alt="Horizon logo" />
      <h1 className="text-30 font-semibold text-gray-900">Page not found</h1>
      <p className="text-16 max-w-md text-gray-600">
        The page you are looking for does not exist or has moved. Your accounts and transactions are
        safe on the home page.
      </p>
      <Link href="/" className="form-btn rounded-lg px-6 py-3 text-center">
        Back to home
      </Link>
    </main>
  );
}
