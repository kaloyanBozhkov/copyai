import { X, Trash2, Terminal, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { ConsoleLog } from "../../hooks/useConsoleLogs";
import { ActionButton } from "../atoms/ActionButton.atom";

interface LogsPanelProps {
  logs: ConsoleLog[];
  onClose: () => void;
  onClear: () => void;
}

export function LogsPanel({ logs, onClose, onClear }: LogsPanelProps) {
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

  return (
    <div className="fixed bottom-4 right-4 w-[600px] h-[400px] bg-grimoire-bg-secondary/95 backdrop-blur-sm border border-grimoire-border rounded-lg shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-grimoire-border bg-gradient-to-r from-grimoire-accent/20 to-transparent">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-grimoire-accent-bright" />
          <h3 className="font-fantasy text-sm font-semibold text-grimoire-accent-bright">
            Console Logs
          </h3>
          <span className="text-xs text-grimoire-text-dim bg-black/30 px-2 py-0.5 rounded">
            {logs.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ActionButton
            variant="ghost"
            onClick={onClear}
            icon={<Trash2 size={12} />}
            disabled={logs.length === 0}
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

      {/* Logs */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-grimoire-text-dim text-sm">
            No logs yet
          </div>
        ) : (
          logs.map((log) => (
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
          ))
        )}
      </div>
    </div>
  );
}

