import { getClosestCommandKey } from "./autocomplete";
// electronInput.ts
import { BrowserWindow, ipcMain, app } from "electron";
import * as path from "path";
import { state } from "./state";

export async function showInput(isDevMode = false): Promise<string> {
  let inputWindow: BrowserWindow | null = new BrowserWindow({
    width: 500,
    height: 200,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    modal: true,
    show: false,
    frame: false,
    hasShadow: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  state.activeWindowRef = inputWindow;

  return new Promise((resolve) => {
    if (!inputWindow) {
      throw Error("Failed to create input window");
    }

    inputWindow.loadFile(path.join(__dirname, "..", "src", "form.html"));

    // Show window when ready
    inputWindow.once("ready-to-show", () => {
      inputWindow?.show();
      inputWindow?.webContents.send("env-config", {
        isDevMode,
      });
    });

    // Handle mouse enter/leave for click-through
    const mouseEnterHandler = () => {
      if (!inputWindow || inputWindow.isDestroyed()) return;
      inputWindow.setIgnoreMouseEvents(false);
    };
    const mouseLeaveHandler = () => {
      if (!inputWindow || inputWindow.isDestroyed()) return;
      inputWindow.setIgnoreMouseEvents(true, { forward: true });
    };
    ipcMain.on("mouse-enter", mouseEnterHandler);
    ipcMain.on("mouse-leave", mouseLeaveHandler);

    // Handle autocomplete requests
    const autocompleteHandler = (
      _event: any,
      { searchValue, isTabPress }: { searchValue: string; isTabPress: boolean }
    ) => {
      if (!inputWindow || inputWindow.isDestroyed()) return;
      const matchedResult = getClosestCommandKey(searchValue);
      inputWindow.webContents.send("autocomplete-result", {
        ...matchedResult,
        isTabPress,
      });
    };
    ipcMain.on("autocomplete-request", autocompleteHandler);

    // Listen for value from renderer
    ipcMain.once("input-value", (_event, value) => {
      ipcMain.removeListener("autocomplete-request", autocompleteHandler);
      ipcMain.removeListener("mouse-enter", mouseEnterHandler);
      ipcMain.removeListener("mouse-leave", mouseLeaveHandler);
      resolve(value);
      state.activeWindowRef = null;
      inputWindow?.close();
      inputWindow = null;
    });

    // Start with click-through enabled
    inputWindow.setIgnoreMouseEvents(true, { forward: true });
  });
}
