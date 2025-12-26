import { exec } from "child_process";
import path from "path";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import { dialog } from "electron";
import fs from "fs";

export interface StreamProcess {
  id: string;
  type: "stream";
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

export const streamProcessUI = {
  getLabel: (process: StreamProcess) => {
    const speedMB = (process.downloadSpeed / 1024 / 1024).toFixed(2);
    const progressPercent = (process.progress * 100).toFixed(1);
    
    let label = `▶ ${process.name}`;
    label += `\n   ${progressPercent}% • ${speedMB} MB/s • ${process.peers} peers • ${process.activeConnections} conn`;
    return label;
  },
  onClick: (process: StreamProcess) => {
    const response = dialog.showMessageBoxSync({
      type: "question",
      buttons: ["Cancel", "Terminate"],
      defaultId: 0,
      title: "Terminate Stream",
      message: "Do you want to terminate this stream?",
      detail: process.name,
    });

    if (response === 1) {
      return true; // Signal to terminate
    }
    return false;
  },
  onTerminate: (process: StreamProcess) => {
    // Clean up the download folder
    const movieFolderPath = path.join(process.downloadPath, process.torrentName);
    
    if (fs.existsSync(movieFolderPath)) {
      console.log(`Cleaning up stream folder: ${movieFolderPath}`);
      fs.rmSync(movieFolderPath, { recursive: true, force: true });
      console.log(`Deleted: ${movieFolderPath}`);
    }
  },
};

// Track active stream server to kill previous ones
let activeServer: {
  server: http.Server;
  client: any;
  cleanup: () => void;
  processId: string;
} | null = null;

export const streamMovie = async ({
  magnetLinkUrl,
  downloadPath,
  airplay = false,
}: {
  magnetLinkUrl: string;
  downloadPath: string;
  airplay?: boolean;
}) => {
  // Import tray functions dynamically to avoid circular deps
  const { addActiveProcess, updateActiveProcess, removeActiveProcess } = await import("../../electron/tray");
  
  // Kill previous stream if exists
  if (activeServer) {
    console.log("Killing previous stream...");
    removeActiveProcess(activeServer.processId);
    activeServer.cleanup();
    activeServer = null;
  }

  const processId = uuidv4();
  // Dynamic import for ESM module (using eval to prevent TS from compiling to require)
  (eval('import("webtorrent")') as Promise<any>)
    .then((WebTorrentModule) => {
      const WebTorrent = WebTorrentModule.default;
      const client = new WebTorrent();

      client.add(magnetLinkUrl, { path: downloadPath }, (torrent: any) => {
        console.log(`Starting stream: ${torrent.name}`);

        // Find the largest file (the movie file)
        const movieFile = torrent.files.reduce((largest: any, file: any) =>
          file.length > largest.length ? file : largest
        );

        // Deselect all files first
        torrent.files.forEach((file: any) => file.deselect());

        // Select only the movie file with high priority for streaming
        movieFile.select(0); // Priority 0 = highest priority for sequential download

        const movieFolderPath = path.join(downloadPath, torrent.name);

        // Add process to tray
        addActiveProcess({
          id: processId,
          type: "stream",
          name: movieFile.name,
          progress: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          peers: 0,
          activeConnections: 0,
          downloadPath,
          torrentName: torrent.name,
          cleanup: () => {
            if (idleCheckInterval) clearInterval(idleCheckInterval);
            if (progressInterval) clearInterval(progressInterval);
            server.close();
            client.destroy();
          },
        } as StreamProcess);

        // Create HTTP server for streaming
        const port = 8888;
        let activeConnections = 0;
        let downloadComplete = false;
        let lastConnectionCloseTime: number | null = null;
        let idleCheckInterval: NodeJS.Timeout | null = null;
        
        const checkAndCleanup = () => {
          // Only cleanup if download is complete AND no active connections AND 5 minutes have passed
          if (downloadComplete && activeConnections === 0) {
            if (!lastConnectionCloseTime) {
              lastConnectionCloseTime = Date.now();
              console.log("No active connections. Starting 5-minute idle timer...");
            }
            
            const idleTime = Date.now() - lastConnectionCloseTime;
            const fiveMinutes = 5 * 60 * 1000;
            
            if (idleTime >= fiveMinutes) {
              console.log("5 minutes of inactivity reached. Shutting down stream server...");
              cleanup();
            }
          }
        };
        
        const server = http.createServer((req, res) => {
          activeConnections++;
          lastConnectionCloseTime = null; // Reset idle timer when new connection comes in
          console.log(`Active connections: ${activeConnections}`);
          
          // Update tray with new connection count
          updateActiveProcess(processId, {
            activeConnections,
          });
          
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Content-Length", movieFile.length);
          res.setHeader("Accept-Ranges", "bytes");

          res.on("close", () => {
            activeConnections--;
            console.log(`Connection closed. Active connections: ${activeConnections}`);
            
            // Update tray with new connection count
            updateActiveProcess(processId, {
              activeConnections,
            });
            
            checkAndCleanup();
          });

          if (req.headers.range) {
            // Handle range requests for seeking
            const parts = req.headers.range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : movieFile.length - 1;
            const chunksize = (end - start) + 1;

            res.writeHead(206, {
              "Content-Range": `bytes ${start}-${end}/${movieFile.length}`,
              "Content-Length": chunksize,
            });

            const stream = movieFile.createReadStream({ start, end });
            stream.pipe(res);
          } else {
            // No range request, stream entire file
            res.writeHead(200);
            const stream = movieFile.createReadStream();
            stream.pipe(res);
          }
        });

        server.listen(port, () => {
          const streamUrl = `http://localhost:${port}`;
          console.log(`Movie streaming at: ${streamUrl}`);
          console.log(`Movie: ${movieFile.name}`);

          // Open in default video player or AirPlay
          if (airplay) {
            // Use beamer or other AirPlay tool if available
            exec(`open -a Beamer "${streamUrl}"`, (error) => {
              if (error) {
                console.log("Beamer not found, trying default player...");
                exec(`open "${streamUrl}"`);
              }
            });
          } else {
            // Open in default video player (usually QuickTime on macOS)
            exec(`open "${streamUrl}"`);
          }
        });

        torrent.on("done", () => {
          downloadComplete = true;
          console.log(`Download complete: ${movieFile.name}`);
          console.log("Stream server will remain active while connections exist");
          // Open Finder at the movie folder when done
          exec(`open "${movieFolderPath}"`, (error) => {
            if (error) {
              console.error("Error opening Finder:", error);
            }
          });
          
          // Start checking every minute for idle timeout
          idleCheckInterval = setInterval(checkAndCleanup, 60 * 1000);
          checkAndCleanup();
        });

        // Cleanup function
        const cleanup = () => {
          console.log("Shutting down stream server...");
          if (idleCheckInterval) clearInterval(idleCheckInterval);
          if (progressInterval) clearInterval(progressInterval);
          server.close();
          client.destroy();
          removeActiveProcess(processId);
          activeServer = null;
        };

        // Store active server for future cleanup
        activeServer = { server, client, cleanup, processId };

        // Cleanup on process exit
        process.on("exit", cleanup);
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);

        // Show progress
        let progressInterval: NodeJS.Timeout | null = setInterval(() => {
          console.log(`Progress: ${(torrent.progress * 100).toFixed(1)}%`);
          console.log(
            `Download speed: ${(torrent.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s`
          );
          console.log(`Upload speed: ${(torrent.uploadSpeed / 1024 / 1024).toFixed(2)} MB/s`);
          console.log(`Peers: ${torrent.numPeers}`);

          // Update tray
          updateActiveProcess(processId, {
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peers: torrent.numPeers,
            activeConnections,
          });

          if (torrent.done) {
            clearInterval(progressInterval!);
          }
        }, 5000);
      });
    })
    .catch((error) => {
      console.error("Error loading webtorrent:", error);
    });
};

