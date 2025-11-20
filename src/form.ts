import { getClosestCommandKey } from "./autocomplete";
// electronInput.ts
import { BrowserWindow, ipcMain } from "electron";
import * as path from "path";
import { state } from "./state";

export async function showInput(): Promise<string> {
  let inputWindow: BrowserWindow | null = new BrowserWindow({
    width: 400,
    height: 60,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    modal: true,
    show: false,
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
    });

    // Handle autocomplete requests
    const autocompleteHandler = (
      _event: any,
      { searchValue, isTabPress }: { searchValue: string; isTabPress: boolean }
    ) => {
      const matchedResult = getClosestCommandKey(searchValue);
      inputWindow?.webContents.send("autocomplete-result", {
        ...matchedResult,
        isTabPress,
      });
    };
    ipcMain.on("autocomplete-request", autocompleteHandler);

    // Listen for value from renderer
    ipcMain.once("input-value", (_event, value) => {
      ipcMain.removeListener("autocomplete-request", autocompleteHandler);
      resolve(value);
      inputWindow?.close();
      inputWindow = null;
      state.activeWindowRef = null;
    });
  });
}
