import Sidebar from "@/components/sidebar";
import Image from "next/image";
import MobileNav from "@/components/mobileNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mock user until auth is wired up; cast keeps the Sidebar props typed as User.
  const loggedIn = { firstName: "Aaditya", lastName: "Pandey" } as User;

  return (
    <main className="flex h-screen w-full font-inter">
      <Sidebar user={loggedIn} />
      <div className="flex size-full flex-col">
        <div className="root-layout">
          <Image src="/icons/logo.svg" width={30} height={30} alt="menu icon" />
          <div>
            <MobileNav user={loggedIn} />
          </div>

        </div>
        {children}
      </div>

    </main>
  );
}
