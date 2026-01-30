import { useEffect, useState } from "react";
import { ipcRenderer } from "@/utils/electron";

interface WatchHistoryItem {
  title: string;
  type: "movie" | "anime";
  watchedAt: string;
}

const formatDate = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const WatchHistory = () => {
  const [items, setItems] = useState<WatchHistoryItem[]>([]);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    // Request initial data
    ipcRenderer.send("watch-history-get");

    const handleData = (_event: unknown, data: WatchHistoryItem[]) => {
      setItems(data);
    };

    ipcRenderer.on("watch-history-data", handleData);

    return () => {
      ipcRenderer.removeListener("watch-history-data", handleData);
    };
  }, []);

  const showToast = () => {
    setToast(true);
    setTimeout(() => setToast(false), 2000);
  };

  const copyAll = () => {
    const text = items.map((item) => item.title).join("\n");
    if (text) {
      navigator.clipboard.writeText(text);
      showToast();
    }
  };

  const copyItem = (title: string) => {
    navigator.clipboard.writeText(title);
    showToast();
  };

  const clearHistory = () => {
    if (confirm("Clear all watch history?")) {
      ipcRenderer.send("watch-history-clear");
    }
  };

  const closeWindow = () => {
    ipcRenderer.send("watch-history-close");
  };

  return (
    <div className="w-full flex flex-col h-screen bg-linear-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 select-text">
      {/* Header */}
      <div
        className="flex justify-between items-center px-5 py-4 bg-black/30 border-b border-white/10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <h1 className="text-lg font-semibold text-white">📺 Watch History</h1>
        <div
          className="flex gap-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={copyAll}
            className="px-3 py-1.5 bg-[#4ecdc4] text-black text-sm rounded-md hover:bg-[#45b7aa] transition-colors"
          >
            Copy All
          </button>
          <button
            onClick={clearHistory}
            className="px-3 py-1.5 bg-[#e74c3c] text-white text-sm rounded-md hover:bg-[#c0392b] transition-colors"
          >
            Clear
          </button>
          <button
            onClick={closeWindow}
            className="px-3 py-1.5 bg-white/10 text-white text-sm rounded-md hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-track-black/20 scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30">
        {items.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            No watch history yet
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              onClick={() => copyItem(item.title)}
              className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg mb-2 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <span className="text-xl w-7 text-center">
                {item.type === "anime" ? "🎌" : "🎬"}
              </span>
              <span className="flex-1 text-sm font-medium">{item.title}</span>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {formatDate(item.watchedAt)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Toast */}
      <div
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 bg-[#4ecdc4] text-black px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity duration-300 ${
          toast ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        Copied to clipboard!
      </div>
    </div>
  );
};
