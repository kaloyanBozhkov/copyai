import lgtv from "lgtv2";
import path from "path";
import os from "os";
import fs from "fs";
import appsMap from "./apps.json";

// Disable SSL verification for LG TV's self-signed certificate
// Only affects this connection, safe for local network
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// Use secure WebSocket for newer LG WebOS
const TV_URL = process.env.LG_TV_URL || "wss://192.168.1.70:3001";
const KEY_FILE_PATH = path.join(os.homedir(), ".copyai", "lg-tv-key");

// Create reverse map for app name -> app ID lookup
const appsNameToId: Record<string, string> = Object.entries(appsMap).reduce(
  (acc, [id, name]) => {
    acc[name.toLowerCase()] = id;
    return acc;
  },
  {} as Record<string, string>
);

/**
 * Ensure the .copyai directory exists
 */
const ensureConfigDir = (): void => {
  const configDir = path.dirname(KEY_FILE_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
};

/**
 * Check if the key file exists
 */
export const hasKeyFile = (): boolean => {
  console.log("KEY_FILE_PATH", KEY_FILE_PATH);
  return fs.existsSync(KEY_FILE_PATH);
};

/**
 * Connect to LG TV and execute a command
 */
const connectAndExecute = <T>(
  action: (tv: any) => Promise<T>
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const config: any = {
      url: TV_URL,
      timeout: 10000,
      reconnect: false,
      // Disable SSL certificate validation for self-signed certs
      wsOptions: {
        rejectUnauthorized: false,
      },
    };

    if (hasKeyFile()) {
      config.keyFile = KEY_FILE_PATH;
    }

    let tvInstance: any = null;
    
    try {
      tvInstance = lgtv(config);
    } catch (error) {
      reject(error);
      return;
    }

    const cleanup = () => {
      if (tvInstance) {
        try {
          tvInstance.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
      }
    };

    // Set timeout
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Connection timeout"));
    }, 10000);

    tvInstance.on("connect", async () => {
      clearTimeout(timeout);
      console.log("✓ Connected to TV");
      try {
        const result = await action(tvInstance);
        cleanup();
        resolve(result);
      } catch (error) {
        cleanup();
        reject(error);
      }
    });

    tvInstance.on("error", (error: Error) => {
      clearTimeout(timeout);
      console.error("Connection error:", error);
      cleanup();
      reject(error);
    });

    tvInstance.on("close", () => {
      clearTimeout(timeout);
      cleanup();
      reject(new Error("Connection closed unexpectedly"));
    });
  });
};

/**
 * Turn on the LG TV
 */
export const turnOnTV = async (): Promise<string> => {
  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request("ssap://system/turnOn", (err: Error, res: any) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    });
    return "TV turned on";
  } catch (error) {
    return `Failed to turn on TV: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Turn off the LG TV
 */
export const turnOffTV = async (): Promise<string> => {
  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request("ssap://system/turnOff", (err: Error, res: any) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    });
    return "TV turned off";
  } catch (error) {
    return `Failed to turn off TV: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Set the volume of the LG TV
 * @param volume - Volume level from 0 to 100
 */
export const setTVVolume = async (volume: number): Promise<string> => {
  if (volume < 0 || volume > 100) {
    return "Volume must be between 0 and 100";
  }

  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request(
          "ssap://audio/setVolume",
          { volume },
          (err: Error, res: any) => {
            if (err) reject(err);
            else resolve(res);
          }
        );
      });
    });
    return `TV volume set to ${volume}%`;
  } catch (error) {
    return `Failed to set TV volume: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Launch an app on the LG TV
 * @param appIdOrName - The app ID (e.g., "netflix") or app name (e.g., "Netflix")
 */
export const launchTVApp = async (appIdOrName: string): Promise<string> => {
  if (!appIdOrName) {
    return "No app ID or name provided";
  }

  // Check if it's an app ID (exists in appsMap keys)
  let appId = appIdOrName;
  
  // If not found as ID, try to find by name (case-insensitive exact match)
  if (!appsMap[appIdOrName as keyof typeof appsMap]) {
    const foundId = appsNameToId[appIdOrName.toLowerCase()];
    if (foundId) {
      appId = foundId;
    }
    // If still not found, use the input as-is (might be a system app not in our list)
  }

  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request(
          "ssap://system.launcher/launch",
          { id: appId },
          (err: Error, res: any) => {
            if (err) reject(err);
            else resolve(res);
          }
        );
      });
    });
    return `Launched app: ${appId}`;
  } catch (error) {
    return `Failed to launch app: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Open YouTube with a search query or video
 * @param query - Search query or video ID/URL
 * @param accountIndex - Optional account index (0-based, e.g., 0 for first account, 1 for second)
 */
export const openYouTube = async (query: string, accountIndex?: number): Promise<string> => {
  if (!query) {
    return "No search query or video provided";
  }

  let youtubeUrl: string;

  // Check if it's a YouTube video URL or ID
  const videoIdMatch = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|^)([a-zA-Z0-9_-]{11})/);
  
  if (videoIdMatch) {
    // It's a video ID or URL
    const videoId = videoIdMatch[1];
    youtubeUrl = `https://www.youtube.com/tv#/watch/video/idle?v=${videoId}`;
  } else {
    // It's a search query
    const encodedQuery = encodeURIComponent(query);
    youtubeUrl = `https://www.youtube.com/tv#/search?q=${encodedQuery}`;
  }

  // Add account index if specified (experimental - might not work on all TVs)
  if (accountIndex !== undefined && accountIndex >= 0) {
    youtubeUrl += `&authuser=${accountIndex}`;
  }

  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request(
          "ssap://system.launcher/open",
          {
            target: youtubeUrl,
          },
          (err: Error, res: any) => {
            if (err) reject(err);
            else resolve(res);
          }
        );
      });
    });
    return `Opened YouTube: ${query}${accountIndex !== undefined ? ` (account ${accountIndex})` : ""}`;
  } catch (error) {
    return `Failed to open YouTube: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Open Spotify web player with a search query
 * @param query - Search query for a song/artist/album
 */
export const openSpotify = async (query: string): Promise<string> => {
  if (!query) {
    return "No search query provided";
  }

  const encodedQuery = encodeURIComponent(query);
  const spotifyUrl = `https://open.spotify.com/search/${encodedQuery}`;

  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request(
          "ssap://system.launcher/open",
          {
            target: spotifyUrl,
          },
          (err: Error, res: any) => {
            if (err) reject(err);
            else resolve(res);
          }
        );
      });
    });
    return `Opened Spotify web player and searched for: ${query}`;
  } catch (error) {
    return `Failed to open Spotify: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Open web browser at a specific URL on the LG TV
 * @param url - The URL to open (e.g., "https://www.google.com")
 */
export const openTVBrowser = async (url: string): Promise<string> => {
  if (!url) {
    return "No URL provided";
  }

  // Add protocol if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request(
          "ssap://system.launcher/open",
          {
            target: url,
          },
          (err: Error, res: any) => {
            if (err) reject(err);
            else resolve(res);
          }
        );
      });
    });
    return `Opened browser at: ${url}`;
  } catch (error) {
    return `Failed to open browser: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * List available apps on the LG TV
 */
export const listTVApps = async (): Promise<string> => {
  try {
    const apps = await connectAndExecute(async (tv) => {
      return new Promise<any[]>((resolve, reject) => {
        tv.request("ssap://com.webos.applicationManager/listApps", (err: Error, res: any) => {
          if (err) reject(err);
          else resolve(res.apps || []);
        });
      });
    });

    if (!apps || apps.length === 0) {
      return "No apps found";
    }

    // Format app list
    const appList = apps
      .map((app: any) => `${app.title || app.id}: ${app.id}`)
      .join("\n");

    return `Available apps:\n${appList}`;
  } catch (error) {
    return `Failed to list apps: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Setup TV pairing and save the key file
 * @param force - Force re-pairing even if key exists
 */
export const setupTV = async (force: boolean = false): Promise<string> => {
  try {
    // Check if key already exists
    if (!force && hasKeyFile()) {
      return `TV already paired. Use 'force' flag to re-pair. Key file: ${KEY_FILE_PATH}`;
    }

    // Remove existing key file if forcing
    if (force && hasKeyFile()) {
      fs.unlinkSync(KEY_FILE_PATH);
    }

    ensureConfigDir();
    console.log(`Attempting to connect to TV at ${TV_URL}...`);

    return await new Promise((resolve, reject) => {
      let tvInstance: any = null;

      const cleanup = () => {
        if (tvInstance) {
          try {
            tvInstance.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
        }
      };

      // Set timeout
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Setup timeout - TV not responding"));
      }, 15000);

      try {
        tvInstance = lgtv({
          url: TV_URL,
          timeout: 15000,
          reconnect: false,
          keyFile: KEY_FILE_PATH,
          // Disable SSL certificate validation for self-signed certs
          wsOptions: {
            rejectUnauthorized: false,
          },
        });
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
        return;
      }

      let prompted = false;

      tvInstance.on("prompt", () => {
        prompted = true;
        console.log("✓ TV responded! Please accept the pairing request on your TV screen...");
      });

      tvInstance.on("connect", () => {
        clearTimeout(timeout);
        cleanup();
        if (prompted) {
          resolve(`TV paired successfully! Key saved to: ${KEY_FILE_PATH}`);
        } else {
          resolve(
            `TV connected (key already existed). Key file: ${KEY_FILE_PATH}`
          );
        }
      });

      tvInstance.on("error", (error: Error) => {
        clearTimeout(timeout);
        console.error("Setup error:", error);
        cleanup();
        reject(error);
      });

      tvInstance.on("close", () => {
        clearTimeout(timeout);
        cleanup();
        reject(new Error("Connection closed during setup"));
      });
    });
  } catch (error) {
    return `Failed to setup TV: ${error instanceof Error ? error.message : String(error)}`;
  }
};
