import { spawn, ChildProcess } from "child_process";
import http from "http";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";
import { dialog, desktopCapturer, BrowserWindow, systemPreferences, shell, ipcMain } from "electron";
import {
  addActiveProcess,
  removeActiveProcess,
  updateActiveProcess,
} from "../../electron/tray";
import { getLocalIP } from "../network/getLocalIP";

export interface ScreenStreamProcess {
  id: string;
  type: "screen_stream";
  name: string;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  peers: number;
  activeConnections: number;
  downloadPath: string;
  torrentName: string;
  cleanup: () => void;
}

export const screenStreamProcessUI = {
  getLabel: (process: ScreenStreamProcess) => {
    return `🖥 ${process.name}\n   ${process.activeConnections} active viewer${process.activeConnections !== 1 ? "s" : ""}`;
  },
  onClick: (process: ScreenStreamProcess): boolean => {
    const response = dialog.showMessageBoxSync({
      type: "question",
      buttons: ["Cancel", "Stop Streaming"],
      defaultId: 0,
      title: "Screen Stream",
      message: process.name,
      detail: `Currently streaming desktop to ${process.activeConnections} viewer(s).`,
    });
    return response === 1;
  },
};

// Track active screen stream to kill previous one
let activeScreenStream: {
  server: http.Server;
  captureWindow: BrowserWindow;
  caffeinateProcess?: ChildProcess;
  cleanup: () => void;
  processId: string;
} | null = null;

// Start caffeinate to prevent sleep during streaming (macOS)
const startCaffeinate = (): ChildProcess | undefined => {
  if (process.platform !== "darwin") return undefined;
  try {
    const proc = spawn("caffeinate", ["-d", "-i"], {
      stdio: "ignore",
      detached: false,
    });
    console.log("Caffeinate started - preventing sleep during screen stream");
    return proc;
  } catch (e) {
    console.warn("Could not start caffeinate:", e);
    return undefined;
  }
};

const stopCaffeinate = (proc?: ChildProcess) => {
  if (proc && !proc.killed) {
    proc.kill();
    console.log("Caffeinate stopped");
  }
};

// Build the HTML page for the hidden BrowserWindow that captures the screen.
// Needs to be served over HTTP (not data: or about:blank) so navigator.mediaDevices is available.
// Uses getUserMedia with chromeMediaSource:'desktop' for efficient continuous capture,
// then sends JPEG frames to the main process via IPC.
const buildCapturePageHTML = (sourceId: string, fps: number, quality: number): string => {
  return `<!DOCTYPE html>
<html><head><title>Capture</title></head>
<body>
<script>
const { ipcRenderer } = require('electron');
(async () => {
  try {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: '${sourceId}',
          maxWidth: 1920,
          maxHeight: 1080,
          maxFrameRate: ${fps}
        }
      }
    });
    video.srcObject = stream;
    await video.play();

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ipcRenderer.send('screen-capture-ready', { width: video.videoWidth, height: video.videoHeight });

    function captureFrame() {
      if (video.readyState >= 2) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(function(blob) {
          if (blob) {
            blob.arrayBuffer().then(function(buf) {
              ipcRenderer.send('screen-frame', Buffer.from(buf));
            });
          }
        }, 'image/jpeg', ${quality / 100});
      }
    }

    setInterval(captureFrame, ${Math.round(1000 / fps)});
    captureFrame();
  } catch (err) {
    ipcRenderer.send('screen-capture-error', err.message || String(err));
  }
})();
</script>
</body></html>`;
};

export const streamScreen = async ({
  fps = 10,
  quality = 80,
  onStreamReady,
}: {
  fps?: number;
  quality?: number; // JPEG quality 1-100 (higher = better)
  onStreamReady?: (streamUrl: string) => void;
}) => {
  // Check screen recording permission on macOS
  if (process.platform === "darwin") {
    const status = systemPreferences.getMediaAccessStatus("screen");
    console.log(`Screen recording permission status: ${status}`);
    if (status !== "granted") {
      console.error("Screen recording permission not granted. Opening System Settings...");
      dialog.showMessageBoxSync({
        type: "warning",
        title: "Screen Recording Permission Required",
        message: "CopyAI needs Screen Recording permission to stream your desktop.",
        detail: "Please grant permission in System Settings > Privacy & Security > Screen Recording, then try again.",
        buttons: ["OK"],
      });
      shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
      return "Error: Screen Recording permission not granted. Please allow in System Settings and try again.";
    }
  }

  // Kill previous screen stream if exists
  if (activeScreenStream) {
    console.log("Killing previous screen stream...");
    removeActiveProcess(activeScreenStream.processId);
    try {
      activeScreenStream.cleanup();
    } catch (e) {
      console.error("Error cleaning up previous screen stream:", e);
    }
    activeScreenStream = null;
  }

  const processId = uuidv4();
  const port = 8889;
  let activeConnections = 0;
  let latestFrame: Buffer | null = null;

  // Get screen source ID using desktopCapturer (called once, not for frame capture)
  let sources;
  try {
    sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 320, height: 180 }, // Small thumbnail, we only need the ID
    });
  } catch (err) {
    console.error("Failed to get screen sources:", err);
    dialog.showMessageBoxSync({
      type: "error",
      title: "Screen Capture Failed",
      message: "Could not access screen capture.",
      detail: "Make sure Screen Recording permission is granted in System Settings > Privacy & Security > Screen Recording.",
      buttons: ["OK"],
    });
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    return "Error: Failed to access screen capture. Check Screen Recording permission.";
  }

  const primaryScreen = sources[0];
  if (!primaryScreen) {
    console.error("No screen source found for capture");
    return "Error: No screen source found";
  }

  console.log(`Screen capture source: ${primaryScreen.name} (${primaryScreen.id})`);

  // Generate capture page HTML for the hidden BrowserWindow
  const capturePageHTML = buildCapturePageHTML(primaryScreen.id, fps, quality);

  // Set up IPC handlers to receive frames from the renderer
  const frameChannel = "screen-frame";
  const readyChannel = "screen-capture-ready";
  const errorChannel = "screen-capture-error";

  let frameCount = 0;
  const frameHandler = (_event: Electron.IpcMainEvent, frameBuffer: Buffer | Uint8Array) => {
    latestFrame = Buffer.isBuffer(frameBuffer) ? frameBuffer : Buffer.from(frameBuffer);
    frameCount++;
    if (frameCount <= 3 || frameCount % 100 === 0) {
      console.log(`[Screen] Frame #${frameCount} received: ${latestFrame.length} bytes`);
    }
  };

  const readyHandler = (_event: Electron.IpcMainEvent, info: { width: number; height: number }) => {
    console.log(`Screen capture stream started: ${info.width}x${info.height}`);
  };

  const errorHandler = (_event: Electron.IpcMainEvent, errorMsg: string) => {
    console.error(`Screen capture error in renderer: ${errorMsg}`);
  };

  ipcMain.on(frameChannel, frameHandler);
  ipcMain.on(readyChannel, readyHandler);
  ipcMain.on(errorChannel, errorHandler);

  // Write capture HTML to a temp file and load via file:// so that both
  // nodeIntegration (require('electron')) and navigator.mediaDevices work
  const captureTmpFile = join(tmpdir(), `copyai-screen-capture-${processId}.html`);
  writeFileSync(captureTmpFile, capturePageHTML, "utf-8");

  const captureWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  captureWindow.loadFile(captureTmpFile);

  // MJPEG boundary for multipart streaming
  const MJPEG_BOUNDARY = "frameboundary";

  // Create HTTP server
  const server = http.createServer((req, res) => {
    console.log(`[Screen HTTP] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Serve HTML player page at root — tries MJPEG <img>, falls back to JS polling
    if (req.url === "/" || req.url === "") {
      activeConnections++;
      res.on("close", () => {
        activeConnections--;
        updateActiveProcess(processId, { activeConnections });
      });
      const intervalMs = Math.round(1000 / fps);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.writeHead(200);
      res.end(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Screen Stream</title>
<style>*{margin:0;padding:0}body{background:#000;overflow:hidden}
img{width:100vw;height:100vh;object-fit:contain}</style></head>
<body>
<img id="s" src="/stream" onerror="fallback()" />
<script>
var fell=false;
function fallback(){
  if(fell)return; fell=true;
  var img=document.getElementById('s');
  function f(){
    var n=new Image();
    n.onload=function(){img.src=n.src;setTimeout(f,${intervalMs})};
    n.onerror=function(){setTimeout(f,500)};
    n.src='/snapshot?'+Date.now();
  }
  img.onerror=null;
  img.src='';
  setTimeout(f,100);
}
</script></body></html>`);
      return;
    }

    // MJPEG multipart stream
    if (req.url === "/stream") {
      res.writeHead(200, {
        "Content-Type": `multipart/x-mixed-replace; boundary=${MJPEG_BOUNDARY}`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Connection": "keep-alive",
        "Pragma": "no-cache",
      });

      const intervalMs = Math.round(1000 / fps);
      const pushFrame = setInterval(() => {
        if (latestFrame && !res.destroyed) {
          res.write(`--${MJPEG_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${latestFrame.length}\r\n\r\n`);
          res.write(latestFrame);
          res.write("\r\n");
        }
      }, intervalMs);

      res.on("close", () => {
        clearInterval(pushFrame);
      });
      return;
    }

    // Single snapshot endpoint (used by JS polling fallback)
    if (req.url?.startsWith("/snapshot")) {
      if (latestFrame) {
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Content-Length", latestFrame.length);
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.writeHead(200);
        res.end(latestFrame);
      } else {
        res.writeHead(503);
        res.end("No frame available yet");
      }
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  // Start server
  await new Promise<void>((resolve) => {
    server.listen(port, "0.0.0.0", () => {
      const networkHost = getLocalIP();
      const networkUrl = `http://${networkHost}:${port}`;
      const localUrl = `http://localhost:${port}`;
      console.log(`Screen streaming at: ${localUrl}`);
      console.log(`Access from network: ${networkUrl}`);

      if (onStreamReady) {
        onStreamReady(networkUrl);
      }
      resolve();
    });
  });

  // Start caffeinate
  const caffeinateProcess = startCaffeinate();

  // Cleanup function
  const cleanup = () => {
    console.log("Shutting down screen stream...");
    try {
      stopCaffeinate(caffeinateProcess);

      // Remove IPC handlers
      ipcMain.removeListener(frameChannel, frameHandler);
      ipcMain.removeListener(readyChannel, readyHandler);
      ipcMain.removeListener(errorChannel, errorHandler);

      if (!captureWindow.isDestroyed()) {
        captureWindow.destroy();
      }

      if (server && server.listening) {
        server.close();
      }

      // Clean up temp file
      try { unlinkSync(captureTmpFile); } catch {}
    } catch (error) {
      console.error("Error during screen stream cleanup:", error);
    } finally {
      removeActiveProcess(processId);
      activeScreenStream = null;
    }
  };

  // Add process to tray
  addActiveProcess({
    id: processId,
    type: "screen_stream",
    name: "Desktop Screen Stream",
    progress: 1,
    downloadSpeed: 0,
    uploadSpeed: 0,
    peers: 0,
    activeConnections: 0,
    downloadPath: "",
    torrentName: "",
    cleanup,
  } as ScreenStreamProcess);

  // Store active stream
  activeScreenStream = { server, captureWindow, caffeinateProcess, cleanup, processId };

  // Cleanup on process exit
  process.on("exit", cleanup);
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  return `Screen stream started on port ${port}`;
};
