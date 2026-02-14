import { BrowserWindow, ipcMain } from "electron";
import path from "path";
import { discoverLights, setDeviceState, getDeviceStates } from "../helpers/wiz";
import {
  getSettings,
  setWizDevices,
  setWizGroups,
  getWizDevices,
  getWizGroups,
  WizDeviceInfo,
  WizGroup,
} from "../kitchen/grimoireSettings";

let wizWindow: BrowserWindow | null = null;

export const showWizSetup = (isDevMode = false): void => {
  if (wizWindow && !wizWindow.isDestroyed()) {
    wizWindow.focus();
    return;
  }

  wizWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
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

  setupWizSetupIPC();

  ipcMain.removeAllListeners("wiz-setup-mounted");
  ipcMain.on("wiz-setup-mounted", () => {
    if (!wizWindow || wizWindow.isDestroyed()) return;
    const settings = getSettings();
    wizWindow.webContents.send("wiz-setup-init", {
      devices: settings.wizDevices ?? [],
      groups: settings.wizGroups ?? [],
    });
  });

  wizWindow.loadFile(appPath, { query: { route: "wiz-setup" } });

  wizWindow.once("ready-to-show", () => {
    wizWindow?.show();
  });

  wizWindow.on("closed", () => {
    wizWindow = null;
    ipcMain.removeAllListeners("wiz-setup-mounted");
    cleanupWizSetupIPC();
  });
};

const setupWizSetupIPC = () => {
  ipcMain.on("wiz-setup-close", () => {
    if (wizWindow && !wizWindow.isDestroyed()) wizWindow.close();
  });

  ipcMain.on("wiz-setup-minimize", () => {
    if (wizWindow && !wizWindow.isDestroyed()) wizWindow.minimize();
  });

  ipcMain.on("wiz-setup-scan", async (event) => {
    try {
      const devices = await discoverLights();
      const deviceInfos: WizDeviceInfo[] = devices.map((d) => ({
        ip: d.ip,
        roomId: d.roomId,
        moduleName: d.moduleName,
      }));
      setWizDevices(deviceInfos);
      event.reply("wiz-setup-scan-result", deviceInfos);
    } catch (error) {
      event.reply("wiz-setup-scan-result", []);
    }
  });

  ipcMain.on("wiz-setup-save-groups", (event, groups: WizGroup[]) => {
    setWizGroups(groups);
    event.reply("wiz-setup-groups-saved", groups);
  });

  ipcMain.on("wiz-setup-get-data", (event) => {
    event.reply("wiz-setup-data", {
      devices: getWizDevices(),
      groups: getWizGroups(),
    });
  });

  ipcMain.on("wiz-setup-toggle-device", async (_event, { ip, state }: { ip: string; state: boolean }) => {
    try {
      await setDeviceState(ip, state);
    } catch (error) {
      console.error("Failed to toggle device:", error);
    }
  });

  ipcMain.on("wiz-setup-get-states", async (event, ips: string[]) => {
    try {
      const states = await getDeviceStates(ips);
      event.reply("wiz-setup-device-states", states);
    } catch {
      event.reply("wiz-setup-device-states", {});
    }
  });
};

const cleanupWizSetupIPC = () => {
  ipcMain.removeAllListeners("wiz-setup-close");
  ipcMain.removeAllListeners("wiz-setup-minimize");
  ipcMain.removeAllListeners("wiz-setup-scan");
  ipcMain.removeAllListeners("wiz-setup-save-groups");
  ipcMain.removeAllListeners("wiz-setup-get-data");
  ipcMain.removeAllListeners("wiz-setup-toggle-device");
  ipcMain.removeAllListeners("wiz-setup-get-states");
};
