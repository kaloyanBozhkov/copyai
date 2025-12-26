import { app } from "electron";
import { setupAutoLaunch } from "./electron/autoLaunch";
import { setupTray, destroyTray, registerProcessType } from "./electron/tray";
import { setupShortcuts } from "./electron/setupShortcuts";
import { log } from "./electron/logError";
import { setupSPAListeners } from "./electron/spaListeners";
import { downloadProcessUI } from "./helpers/webtorrent/downloadMovie";
import { streamProcessUI } from "./helpers/webtorrent/streamMovie";

log("App module loaded");

app.whenReady().then(async () => {
  const isDevMode = !app.isPackaged;
  log(`App ready, isDevMode: ${isDevMode}, isPackaged: ${app.isPackaged}`);

  // Register process types for tray
  registerProcessType("download", downloadProcessUI);
  registerProcessType("stream", streamProcessUI);

  if (!isDevMode) {
    await setupAutoLaunch();
  }

  await setupTray(isDevMode);
  setupShortcuts(isDevMode);
  setupSPAListeners(isDevMode);
});

// Prevent app from quitting when all windows are closed
app.on("window-all-closed", () => {
  // Do nothing - keep app running in background
});

// Clean up on quit
app.on("will-quit", () => {
  destroyTray();
});

if (process.platform === "darwin") {
  app.dock?.hide();
}
