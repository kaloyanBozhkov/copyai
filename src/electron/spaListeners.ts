import { ipcMain } from "electron";
import { closeActiveWindow } from "./actions";

/**
 * Listen for any events from SPA that want to control electron
 */
export const setupSPAListeners = (isDevMode: boolean) => {
  ipcMain.on("request-window-close", () => {
    closeActiveWindow();
  });
};
