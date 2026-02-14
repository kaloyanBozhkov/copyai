import { BrowserWindow, ipcMain } from "electron";
import path from "path";
import { setDeviceState, getDeviceStates } from "../helpers/wiz";
import { getWizDevices, getWizGroups } from "../kitchen/grimoireSettings";

let controlWindow: BrowserWindow | null = null;

export const showWizControl = (): void => {
  if (controlWindow && !controlWindow.isDestroyed()) {
    controlWindow.focus();
    return;
  }

  controlWindow = new BrowserWindow({
    width: 480,
    height: 520,
    minWidth: 360,
    minHeight: 300,
    resizable: true,
    movable: true,
    frame: false,
    transparent: false,
    hasShadow: true,
    vibrancy: "under-window",
    visualEffectState: "active",
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

  setupWizControlIPC();

  ipcMain.removeAllListeners("wiz-control-mounted");
  ipcMain.on("wiz-control-mounted", () => {
    if (!controlWindow || controlWindow.isDestroyed()) return;
    controlWindow.webContents.send("wiz-control-init", {
      devices: getWizDevices(),
      groups: getWizGroups(),
    });
  });

  controlWindow.loadFile(appPath, { query: { route: "wiz-control" } });

  controlWindow.once("ready-to-show", () => {
    controlWindow?.show();
  });

  controlWindow.on("closed", () => {
    controlWindow = null;
    ipcMain.removeAllListeners("wiz-control-mounted");
    cleanupWizControlIPC();
  });
};

const setupWizControlIPC = () => {
  ipcMain.on("wiz-control-close", () => {
    if (controlWindow && !controlWindow.isDestroyed()) controlWindow.close();
  });

  ipcMain.on("wiz-control-minimize", () => {
    if (controlWindow && !controlWindow.isDestroyed()) controlWindow.minimize();
  });

  ipcMain.on("wiz-control-toggle", async (_event, { ip, state }: { ip: string; state: boolean }) => {
    try {
      await setDeviceState(ip, state);
    } catch (error) {
      console.error("Failed to toggle device:", error);
    }
  });

  ipcMain.on("wiz-control-toggle-group", async (_event, { ips, state }: { ips: string[]; state: boolean }) => {
    try {
      await Promise.all(ips.map((ip) => setDeviceState(ip, state)));
    } catch (error) {
      console.error("Failed to toggle group:", error);
    }
  });

  ipcMain.on("wiz-control-get-states", async (event, ips: string[]) => {
    try {
      const states = await getDeviceStates(ips);
      event.reply("wiz-control-device-states", states);
    } catch {
      event.reply("wiz-control-device-states", {});
    }
  });
};

const cleanupWizControlIPC = () => {
  ipcMain.removeAllListeners("wiz-control-close");
  ipcMain.removeAllListeners("wiz-control-minimize");
  ipcMain.removeAllListeners("wiz-control-toggle");
  ipcMain.removeAllListeners("wiz-control-toggle-group");
  ipcMain.removeAllListeners("wiz-control-get-states");
};
