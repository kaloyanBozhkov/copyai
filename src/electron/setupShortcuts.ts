import { globalShortcut } from "electron";
import {
  closeActiveWindowListener,
  showInputWindowListener,
} from "./controllers";

export const setupShortcuts = (isDevMode: boolean) => {
  const shortcuts = [
    globalShortcut.register(`CMD+D${isDevMode ? "+Shift" : ""}`, () =>
      showInputWindowListener(isDevMode)
    ),
    globalShortcut.register("Escape", closeActiveWindowListener),
  ];

  if (shortcuts.some((success) => !success)) {
    console.log("Failed to register global shortcut");
  }
};
