import http from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import { getLocalIP } from "../network/getLocalIP";
import {
  initTransfers,
  clearTransfers,
  getState,
  addSharedFile,
  removeSharedFile,
  addActiveTransfer,
  updateTransferProgress,
  completeTransfer,
  setReceivePath,
  addReceivedFile,
  addSSEClient,
  removeSSEClient,
} from "./transfers";

const PORT = 8877;
const SHARE_DIR = path.join(os.homedir(), ".copyai-ftp-shared");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".map": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const getContentType = (filePath: string) =>
  MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream";

/** Recursively search a directory for a file by name + size (max 3 levels deep). */
const searchDir = (
  dir: string,
  fileName: string,
  fileSize: number,
  depth = 0,
  maxDepth = 3
): string | null => {
  // Check direct match first
  const filePath = path.join(dir, fileName);
  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile() && stat.size === fileSize) return filePath;
  } catch {}

  // Recurse into subdirectories
  if (depth >= maxDepth) return null;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const found = searchDir(
        path.join(dir, entry.name),
        fileName,
        fileSize,
        depth + 1,
        maxDepth
      );
      if (found) return found;
    }
  } catch {}

  return null;
};

/** Find a file on disk by name + size. Searches common directories recursively. */
const findLocalFile = (fileName: string, fileSize: number): string | null => {
  const home = os.homedir();
  const dirs = [
    path.join(home, "Downloads"),
    path.join(home, "Documents"),
    path.join(home, "Desktop"),
    home,
  ];

  for (const dir of dirs) {
    const found = searchDir(dir, fileName, fileSize);
    if (found) return found;
  }

  return null;
};

const isHost = (req: http.IncomingMessage) => {
  const addr = req.socket.remoteAddress ?? "";
  return (
    addr === "127.0.0.1" ||
    addr === "::1" ||
    addr === "::ffff:127.0.0.1"
  );
};

const sendJson = (
  res: http.ServerResponse,
  data: unknown,
  status = 200
) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

const sendError = (
  res: http.ServerResponse,
  message: string,
  status = 400
) => {
  sendJson(res, { error: message }, status);
};

const distPath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "src",
  "app",
  "dist"
);

const serveStatic = (
  res: http.ServerResponse,
  pathname: string
) => {
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const fullPath = path.join(distPath, safePath);

  if (!fullPath.startsWith(distPath)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      fs.createReadStream(indexPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("App not built. Run: npm run build:app");
    }
    return;
  }

  const stat = fs.statSync(fullPath);
  res.writeHead(200, {
    "Content-Type": getContentType(fullPath),
    "Content-Length": stat.size,
  });
  fs.createReadStream(fullPath).pipe(res);
};

const handleStreamUpload = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  destDir: string,
  direction: "upload" | "share"
) => {
  const fileName = decodeURIComponent(
    (req.headers["x-filename"] as string) ?? "unknown"
  );
  const fileSize = parseInt(req.headers["content-length"] ?? "0", 10);
  const clientIp = req.socket.remoteAddress ?? "unknown";
  const transferId = uuidv4();

  fs.mkdirSync(destDir, { recursive: true });

  // Avoid overwriting - append suffix if file exists
  let finalName = fileName;
  let filePath = path.join(destDir, finalName);
  let counter = 1;
  while (fs.existsSync(filePath)) {
    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    finalName = `${base} (${counter})${ext}`;
    filePath = path.join(destDir, finalName);
    counter++;
  }

  const writeStream = fs.createWriteStream(filePath, {
    highWaterMark: 16 * 1024 * 1024,
  });
  let bytesReceived = 0;

  addActiveTransfer({
    id: transferId,
    fileName: finalName,
    direction,
    progress: 0,
    size: fileSize,
    transferred: 0,
    clientIp,
    startedAt: new Date().toISOString(),
  });

  // Track progress via interval instead of per-chunk callback
  const progressInterval = setInterval(() => {
    const progress = fileSize > 0 ? bytesReceived / fileSize : 0;
    updateTransferProgress(transferId, progress, bytesReceived);
  }, 300);

  req.on("data", (chunk: Buffer) => {
    bytesReceived += chunk.length;
  });

  req.pipe(writeStream);

  writeStream.on("finish", () => {
    clearInterval(progressInterval);
    updateTransferProgress(transferId, 1, bytesReceived);
    completeTransfer(transferId);

    if (direction === "share") {
      addSharedFile({
        id: transferId,
        name: finalName,
        size: bytesReceived,
        sharedAt: new Date().toISOString(),
        path: filePath,
      });
    } else {
      addReceivedFile({
        id: transferId,
        name: finalName,
        size: bytesReceived,
        receivedAt: new Date().toISOString(),
        clientIp,
        path: filePath,
      });
    }

    sendJson(res, { success: true, id: transferId, name: finalName, size: bytesReceived });
  });

  writeStream.on("error", (err) => {
    clearInterval(progressInterval);
    completeTransfer(transferId);
    sendError(res, `Write failed: ${err.message}`, 500);
  });

  req.on("error", () => {
    clearInterval(progressInterval);
    writeStream.destroy();
    completeTransfer(transferId);
  });
};

const handleDownload = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  fileId: string
) => {
  const { sharedFiles } = getState();
  const file = sharedFiles.find((f) => f.id === fileId);

  if (!file || !fs.existsSync(file.path)) {
    sendError(res, "File not found", 404);
    return;
  }

  const stat = fs.statSync(file.path);
  const clientIp = req.socket.remoteAddress ?? "unknown";
  const transferId = uuidv4();

  const headers: Record<string, string | number> = {
    "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name)}"`,
    "Accept-Ranges": "bytes",
    "Content-Type": "application/octet-stream",
  };

  let start = 0;
  let end = stat.size - 1;
  let statusCode = 200;

  // Range header support for resumable downloads
  const range = req.headers.range;
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      start = parseInt(match[1], 10);
      end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      statusCode = 206;
      headers["Content-Range"] = `bytes ${start}-${end}/${stat.size}`;
    }
  }

  headers["Content-Length"] = end - start + 1;

  addActiveTransfer({
    id: transferId,
    fileName: file.name,
    direction: "download",
    progress: 0,
    size: stat.size,
    transferred: start,
    clientIp,
    startedAt: new Date().toISOString(),
  });

  res.writeHead(statusCode, headers);

  // 2MB buffer for high throughput on LAN
  const stream = fs.createReadStream(file.path, {
    start,
    end,
    highWaterMark: 16 * 1024 * 1024,
  });

  // Track progress via socket bytes rather than intercepting stream chunks
  const totalBytes = end - start + 1;
  let bytesSent = 0;
  res.on("drain", () => {
    bytesSent = (res.socket?.bytesWritten ?? 0);
  });
  const progressInterval = setInterval(() => {
    const sent = res.socket?.bytesWritten ?? bytesSent;
    const progress = totalBytes > 0 ? Math.min(sent / totalBytes, 1) : 0;
    updateTransferProgress(transferId, progress, start + sent);
  }, 300);

  const cleanup = () => {
    clearInterval(progressInterval);
    completeTransfer(transferId);
  };

  stream.on("end", cleanup);
  stream.on("error", cleanup);
  req.on("close", () => {
    stream.destroy();
    cleanup();
  });

  stream.pipe(res);
};

let activeServer: http.Server | null = null;

export const stopFtpServer = () => {
  if (!activeServer) return;
  clearTransfers();
  activeServer.close();
  activeServer = null;
  // Clean up shared files
  try {
    fs.rmSync(SHARE_DIR, { recursive: true, force: true });
  } catch {}
};

export const startFtpServer = async (
  receivePath?: string
): Promise<string> => {
  const localIP = getLocalIP();

  if (activeServer) {
    return `FTP server already running at http://${localIP}:${PORT}`;
  }

  const defaultReceivePath =
    receivePath ?? path.join(os.homedir(), "Downloads");
  initTransfers(defaultReceivePath);
  fs.mkdirSync(SHARE_DIR, { recursive: true });

  const server = http.createServer((req, res) => {
    try {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const pathname = url.pathname;

    // CORS for local network
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, DELETE, PATCH, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, X-Filename"
    );

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // --- API routes ---
    if (pathname.startsWith("/api/")) {
      if (req.method === "GET" && pathname === "/api/status") {
        const st = getState();
        sendJson(res, {
          role: isHost(req) ? "host" : "client",
          serverIp: localIP,
          port: PORT,
          receivePath: st.receivePath,
          serverStartedAt: st.serverStartedAt,
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/files") {
        const st = getState();
        sendJson(res, {
          shared: st.sharedFiles,
          received: st.receivedFiles,
          activeTransfers: st.activeTransfers,
          completedTransfers: st.completedTransfers,
        });
        return;
      }

      // Host: try to resolve file on disk by name+size (zero copy)
      if (req.method === "POST" && pathname === "/api/share-resolve") {
        console.log("[FTP] share-resolve endpoint hit");
        if (!isHost(req)) {
          sendError(res, "Only host can share files", 403);
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          try {
            const { name, size } = JSON.parse(
              Buffer.concat(chunks).toString()
            );
            console.log(`[FTP] share-resolve: "${name}" size=${size}`);
            const localPath = findLocalFile(name, size);
            console.log(`[FTP] share-resolve result: ${localPath ?? "NOT FOUND"}`);
            if (localPath) {
              const id = uuidv4();
              addSharedFile({
                id,
                name,
                size,
                sharedAt: new Date().toISOString(),
                path: localPath,
                resolved: true,
              });
              sendJson(res, { success: true, id, name, size, resolved: true });
            } else {
              sendJson(res, { resolved: false });
            }
          } catch (err) {
            console.error("[FTP] share-resolve error:", err);
            sendError(res, "Invalid JSON");
          }
        });
        return;
      }

      // Host: upload-based share (fallback when resolve fails)
      if (req.method === "POST" && pathname === "/api/share") {
        if (!isHost(req)) {
          sendError(res, "Only host can share files", 403);
          return;
        }
        handleStreamUpload(req, res, SHARE_DIR, "share");
        return;
      }

      if (req.method === "DELETE" && pathname.startsWith("/api/share/")) {
        if (!isHost(req)) {
          sendError(res, "Only host can manage shared files", 403);
          return;
        }
        const fileId = pathname.slice("/api/share/".length);
        removeSharedFile(fileId);
        sendJson(res, { success: true });
        return;
      }

      if (req.method === "POST" && pathname === "/api/upload") {
        const st = getState();
        handleStreamUpload(req, res, st.receivePath, "upload");
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/api/download/")) {
        const fileId = pathname.slice("/api/download/".length);
        handleDownload(req, res, fileId);
        return;
      }

      if (req.method === "PATCH" && pathname === "/api/config") {
        if (!isHost(req)) {
          sendError(res, "Only host can change config", 403);
          return;
        }
        const chunks: Buffer[] = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            if (body.receivePath) {
              fs.mkdirSync(body.receivePath, { recursive: true });
              setReceivePath(body.receivePath);
            }
            sendJson(res, { success: true, receivePath: body.receivePath });
          } catch {
            sendError(res, "Invalid JSON");
          }
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write(":\n\n");
        addSSEClient(res);
        req.on("close", () => removeSSEClient(res));
        return;
      }

      if (req.method === "POST" && pathname === "/api/stop") {
        if (!isHost(req)) {
          sendError(res, "Only host can stop server", 403);
          return;
        }
        sendJson(res, { success: true });
        setTimeout(() => stopFtpServer(), 100);
        return;
      }

      sendError(res, "Not found", 404);
      return;
    }

    // --- Static files (React SPA) ---
    if (pathname === "/") {
      const indexPath = path.join(distPath, "index.html");
      if (!fs.existsSync(indexPath)) {
        res.writeHead(404);
        res.end("App not built. Run: npm run build:app");
        return;
      }
      let html = fs.readFileSync(indexPath, "utf-8");
      // Inject route param so the React SPA renders the FTP view
      const routeScript = `<script>if(!location.search.includes('route='))history.replaceState(null,'','/?route=ftp-transfer');</script>`;
      html = html.replace("</head>", `${routeScript}</head>`);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }

    serveStatic(res, pathname);
    } catch (err) {
      console.error("[FTP] Request handler error:", err);
      if (!res.headersSent) {
        sendError(res, "Internal server error", 500);
      }
    }
  });

  // Tuned for fast LAN transfers of large files
  server.timeout = 0; // no timeout
  server.keepAliveTimeout = 0;
  server.requestTimeout = 0;

  // Disable Nagle + bump socket buffers on every connection
  server.on("connection", (socket) => {
    socket.setNoDelay(true);
    socket.setKeepAlive(true);
    // 4MB send/receive buffers
    try {
      (socket as any).setRecvBufferSize(4 * 1024 * 1024);
      (socket as any).setSendBufferSize(4 * 1024 * 1024);
    } catch {
      // not available on all platforms
    }
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    console.error(`[FTP] Server error:`, err.message);
  });

  // Prevent unhandled async errors from killing the server
  process.on("uncaughtException", (err) => {
    console.error("[FTP] Uncaught exception:", err);
  });
  process.on("unhandledRejection", (err) => {
    console.error("[FTP] Unhandled rejection:", err);
  });

  activeServer = server;

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[FTP] Server running at http://${localIP}:${PORT}`);
    exec(`open http://localhost:${PORT}`);
  });

  return `FTP server started at http://${localIP}:${PORT}`;
};
