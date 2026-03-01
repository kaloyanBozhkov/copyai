import { useState, useRef, useEffect, useCallback } from "react";
import { X, Trash2, Terminal, AlertCircle, Info, AlertTriangle, ChevronRight } from "lucide-react";
import { ConsoleLog } from "../../hooks/useConsoleLogs";
import { ActionButton } from "../atoms/ActionButton.atom";
import { ipcRenderer } from "@/utils/electron";

interface ReplEntry {
  id: string;
  type: "input" | "output" | "error";
  message: string;
  timestamp: number;
}

interface LogsPanelProps {
  logs: ConsoleLog[];
  onClose: () => void;
  onClear: () => void;
}

let replIdCounter = 0;

export function LogsPanel({ logs, onClose, onClear }: LogsPanelProps) {
  const [replInput, setReplInput] = useState("");
  const [replEntries, setReplEntries] = useState<ReplEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs/repl entries appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, replEntries]);

  const handleEval = useCallback(async (code: string) => {
    if (!code.trim()) return;

    const inputEntry: ReplEntry = {
      id: `repl-${replIdCounter++}`,
      type: "input",
      message: code,
      timestamp: Date.now(),
    };

    setReplEntries((prev) => [...prev, inputEntry]);
    setHistory((prev) => [code, ...prev]);
    setHistoryIndex(-1);
    setReplInput("");
    setIsEvaluating(true);

    // Listen for result
    const handler = (_: unknown, data: { success: boolean; result?: string; error?: string }) => {
      const outputEntry: ReplEntry = {
        id: `repl-${replIdCounter++}`,
        type: data.success ? "output" : "error",
        message: data.success ? (data.result ?? "undefined") : (data.error ?? "Unknown error"),
        timestamp: Date.now(),
      };
      setReplEntries((prev) => [...prev, outputEntry]);
      setIsEvaluating(false);
    };

    ipcRenderer.once("grimoire-eval-result", handler);
    ipcRenderer.send("grimoire-eval", code);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleEval(replInput);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (history.length > 0) {
          const newIndex = Math.min(historyIndex + 1, history.length - 1);
          setHistoryIndex(newIndex);
          setReplInput(history[newIndex]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setReplInput(history[newIndex]);
        } else {
          setHistoryIndex(-1);
          setReplInput("");
        }
      }
    },
    [replInput, history, historyIndex, handleEval]
  );

  const handleClearAll = useCallback(() => {
    onClear();
    setReplEntries([]);
  }, [onClear]);

  const getLogIcon = (type: ConsoleLog["type"]) => {
    switch (type) {
      case "error":
        return <AlertCircle size={12} className="text-grimoire-red" />;
      case "warn":
        return <AlertTriangle size={12} className="text-grimoire-gold" />;
      case "info":
        return <Info size={12} className="text-grimoire-accent-bright" />;
      default:
        return <Terminal size={12} className="text-grimoire-text-dim" />;
    }
  };

  const getLogColor = (type: ConsoleLog["type"]) => {
    switch (type) {
      case "error":
        return "text-grimoire-red";
      case "warn":
        return "text-grimoire-gold";
      case "info":
        return "text-grimoire-accent-bright";
      default:
        return "text-grimoire-text";
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const ms = date.getMilliseconds().toString().padStart(3, "0");
    return `${time}.${ms}`;
  };

  // Merge logs and repl entries into a single timeline
  const allEntries: Array<{ kind: "log"; data: ConsoleLog } | { kind: "repl"; data: ReplEntry }> = [
    ...logs.map((l) => ({ kind: "log" as const, data: l })),
    ...replEntries.map((r) => ({ kind: "repl" as const, data: r })),
  ].sort((a, b) => a.data.timestamp - b.data.timestamp);

  return (
    <div className="fixed bottom-4 right-4 w-[600px] h-[400px] bg-grimoire-bg-secondary/95 backdrop-blur-sm border border-grimoire-border rounded-lg shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-grimoire-border bg-gradient-to-r from-grimoire-accent/20 to-transparent">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-grimoire-accent-bright" />
          <h3 className="font-fantasy text-sm font-semibold text-grimoire-accent-bright">
            Console
          </h3>
          <span className="text-xs text-grimoire-text-dim bg-black/30 px-2 py-0.5 rounded">
            {logs.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            variant="ghost"
            onClick={handleClearAll}
            icon={<Trash2 size={12} />}
            disabled={logs.length === 0 && replEntries.length === 0}
          >
            Clear
          </ActionButton>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 text-grimoire-text-dim hover:text-grimoire-text transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Logs + REPL output */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {allEntries.length === 0 ? (
          <div className="flex items-center justify-center h-full text-grimoire-text-dim text-sm">
            No logs yet &mdash; type JS below to evaluate in the main process
          </div>
        ) : (
          allEntries.map((entry) => {
            if (entry.kind === "log") {
              const log = entry.data;
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 px-2 py-1.5 bg-black/20 rounded hover:bg-black/30 transition-colors font-mono text-xs"
                >
                  <span className="text-grimoire-text-dim/50 flex-shrink-0 mt-0.5">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  <div className="flex-shrink-0 mt-0.5">{getLogIcon(log.type)}</div>
                  {log.source === "main" && (
                    <span className="flex-shrink-0 text-grimoire-accent-bright/60 text-[10px] bg-grimoire-accent/10 px-1.5 py-0.5 rounded mt-0.5">
                      MAIN
                    </span>
                  )}
                  <pre className={`flex-1 whitespace-pre-wrap break-words ${getLogColor(log.type)}`}>
                    {log.message}
                  </pre>
                </div>
              );
            }

            // REPL entry
            const repl = entry.data;
            if (repl.type === "input") {
              return (
                <div
                  key={repl.id}
                  className="flex items-start gap-2 px-2 py-1.5 font-mono text-xs"
                >
                  <span className="text-grimoire-text-dim/50 flex-shrink-0 mt-0.5">
                    {formatTimestamp(repl.timestamp)}
                  </span>
                  <ChevronRight size={12} className="text-grimoire-accent-bright flex-shrink-0 mt-0.5" />
                  <pre className="flex-1 whitespace-pre-wrap break-words text-grimoire-accent-bright">
                    {repl.message}
                  </pre>
                </div>
              );
            }

            return (
              <div
                key={repl.id}
                className={`flex items-start gap-2 px-2 py-1.5 font-mono text-xs ${
                  repl.type === "error" ? "bg-grimoire-red/10" : "bg-grimoire-accent/5"
                } rounded`}
              >
                <span className="text-grimoire-text-dim/50 flex-shrink-0 mt-0.5">
                  {formatTimestamp(repl.timestamp)}
                </span>
                <span className={`flex-shrink-0 mt-0.5 ${repl.type === "error" ? "text-grimoire-red" : "text-grimoire-gold"}`}>
                  {repl.type === "error" ? "✕" : "←"}
                </span>
                <pre className={`flex-1 whitespace-pre-wrap break-words ${
                  repl.type === "error" ? "text-grimoire-red" : "text-grimoire-gold"
                }`}>
                  {repl.message}
                </pre>
              </div>
            );
          })
        )}
      </div>

      {/* REPL Input */}
      <div className="border-t border-grimoire-border px-3 py-2 flex items-center gap-2 bg-black/30">
        <ChevronRight size={14} className="text-grimoire-accent-bright flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={replInput}
          onChange={(e) => setReplInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Evaluate JS in main process... (e.g. process.env.NODE_ENV)"
          disabled={isEvaluating}
          className="flex-1 bg-transparent text-grimoire-text font-mono text-xs outline-none placeholder:text-grimoire-text-dim/40 disabled:opacity-50"
          autoFocus
          spellCheck={false}
        />
        {isEvaluating && (
          <div className="w-3 h-3 border-2 border-grimoire-accent-bright/40 border-t-grimoire-accent-bright rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
}

