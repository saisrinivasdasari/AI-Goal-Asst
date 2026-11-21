"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Search,
  Trash2,
  Sparkles,
  ShieldAlert,
  RefreshCw,
  Tag,
  Calendar,
} from "lucide-react";

interface Memory {
  id: string;
  category: string;
  content: string;
  durability: "EPHEMERAL" | "WORKING" | "CONSOLIDATED" | "CORE_IDENTITY";
  importanceScore: number;
  tags: string[];
  createdAt: string;
}

export default function MemoriesPage() {
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [forgetTopic, setForgetTopic] = useState("");
  const [forgetting, setForgetting] = useState(false);
  const [forgetMsg, setForgetMsg] = useState<string | null>(null);

  const fetchMemories = async (searchQuery = "") => {
    try {
      setLoading(true);
      const url = searchQuery
        ? `/api/v1/memories?q=${encodeURIComponent(searchQuery)}`
        : "/api/v1/memories";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setMemories(json.data);
      }
    } catch (err) {
      console.error("Failed to load memories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMemories(query);
  };

  const handleBulkForget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgetTopic.trim()) return;

    try {
      setForgetting(true);
      setForgetMsg(null);
      const res = await fetch(`/api/v1/memories?topic=${encodeURIComponent(forgetTopic)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setForgetMsg(`Successfully removed ${json.data.deletedCount} memories related to "${forgetTopic}".`);
        setForgetTopic("");
        fetchMemories();
      }
    } catch (err) {
      console.error("Failed to bulk forget:", err);
    } finally {
      setForgetting(false);
    }
  };

  const getDurabilityBadge = (durability: string) => {
    switch (durability) {
      case "CORE_IDENTITY":
        return "bg-rose-950/70 text-rose-400 border-rose-800/60";
      case "CONSOLIDATED":
        return "bg-cyan-950/70 text-cyan-400 border-cyan-800/60";
      case "WORKING":
        return "bg-amber-950/70 text-amber-400 border-amber-800/60";
      default:
        return "bg-neutral-800 text-neutral-400 border-neutral-700";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
          <Brain className="w-4 h-4" />
          <span>Semantic Storage & Recall</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Universal Memory</h1>
        <p className="text-xs text-neutral-400">
          Hybrid Vector + Full-Text Search (RRF) across your goals, learnings, habits, and journal entries.
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memories with hybrid semantic vectors (e.g. 'backend architecture', 'cardio habits')..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-sm focus:outline-none focus:border-cyan-500 font-medium"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2"
        >
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
        </button>
      </form>

      {/* Bulk Topic Forget Box */}
      <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
            <ShieldAlert className="w-4 h-4" />
            <span>Right to be Forgotten (Bulk Forget)</span>
          </div>
          <p className="text-[11px] text-neutral-400">
            Permanently purge all universal memories and vectors matching a specific topic.
          </p>
        </div>

        <form onSubmit={handleBulkForget} className="flex items-center gap-2">
          <input
            type="text"
            value={forgetTopic}
            onChange={(e) => setForgetTopic(e.target.value)}
            placeholder="Topic to purge..."
            className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs focus:outline-none focus:border-rose-500 font-medium"
          />
          <button
            type="submit"
            disabled={forgetting || !forgetTopic.trim()}
            className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/80 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {forgetting ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Trash2 className="w-3 h-3" />
            )}
            <span>Purge</span>
          </button>
        </form>
      </div>

      {forgetMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs">
          {forgetMsg}
        </div>
      )}

      {/* Memory Results */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <span>Memories In Vault</span>
          <span className="text-xs font-mono text-neutral-500">({memories.length})</span>
        </h2>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <p className="text-xs font-mono text-neutral-500">Querying semantic vault...</p>
          </div>
        ) : memories.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memories.map((mem) => (
              <div
                key={mem.id}
                className="p-5 rounded-xl bg-neutral-900/50 border border-neutral-800 space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-cyan-400 uppercase font-semibold">
                      {mem.category}
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${getDurabilityBadge(
                        mem.durability
                      )}`}
                    >
                      {mem.durability}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-200 leading-relaxed font-normal">
                    {mem.content}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-neutral-800/60 text-[10px] font-mono text-neutral-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(mem.createdAt).toLocaleDateString()}
                  </span>
                  <span>Score: {mem.importanceScore}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center rounded-2xl bg-neutral-900/20 border border-dashed border-neutral-800 space-y-2">
            <Brain className="w-8 h-8 text-neutral-600 mx-auto" />
            <p className="text-xs text-neutral-400">No memories matched this query.</p>
          </div>
        )}
      </div>
    </div>
  );
}

