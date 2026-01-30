import fs from "fs";
import path from "path";
import os from "os";

const HISTORY_FILE = path.join(os.homedir(), ".copyai-watch-history.json");

export interface WatchHistoryItem {
  title: string;
  type: "movie" | "anime";
  watchedAt: string; // ISO date string
}

interface WatchHistory {
  items: WatchHistoryItem[];
}

let historyCache: WatchHistoryItem[] | null = null;

const loadHistory = (): WatchHistoryItem[] => {
  if (historyCache) return historyCache;

  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      const parsed: WatchHistory = JSON.parse(data);
      historyCache = parsed.items || [];
      return historyCache;
    }
  } catch (error) {
    console.error("Failed to load watch history:", error);
  }

  historyCache = [];
  return historyCache;
};

const saveHistory = (items: WatchHistoryItem[]): void => {
  try {
    const data: WatchHistory = { items };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf-8");
    historyCache = items;
  } catch (error) {
    console.error("Failed to save watch history:", error);
  }
};

export const addToWatchHistory = (
  title: string,
  type: "movie" | "anime"
): void => {
  const history = loadHistory();

  // Remove if same title already exists
  const filtered = history.filter(
    (item) => item.title.toLowerCase() !== title.toLowerCase()
  );

  // Add to front with timestamp
  const newHistory: WatchHistoryItem[] = [
    { title, type, watchedAt: new Date().toISOString() },
    ...filtered,
  ];

  saveHistory(newHistory);
};

export const getWatchHistory = (): WatchHistoryItem[] => {
  return loadHistory();
};

export const clearWatchHistory = (): void => {
  saveHistory([]);
  historyCache = [];
};
