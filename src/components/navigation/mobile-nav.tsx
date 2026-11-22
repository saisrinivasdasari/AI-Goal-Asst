"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Target,
  BookOpen,
  TrendingUp,
  Menu,
} from "lucide-react";
import { MobileDrawer } from "./mobile-drawer";

const MOBILE_TABS = [
  {
    name: "Today",
    href: "/today",
    icon: Compass,
  },
  {
    name: "Goals",
    href: "/goals",
    icon: Target,
  },
  {
    name: "Journal",
    href: "/journal",
    icon: BookOpen,
  },
  {
    name: "Analyst",
    href: "/analyst",
    icon: TrendingUp,
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Check if current route belongs to secondary items
  const isSecondaryActive =
    pathname.startsWith("/chat") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/memories") ||
    pathname.startsWith("/settings");

  return (
    <>
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-neutral-950/90 backdrop-blur-xl border-t border-neutral-800/80 px-2 pt-1 pb-[max(8px,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {MOBILE_TABS.map((tab) => {
            const isActive =
              pathname === tab.href ||
              (tab.href !== "/today" && pathname?.startsWith(tab.href));
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 active:scale-95 ${
                  isActive
                    ? "text-cyan-400 font-semibold"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {/* Active Micro-Pill Indicator */}
                {isActive && (
                  <span className="absolute -top-1 w-6 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                )}
                <div
                  className={`p-1 rounded-lg ${
                    isActive ? "bg-cyan-950/60" : "bg-transparent"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">
                  {tab.name}
                </span>
              </Link>
            );
          })}

          {/* More / Menu Drawer Trigger */}
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open More Menu"
            className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 active:scale-95 ${
              isSecondaryActive
                ? "text-cyan-400 font-semibold"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {isSecondaryActive && (
              <span className="absolute -top-1 w-6 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
            )}
            <div
              className={`p-1 rounded-lg ${
                isSecondaryActive ? "bg-cyan-950/60" : "bg-transparent"
              }`}
            >
              <Menu className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-0.5 tracking-tight font-medium">
              More
            </span>
          </button>
        </div>
      </nav>

      {/* Slide-Up Drawer */}
      <MobileDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </>
  );
}

