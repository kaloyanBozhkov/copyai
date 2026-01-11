import { exec } from "child_process";
import path from "path";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import { dialog } from "electron";
import fs from "fs";
import { Readable } from "stream";
import {
  addActiveProcess,
  removeActiveProcess,
  updateActiveProcess,
} from "../../electron/tray";
import { applyFileSelection } from "./selectTorrentFiles";

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
    const progressPercent = (process.progress * 100).toFixed(1);

    let label = `▶ ${process.name}`;

    // Show streaming status when complete
    if (progressPercent === "100.0") {
      label += `\n   🎬 STREAMING • ${process.activeConnections} active viewers`;
    } else {
      const speedMB = (process.downloadSpeed / 1024 / 1024).toFixed(2);
      label += `\n   ${progressPercent}% • ${speedMB} MB/s • ${process.peers} peers • ${process.activeConnections} conn`;
    }

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
  onTerminate: (streamProcess: StreamProcess) => {
    // Force immediate cleanup without waiting for timers
    console.log(`Force terminating stream: ${streamProcess.name}`);

    // Clean up the download folder immediately
    const movieFolderPath = path.join(
      streamProcess.downloadPath,
      streamProcess.torrentName
    );

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

const extractSubtitles = (movieFile: any, movieFolderPath: string) => {
  const moviePath = path.join(movieFolderPath, movieFile.name);

  console.log(`Checking for subtitles in: ${moviePath}`);

  // First, probe the file to find subtitle streams
  exec(
    `ffprobe -v error -select_streams s -show_entries stream=index:stream_tags=language -of json "${moviePath}"`,
    (error, stdout, stderr) => {
      if (error) {
        console.log("No subtitles found or ffprobe not available");
        return;
      }

      try {
        const probeData = JSON.parse(stdout);
        const subtitleStreams = probeData.streams || [];

        if (subtitleStreams.length === 0) {
          console.log("No embedded subtitles found");
          return;
        }

        console.log(`Found ${subtitleStreams.length} subtitle stream(s)`);

        // Extract each subtitle stream
        subtitleStreams.forEach((stream: any, idx: number) => {
          const language = stream.tags?.language || `track${idx}`;
          const streamIndex = stream.index;
          const baseName = path.basename(
            movieFile.name,
            path.extname(movieFile.name)
          );
          const subtitlePath = path.join(
            movieFolderPath,
            `${baseName}.${language}.srt`
          );

          exec(
            `ffmpeg -i "${moviePath}" -map 0:${streamIndex} -c:s srt "${subtitlePath}" -y`,
            (extractError) => {
              if (extractError) {
                console.error(
                  `Failed to extract subtitle ${language}:`,
                  extractError.message
                );
                return;
              }
              console.log(`Extracted subtitle: ${subtitlePath}`);
            }
          );
        });
      } catch (parseError) {
        console.error("Failed to parse ffprobe output:", parseError);
      }
    }
  );
};

const buildVideoPlayerHTML = (videoUrl: string, videoName: string): string => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${videoName}</title>
  <link href="https://vjs.zencdn.net/8.6.1/video-js.css" rel="stylesheet" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      font-family: Arial, sans-serif;
    }
    .video-container {
      width: 100%;
      max-width: 1920px;
      height: 100vh;
    }
    .video-js {
      width: 100%;
      height: 100%;
    }
    .error-log {
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(255, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-size: 12px;
      max-width: 400px;
      z-index: 10000;
      display: none;
    }
  </style>
</head>
<body>
  <div class="error-log" id="error-log"></div>
  <div class="video-container">
    <video
      id="video-player"
      class="video-js vjs-default-skin"
      controls
      preload="auto"
      crossorigin="anonymous"
      data-setup="{}"
    >
      <source src="${videoUrl}" type="video/mp4" />
      <p class="vjs-no-js">
        To view this video please enable JavaScript, and consider upgrading to a web browser that
        <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>.
      </p>
    </video>
  </div>
  <script src="https://vjs.zencdn.net/8.6.1/video.min.js"></script>
  <script>
    const errorLog = document.getElementById('error-log');
    function showError(msg) {
      errorLog.textContent = msg;
      errorLog.style.display = 'block';
      console.error(msg);
    }
    
    const player = videojs('video-player', {
      fluid: true,
      responsive: true,
      playbackRates: [0.5, 1, 1.25, 1.5, 2],
      controls: true,
      preload: 'auto',
      html5: {
        vhs: {
          overrideNative: false
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false
      }
    });
    
    player.ready(function() {
      console.log('Video.js player ready');
    });
    
    player.on('error', function() {
      const error = player.error();
      if (error) {
        showError('Player Error: ' + error.code + ' - ' + error.message);
      }
    });
    
    player.on('loadstart', function() {
      console.log('Load start');
    });
    
    player.on('loadedmetadata', function() {
      console.log('Metadata loaded');
    });
    
    player.on('loadeddata', function() {
      console.log('Data loaded');
    });
    
    player.on('canplay', function() {
      console.log('Can play');
    });
    
    player.on('waiting', function() {
      console.log('Waiting for data');
    });
    
    player.on('stalled', function() {
      showError('Video stalled - buffering');
    });
    
    // Track loaded subtitles to avoid duplicates
    const loadedSubtitles = new Set();
    
    // Poll for subtitles every 5 seconds
    function checkForSubtitles() {
      fetch('/subtitles')
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.subtitles && data.subtitles.length > 0) {
            data.subtitles.forEach(function(sub, index) {
              if (!loadedSubtitles.has(sub.filename)) {
                console.log('Adding subtitle track:', sub.label);
                player.addRemoteTextTrack({
                  kind: 'captions',
                  src: sub.url,
                  srclang: sub.language,
                  label: sub.label,
                  default: index === 0
                }, false);
                loadedSubtitles.add(sub.filename);
              }
            });
          }
        })
        .catch(function(err) {
          console.log('No subtitles available yet');
        });
    }
    
    // Check immediately and then every 5 seconds
    checkForSubtitles();
    setInterval(checkForSubtitles, 5000);
    
    // Try to play after a short delay
    setTimeout(function() {
      player.play().catch(function(err) {
        showError('Play failed: ' + err.message);
      });
    }, 500);
  </script>
</body>
</html>`;
};

export const streamMovie = async ({
  magnetLinkUrl,
  downloadPath,
  searchQuery,
}: {
  magnetLinkUrl: string;
  downloadPath: string;
  searchQuery: string;
}) => {
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

      // Add error handler for client
      client.on('error', (err: Error) => {
        console.error('WebTorrent client error:', err);
      });

      client.add(magnetLinkUrl, { path: downloadPath }, async (torrent: any) => {
        console.log(`Starting stream: ${torrent.name}`);

        // Add error handler for torrent
        torrent.on('error', (err: Error) => {
          console.error('Torrent error:', err);
        });

        // Use AI to select the right files based on search query (prioritize for streaming)
        const movieFile = await applyFileSelection(torrent, searchQuery, {
          prioritize: true,
        });

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
            try {
              if (idleCheckInterval) clearInterval(idleCheckInterval);
              if (progressInterval) clearInterval(progressInterval);
              if (server && server.listening) {
                server.close();
              }
              if (client && !client.destroyed) {
                client.destroy();
              }
            } catch (error) {
              console.error("Error during stream cleanup:", error);
            }
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
              console.log(
                "No active connections. Starting 5-minute idle timer..."
              );
            }

            const idleTime = Date.now() - lastConnectionCloseTime;
            const fiveMinutes = 5 * 60 * 1000;

            if (idleTime >= fiveMinutes) {
              console.log(
                "5 minutes of inactivity reached. Shutting down stream server..."
              );
              cleanup();
            }
          }
        };

        const server = http.createServer((req, res) => {
          activeConnections++;
          lastConnectionCloseTime = null; // Reset idle timer when new connection comes in
          console.log(
            `Active connections: ${activeConnections} - ${req.method} ${req.url}`
          );

          // Set CORS headers for all responses
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
          res.setHeader(
            "Access-Control-Allow-Headers",
            "Range, Content-Type, Accept"
          );
          res.setHeader(
            "Access-Control-Expose-Headers",
            "Content-Range, Content-Length, Accept-Ranges"
          );

          // Handle OPTIONS preflight
          if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
          }

          // Update tray with new connection count
          updateActiveProcess(processId, {
            activeConnections,
          });

          let fileStream: Readable | null = null;

          res.on("close", () => {
            // Clean up file stream if it exists
            if (fileStream && !fileStream.destroyed) {
              fileStream.destroy();
              fileStream = null;
            }

            activeConnections--;
            console.log(
              `Connection closed. Active connections: ${activeConnections}`
            );

            // Update tray with new connection count
            updateActiveProcess(processId, {
              activeConnections,
            });

            checkAndCleanup();
          });

          res.on("error", (err: Error) => {
            // Clean up file stream on response error
            if (fileStream && !fileStream.destroyed) {
              fileStream.destroy();
              fileStream = null;
            }
            // Only log unexpected errors (ignore expected close errors)
            const expectedErrors = [
              "write after end",
              "Cannot write after response ended",
              "Writable stream closed prematurely",
              "socket hang up",
              "ECONNRESET",
            ];
            if (!expectedErrors.some((e) => err.message.includes(e))) {
              console.error("Response error:", err.message);
            }
          });

          // Serve HTML player at root path
          if (req.url === "/" || req.url === "") {
            // Use relative URL so it works from any IP/hostname
            const videoUrl = "/video";
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.writeHead(200);
            res.end(buildVideoPlayerHTML(videoUrl, movieFile.name));
            return;
          }

          // Serve subtitle list endpoint
          if (req.url === "/subtitles") {
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);

            try {
              const files = fs.readdirSync(movieFolderPath);
              const subtitles = files
                .filter((f) => f.endsWith(".srt"))
                .map((f) => {
                  const match = f.match(/\.([a-z]{2,3})\.srt$/i);
                  const language = match ? match[1] : "unknown";
                  return {
                    filename: f,
                    url: `/subtitles/${encodeURIComponent(f)}`,
                    language: language,
                    label: language.toUpperCase(),
                  };
                });
              res.end(JSON.stringify({ subtitles }));
            } catch (err) {
              res.end(JSON.stringify({ subtitles: [] }));
            }
            return;
          }

          // Serve subtitle files
          if (req.url?.startsWith("/subtitles/")) {
            const filename = decodeURIComponent(
              req.url.replace("/subtitles/", "")
            );
            const subtitlePath = path.join(movieFolderPath, filename);

            if (fs.existsSync(subtitlePath) && filename.endsWith(".srt")) {
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.writeHead(200);
              fs.createReadStream(subtitlePath).pipe(res);
            } else {
              res.writeHead(404);
              res.end("Subtitle not found");
            }
            return;
          }

          // Serve video at /video path
          if (req.url === "/video" || req.url?.startsWith("/video")) {
            // Determine content type based on file extension
            const fileName = movieFile.name.toLowerCase();
            let contentType = "video/mp4";
            if (fileName.endsWith(".mkv")) contentType = "video/x-matroska";
            else if (fileName.endsWith(".webm")) contentType = "video/webm";
            else if (fileName.endsWith(".avi")) contentType = "video/x-msvideo";

            res.setHeader("Content-Type", contentType);
            res.setHeader("Accept-Ranges", "bytes");
            res.setHeader("Cache-Control", "no-cache");

            // Handle range requests
            const rangeHeader = req.headers.range || req.headers["range"];

            if (rangeHeader) {
              // Parse range header more robustly
              const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
              if (rangeMatch) {
                const start = parseInt(rangeMatch[1], 10);
                const end = rangeMatch[2]
                  ? parseInt(rangeMatch[2], 10)
                  : movieFile.length - 1;

                // Validate range
                if (start >= 0 && start < movieFile.length && end >= start) {
                  const endPos = Math.min(end, movieFile.length - 1);
                  const chunksize = endPos - start + 1;

                  res.writeHead(206, {
                    "Content-Range": `bytes ${start}-${endPos}/${movieFile.length}`,
                    "Content-Length": chunksize,
                  });

                  console.log(
                    `Serving range: ${start}-${endPos} (${chunksize} bytes)`
                  );
                  const stream = movieFile.createReadStream({
                    start,
                    end: endPos,
                  });
                  fileStream = stream;
                  const currentStream = stream;

                  currentStream.on("error", (err: Error) => {
                    // Expected errors when user closes connection
                    const expectedErrors = [
                      "Writable stream closed prematurely",
                      "write after end",
                      "Cannot write after response ended",
                      "socket hang up",
                      "ECONNRESET",
                    ];

                    if (expectedErrors.some((e) => err.message.includes(e))) {
                      // Silently handle expected close errors
                      if (currentStream && !currentStream.destroyed) {
                        currentStream.destroy();
                      }
                      return;
                    }

                    // Only log/log unexpected errors if response is still writable
                    if (!res.destroyed && !res.closed) {
                      console.error("Stream error:", err.message);
                      if (!res.headersSent) {
                        res.writeHead(500);
                        res.end("Stream Error");
                      } else if (!res.writableEnded) {
                        res.end();
                      }
                    }
                    // Clean up stream
                    if (currentStream && !currentStream.destroyed) {
                      currentStream.destroy();
                    }
                  });

                  currentStream.on("end", () => {
                    if (fileStream === currentStream) {
                      fileStream = null;
                    }
                  });

                  currentStream.pipe(res, { end: true });
                  return;
                }
              }
            }

            // No valid range request, send full file or initial chunk
            // Some TV browsers need initial range even if not requested
            const initialChunkSize = Math.min(1024 * 1024, movieFile.length); // 1MB or file size

            res.setHeader("Content-Length", movieFile.length);
            res.setHeader(
              "Content-Range",
              `bytes 0-${movieFile.length - 1}/${movieFile.length}`
            );

            res.writeHead(200);
            console.log(`Serving full file: ${movieFile.length} bytes`);
            const stream = movieFile.createReadStream();
            fileStream = stream;
            const currentStream = stream;

            currentStream.on("error", (err: Error) => {
              // Expected errors when user closes connection
              const expectedErrors = [
                "Writable stream closed prematurely",
                "write after end",
                "Cannot write after response ended",
                "socket hang up",
                "ECONNRESET",
              ];

              if (expectedErrors.some((e) => err.message.includes(e))) {
                // Silently handle expected close errors
                if (currentStream && !currentStream.destroyed) {
                  currentStream.destroy();
                }
                return;
              }

              // Only log unexpected errors if response is still writable
              if (!res.destroyed && !res.closed) {
                console.error("Stream error:", err.message);
                if (!res.headersSent) {
                  res.writeHead(500);
                  res.end("Stream Error");
                } else if (!res.writableEnded) {
                  res.end();
                }
              }
              // Clean up stream
              if (currentStream && !currentStream.destroyed) {
                currentStream.destroy();
              }
            });

            currentStream.on("end", () => {
              if (fileStream === currentStream) {
                fileStream = null;
              }
            });

            currentStream.pipe(res, { end: true });
            return;
          }

          // 404 for other paths
          res.writeHead(404);
          res.end("Not Found");
        });

        server.listen(port, "0.0.0.0", () => {
          const streamUrl = `http://localhost:${port}`;
          console.log(`Movie streaming at: ${streamUrl}`);
          console.log(`Movie: ${movieFile.name}`);
          console.log(`Access from TV: http://koko-mac.com:${port}`);

          // Open in default video player (usually QuickTime on macOS)
          exec(`open "${streamUrl}"`);
        });

        // Check if movie file download is complete
        const checkMovieFileComplete = () => {
          if (!movieFile.done) return false;

          downloadComplete = true;
          console.log(`✓ Download complete: ${movieFile.name}`);
          console.log(
            "Stream server will remain active while connections exist"
          );

          // Update tray to show streaming status
          updateActiveProcess(processId, {
            progress: 1,
            downloadSpeed: 0,
            uploadSpeed: 0,
            name: `${movieFile.name} - STREAMING`,
          });

          // Extract subtitles from movie file if any exist
          console.log("Starting subtitle extraction...");
          extractSubtitles(movieFile, movieFolderPath);

          // Start checking every minute for idle timeout
          idleCheckInterval = setInterval(checkAndCleanup, 60 * 1000);
          checkAndCleanup();
          return true;
        };

        torrent.on("done", () => {
          if (!downloadComplete) {
            checkMovieFileComplete();
          }
        });

        // Cleanup function
        const cleanup = () => {
          console.log("Shutting down stream server...");
          try {
            if (idleCheckInterval) clearInterval(idleCheckInterval);
            if (progressInterval) clearInterval(progressInterval);
            if (server && server.listening) {
              server.close();
            }
            if (client && !client.destroyed) {
              client.destroy();
            }
          } catch (error) {
            console.error("Error during stream cleanup:", error);
          } finally {
            removeActiveProcess(processId);
            activeServer = null;
          }
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
          console.log(
            `Upload speed: ${(torrent.uploadSpeed / 1024 / 1024).toFixed(2)} MB/s`
          );
          console.log(`Peers: ${torrent.numPeers}`);

          // Update tray
          updateActiveProcess(processId, {
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peers: torrent.numPeers,
            activeConnections,
          });

          // Check if movie file is complete (since we only selected one file)
          // Use >= 0.999 to catch cases where progress might be very close to 1
          if (!downloadComplete && torrent.progress >= 0.999) {
            checkMovieFileComplete();
          }

          if (torrent.done || downloadComplete) {
            clearInterval(progressInterval!);
          }
        }, 5000);

        // Check immediately if already complete (e.g., previously downloaded)
        if (torrent.progress >= 0.999) {
          setTimeout(() => {
            if (!downloadComplete) {
              console.log("File appears to be already downloaded, checking...");
              checkMovieFileComplete();
            }
          }, 2000);
        }
      });
    })
    .catch((error) => {
      console.error("Error loading webtorrent:", error);
    });
};
