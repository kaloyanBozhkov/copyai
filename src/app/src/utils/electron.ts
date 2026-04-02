type IpcListener = (...args: any[]) => void;

type IpcRenderer = {
  send: (channel: string, ...args: any[]) => void;
  on: (channel: string, listener: IpcListener) => void;
  once: (channel: string, listener: IpcListener) => void;
  removeListener: (channel: string, listener: IpcListener) => void;
  removeAllListeners: (channel: string) => void;
};

const noopIpc: IpcRenderer = {
  send: () => {},
  on: () => {},
  once: () => {},
  removeListener: () => {},
  removeAllListeners: () => {},
};

let resolvedIpcRenderer: IpcRenderer;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  resolvedIpcRenderer = require("electron").ipcRenderer;
} catch {
  // Running in a regular browser (not Electron) — provide no-op stubs
  resolvedIpcRenderer = noopIpc;
}

export const ipcRenderer = resolvedIpcRenderer;

