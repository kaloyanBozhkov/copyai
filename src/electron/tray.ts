import { app, Tray, Menu, nativeImage } from "electron";
import { join } from "path";
import { autoLauncher, getAutoLaunchEnabled } from "./autoLaunch";
import { showInputWindowListener } from "./controllers";
import { log } from "./logError";

let tray: Tray | null = null;

export const setupTray = async (isDevMode: boolean) => {
  try {
    const iconPath = isDevMode
      ? join(__dirname, "..", "..", "src", "assets", "copyai-logo.png")
      : join(process.resourcesPath, "copyai-logo.png");

    const icon = nativeImage.createFromPath(iconPath);
    const trayIcon = icon.resize({ width: 18, height: 18 });

    tray = new Tray(trayIcon);
    tray.setToolTip("CopyAI");

    const isAutoLaunchEnabled = getAutoLaunchEnabled();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Open CopyAI",
        click: () => showInputWindowListener(isDevMode),
      },
      { type: "separator" },
      {
        label: "Launch at Login",
        type: "checkbox",
        checked: isAutoLaunchEnabled,
        click: (menuItem) => {
          try {
            if (menuItem.checked) {
              autoLauncher.enable();
            } else {
              autoLauncher.disable();
            }
          } catch (error) {
            log(`Failed to toggle auto-launch: ${error}`);
            menuItem.checked = !menuItem.checked;
          }
        },
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => app.quit(),
      },
    ]);

    tray.setContextMenu(contextMenu);
  } catch (error) {
    log(`setupTray error: ${error}`);
  }
};

export const destroyTray = () => {
  tray?.destroy();
};
