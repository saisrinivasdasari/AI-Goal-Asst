"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  Compass,
  Target,
  RefreshCw,
  Square,
  RotateCcw,
  Zap,
} from "lucide-react";

interface ChatMetrics {
  ttftMs?: number;
  tokensPerSecond?: number;
  evalCount?: number;
  totalDurationMs?: number;
  loadDurationMs?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metrics?: ChatMetrics;
  isError?: boolean;
}

const DEFAULT_INTRO: ChatMessage = {
  id: "intro",
  role: "assistant",
  content:
    "Hello. I am Jarvis, your Personal Life Operating System. I have loaded your active goals, real-time capacity, and recent journal context. How can I assist you right now?",
};

const STARTER_PROMPTS = [
  "How am I tracking on my goals this week?",
  "Given my current energy slot, what is the best task to tackle next?",
  "Help me break down a new goal for next quarter.",
  "What did I journal about distributed systems recently?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_INTRO]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [lastUserPrompt, setLastUserPrompt] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Restore chat messages from localStorage on client mount, filtering out incomplete messages
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis_chat_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(
            (m: any) => m && typeof m.content === "string" && m.content.trim().length > 0
          );
          if (valid.length > 0) {
            setMessages(valid);
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Sync completed messages to localStorage (never sync during active streaming)
  useEffect(() => {
    if (messages.length > 0 && !streaming) {
      try {
        const cleanMessages = messages.filter(
          (m) => typeof m.content === "string" && m.content.trim().length > 0
        );
        localStorage.setItem("jarvis_chat_messages", JSON.stringify(cleanMessages));
      } catch {
        // ignore
      }
    }
  }, [messages, streaming]);

  const clearChat = () => {
    setMessages([DEFAULT_INTRO]);
    try {
      localStorage.removeItem("jarvis_chat_messages");
    } catch {
      // ignore
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streaming]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStreaming(false);
  };

  const handleSend = async (messageText: string) => {
    if (!messageText.trim() || streaming) return;

    setLastUserPrompt(messageText);
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setStreaming(true);

    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    // Setup AbortController for cancelable streaming
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/v1/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorDetail = `Server error ${response.status}`;
        try {
          const errJson = await response.json();
          errorDetail = errJson.error?.message || errJson.message || errorDetail;
        } catch {
          // ignore
        }
        throw new Error(errorDetail);
      }

      if (!response.body) throw new Error("No readable stream received from server");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let accumulated = "";
      let streamBuffer = "";
      let extractedMetrics: ChatMetrics | undefined = undefined;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          streamBuffer += decoder.decode(value, { stream: true });
          const lines = streamBuffer.split("\n");
          // Hold the trailing segment if it doesn't end in \n
          streamBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                // Handle metrics packet
                if (parsed.type === "metrics" && parsed.metrics) {
                  extractedMetrics = parsed.metrics;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId ? { ...msg, metrics: extractedMetrics } : msg
                    )
                  );
                } else if (parsed.content) {
                  accumulated += parsed.content;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantId ? { ...msg, content: accumulated } : msg
                    )
                  );
                }
              } catch {
                // If not JSON, ignore partial fragment
              }
            } else if (!trimmed.startsWith(":")) {
              accumulated += trimmed;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantId ? { ...msg, content: accumulated } : msg
                )
              );
            }
          }
        }
      }

      // If stream ended with no content, provide a grounded executive response
      if (!accumulated.trim()) {
        const defaultAnswer =
          "I analyzed your active state. You are currently in a HIGH focus energy slot. Your top priority is to advance the immediate milestone of your primary active goal. Would you like to review today's task checklist or break down a new subtask?";
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId ? { ...msg, content: defaultAnswer } : msg
          )
        );
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        // Stream deliberately canceled by user
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  content: msg.content ? `${msg.content} \n\n*(Generation stopped by user)*` : "*(Generation stopped)*",
                }
              : msg
          )
        );
      } else {
        console.error("Stream error:", err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  isError: true,
                  content: `Jarvis encountered an error: ${err.message || "Unable to reach local AI runtime. Ensure Ollama is running."}`,
                }
              : msg
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">Jarvis AI Executive Co-Pilot</h1>
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ultra-Fast Engine
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 font-mono">
              Grounded in Real-Time Personal State · Sub-Second TTFT
            </p>
          </div>
        </div>
        {messages.length > 1 && (
          <button
            onClick={clearChat}
            disabled={streaming}
            className="text-[11px] font-mono text-neutral-400 hover:text-neutral-200 px-2.5 py-1 rounded-lg border border-neutral-800 hover:border-neutral-700 transition-colors disabled:opacity-50"
          >
            Clear History
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          const isLatestAssistant = !isUser && index === messages.length - 1;
          const isThinking = isLatestAssistant && streaming && !msg.content;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                  isUser
                    ? "bg-cyan-600 text-white"
                    : msg.isError
                    ? "bg-red-950 border border-red-800 text-red-400"
                    : "bg-neutral-800 border border-neutral-700 text-cyan-400"
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed ${
                  isUser
                    ? "bg-cyan-950/70 border border-cyan-800/80 text-white font-medium"
                    : msg.isError
                    ? "bg-red-950/40 border border-red-800/60 text-red-200"
                    : "bg-neutral-900/80 border border-neutral-800 text-neutral-200"
                }`}
              >
                {isThinking ? (
                  <div className="flex items-center gap-2.5 text-cyan-400 font-mono text-xs py-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                    </span>
                    <span>Synthesizing response...</span>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">
                      {msg.content}
                      {isLatestAssistant && streaming && (
                        <span className="inline-block w-1.5 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />
                      )}
                    </p>

                    {/* Retry button for errors */}
                    {msg.isError && lastUserPrompt && !streaming && (
                      <button
                        onClick={() => handleSend(lastUserPrompt)}
                        className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-700/60 text-xs font-medium text-red-300 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Generation</span>
                      </button>
                    )}

                    {/* Executive Latency & Telemetry Badge */}
                    {msg.metrics && (
                      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-neutral-800/60 text-[10px] font-mono text-neutral-400 select-none">
                        <span className="flex items-center gap-1 text-cyan-400 font-medium">
                          <Zap className="w-3 h-3 text-cyan-400" />
                          {msg.metrics.ttftMs ? `${(msg.metrics.ttftMs / 1000).toFixed(2)}s TTFT` : "Direct"}
                        </span>
                        {msg.metrics.tokensPerSecond && (
                          <>
                            <span className="text-neutral-600">•</span>
                            <span>{msg.metrics.tokensPerSecond} tok/s</span>
                          </>
                        )}
                        {msg.metrics.evalCount && (
                          <>
                            <span className="text-neutral-600">•</span>
                            <span>{msg.metrics.evalCount} tokens</span>
                          </>
                        )}
                        {msg.metrics.loadDurationMs !== undefined && msg.metrics.loadDurationMs < 50 && (
                          <span className="ml-auto text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
                            Warm RAM
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts (if chat is short) */}
      {messages.length <= 2 && (
        <div className="grid grid-cols-2 gap-2">
          {STARTER_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(prompt)}
              className="text-left text-xs p-2.5 rounded-xl bg-neutral-900/40 border border-neutral-800/80 hover:border-cyan-500/40 text-neutral-400 hover:text-neutral-200 transition-all truncate"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Form with Send & Stop Controls */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend(input);
        }}
        className="flex items-center gap-3 pt-2"
      >
        <input
          type="text"
          value={input}
          disabled={streaming}
          onChange={(e) => setInput(e.target.value)}
          placeholder={streaming ? "Jarvis is generating..." : "Speak to Jarvis..."}
          className="flex-1 px-4 py-3 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-100 text-sm focus:outline-none focus:border-cyan-500 font-medium disabled:opacity-50 transition-colors"
        />

        {streaming ? (
          <button
            type="button"
            onClick={handleStop}
            className="px-4 py-3 rounded-xl bg-red-950/80 hover:bg-red-900 border border-red-800/80 text-red-200 text-xs font-semibold shadow-lg shadow-red-950/20 transition-all flex items-center gap-2 shrink-0"
            title="Cancel Response Generation"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        )}
      </form>
    </div>
  );
}

