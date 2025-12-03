import path from "path";
import { state } from "../electron/state";
import { IPCActions, sendToActiveWindow } from "../electron/actions";
import { ipcMain } from "electron";

export const browserWindowOptions: Electron.BrowserWindowConstructorOptions = {
  resizable: false,
  movable: true,
  alwaysOnTop: true,
  modal: true,
  show: false,
  frame: false,
  hasShadow: false,
  transparent: true,
  skipTaskbar: true,
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
  },
};

export const initActiveWindow = ({
  window,
  config,
}: {
  window: Electron.BrowserWindow;
  config: IPCActions["app-init"];
}): Promise<void> => {
  return new Promise((resolve) => {
    const appPath = path.join(
      __dirname,
      "..",
      "..",
      "src",
      "app",
      "dist",
      "index.html"
    );

    state.activeWindowRef = window;

    ipcMain.removeAllListeners("app-mounted");
    ipcMain.removeAllListeners("app-unmounted");

    ipcMain.once("app-mounted", () => {
      if (!state.activeWindowRef) return;
      sendToActiveWindow("app-init", config);
      state.activeWindowRef.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
      });
      state.activeWindowRef.show();
      resolve();
    });

    ipcMain.once("app-unmounted", () => {});

    window.loadFile(appPath);
    // window.webContents.openDevTools();
  });
};
