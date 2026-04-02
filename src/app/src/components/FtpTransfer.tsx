import { useEffect, useState, useRef, useCallback, type FC } from "react";
import {
  Upload,
  Download,
  X,
  Trash2,
  FolderOpen,
  Server,
  ArrowUpCircle,
  ArrowDownCircle,
  Check,
  StopCircle,
  RefreshCw,
} from "lucide-react";

// --- Types ---

type SharedFile = {
  id: string;
  name: string;
  size: number;
  sharedAt: string;
};

type ReceivedFile = {
  id: string;
  name: string;
  size: number;
  receivedAt: string;
  clientIp: string;
};

type ActiveTransfer = {
  id: string;
  fileName: string;
  direction: "upload" | "download" | "share";
  progress: number;
  size: number;
  transferred: number;
  clientIp: string;
};

type CompletedTransfer = {
  id: string;
  fileName: string;
  direction: "upload" | "download" | "share";
  completedAt: string;
  size: number;
};

type Role = "host" | "client";

type FilesPayload = {
  shared: SharedFile[];
  received: ReceivedFile[];
  activeTransfers: ActiveTransfer[];
  completedTransfers: CompletedTransfer[];
};

type StatusPayload = {
  role: Role;
  serverIp: string;
  port: number;
  receivePath: string;
};

// --- Helpers ---

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Try to resolve file on disk (host only, zero-copy), fall back to upload. */
const shareOrUpload = async (
  file: File,
  endpoint: string,
  onProgress: (p: number) => void
) => {
  // Host share: try Spotlight resolve first
  if (endpoint === "/api/share") {
    try {
      const res = await fetch("/api/share-resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size }),
      });
      const data = await res.json();
      if (data.resolved) {
        onProgress(1);
        return;
      }
    } catch {
      // resolve failed, fall through to upload
    }
  }

  // Regular upload (clients, or host fallback)
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status === 200
        ? resolve()
        : reject(new Error(`Upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.open("POST", endpoint);
    xhr.setRequestHeader("X-Filename", encodeURIComponent(file.name));
    xhr.send(file);
  });
};

// --- Sub-components ---

type DropZoneProps = FC<{
  className?: string;
  onFiles: (files: File[]) => void;
  label: string;
  sublabel: string;
}>;

const DropZone: DropZoneProps = ({ className, onFiles, label, sublabel }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
        dragging
          ? "border-[#e94560] bg-[#e94560]/15 scale-[1.02]"
          : "border-white/20 bg-white/5 hover:border-white/40"
      } ${className ?? ""}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <Upload className="w-8 h-8 mx-auto mb-3 text-[#e94560]" />
      <p className="text-white/80 text-sm font-medium">{label}</p>
      <p className="text-white/40 text-xs mt-1">{sublabel}</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </div>
  );
};

type LocalUpload = {
  id: string;
  file: File;
  progress: number;
  done: boolean;
  error?: string;
};

type SendPanelProps = FC<{
  className?: string;
  role: Role;
  sharedFiles: SharedFile[];
  onRemoveShared: (id: string) => void;
  onTransferDone: () => void;
}>;

const SendPanel: SendPanelProps = ({ className, role, sharedFiles, onRemoveShared, onTransferDone }) => {
  const [uploads, setUploads] = useState<LocalUpload[]>([]);

  const endpoint = role === "host" ? "/api/share" : "/api/upload";
  const title = role === "host" ? "Share Files" : "Send to Host";
  const subtitle =
    role === "host"
      ? "Drop files to make available for download"
      : "Drop files to send to the host machine";

  const handleFiles = useCallback(
    (files: File[]) => {
      let counter = Date.now();
      const newUploads = files.map((f) => ({
        id: `upload-${counter++}`,
        file: f,
        progress: 0,
        done: false,
      }));

      setUploads((prev) => [...prev, ...newUploads]);

      newUploads.forEach((entry) => {
        const updateById = (
          id: string,
          patch: Partial<LocalUpload>
        ) =>
          setUploads((prev) =>
            prev.map((u) => (u.id === id ? { ...u, ...patch } : u))
          );

        shareOrUpload(entry.file, endpoint, (p) =>
          updateById(entry.id, { progress: p })
        )
          .then(() => {
            updateById(entry.id, { done: true, progress: 1 });
            onTransferDone();
          })
          .catch((err) =>
            updateById(entry.id, { error: err.message })
          );
      });
    },
    [endpoint]
  );

  const clearDone = () => setUploads((prev) => prev.filter((u) => !u.done && !u.error));

  return (
    <div
      className={`flex flex-col bg-white/5 rounded-xl border border-white/10 p-4 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ArrowUpCircle className="w-4 h-4 text-[#e94560]" />
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        {uploads.some((u) => u.done || u.error) && (
          <button
            onClick={clearDone}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Clear done
          </button>
        )}
      </div>

      <DropZone onFiles={handleFiles} label="Drop files here" sublabel={subtitle} />

      {uploads.length > 0 && (
        <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
          {uploads.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
            >
              <span className="text-xs text-white/80 truncate flex-1">
                {u.file.name}
              </span>
              <span className="text-xs text-white/40 shrink-0">
                {formatSize(u.file.size)}
              </span>
              {u.error ? (
                <span className="text-xs text-red-400">Failed</span>
              ) : u.done ? (
                <Check className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-[#e94560] to-[#ff6b6b] transition-all duration-200"
                    style={{ width: `${u.progress * 100}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Host: show shared files being served */}
      {role === "host" && sharedFiles.length > 0 && (
        <>
          <div className="flex items-center gap-2 mt-4 mb-2 pt-3 border-t border-white/10">
            <Download className="w-3.5 h-3.5 text-[#4ecdc4]" />
            <h3 className="text-xs font-medium text-white/60">
              Shared ({sharedFiles.length})
            </h3>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {sharedFiles.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
              >
                <span className="text-xs text-white/80 truncate flex-1">
                  {f.name}
                </span>
                <span className="text-xs text-white/40 shrink-0">
                  {formatSize(f.size)}
                </span>
                <button
                  onClick={() => onRemoveShared(f.id)}
                  className="p-1 rounded hover:bg-red-500/20 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

type ReceivePanelProps = FC<{
  className?: string;
  role: Role;
  sharedFiles: SharedFile[];
  receivedFiles: ReceivedFile[];
}>;

const ReceivePanel: ReceivePanelProps = ({
  className,
  role,
  sharedFiles,
  receivedFiles,
}) => {
  const isHostView = role === "host";
  const title = isHostView ? "Received Files" : "Available Files";
  const items = isHostView ? receivedFiles : sharedFiles;

  const [downloading, setDownloading] = useState<Record<string, number>>({});

  const canPickSaveLocation =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "showSaveFilePicker" in window;

  const downloadWithPicker = async (file: SharedFile) => {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: file.name,
      });
      const writable = await handle.createWritable();
      const res = await fetch(`/api/download/${file.id}`);
      if (!res.ok || !res.body) throw new Error("Download failed");

      const reader = res.body.getReader();
      let received = 0;

      setDownloading((prev) => ({ ...prev, [file.id]: 0 }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writable.write(value);
        received += value.length;
        setDownloading((prev) => ({
          ...prev,
          [file.id]: file.size > 0 ? received / file.size : 1,
        }));
      }

      await writable.close();
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      throw err;
    } finally {
      setDownloading((prev) => {
        const next = { ...prev };
        delete next[file.id];
        return next;
      });
    }
  };

  const downloadFile = (file: SharedFile) => {
    if (canPickSaveLocation) {
      downloadWithPicker(file).catch(() => {
        // Picker failed, trigger regular download
        triggerDownload(file);
      });
      return;
    }
    triggerDownload(file);
  };

  const triggerDownload = (file: SharedFile) => {
    const a = document.createElement("a");
    a.href = `/api/download/${file.id}`;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className={`flex flex-col bg-white/5 rounded-xl border border-white/10 p-4 ${className ?? ""}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <ArrowDownCircle className="w-4 h-4 text-[#4ecdc4]" />
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-xs text-white/40 ml-auto">
          {items.length} file{items.length !== 1 ? "s" : ""}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-white/30 text-sm">
            {isHostView
              ? "No files received yet"
              : "No files shared by host yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {isHostView
            ? receivedFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
                >
                  <span className="text-xs text-white/80 truncate flex-1">
                    {f.name}
                  </span>
                  <span className="text-xs text-white/40 shrink-0">
                    {formatSize(f.size)}
                  </span>
                  <span className="text-xs text-white/30 shrink-0">
                    {formatTime(f.receivedAt)}
                  </span>
                </div>
              ))
            : sharedFiles.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2"
                >
                  <span className="text-xs text-white/80 truncate flex-1">
                    {f.name}
                  </span>
                  <span className="text-xs text-white/40 shrink-0">
                    {formatSize(f.size)}
                  </span>
                  {downloading[f.id] !== undefined ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-linear-to-r from-[#4ecdc4] to-[#45b7aa] transition-all duration-200"
                          style={{ width: `${(downloading[f.id] ?? 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-white/40 w-8">
                        {Math.round((downloading[f.id] ?? 0) * 100)}%
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => downloadFile(f)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      title="Download — pick save location"
                    >
                      <Download className="w-3.5 h-3.5 text-[#4ecdc4]" />
                    </button>
                  )}
                </div>
              ))}
        </div>
      )}

    </div>
  );
};

type TransferActivityProps = FC<{
  className?: string;
  active: ActiveTransfer[];
  completed: CompletedTransfer[];
}>;

const TransferActivity: TransferActivityProps = ({
  className,
  active,
  completed,
}) => {
  const recentCompleted = completed.slice(-10).reverse();

  if (active.length === 0 && recentCompleted.length === 0) return null;

  return (
    <div
      className={`bg-white/5 rounded-xl border border-white/10 p-4 ${className ?? ""}`}
    >
      <h2 className="text-sm font-semibold text-white mb-3">
        Transfer Activity
      </h2>

      {active.length > 0 && (
        <div className="space-y-2 mb-3">
          {active.map((t) => (
            <div key={t.id} className="flex items-center gap-3">
              {t.direction === "download" ? (
                <ArrowDownCircle className="w-3.5 h-3.5 text-[#4ecdc4] shrink-0" />
              ) : (
                <ArrowUpCircle className="w-3.5 h-3.5 text-[#e94560] shrink-0" />
              )}
              <span className="text-xs text-white/80 truncate flex-1">
                {t.fileName}
              </span>
              <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-gradient-to-r from-[#e94560] to-[#ff6b6b] transition-all duration-300"
                  style={{ width: `${t.progress * 100}%` }}
                />
              </div>
              <span className="text-xs text-white/40 w-10 text-right shrink-0">
                {Math.round(t.progress * 100)}%
              </span>
              <span className="text-xs text-white/30 shrink-0">
                {formatSize(t.transferred)}/{formatSize(t.size)}
              </span>
            </div>
          ))}
        </div>
      )}

      {recentCompleted.length > 0 && (
        <div className="space-y-1">
          {recentCompleted.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 opacity-60"
            >
              <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
              <span className="text-xs text-white/60 truncate flex-1">
                {t.fileName}
              </span>
              <span className="text-xs text-white/30 shrink-0">
                {formatSize(t.size)}
              </span>
              <span className="text-xs text-white/30 shrink-0">
                {formatTime(t.completedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

export const FtpTransfer = () => {
  const [role, setRole] = useState<Role | null>(null);
  const [serverIp, setServerIp] = useState("");
  const [port, setPort] = useState(0);
  const [receivePath, setReceivePath] = useState("");
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState("");
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFile[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<ActiveTransfer[]>([]);
  const [completedTransfers, setCompletedTransfers] = useState<CompletedTransfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch initial status
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data: StatusPayload) => {
        setRole(data.role);
        setServerIp(data.serverIp);
        setPort(data.port);
        setReceivePath(data.receivePath);
        setPathInput(data.receivePath);
      })
      .catch(() => setError("Cannot connect to server"));
  }, []);

  // Fetch files list
  const refreshFiles = useCallback(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data: FilesPayload) => {
        setSharedFiles(data.shared);
        setReceivedFiles(data.received);
        setActiveTransfers(data.activeTransfers);
        setCompletedTransfers(data.completedTransfers);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!role) return;
    refreshFiles();
    const interval = setInterval(refreshFiles, 5000);
    return () => clearInterval(interval);
  }, [role, refreshFiles]);

  // SSE connection
  useEffect(() => {
    if (!role) return;

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.addEventListener("file-shared", (e) => {
      const file: SharedFile = JSON.parse(e.data);
      setSharedFiles((prev) =>
        prev.some((f) => f.id === file.id) ? prev : [...prev, file]
      );
    });

    es.addEventListener("file-removed", (e) => {
      const { id } = JSON.parse(e.data);
      setSharedFiles((prev) => prev.filter((f) => f.id !== id));
    });

    es.addEventListener("file-received", (e) => {
      const file: ReceivedFile = JSON.parse(e.data);
      setReceivedFiles((prev) =>
        prev.some((f) => f.id === file.id) ? prev : [...prev, file]
      );
    });

    es.addEventListener("transfer-started", (e) => {
      const transfer: ActiveTransfer = JSON.parse(e.data);
      setActiveTransfers((prev) =>
        prev.some((t) => t.id === transfer.id) ? prev : [...prev, transfer]
      );
    });

    es.addEventListener("transfer-progress", (e) => {
      const { id, progress, transferred } = JSON.parse(e.data);
      setActiveTransfers((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, progress, transferred } : t
        )
      );
    });

    es.addEventListener("transfer-complete", (e) => {
      const completed: CompletedTransfer = JSON.parse(e.data);
      setActiveTransfers((prev) => prev.filter((t) => t.id !== completed.id));
      setCompletedTransfers((prev) => [...prev, completed]);
    });

    es.addEventListener("config-updated", (e) => {
      const { receivePath: rp } = JSON.parse(e.data);
      setReceivePath(rp);
      setPathInput(rp);
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [role]);

  const handleRemoveShared = (id: string) => {
    fetch(`/api/share/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const handleSavePath = () => {
    fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receivePath: pathInput }),
    })
      .then((r) => r.json())
      .then(() => {
        setReceivePath(pathInput);
        setEditingPath(false);
      })
      .catch(() => {});
  };

  const handleStop = () => {
    fetch("/api/stop", { method: "POST" }).then(() => {
      setError("Server stopped");
    });
  };

  // Loading state
  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
        <div className="text-center">
          <StopCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] to-[#16213e]">
        <RefreshCw className="w-6 h-6 text-white/40 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col h-screen bg-gradient-to-br from-[#1a1a2e] to-[#16213e] text-gray-200 select-text pointer-events-auto">
      {/* Header */}
      <div className="flex justify-between items-center px-5 py-4 bg-black/30 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-[#e94560]" />
          <div>
            <h1 className="text-base font-semibold text-white">
              FTP Transfer
            </h1>
            <p className="text-xs text-white/40">
              {serverIp}:{port}{" "}
              <span
                className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  role === "host"
                    ? "bg-[#e94560]/20 text-[#e94560]"
                    : "bg-[#4ecdc4]/20 text-[#4ecdc4]"
                }`}
              >
                {role.toUpperCase()}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Receive path config (host only) */}
          {role === "host" && (
            <div className="flex items-center gap-2 mr-2">
              <FolderOpen className="w-4 h-4 text-white/40" />
              {editingPath ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={pathInput}
                    onChange={(e) => setPathInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSavePath()}
                    className="bg-white/10 border border-white/20 rounded px-2 py-1 text-xs text-white w-48 outline-none focus:border-[#e94560]"
                    autoFocus
                  />
                  <button
                    onClick={handleSavePath}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5 text-green-400" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingPath(false);
                      setPathInput(receivePath);
                    }}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingPath(true)}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors truncate max-w-[200px]"
                  title={`Receive to: ${receivePath}`}
                >
                  {receivePath}
                </button>
              )}
            </div>
          )}

          {role === "host" && (
            <button
              onClick={handleStop}
              className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs rounded-md hover:bg-red-500/30 transition-colors"
            >
              Stop Server
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Two-column panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SendPanel
            role={role}
            sharedFiles={sharedFiles}
            onRemoveShared={handleRemoveShared}
            onTransferDone={refreshFiles}
          />
          <ReceivePanel
            role={role}
            sharedFiles={sharedFiles}
            receivedFiles={receivedFiles}
          />
        </div>

        {/* Transfer activity */}
        <TransferActivity
          active={activeTransfers}
          completed={completedTransfers}
        />
      </div>

      {/* Footer */}
      <div className="px-5 py-2 bg-black/20 border-t border-white/5 shrink-0">
        <p className="text-[10px] text-white/20 text-center">
          {role === "host"
            ? `Clients connect to http://${serverIp}:${port}`
            : `Connected to ${serverIp}:${port}`}
        </p>
      </div>
    </div>
  );
};
