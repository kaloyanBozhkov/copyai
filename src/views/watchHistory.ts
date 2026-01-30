import { BrowserWindow, ipcMain } from "electron";
import path from "path";
import { getWatchHistory, clearWatchHistory } from "../helpers/webtorrent/watchHistory";

let historyWindow: BrowserWindow | null = null;

export const showWatchHistory = (): void => {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.focus();
    return;
  }

  historyWindow = new BrowserWindow({
    width: 500,
    height: 600,
    minWidth: 400,
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
};

const cleanupWatchHistoryIPC = () => {
  ipcMain.removeAllListeners("watch-history-get");
  ipcMain.removeAllListeners("watch-history-clear");
  ipcMain.removeAllListeners("watch-history-close");
};
