import Image from "next/image";

import SiteFooter from "@/components/siteFooter";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="flex min-h-screen w-full justify-between font-inter">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-1 justify-center">{children}</div>
        <SiteFooter />
      </div>
      <div className="auth-asset">
        <div>
          <Image
            src="/icons/auth-image.svg"
            width={500}
            height={500}
            alt="Preview of the Horizon dashboard"
          />
        </div>
      </div>
    </main>
  );
}