import { Suspense } from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { Header } from "@/components/navigation/header";
import { MobileNav } from "@/components/navigation/mobile-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <Suspense fallback={<aside className="hidden md:flex w-64 bg-neutral-950 border-r border-neutral-800/80 h-screen" />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 max-w-7xl w-full mx-auto pb-28 md:pb-8">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
