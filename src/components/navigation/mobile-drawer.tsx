"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  X,
  MessageSquare,
  Calendar,
  Brain,
  Sliders,
  LogOut,
  Sparkles,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserSummary {
  fullName: string;
  initials: string;
  email: string;
}

const SECONDARY_LINKS = [
  {
    name: "Jarvis AI Co-Pilot",
    href: "/chat",
    icon: MessageSquare,
    desc: "Interactive reasoning & goal refinement",
    badge: "AI",
  },
  {
    name: "Periodic Reviews",
    href: "/review",
    icon: Calendar,
    desc: "Weekly & Monthly retrospective audit",
  },
  {
    name: "Universal Memory",
    href: "/memories",
    icon: Brain,
    desc: "Long-term episodic recall & context",
  },
  {
    name: "Capacity & Energy Settings",
    href: "/settings/capacity",
    icon: Sliders,
    desc: "Weekly hours & circadian calibration",
  },
];

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserSummary>({
    fullName: "Traveler",
    initials: "TR",
    email: "",
  });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
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
      .catch(() => {});
  }, [isOpen]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      onClose();
      router.push("/login");
      router.refresh();
    } catch {
      onClose();
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-Up Bottom Sheet */}
      <div className="relative w-full bg-neutral-900/95 border-t border-neutral-800/90 backdrop-blur-2xl rounded-t-3xl p-5 pb-8 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
        {/* Grab Handle */}
        <div className="w-12 h-1.5 rounded-full bg-neutral-700/80 mx-auto mb-4" />

        {/* User Card & Close */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800/70 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-600 border border-cyan-400/30 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-cyan-500/20">
              {user.initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-white tracking-tight">{user.fullName}</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <p className="text-[11px] text-neutral-400 font-mono truncate max-w-[180px]">
                  {user.email || "Life OS Active"}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-800/80 border border-neutral-700/70 flex items-center justify-center text-neutral-400 hover:text-white"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Secondary Navigation Section */}
        <div className="space-y-1.5 mb-6">
          <p className="text-[10px] font-semibold text-neutral-500 font-mono uppercase tracking-wider px-2 mb-2">
            Intelligence & Memory
          </p>
          {SECONDARY_LINKS.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center justify-between p-3 rounded-2xl transition-all active:scale-[0.98] ${
                  isActive
                    ? "bg-neutral-800 text-cyan-300 border border-neutral-700/80 shadow-sm"
                    : "bg-neutral-950/40 border border-neutral-800/40 text-neutral-300 hover:bg-neutral-800/60"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isActive
                        ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60"
                        : "bg-neutral-800/70 text-neutral-400"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-100">{link.name}</span>
                      {link.badge && (
                        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/50">
                          {link.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-400">{link.desc}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-neutral-500" />
              </Link>
            );
          })}
        </div>

        {/* Footer Actions: Logout */}
        <div className="pt-3 border-t border-neutral-800/70 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>JARVIS LIFE OS v2.0</span>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{loggingOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

