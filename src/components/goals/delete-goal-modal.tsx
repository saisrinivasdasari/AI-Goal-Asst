"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, X, Loader2, CheckCircle2 } from "lucide-react";

interface DeleteGoalModalProps {
  isOpen: boolean;
  goalId: string;
  goalTitle: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteGoalModal({
  isOpen,
  goalId,
  goalTitle,
  onClose,
  onDeleted,
}: DeleteGoalModalProps) {
  const [confirmInput, setConfirmInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfirmed = confirmInput.trim().toLowerCase() === "delete";

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    try {
      setIsDeleting(true);
      setError(null);

      const res = await fetch(`/api/v1/goals/${goalId}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to delete roadmap");
      }

      onDeleted();
    } catch (err: any) {
      console.error("Delete goal failed:", err);
      setError(err.message || "Failed to delete roadmap. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (isDeleting) return;
    setConfirmInput("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Delete Goal & Roadmap
              </h2>
              <p className="text-xs text-neutral-400 font-mono line-clamp-1">
                {goalTitle}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isDeleting}
            className="text-neutral-500 hover:text-neutral-300 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Callout */}
        <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-900/50 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Permanent Action</span>
          </div>
          <p className="text-[12px] text-rose-200/80 leading-relaxed">
            This will permanently erase this goal, all decomposed milestones, weekly targets,
            and scheduled daily tasks from your life operating system.
          </p>
        </div>

        {/* Type check confirmation */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-neutral-300">
            Type <span className="font-mono font-bold text-rose-400 uppercase">delete</span> to confirm:
          </label>
          <div className="relative">
            <input
              type="text"
              autoFocus
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="type delete"
              disabled={isDeleting}
              className={`w-full px-3.5 py-2.5 rounded-xl bg-neutral-900/90 text-sm font-mono text-white placeholder-neutral-600 border transition-all focus:outline-none ${
                isConfirmed
                  ? "border-rose-500/80 focus:ring-2 focus:ring-rose-500/30"
                  : "border-neutral-800 focus:border-neutral-700"
              }`}
            />
            {isConfirmed && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-rose-400 font-mono">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ready</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-rose-400 font-mono bg-rose-950/40 p-2.5 rounded-lg border border-rose-800/40">
            {error}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-rose-600/20 transition-all"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Permanently Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

