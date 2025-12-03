import { app } from "electron";
import { log } from "./logError";

export const autoLauncher = {
  isEnabled: () => {
    const settings = app.getLoginItemSettings({
      path: app.getPath("exe"),
    });
    return settings.openAtLogin;
  },
  enable: () => {
    app.setLoginItemSettings({ openAtLogin: true, path: app.getPath("exe") });
    log("Auto-launch enabled");
    log("Settings: ", getAutoLaunchEnabled());
  },
  disable: () => {
    app.setLoginItemSettings({ openAtLogin: false, path: app.getPath("exe") });
    log("Auto-launch disabled");
  },
};

export const setupAutoLaunch = () => {
  try {
    const isEnabled = autoLauncher.isEnabled();
    log(`Auto-launch check - enabled: ${isEnabled}`);
    if (!isEnabled) {
      autoLauncher.enable();
    }
  } catch (error) {
    log(`Auto-launch setup failed: ${error}`);
  }
};

export const getAutoLaunchEnabled = () => {
  let isAutoLaunchEnabled = false;
  try {
    isAutoLaunchEnabled = autoLauncher.isEnabled();
  } catch {
    log("Could not check auto-launch status");
  }

  return isAutoLaunchEnabled;
};
