import { exec } from "child_process";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { dialog } from "electron";
import fs from "fs";

export interface DownloadProcess {
  id: string;
  type: "download";
  name: string;
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  peers: number;
  downloadPath: string;
  torrentName: string;
  cleanup: () => void;
}

export const downloadProcessUI = {
  getLabel: (process: DownloadProcess) => {
    const speedMB = (process.downloadSpeed / 1024 / 1024).toFixed(2);
    const progressPercent = (process.progress * 100).toFixed(1);
    
    let label = `⬇ ${process.name}`;
    label += `\n   ${progressPercent}% • ${speedMB} MB/s • ${process.peers} peers`;
    return label;
  },
  onClick: (process: DownloadProcess) => {
    const response = dialog.showMessageBoxSync({
      type: "question",
      buttons: ["Cancel", "Terminate"],
      defaultId: 0,
      title: "Terminate Download",
      message: "Do you want to terminate this download?",
      detail: process.name,
    });

    if (response === 1) {
      return true; // Signal to terminate
    }
    return false;
  },
  onTerminate: (process: DownloadProcess) => {
    // Clean up the download folder
    const movieFolderPath = path.join(process.downloadPath, process.torrentName);
    
    if (fs.existsSync(movieFolderPath)) {
      console.log(`Cleaning up download folder: ${movieFolderPath}`);
      fs.rmSync(movieFolderPath, { recursive: true, force: true });
      console.log(`Deleted: ${movieFolderPath}`);
    }
  },
};

export const downloadMovie = async ({
  magnetLinkUrl,
  downloadPath,
}: {
  magnetLinkUrl: string;
  downloadPath: string;
}) => {
  const processId = uuidv4();
  // Import tray functions dynamically to avoid circular deps
  const { addActiveProcess, updateActiveProcess, removeActiveProcess } = await import("../../electron/tray");
  // Dynamic import for ESM module (using eval to prevent TS from compiling to require)
  (eval('import("webtorrent")') as Promise<any>)
    .then((WebTorrentModule) => {
      const WebTorrent = WebTorrentModule.default;
      const client = new WebTorrent();

      client.add(magnetLinkUrl, { path: downloadPath }, (torrent: any) => {
        console.log(`Starting download: ${torrent.name}`);

        // Find the largest file (the movie file)
        const movieFile = torrent.files.reduce((largest: any, file: any) =>
          file.length > largest.length ? file : largest
        );

        // Deselect all files first
        torrent.files.forEach((file: any) => file.deselect());

        // Select only the movie file
        movieFile.select();

        const movieFolderPath = path.join(downloadPath, torrent.name);

        // Add process to tray
        addActiveProcess({
          id: processId,
          type: "download",
          name: movieFile.name,
          progress: 0,
          downloadSpeed: 0,
          uploadSpeed: 0,
          peers: 0,
          downloadPath,
          torrentName: torrent.name,
          cleanup: () => {
            clearInterval(progressInterval);
            client.destroy();
          },
        } as DownloadProcess);

        torrent.on("done", () => {
          console.log(`Download complete: ${movieFile.name}`);
          // Remove from tray
          removeActiveProcess(processId);
          // Open Finder at the movie folder when done
          exec(`open "${movieFolderPath}"`, (error) => {
            if (error) {
              console.error("Error opening Finder:", error);
            }
            client.destroy();
          });
        });

        // Show progress
        const progressInterval = setInterval(() => {
          console.log(`Progress: ${(torrent.progress * 100).toFixed(1)}%`);
          console.log(
            `Download speed: ${(torrent.downloadSpeed / 1024 / 1024).toFixed(2)} MB/s`
          );
          console.log(`Peers: ${torrent.numPeers}`);

          // Update tray
          updateActiveProcess(processId, {
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            peers: torrent.numPeers,
          });

          if (torrent.done) {
            clearInterval(progressInterval);
          }
        }, 5000);
      });
    })
    .catch((error) => {
      console.error("Error loading webtorrent:", error);
    });
};
