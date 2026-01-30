import { useState, useEffect, useCallback } from "react";
import { ipcRenderer } from "@/utils/electron";

export interface ConsoleLog {
  id: string;
  type: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: number;
  args: any[];
  source?: "main" | "renderer";
}

let logListeners: Array<(log: ConsoleLog) => void> = [];
let idCounter = 0;

// Wrap console methods once globally
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
};

const captureLog = (type: ConsoleLog["type"], args: any[], source: "main" | "renderer" = "renderer") => {
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

  const log: ConsoleLog = {
    id: `log-${idCounter++}`,
    type,
    message,
    timestamp: Date.now(),
    args,
    source,
  };

  logListeners.forEach((listener) => listener(log));
};

// Install console wrappers only once
let installed = false;

const installConsoleWrappers = () => {
  if (installed) return;
  installed = true;

  console.log = (...args: any[]) => {
    originalConsole.log(...args);
    captureLog("log", args);
  };

  console.warn = (...args: any[]) => {
    originalConsole.warn(...args);
    captureLog("warn", args);
  };

  console.error = (...args: any[]) => {
    originalConsole.error(...args);
    captureLog("error", args);
  };

  console.info = (...args: any[]) => {
    originalConsole.info(...args);
    captureLog("info", args);
  };
};

export const useConsoleLogs = () => {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);

  useEffect(() => {
    installConsoleWrappers();

    const listener = (log: ConsoleLog) => {
      setLogs((prev) => [...prev, log]);
    };

    logListeners.push(listener);

    // Listen for main process logs
    const handleMainLog = (_: unknown, data: { type: ConsoleLog["type"]; message: string; timestamp: number; source: "main" }) => {
      const log: ConsoleLog = {
        id: `log-${idCounter++}`,
        type: data.type,
        message: data.message,
        timestamp: data.timestamp,
        args: [data.message],
        source: "main",
      };
      setLogs((prev) => [...prev, log]);
    };

    ipcRenderer.on("main-process-log", handleMainLog);

    return () => {
      logListeners = logListeners.filter((l) => l !== listener);
      ipcRenderer.removeListener("main-process-log", handleMainLog);
    };
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, clearLogs };
};

