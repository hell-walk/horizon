import Sidebar from "@/components/sidebar";

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
      {children}
    </main>
  );
}
