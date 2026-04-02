import fs from "fs";
import path from "path";
import os from "os";
import http from "http";

export type SharedFile = {
  id: string;
  name: string;
  size: number;
  sharedAt: string;
  path: string;
  /** true when file was resolved on disk (not copied) — do not delete original */
  resolved?: boolean;
};

export type ReceivedFile = {
  id: string;
  name: string;
  size: number;
  receivedAt: string;
  clientIp: string;
  path: string;
};

export type ActiveTransfer = {
  id: string;
  fileName: string;
  direction: "upload" | "download" | "share";
  progress: number;
  size: number;
  transferred: number;
  clientIp: string;
  startedAt: string;
};

export type CompletedTransfer = {
  id: string;
  fileName: string;
  direction: "upload" | "download" | "share";
  clientIp: string;
  completedAt: string;
  size: number;
};

export type TransferState = {
  serverStartedAt: string;
  receivePath: string;
  sharedFiles: SharedFile[];
  receivedFiles: ReceivedFile[];
  activeTransfers: ActiveTransfer[];
  completedTransfers: CompletedTransfer[];
};

const TRANSFERS_PATH = path.join(os.homedir(), ".copyai-ftp-transfers.json");

let state: TransferState = {
  serverStartedAt: "",
  receivePath: "",
  sharedFiles: [],
  receivedFiles: [],
  activeTransfers: [],
  completedTransfers: [],
};

const sseClients = new Set<http.ServerResponse>();

const persist = () => {
  fs.writeFileSync(TRANSFERS_PATH, JSON.stringify(state, null, 2));
};

export const broadcast = (event: string, data: unknown) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
};

export const addSSEClient = (res: http.ServerResponse) => {
  sseClients.add(res);
};

export const removeSSEClient = (res: http.ServerResponse) => {
  sseClients.delete(res);
};

export const initTransfers = (receivePath: string) => {
  state = {
    serverStartedAt: new Date().toISOString(),
    receivePath,
    sharedFiles: [],
    receivedFiles: [],
    activeTransfers: [],
    completedTransfers: [],
  };
  persist();
};

export const clearTransfers = () => {
  state = {
    serverStartedAt: "",
    receivePath: "",
    sharedFiles: [],
    receivedFiles: [],
    activeTransfers: [],
    completedTransfers: [],
  };
  try {
    fs.unlinkSync(TRANSFERS_PATH);
  } catch {}
};

export const getState = (): TransferState => state;

export const setReceivePath = (receivePath: string) => {
  state = { ...state, receivePath };
  persist();
  broadcast("config-updated", { receivePath });
};

export const addSharedFile = (file: SharedFile) => {
  state = { ...state, sharedFiles: [...state.sharedFiles, file] };
  persist();
  broadcast("file-shared", file);
};

export const removeSharedFile = (fileId: string) => {
  const file = state.sharedFiles.find((f) => f.id === fileId);
  if (!file) return;
  // Only delete if it was a copy, not the user's original file
  if (!file.resolved) {
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }
  state = {
    ...state,
    sharedFiles: state.sharedFiles.filter((f) => f.id !== fileId),
  };
  persist();
  broadcast("file-removed", { id: fileId });
};

export const addReceivedFile = (file: ReceivedFile) => {
  state = { ...state, receivedFiles: [...state.receivedFiles, file] };
  persist();
  broadcast("file-received", file);
};

export const addActiveTransfer = (transfer: ActiveTransfer) => {
  state = {
    ...state,
    activeTransfers: [...state.activeTransfers, transfer],
  };
  broadcast("transfer-started", transfer);
};

const lastBroadcast = new Map<string, number>();
const PROGRESS_THROTTLE_MS = 300;

export const updateTransferProgress = (
  id: string,
  progress: number,
  transferred: number
) => {
  state = {
    ...state,
    activeTransfers: state.activeTransfers.map((t) =>
      t.id === id ? { ...t, progress, transferred } : t
    ),
  };

  // Throttle SSE broadcasts to avoid flooding
  const now = Date.now();
  const last = lastBroadcast.get(id) ?? 0;
  if (now - last >= PROGRESS_THROTTLE_MS || progress >= 1) {
    lastBroadcast.set(id, now);
    broadcast("transfer-progress", { id, progress, transferred });
  }
};

export const clearProgressThrottle = (id: string) => {
  lastBroadcast.delete(id);
};

export const completeTransfer = (id: string) => {
  const transfer = state.activeTransfers.find((t) => t.id === id);
  if (!transfer) return;

  const completed: CompletedTransfer = {
    id: transfer.id,
    fileName: transfer.fileName,
    direction: transfer.direction,
    clientIp: transfer.clientIp,
    completedAt: new Date().toISOString(),
    size: transfer.transferred,
  };

  state = {
    ...state,
    activeTransfers: state.activeTransfers.filter((t) => t.id !== id),
    completedTransfers: [...state.completedTransfers, completed],
  };
  persist();
  broadcast("transfer-complete", completed);
};
