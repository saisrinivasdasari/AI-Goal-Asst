"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BookOpen,
  Send,
  Sparkles,
  Smile,
  Tag,
  CheckCircle2,
  Brain,
  RefreshCw,
  Clock,
  Calendar,
  Layers,
  Lightbulb,
  Award,
  Compass,
  ArrowRight,
  ArrowLeft,
  Filter,
  Search,
  Flame,
  Zap,
  Folder,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

interface ParsedJournalItem {
  id: string;
  taxonomyPath: string;
  domain: string;
  category: string;
  topic: string;
  content: string;
  takeaway: string;
  emotion: string;
  memoryType: string;
  isCompleted: boolean;
}

interface JournalEntry {
  id: string;
  rawInputText: string;
  detectedMood?: string;
  entryDate: string;
  createdAt: string;
  items: ParsedJournalItem[];
}

interface PlaybookTopicTakeaway {
  id: string;
  entryId: string;
  date: string;
  takeaway: string;
  content: string;
  emotion?: string;
  memoryType: string;
}

interface PlaybookTopic {
  title: string;
  count: number;
  lastPracticed: string;
  takeaways: PlaybookTopicTakeaway[];
}

interface DisciplinePlaybook {
  category: string;
  domain: string;
  icon: string;
  totalEntries: number;
  lastActiveDate: string;
  topics: PlaybookTopic[];
}

interface DomainKnowledgeHub {
  domain: string;
  icon: string;
  totalEntries: number;
  disciplines: DisciplinePlaybook[];
}

interface KnowledgeVaultData {
  domains: { name: string; count: number }[];
  playbooks?: DomainKnowledgeHub[];
  ideaBank: any[];
  learningBank: any[];
  reflectionBank: any[];
  totalEntries: number;
  totalItems: number;
}

export default function JournalPage() {
  const [activeTab, setActiveTab] = useState<"stream" | "vault">("stream");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [vaultData, setVaultData] = useState<KnowledgeVaultData | null>(null);
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<any | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");
  const [selectedVaultDomain, setSelectedVaultDomain] = useState<string>("ALL");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string | null>(null);
  const [showLegacyBanks, setShowLegacyBanks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchJournalData = async () => {
    try {
      setLoading(true);
      const [resEntries, resVault] = await Promise.all([
        fetch("/api/v1/journal"),
        fetch("/api/v1/journal/vault"),
      ]);

      const jsonEntries = await resEntries.json();
      const jsonVault = await resVault.json();

      if (jsonEntries.success) {
        setEntries(jsonEntries.data || jsonEntries.entries || []);
      }
      if (jsonVault.success) {
        setVaultData(jsonVault.data || jsonVault);
      }
    } catch (err) {
      console.error("Failed to load journal entries:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournalData();
  }, []);

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    try {
      setIngesting(true);
      setLastProcessed(null);
      const res = await fetch("/api/v1/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const json = await res.json();
      if (json.success) {
        setLastProcessed(json.data);
        setRawText("");
        fetchJournalData();
      }
    } catch (err) {
      console.error("Journal ingestion failed:", err);
    } finally {
      setIngesting(false);
    }
  };

  // Distinct Domains for filtering
  const allDomains = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      e.items?.forEach((it) => {
        if (it.domain) set.add(it.domain);
      });
    });
    return Array.from(set);
  }, [entries]);

  // Filtered entries by selected domain and search query
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        !searchQuery ||
        entry.rawInputText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.items.some(
          (it) =>
            it.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            it.takeaway.toLowerCase().includes(searchQuery.toLowerCase())
        );

      if (!matchesSearch) return false;

      if (selectedDomain === "ALL") return true;
      return entry.items.some((it) => it.domain === selectedDomain);
    });
  }, [entries, selectedDomain, searchQuery]);

  // Filtered disciplines based on selected vault domain
  const filteredDisciplines = useMemo(() => {
    if (!vaultData?.playbooks) return [];
    if (selectedVaultDomain === "ALL") {
      return vaultData.playbooks.flatMap((p) => p.disciplines);
    }
    const matchingHub = vaultData.playbooks.find((p) => p.domain === selectedVaultDomain);
    return matchingHub ? matchingHub.disciplines : [];
  }, [vaultData, selectedVaultDomain]);

  // Currently focused discipline object if one is selected
  const activeDiscipline = useMemo(() => {
    if (!selectedDiscipline || !vaultData?.playbooks) return null;
    for (const hub of vaultData.playbooks) {
      const found = hub.disciplines.find((d) => d.category === selectedDiscipline);
      if (found) return found;
    }
    return null;
  }, [vaultData, selectedDiscipline]);

  const getMemoryTypeStyle = (type: string) => {
    switch (type) {
      case "IDEA":
        return "bg-amber-950/80 text-amber-300 border-amber-800/80";
      case "LEARNING":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-800/80";
      case "EXPERIENCE":
        return "bg-blue-950/80 text-blue-300 border-blue-800/80";
      case "DECISION":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-800/80";
      default:
        return "bg-purple-950/80 text-purple-300 border-purple-800/80";
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            <span>Conversational Life Engine & Knowledge Vault</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Life Journal</h1>
          <p className="text-xs text-neutral-400 max-w-xl">
            Unburden your mind in plain text. Jarvis dynamically maps your experiences, skill learnings, and business ideas into an autonomous 3-tier knowledge ontology.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center rounded-xl bg-neutral-900 border border-neutral-800 p-1 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("stream")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "stream"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Journal Stream</span>
          </button>
          <button
            onClick={() => setActiveTab("vault")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "vault"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Knowledge Vault</span>
          </button>
        </div>
      </div>

      {/* Input Box */}
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4 shadow-xl">
        <form onSubmit={handleIngest} className="space-y-4">
          <div className="relative">
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="What happened today? (e.g. 'Played badminton today, realized court movement and racket head placement when hitting is critical. Felt energized.' or 'Got an idea: open an express high-quality cafe in a tech hub with minimal menu and fast delivery.')"
              className="w-full p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-sm focus:outline-none focus:border-cyan-500 font-normal leading-relaxed resize-none placeholder-neutral-600"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Dynamic 3-Tier Taxonomy: Domain ➔ Category ➔ Entity Mapping</span>
            </div>

            <button
              type="submit"
              disabled={ingesting || !rawText.trim()}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {ingesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Knowledge...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Ingest Knowledge</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Real-time Ingestion Result Pill */}
        {lastProcessed && (
          <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-800/80 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
                <Brain className="w-4 h-4 text-cyan-400" />
                <span>Jarvis Cognitive Breakdown</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-900 text-cyan-300 uppercase">
                Mood: {lastProcessed.journalEntry?.detectedMood || "Reflective"}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              {lastProcessed.extractedItems?.map((it: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80 text-xs space-y-1.5"
                >
                  <div className="flex items-center gap-2 font-mono text-[11px] text-cyan-400">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800/60 font-semibold">
                      {it.domain}
                    </span>
                    <span>➔</span>
                    <span className="text-neutral-300">{it.category}</span>
                    <span>➔</span>
                    <span className="text-white font-semibold">{it.topic}</span>
                  </div>

                  {it.takeaway && (
                    <p className="text-xs text-neutral-200 pl-2 border-l-2 border-cyan-500/60 italic">
                      💡 "{it.takeaway}"
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-[10px] font-mono text-neutral-400 pt-0.5">
                    <span className="text-amber-400">⚡ Emotion: {it.emotionalResonance}</span>
                    <span>•</span>
                    <span className="text-cyan-300">🏷️ {it.memoryType}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Domain Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Domain Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedDomain("ALL")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              selectedDomain === "ALL"
                ? "bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20"
                : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
            }`}
          >
            All Knowledge
          </button>
          {allDomains.map((domain) => (
            <button
              key={domain}
              onClick={() => setSelectedDomain(domain)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                selectedDomain === domain
                  ? "bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              {domain}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ideas, topics..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Tab 1: Chronological Journal Stream */}
      {activeTab === "stream" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Timeline Feed</span>
              <span className="text-xs font-mono text-neutral-500">
                ({filteredEntries.length} entries)
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[30vh] space-y-3">
              <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
              <p className="text-xs font-mono text-neutral-500">Loading entries...</p>
            </div>
          ) : filteredEntries.length > 0 ? (
            <div className="space-y-5">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-4 shadow-lg hover:border-neutral-700 transition-all"
                >
                  {/* Entry Header */}
                  <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      {new Date(entry.createdAt).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {entry.detectedMood && (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-neutral-800/90 text-neutral-300 uppercase border border-neutral-700/60">
                        Mood: {entry.detectedMood}
                      </span>
                    )}
                  </div>

                  {/* Raw User Thought */}
                  <p className="text-sm text-neutral-200 leading-relaxed italic border-l-2 border-neutral-800 pl-3">
                    "{entry.rawInputText}"
                  </p>

                  {/* Hierarchical Knowledge Items */}
                  {entry.items && entry.items.length > 0 && (
                    <div className="pt-3 border-t border-neutral-800/60 space-y-3">
                      {entry.items.map((item) => {
                        const typeClass = getMemoryTypeStyle(item.memoryType);

                        return (
                          <div
                            key={item.id}
                            className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800/70 space-y-2.5"
                          >
                            {/* Breadcrumbs Row */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400 flex-wrap">
                                <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 font-semibold text-cyan-300">
                                  {item.domain}
                                </span>
                                <span>➔</span>
                                <span className="text-neutral-400">{item.category}</span>
                                <span>➔</span>
                                <span className="text-white font-semibold">{item.topic}</span>
                              </div>

                              <span
                                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border font-mono ${typeClass}`}
                              >
                                {item.memoryType}
                              </span>
                            </div>

                            {/* Distilled Takeaway */}
                            {item.takeaway && (
                              <div className="p-2.5 rounded-lg bg-neutral-900/60 border border-neutral-800/60 text-xs text-neutral-200">
                                <span className="font-semibold text-cyan-400">💡 Takeaway: </span>
                                <span>{item.takeaway}</span>
                              </div>
                            )}

                            {/* Emotion & Details */}
                            <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono pt-1">
                              {item.emotion && (
                                <span className="text-amber-400/90 flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-amber-400" />
                                  <span>{item.emotion}</span>
                                </span>
                              )}
                              <span className="text-[10px] text-neutral-500">
                                Embedded in pgvector
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-16 text-center rounded-2xl bg-neutral-900/20 border border-dashed border-neutral-800 space-y-2">
              <BookOpen className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs text-neutral-400">No journal entries found matching criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Categorized Knowledge Vault */}
      {activeTab === "vault" && (
        <div className="space-y-8 animate-in fade-in">
          {/* Vault Header & Domain Filter */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Brain className="w-5 h-5 text-cyan-400" />
                  <span>Living Knowledge Playbooks</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Disciplines, sports, and skills isolated into dedicated living hubs.
                </p>
              </div>

              {selectedDiscipline && (
                <button
                  onClick={() => setSelectedDiscipline(null)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-semibold transition-colors self-start sm:self-auto"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to All Disciplines</span>
                </button>
              )}
            </div>

            {/* Domain Selection Tabs (visible when browsing disciplines) */}
            {!selectedDiscipline && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setSelectedVaultDomain("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedVaultDomain === "ALL"
                      ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                      : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"
                  }`}
                >
                  🌐 All Domains ({vaultData?.totalEntries || 0})
                </button>

                {vaultData?.playbooks?.map((hub) => (
                  <button
                    key={hub.domain}
                    onClick={() => setSelectedVaultDomain(hub.domain)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedVaultDomain === hub.domain
                        ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                        : "bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700"
                    }`}
                  >
                    <span>{hub.icon}</span>
                    <span>{hub.domain}</span>
                    <span className="text-[10px] font-mono opacity-70">({hub.totalEntries})</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* VIEW A: Single Focused Discipline Playbook View */}
          {selectedDiscipline && activeDiscipline ? (
            <div className="space-y-6 animate-in fade-in">
              {/* Discipline Hub Banner */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-cyan-950/40 border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-3xl shadow-inner">
                    {activeDiscipline.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 uppercase font-semibold">
                        {activeDiscipline.domain}
                      </span>
                      <span className="text-xs text-neutral-500 font-mono">
                        Active {new Date(activeDiscipline.lastActiveDate).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-tight mt-1">
                      {activeDiscipline.category} Master Playbook
                    </h2>
                    <p className="text-xs text-neutral-400">
                      {activeDiscipline.totalEntries} sessions logged across {activeDiscipline.topics.length} techniques & strategies
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <div className="px-3.5 py-2 rounded-xl bg-neutral-950/80 border border-neutral-800 text-center">
                    <span className="text-base font-bold text-cyan-400 block font-mono">
                      {activeDiscipline.totalEntries}
                    </span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
                      Sessions
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-xl bg-neutral-950/80 border border-neutral-800 text-center">
                    <span className="text-base font-bold text-amber-400 block font-mono">
                      {activeDiscipline.topics.length}
                    </span>
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">
                      Techniques
                    </span>
                  </div>
                </div>
              </div>

              {/* Technique Topics Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-neutral-400 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Technique Logs & Form Corrections</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeDiscipline.topics.map((top, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 transition-all space-y-4 shadow-lg"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-cyan-400" />
                          <span>{top.title}</span>
                        </span>
                        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-800/60">
                          {top.count} {top.count === 1 ? "log" : "logs"}
                        </span>
                      </div>

                      {/* Top Takeaway */}
                      {top.takeaways[0] && (
                        <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1.5">
                          <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>Latest Golden Cue</span>
                          </span>
                          <p className="text-xs text-neutral-200 leading-relaxed font-medium">
                            {top.takeaways[0].takeaway}
                          </p>
                        </div>
                      )}

                      {/* Timeline of All Sessions */}
                      <div className="space-y-2 pt-1 border-t border-neutral-800/60">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 block">
                          Evolution & Practice History:
                        </span>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {top.takeaways.map((tk, tIdx) => (
                            <div
                              key={tIdx}
                              className="text-xs text-neutral-400 p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/40 space-y-1"
                            >
                              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                                <span>{new Date(tk.date).toLocaleDateString()}</span>
                                {tk.emotion && (
                                  <span className="text-cyan-400/90 font-semibold">{tk.emotion}</span>
                                )}
                              </div>
                              <p className="text-neutral-300 leading-relaxed text-[11px]">
                                {tk.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* VIEW B: Disciplines Grid (Badminton, Chess, Tech, etc.) */
            <div className="space-y-4">
              {filteredDisciplines.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDisciplines.map((disc, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedDiscipline(disc.category)}
                      className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-cyan-500/50 hover:bg-neutral-900/90 cursor-pointer transition-all space-y-4 group shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-12 h-12 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-2xl group-hover:scale-105 transition-transform">
                          {disc.icon}
                        </div>
                        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-semibold">
                          {disc.totalEntries} {disc.totalEntries === 1 ? "entry" : "entries"}
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                          {disc.domain}
                        </span>
                        <h4 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors">
                          {disc.category}
                        </h4>
                      </div>

                      {/* Top Techniques Badges */}
                      <div className="space-y-1.5 pt-2 border-t border-neutral-800/60">
                        <span className="text-[10px] font-mono text-neutral-500 uppercase">
                          Techniques ({disc.topics.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {disc.topics.slice(0, 3).map((top, tIdx) => (
                            <span
                              key={tIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 text-neutral-300 border border-neutral-800 truncate max-w-[180px]"
                            >
                              {top.title} ({top.count})
                            </span>
                          ))}
                          {disc.topics.length > 3 && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-950 text-neutral-500 border border-neutral-800">
                              +{disc.topics.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-cyan-400 font-semibold pt-2 border-t border-neutral-800/40">
                        <span>Open Playbook</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-16 text-center rounded-2xl bg-neutral-900/20 border border-dashed border-neutral-800 space-y-2">
                  <Brain className="w-8 h-8 text-neutral-600 mx-auto" />
                  <p className="text-xs text-neutral-400">
                    No playbooks found in this domain yet. Journal your skills, drills, or insights to build them!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Collapsible Legacy Flat Banks (For complete backwards compatibility) */}
          <div className="pt-6 border-t border-neutral-800/80">
            <button
              onClick={() => setShowLegacyBanks(!showLegacyBanks)}
              className="text-xs font-mono text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-2"
            >
              <span>{showLegacyBanks ? "− Hide Legacy Flat Banks" : "+ View Legacy Flat Banks (Idea Bank, Learning Bank, Mindset)"}</span>
            </button>

            {showLegacyBanks && (
              <div className="mt-6 space-y-8 animate-in fade-in">
                {/* Section 1: Idea Bank */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    <span>Idea & Venture Bank ({vaultData?.ideaBank?.length || 0})</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {vaultData?.ideaBank?.map((idea, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-2">
                        <span className="text-[10px] font-mono text-amber-400 uppercase">{idea.category}</span>
                        <h5 className="text-xs font-bold text-white">{idea.topic}</h5>
                        <p className="text-xs text-neutral-400">{idea.takeaway || idea.content}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section 2: Learning Bank */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Award className="w-4 h-4 text-cyan-400" />
                    <span>Learning Bank ({vaultData?.learningBank?.length || 0})</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {vaultData?.learningBank?.map((skill, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-800 space-y-2">
                        <span className="text-[10px] font-mono text-cyan-400 uppercase">{skill.category}</span>
                        <h5 className="text-xs font-bold text-white">{skill.topic}</h5>
                        <p className="text-xs text-neutral-400">{skill.takeaway || skill.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
