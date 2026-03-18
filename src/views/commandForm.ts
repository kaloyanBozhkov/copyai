import path from "path";
import { BrowserWindow, ipcMain } from "electron";

export interface FormField {
  name: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  defaultValue?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

/**
 * Show a form window and await user input.
 * Creates a standalone window that doesn't interfere with the processing window.
 *
 * Returns the form values as a Record, or null if cancelled.
 */
export async function showCommandFormWindow(
  title: string,
  fields: FormField[]
): Promise<Record<string, string> | null> {
  const height = 140 + fields.length * 70;

  const formWindow = new BrowserWindow({
    width: 450,
    height: Math.min(height, 500),
    resizable: false,
    alwaysOnTop: true,
    show: false,
    frame: false,
    hasShadow: false,
    transparent: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const appPath = path.join(
    __dirname,
    "..",
    "..",
    "src",
    "app",
    "dist",
    "index.html"
  );

  console.log("[Form] Creating form window...");

  await new Promise<void>((resolve) => {
    formWindow.webContents.once("did-finish-load", () => {
      console.log("[Form] did-finish-load fired");
      setTimeout(() => {
        console.log("[Form] Sending app-init");
        formWindow.webContents.send("app-init", { route: "command-form" });
        setTimeout(() => {
          console.log("[Form] Sending command-form-init");
          formWindow.webContents.send("command-form-init", { title, fields });
          formWindow.show();
          formWindow.focus();
          console.log("[Form] Window shown");
          resolve();
        }, 300);
      }, 300);
    });

    formWindow.on("closed", () => {
      console.log("[Form] Window was closed!");
    });

    formWindow.loadFile(appPath);
  });

  formWindow.setIgnoreMouseEvents(true, { forward: true });

  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (val: Record<string, string> | null) => {
      if (resolved) return;
      resolved = true;
      ipcMain.removeListener("form-mouse-enter", formMouseEnterHandler);
      ipcMain.removeListener("form-mouse-leave", formMouseLeaveHandler);
      ipcMain.removeListener("command-form-submit", submitHandler);
      // Close window after resolving
      if (formWindow && !formWindow.isDestroyed()) formWindow.close();
      resolve(val);
    };

    const formMouseEnterHandler = () => {
      if (!formWindow.isDestroyed()) formWindow.setIgnoreMouseEvents(false);
    };
    const formMouseLeaveHandler = () => {
      if (!formWindow.isDestroyed())
        formWindow.setIgnoreMouseEvents(true, { forward: true });
    };
    const submitHandler = (
      _event: Electron.IpcMainEvent,
      values: Record<string, string> | null
    ) => {
      console.log("[Form] Submit received:", values ? "with values" : "null");
      safeResolve(values);
    };

    ipcMain.on("form-mouse-enter", formMouseEnterHandler);
    ipcMain.on("form-mouse-leave", formMouseLeaveHandler);
    ipcMain.once("command-form-submit", submitHandler);
    formWindow.on("closed", () => safeResolve(null));
  });
}
