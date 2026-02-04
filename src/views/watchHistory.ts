import { BrowserWindow, ipcMain } from "electron";
import path from "path";
import { getWatchHistory, clearWatchHistory } from "../helpers/webtorrent/watchHistory";
import { cmdKitchen } from "../kitchen/cmdKitchen";

let historyWindow: BrowserWindow | null = null;

export const showWatchHistory = (): void => {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }

  historyWindow = new BrowserWindow({
    width: 700,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    resizable: true,
    movable: true,
    frame: false,
    transparent: false,
    hasShadow: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const appPath = path.join(
    __dirname,
    "..",
    "..",
    "src",
    "app",
    "dist",
    "index.html"
  );

  // Setup IPC handlers
  setupWatchHistoryIPC();

  historyWindow.loadFile(appPath, { query: { route: "watch-history" } });

  historyWindow.once("ready-to-show", () => {
    historyWindow?.show();
  });

  historyWindow.on("closed", () => {
    historyWindow = null;
    cleanupWatchHistoryIPC();
  });
};

const setupWatchHistoryIPC = () => {
  ipcMain.on("watch-history-get", (event) => {
    const items = getWatchHistory();
    event.reply("watch-history-data", items);
  });

  ipcMain.on("watch-history-clear", (event) => {
    clearWatchHistory();
    const items = getWatchHistory();
    event.reply("watch-history-data", items);
  });

  ipcMain.on("watch-history-close", () => {
    if (historyWindow && !historyWindow.isDestroyed()) {
      historyWindow.close();
    }
  });

  ipcMain.on(
    "watch-history-play",
    async (
      _event,
      {
        title,
        type,
        target,
      }: { title: string; type: "movie" | "anime"; target: "tv" | "laptop" }
    ) => {
      // Build command key based on type and target
      const commandKey =
        target === "tv"
          ? type === "anime"
            ? "tv.anime_stream"
            : "tv.movie_stream"
          : type === "anime"
            ? "laptop.anime_stream"
            : "laptop.movie_stream";

      console.log(`[Watch History] Playing "${title}" via ${commandKey}`);
      try {
        const result = await cmdKitchen(commandKey, [title]);
        console.log(`[Watch History] Command result:`, result);
      } catch (error) {
        console.error(`[Watch History] Command failed:`, error);
      }
    }
  );
};

const cleanupWatchHistoryIPC = () => {
  ipcMain.removeAllListeners("watch-history-get");
  ipcMain.removeAllListeners("watch-history-clear");
  ipcMain.removeAllListeners("watch-history-close");
  ipcMain.removeAllListeners("watch-history-play");
};
