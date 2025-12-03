import { BrowserWindow } from "electron";
import { browserWindowOptions, initActiveWindow } from "./common";
import { sendToActiveWindow } from "../electron/actions";

type UnmountCallback = () => void;

export async function showProcessingCommandView(
  isDevMode = false
): Promise<UnmountCallback> {
  console.log("Creating processing window...");
  const window = new BrowserWindow({
    ...browserWindowOptions,
    width: 500,
    height: 200,
  });

  window.setIgnoreMouseEvents(true);

  await initActiveWindow({
    window,
    config: {
      route: "processing-command",
      isDevMode,
    },
  });

  return () => {
    sendToActiveWindow("command-processing-completed", void 0);
  };
}
