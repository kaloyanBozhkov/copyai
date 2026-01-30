import { BrowserWindow, ipcMain } from "electron";
import { getWatchHistory, clearWatchHistory, WatchHistoryItem } from "../kitchen/watchHistory";

let historyWindow: BrowserWindow | null = null;

const buildHistoryHTML = (items: WatchHistoryItem[]): string => {
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

  const itemsHTML = items.length === 0
    ? '<div class="empty">No watch history yet</div>'
    : items
        .map(
          (item, idx) => `
        <div class="item" data-index="${idx}">
          <span class="type ${item.type}">${item.type === "anime" ? "🎌" : "🎬"}</span>
          <span class="title">${item.title}</span>
          <span class="date">${formatDate(item.watchedAt)}</span>
        </div>`
        )
        .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Watch History</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: text;
    }
    .header {
      padding: 16px 20px;
      background: rgba(0,0,0,0.3);
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      -webkit-app-region: drag;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
      color: #fff;
    }
    .header-buttons {
      display: flex;
      gap: 8px;
      -webkit-app-region: no-drag;
    }
    .btn {
      padding: 6px 12px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }
    .btn-copy {
      background: #4ecdc4;
      color: #000;
    }
    .btn-copy:hover { background: #45b7aa; }
    .btn-clear {
      background: #e74c3c;
      color: #fff;
    }
    .btn-clear:hover { background: #c0392b; }
    .btn-close {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }
    .btn-close:hover { background: rgba(255,255,255,0.2); }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .content::-webkit-scrollbar { width: 8px; }
    .content::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    .content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
    .content::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
    .item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      margin-bottom: 8px;
      transition: background 0.2s;
    }
    .item:hover { background: rgba(255,255,255,0.1); }
    .type {
      font-size: 20px;
      width: 28px;
      text-align: center;
    }
    .title {
      flex: 1;
      font-size: 14px;
      font-weight: 500;
    }
    .date {
      font-size: 12px;
      color: #888;
      white-space: nowrap;
    }
    .empty {
      text-align: center;
      padding: 40px;
      color: #666;
      font-size: 14px;
    }
    .copied-toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4ecdc4;
      color: #000;
      padding: 10px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .copied-toast.show { opacity: 1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📺 Watch History</h1>
    <div class="header-buttons">
      <button class="btn btn-copy" onclick="copyAll()">Copy All</button>
      <button class="btn btn-clear" onclick="clearHistory()">Clear</button>
      <button class="btn btn-close" onclick="closeWindow()">Close</button>
    </div>
  </div>
  <div class="content" id="content">
    ${itemsHTML}
  </div>
  <div class="copied-toast" id="toast">Copied to clipboard!</div>
  <script>
    const { ipcRenderer } = require('electron');
    
    function copyAll() {
      const items = document.querySelectorAll('.item .title');
      const text = Array.from(items).map(el => el.textContent).join('\\n');
      if (text) {
        navigator.clipboard.writeText(text);
        showToast();
      }
    }
    
    function clearHistory() {
      if (confirm('Clear all watch history?')) {
        ipcRenderer.send('watch-history-clear');
      }
    }
    
    function closeWindow() {
      ipcRenderer.send('watch-history-close');
    }
    
    function showToast() {
      const toast = document.getElementById('toast');
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
    
    // Double-click to copy single item
    document.querySelectorAll('.item').forEach(item => {
      item.addEventListener('dblclick', () => {
        const title = item.querySelector('.title').textContent;
        navigator.clipboard.writeText(title);
        showToast();
      });
    });
  </script>
</body>
</html>`;
};

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

  const items = getWatchHistory();
  historyWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildHistoryHTML(items))}`
  );

  // IPC handlers
  ipcMain.once("watch-history-close", () => {
    if (historyWindow && !historyWindow.isDestroyed()) {
      historyWindow.close();
    }
  });

  ipcMain.once("watch-history-clear", () => {
    clearWatchHistory();
    if (historyWindow && !historyWindow.isDestroyed()) {
      const items = getWatchHistory();
      historyWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(buildHistoryHTML(items))}`
      );
    }
  });

  historyWindow.on("closed", () => {
    historyWindow = null;
    ipcMain.removeAllListeners("watch-history-close");
    ipcMain.removeAllListeners("watch-history-clear");
  });
};
