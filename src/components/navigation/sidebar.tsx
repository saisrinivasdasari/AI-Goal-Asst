"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Compass,
  Target,
  BookOpen,
  Brain,
  MessageSquare,
  Sliders,
  Sparkles,
  TrendingUp,
  Calendar,
  LogOut,
} from "lucide-react";

const NAV_ITEMS = [
  {
    name: "Today's Mission",
    href: "/today",
    icon: Compass,
    badge: "Active",
  },
  {
    name: "Goals & Journey",
    href: "/goals",
    icon: Target,
  },
  {
    name: "Life Journal",
    href: "/journal",
    icon: BookOpen,
  },
  {
    name: "Personal Analyst",
    href: "/analyst",
    icon: TrendingUp,
  },
  {
    name: "Periodic Reviews",
    href: "/review",
    icon: Calendar,
  },
  {
    name: "Universal Memory",
    href: "/memories",
    icon: Brain,
  },
  {
    name: "Jarvis AI Co-Pilot",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    name: "Capacity & Energy",
    href: "/settings/capacity",
    icon: Sliders,
  },
];

interface UserSummary {
  fullName: string;
  initials: string;
  email: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSummary>({
    fullName: "Traveler",
    initials: "TR",
    email: "",
  });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.user) {
          setUser({
            fullName: data.user.fullName || "Traveler",
            initials: data.user.initials || "TR",
            email: data.user.email || "",
          });
        }
      })
      .catch(() => {
        // Ignore fallback
      });
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside className="w-64 bg-neutral-950 border-r border-neutral-800/80 flex flex-col h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-neutral-800/60 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-white tracking-wide text-base">JARVIS</h1>
            <p className="text-[11px] text-neutral-400 font-mono tracking-wider">LIFE OS v2.0</p>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/today" && pathname?.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-neutral-800/90 text-cyan-400 shadow-sm border border-neutral-700/60"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? "text-cyan-400" : "text-neutral-400"}`} />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Status Footer */}
      <div className="p-4 border-t border-neutral-800/60 bg-neutral-950/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-semibold text-cyan-400 shrink-0">
            {user.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-neutral-200 truncate">{user.fullName}</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] text-neutral-400 font-mono">Isolated Context</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Log out of Jarvis"
            className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-neutral-900/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
