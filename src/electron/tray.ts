import { app, Tray, Menu, nativeImage } from "electron";
import { join } from "path";
import { autoLauncher, getAutoLaunchEnabled } from "./autoLaunch";
import { showInputWindowListener } from "./controllers";
import { showCommandBrowser } from "../views/commandBrowser";
import { log } from "./logError";
import type { DownloadProcess } from "../helpers/webtorrent/downloadMovie";
import type { StreamProcess } from "../helpers/webtorrent/streamMovie";

let tray: Tray | null = null;
let isDevMode = false;
let updateInterval: NodeJS.Timeout | null = null;

// Union type of all possible active processes
export type ActiveProcess = DownloadProcess | StreamProcess;

// Registry of process type handlers
interface ProcessTypeHandler<T extends ActiveProcess = ActiveProcess> {
  getLabel: (process: T) => string;
  onClick: (process: T) => boolean; // returns true if should terminate
  onTerminate?: (process: T) => void; // optional cleanup on termination
}

const processTypeRegistry: Record<string, ProcessTypeHandler> = {};

// Register a process type handler
export const registerProcessType = <T extends ActiveProcess>(
  type: string,
  handler: ProcessTypeHandler<T>
) => {
  processTypeRegistry[type] = handler as ProcessTypeHandler;
};

let activeProcesses: Map<string, ActiveProcess> = new Map();

const updateTrayMenu = () => {
  if (!tray) return;

  const isAutoLaunchEnabled = getAutoLaunchEnabled();

  const processMenuItems = Array.from(activeProcesses.values()).map((process) => {
    const handler = processTypeRegistry[process.type];
    
    if (!handler) {
      log(`No handler found for process type: ${process.type}`);
      return null;
    }

    return {
      label: handler.getLabel(process),
      click: () => {
        const shouldTerminate = handler.onClick(process);
        if (shouldTerminate) {
          process.cleanup();
          // Call onTerminate callback if provided
          if (handler.onTerminate) {
            handler.onTerminate(process);
          }
          removeActiveProcess(process.id);
        }
      },
    };
  }).filter(Boolean);

  const menuTemplate: any[] = [
    {
      label: "Open CopyAI",
      click: () => showInputWindowListener(isDevMode),
    },
    {
      label: "Command Grimoire",
      click: () => showCommandBrowser(isDevMode),
    },
  ];

  if (processMenuItems.length > 0) {
    menuTemplate.push({ type: "separator" });
    menuTemplate.push(...processMenuItems);
  }

  menuTemplate.push(
    { type: "separator" },
    {
      label: "Launch at Login",
      type: "checkbox",
      checked: isAutoLaunchEnabled,
      click: (menuItem: any) => {
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
    }
  );

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);
};

export const setupTray = async (devMode: boolean) => {
  isDevMode = devMode;
  try {
    const iconPath = isDevMode
      ? join(__dirname, "..", "..", "src", "assets", "copyai-logo.png")
      : join(process.resourcesPath, "copyai-logo.png");

    const icon = nativeImage.createFromPath(iconPath);
    const trayIcon = icon.resize({ width: 18, height: 18 });

    tray = new Tray(trayIcon);
    tray.setToolTip("CopyAI");

    updateTrayMenu();
  } catch (error) {
    log(`setupTray error: ${error}`);
  }
};

export const destroyTray = () => {
  stopRealtimeUpdates();
  tray?.destroy();
};

const startRealtimeUpdates = () => {
  // Update menu every 2 seconds while there are active processes
  if (!updateInterval && activeProcesses.size > 0) {
    console.log("Starting real-time tray updates");
    updateInterval = setInterval(() => {
      if (activeProcesses.size > 0) {
        updateTrayMenu();
      } else {
        stopRealtimeUpdates();
      }
    }, 2000);
  }
};

const stopRealtimeUpdates = () => {
  if (updateInterval) {
    console.log("Stopping real-time tray updates");
    clearInterval(updateInterval);
    updateInterval = null;
  }
};

export const addActiveProcess = (process: ActiveProcess) => {
  activeProcesses.set(process.id, process);
  updateTrayMenu();
  startRealtimeUpdates(); // Start updates when first process is added
};

export const updateActiveProcess = (
  id: string,
  updates: Partial<ActiveProcess>
) => {
  const process = activeProcesses.get(id);
  if (process) {
    Object.assign(process, updates);
    console.log(`Updated process ${id}:`, {
      progress: (process.progress * 100).toFixed(1) + "%",
      downloadSpeed: ((process as any).downloadSpeed / 1024 / 1024).toFixed(2) + " MB/s",
      peers: (process as any).peers,
    });
    // Menu will be updated by the interval
  }
};

export const removeActiveProcess = (id: string) => {
  activeProcesses.delete(id);
  updateTrayMenu();
  
  // Stop realtime updates if no more processes
  if (activeProcesses.size === 0) {
    stopRealtimeUpdates();
  }
};
