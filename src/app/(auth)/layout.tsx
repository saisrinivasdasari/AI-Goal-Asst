import React from "react";
import { Sparkles } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background radial ambient glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Brand Header */}
      <div className="mb-8 flex flex-col items-center text-center z-10">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-xl shadow-cyan-500/25 mb-4 border border-cyan-400/30">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">JARVIS</h1>
        <p className="text-xs text-neutral-400 font-mono tracking-widest mt-1 uppercase">
          Autonomous Life Operating System
        </p>
      </div>

      {/* Form Container */}
      <div className="w-full max-w-md z-10">{children}</div>

      {/* Subtle Footer */}
      <p className="mt-8 text-xs text-neutral-500 font-mono text-center z-10">
        Encrypted &amp; Isolated Knowledge Vault &bull; v2.0
      </p>
    </div>
  );
}

