"use client";

import { useEffect, useState } from "react";
import { Undo2, X, CheckCircle2 } from "lucide-react";

interface FloatingUndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

export function FloatingUndoToast({
  message,
  onUndo,
  onDismiss,
  durationMs = 6000,
}: FloatingUndoToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [durationMs, onDismiss]);

  return (
    <div className="fixed bottom-20 sm:bottom-6 inset-x-4 sm:inset-x-auto sm:right-6 max-w-md sm:max-w-sm mx-auto sm:mx-0 z-50 animate-in slide-in-from-bottom duration-200">
      <div className="relative overflow-hidden rounded-2xl bg-neutral-900/95 border border-neutral-700/90 shadow-2xl backdrop-blur-xl p-3.5 flex items-center justify-between gap-3 text-white">
        {/* Countdown progress line */}
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 transition-all"
          style={{ width: `${progress}%` }}
        />

        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <p className="text-xs font-medium text-neutral-200 truncate">{message}</p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onUndo}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-800/80 text-cyan-300 text-xs font-bold transition-all active:scale-95 shadow-sm"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg text-neutral-400 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

