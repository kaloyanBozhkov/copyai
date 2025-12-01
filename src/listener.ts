import { app, globalShortcut } from "electron";
import {
  closeActiveWindowListener,
  showInputWindowListener,
} from "./procedures";

// Detect if Electron was started via `npm start`
const isDevMode = process.env.NODE_ENV !== "production";

app.whenReady().then(() => {
  const shortcuts = [
    globalShortcut.register(`CMD+D${isDevMode ? "+Shift" : ""}`, () =>
      showInputWindowListener(isDevMode)
    ),
    globalShortcut.register("Escape", closeActiveWindowListener),
  ];

  if (shortcuts.some((success) => !success)) {
    console.log("Failed to register global shortcut");
  }
});

// Prevent app from quitting when all windows are closed
app.on("window-all-closed", () => {
  // Do nothing - keep app running in background
});

// Clean up on quit
app.on("will-quit", () => {});

if (process.platform === "darwin") {
  app.dock?.hide();
}
