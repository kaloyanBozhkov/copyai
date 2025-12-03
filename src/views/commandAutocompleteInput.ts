import { getClosestCommandKey } from "../kitchen/autocomplete";
import { BrowserWindow, ipcMain } from "electron";
import { state } from "../electron/state";
import { browserWindowOptions, initActiveWindow } from "./common";
import { sendToActiveWindow } from "../electron/actions";

export async function showCommandAutocompleteInput(
  isDevMode = false
): Promise<string> {
  const inputWindow = new BrowserWindow({
    ...browserWindowOptions,
    width: 500,
    height: 200,
  });

  await initActiveWindow({
    window: inputWindow,
    config: {
      route: "command-input",
      isDevMode,
    },
  });

  // wait for user command + arg input and resolve with user input
  return new Promise((resolve) => {
    let isClosing = false;

    // Handle mouse enter/leave for click-through
    const mouseEnterHandler = () => {
      if (!inputWindow || inputWindow.isDestroyed() || isClosing) return;
      inputWindow.setIgnoreMouseEvents(false);
    };
    const mouseLeaveHandler = () => {
      if (!inputWindow || inputWindow.isDestroyed() || isClosing) return;
      inputWindow.setIgnoreMouseEvents(true, { forward: true });
    };
    ipcMain.on("mouse-enter", mouseEnterHandler);
    ipcMain.on("mouse-leave", mouseLeaveHandler);

    // Handle autocomplete requests
    const autocompleteHandler = (
      _event: Electron.IpcMainEvent,
      { searchValue, isTabPress }: { searchValue: string; isTabPress: boolean }
    ) => {
      if (!inputWindow || inputWindow.isDestroyed() || isClosing) return;
      const matchedResult = getClosestCommandKey(searchValue);
      sendToActiveWindow("autocomplete-result", {
        ...matchedResult,
        isTabPress,
      });
    };
    ipcMain.on("autocomplete-request", autocompleteHandler);

    // Listen for value from renderer
    ipcMain.once("input-value", (_event, value) => {
      isClosing = true;
      ipcMain.removeListener("autocomplete-request", autocompleteHandler);
      ipcMain.removeListener("mouse-enter", mouseEnterHandler);
      ipcMain.removeListener("mouse-leave", mouseLeaveHandler);

      if (inputWindow && !inputWindow.isDestroyed()) {
        inputWindow.once("closed", () => {
          state.activeWindowRef = null;
          resolve(value);
        });
        inputWindow.close();
      } else {
        state.activeWindowRef = null;
        resolve(value);
      }
    });

    // Start with click-through enabled
    inputWindow.setIgnoreMouseEvents(true, { forward: true });
  });
}
