import { ipcMain } from "electron";
import { closeActiveWindow } from "./actions";

/**
 * Listen for any events from SPA that want to control electron
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const setupSPAListeners = (_isDevMode: boolean) => {
  ipcMain.on("request-window-close", () => {
    closeActiveWindow();
  });
};
