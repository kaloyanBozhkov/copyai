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

// Check if title has episode pattern (e01, s01e01, episode 1, etc.)
const hasEpisode = (title: string): boolean => {
  return /(?:e|ep|episode\s*)\d{1,4}/i.test(title);
};

// Increment episode in title
const getNextEpisodeTitle = (title: string): string => {
  const episodeMatch = title.match(/(?:e|ep|episode\s*)(\d{1,4})/i);
  if (!episodeMatch) return title;
  
  const currentEp = parseInt(episodeMatch[1], 10);
  const newEp = currentEp + 1;
  const newEpStr = newEp.toString().padStart(episodeMatch[1].length, "0");
  
  return title.replace(/(?:e|ep|episode\s*)\d{1,4}/i, (match) => {
    return match.replace(/\d+/, newEpStr);
  });
};

export const WatchHistory = () => {
  const [items, setItems] = useState<WatchHistoryItem[]>([]);
  const [toast, setToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Copied to clipboard!");

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

  const showToast = (message = "Copied to clipboard!") => {
    setToastMessage(message);
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

  const playOnTV = (item: WatchHistoryItem) => {
    ipcRenderer.send("watch-history-play", { title: item.title, type: item.type, target: "tv" });
    showToast("Starting on TV...");
  };

  const playOnLaptop = (item: WatchHistoryItem) => {
    ipcRenderer.send("watch-history-play", { title: item.title, type: item.type, target: "laptop" });
    showToast("Starting on Laptop...");
  };

  const playNextEpisode = (item: WatchHistoryItem, target: "tv" | "laptop") => {
    const nextTitle = getNextEpisodeTitle(item.title);
    ipcRenderer.send("watch-history-play", { title: nextTitle, type: item.type, target });
    showToast(`Starting ${nextTitle}...`);
  };

  return (
    <div className="w-full flex flex-col h-screen bg-linear-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 select-text pointer-events-auto">
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
              className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg mb-2 hover:bg-white/10 transition-colors"
            >
              <span className="text-xl w-7 text-center">
                {item.type === "anime" ? "🎌" : "🎬"}
              </span>
              <span 
                className="flex-1 text-sm font-medium cursor-pointer hover:text-white"
                onClick={() => copyItem(item.title)}
                title="Click to copy"
              >
                {item.title}
              </span>
              
              {/* Action buttons */}
              <div className="flex items-center gap-1.5">
                {/* Next Episode buttons (only if has episode) */}
                {hasEpisode(item.title) && (
                  <div className="flex items-center gap-1 mr-2 border-r border-white/10 pr-2">
                    <span className="text-xs text-gray-500 mr-1">Next:</span>
                    <button
                      onClick={() => playNextEpisode(item, "tv")}
                      className="p-1.5 bg-purple-600/50 hover:bg-purple-600 rounded text-xs transition-colors"
                      title="Next episode on TV"
                    >
                      📺
                    </button>
                    <button
                      onClick={() => playNextEpisode(item, "laptop")}
                      className="p-1.5 bg-purple-600/50 hover:bg-purple-600 rounded text-xs transition-colors"
                      title="Next episode on Laptop"
                    >
                      💻
                    </button>
                  </div>
                )}
                
                {/* Play buttons */}
                <button
                  onClick={() => playOnTV(item)}
                  className="p-1.5 bg-blue-600/50 hover:bg-blue-600 rounded text-xs transition-colors"
                  title="Play on TV"
                >
                  📺
                </button>
                <button
                  onClick={() => playOnLaptop(item)}
                  className="p-1.5 bg-green-600/50 hover:bg-green-600 rounded text-xs transition-colors"
                  title="Play on Laptop"
                >
                  💻
                </button>
              </div>
              
              <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
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
        {toastMessage}
      </div>
    </div>
  );
};
