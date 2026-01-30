import { BrowserWindow } from "electron";

let isInstalled = false;
let targetWindow: BrowserWindow | null = null;
let isForwardingEnabled = false;

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
};

export const setupConsoleForwarding = (window: BrowserWindow) => {
  targetWindow = window;
  
  if (isInstalled) return;
  isInstalled = true;

  console.log = (...args: any[]) => {
    originalConsole.log(...args);
    if (isForwardingEnabled) forwardLog("log", args);
  };

  console.warn = (...args: any[]) => {
    originalConsole.warn(...args);
    if (isForwardingEnabled) forwardLog("warn", args);
  };

  console.error = (...args: any[]) => {
    originalConsole.error(...args);
    if (isForwardingEnabled) forwardLog("error", args);
  };

  console.info = (...args: any[]) => {
    originalConsole.info(...args);
    if (isForwardingEnabled) forwardLog("info", args);
  };
};

const forwardLog = (type: "log" | "warn" | "error" | "info", args: any[]) => {
  if (!targetWindow || targetWindow.isDestroyed()) return;

  const message = args
    .map((arg) => {
      if (typeof arg === "object") {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(" ");

  targetWindow.webContents.send("main-process-log", {
    type,
    message,
    timestamp: Date.now(),
    source: "main",
  });
};

export const enableLogForwarding = () => {
  isForwardingEnabled = true;
};

export const disableLogForwarding = () => {
  isForwardingEnabled = false;
};

export const stopConsoleForwarding = () => {
  targetWindow = null;
  isForwardingEnabled = false;
};

