/* eslint-disable @typescript-eslint/no-explicit-any */
import lgtv from "lgtv2";
import WebSocket, { RawData } from "ws";
import path from "path";
import os from "os";
import fs from "fs";
import dgram from "dgram";
import appsMap from "./apps.json";
import { getApiKey } from "../../kitchen/grimoireSettings";

// Disable SSL verification for LG TV's self-signed certificate
// Only affects this connection, safe for local network
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// WebSocket connection to LG TV (wss:// for secure connection)
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
        } catch {
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

// TV MAC address for Wake-on-LAN (from Grimoire Settings)
const getTV_MAC = () => getApiKey("LG_TV_MAC") || "7C:64:6C:A0:E4:51";

/**
 * Send a single WOL magic packet on one socket, reused for all targets.
 */
const sendWOL = (mac: string): Promise<void> => {
  const macBytes = Buffer.from(mac.replace(/:/g, ""), "hex");
  const packet = Buffer.concat([
    Buffer.alloc(6, 0xff),
    ...Array(16).fill(macBytes),
  ]);

  return new Promise<void>((resolve, reject) => {
    const sock = dgram.createSocket("udp4");
    sock.once("error", (err) => {
      sock.close();
      reject(err);
    });
    sock.bind(() => {
      sock.setBroadcast(true);

      const targets = [
        { addr: "255.255.255.255", port: 9 },
        { addr: "192.168.1.255", port: 9 },
        { addr: "192.168.0.255", port: 9 },
      ];

      let i = 0;
      const sendNext = () => {
        if (i >= targets.length) {
          // Small delay before close so the last packet flushes
          setTimeout(() => sock.close(), 50);
          resolve();
          return;
        }
        const { addr, port } = targets[i++];
        sock.send(packet, 0, packet.length, port, addr, (err) => {
          if (err) console.error(`WOL send error to ${addr}:${port}:`, err);
          sendNext();
        });
      };
      sendNext();
    });
  });
};

/**
 * Check if the TV is reachable by attempting a WebSocket connection.
 */
const isTVAwake = (): Promise<boolean> =>
  new Promise((resolve) => {
    const ws = new WebSocket(TV_URL, { rejectUnauthorized: false });
    const timer = setTimeout(() => {
      ws.close();
      resolve(false);
    }, 3000);
    ws.on("open", () => {
      clearTimeout(timer);
      ws.close();
      resolve(true);
    });
    ws.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });

/**
 * Ensure the TV is on — check first, send WOL if needed.
 * Returns true if the TV is confirmed awake, false otherwise.
 */
export const ensureTVOn = async (): Promise<boolean> => {
  if (await isTVAwake()) return true;
  console.log("TV is off, sending WOL...");
  const result = await turnOnTV();
  return result.startsWith("TV is on");
};

/**
 * Turn on the LG TV via Wake-on-LAN, then confirm it's awake.
 */
export const turnOnTV = async (): Promise<string> => {
  const mac = getTV_MAC();
  const maxAttempts = 5;
  const pollInterval = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sendWOL(mac);
    } catch (error) {
      console.error(`WOL attempt ${attempt} failed:`, error);
    }

    // Wait then check if TV is responding
    await new Promise((r) => setTimeout(r, pollInterval));

    if (await isTVAwake()) {
      return `TV is on (confirmed after ${attempt} attempt${attempt > 1 ? "s" : ""})`;
    }

    console.log(`TV not responding yet (attempt ${attempt}/${maxAttempts})...`);
  }

  return "WOL packets sent but TV did not respond within timeout — it may still be booting";
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
 * Turn off the TV screen (display only, TV stays on)
 */
export const turnOffTVScreen = async (): Promise<string> => {
  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request("ssap://com.webos.service.tvpower/power/turnOffScreen", (err: Error, res: any) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    });
    return "TV screen turned off";
  } catch (error) {
    return `Failed to turn off TV screen: ${error instanceof Error ? error.message : String(error)}`;
  }
};

/**
 * Turn on the TV screen
 */
export const turnOnTVScreen = async (): Promise<string> => {
  try {
    await connectAndExecute(async (tv) => {
      return new Promise((resolve, reject) => {
        tv.request("ssap://com.webos.service.tvpower/power/turnOnScreen", (err: Error, res: any) => {
          if (err) reject(err);
          else resolve(res);
        });
      });
    });
    return "TV screen turned on";
  } catch (error) {
    return `Failed to turn on TV screen: ${error instanceof Error ? error.message : String(error)}`;
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
 * Get the LG TV handshake payload for pairing
 */
const getHandshakePayload = (existingKey: string | null) => ({
  type: "register",
  id: "register_0",
  payload: {
    forcePairing: false,
    pairingType: "PROMPT",
    "client-key": existingKey || undefined,
    manifest: {
      manifestVersion: 1,
      appVersion: "1.1",
      signed: {
        created: "20140509",
        appId: "com.lge.test",
        vendorId: "com.lge",
        localizedAppNames: {
          "": "LG Remote App",
          "ko-KR": "LG Remote App",
          "zxx-XX": "LG Remote App",
        },
        localizedVendorNames: { "": "LG Electronics" },
        permissions: [
          "TEST_SECURE", "CONTROL_INPUT_TEXT", "CONTROL_MOUSE_AND_KEYBOARD",
          "READ_INSTALLED_APPS", "READ_LGE_SDX", "READ_NOTIFICATIONS", "SEARCH",
          "WRITE_SETTINGS", "WRITE_NOTIFICATION_ALERT", "CONTROL_POWER",
          "READ_CURRENT_CHANNEL", "READ_RUNNING_APPS", "READ_UPDATE_INFO",
          "UPDATE_FROM_REMOTE_APP", "READ_LGE_TV_INPUT_EVENTS", "READ_TV_CURRENT_TIME",
        ],
        serial: "SerialNumber",
      },
      permissions: [
        "LAUNCH", "LAUNCH_WEBAPP", "APP_TO_APP", "CLOSE", "TEST_OPEN", "TEST_PROTECTED",
        "CONTROL_AUDIO", "CONTROL_DISPLAY", "CONTROL_INPUT_JOYSTICK",
        "CONTROL_INPUT_MEDIA_RECORDING", "CONTROL_INPUT_MEDIA_PLAYBACK",
        "CONTROL_INPUT_TV", "CONTROL_POWER", "CONTROL_TV_SCREEN", "READ_APP_STATUS", "READ_CURRENT_CHANNEL",
        "READ_INPUT_DEVICE_LIST", "READ_NETWORK_STATE", "READ_RUNNING_APPS",
        "READ_TV_CHANNEL_LIST", "WRITE_NOTIFICATION_TOAST", "READ_POWER_STATE",
        "READ_COUNTRY_INFO",
      ],
      signatures: [{
        signatureVersion: 1,
        signature: "eyJhbGdvcml0aG0iOiJSU0EtU0hBMjU2Iiwia2V5SWQiOiJ0ZXN0LXNpZ25pbmctY2VydCIsInNpZ25hdHVyZVZlcnNpb24iOjF9.hrVRgjCwXVvE2OOSpDZ58hR+59aFNwYDyjQgKk3auukd7pcegmE2CzPCa0bJ0ZsRAcKkCTJrWo5iDzNhMBWRyaMOv5zWSrthlf7G128qvIlpMT0YNY+n/FaOHE73uLrS/g7swl3/qH/BGFG2Hu4RlL48eb3lLKqTt2xKHdCs6Cd4RMfJPYnzgvI4BNrFUKsjkcu+WD4OO2A27Pq1n50cMchmcaXadJhGrOqH5YmHdOCj5NSHzJYrsW0HPlpuAx/ECMeIZYDh6RMqaFM2DXzdKX9NmmyqzJ3o/0lkk/N97gfVRLW5hA29yeAwaCViZNCP8iC9aO0q9fQojoa7NQnAtw==",
      }],
    },
  },
});

/**
 * Setup TV pairing and save the key file using raw WebSocket
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

    // Get existing key if available
    let existingKey: string | null = null;
    if (fs.existsSync(KEY_FILE_PATH)) {
      try {
        existingKey = fs.readFileSync(KEY_FILE_PATH, "utf8").trim() || null;
      } catch {
        existingKey = null;
      }
    }

    return await new Promise((resolve, reject) => {
      const ws = new WebSocket(TV_URL, { rejectUnauthorized: false });

      const timeoutId = setTimeout(() => {
        ws.close();
        reject(new Error("Setup timeout - TV not responding after 30s"));
      }, 30000);

      ws.on("open", () => {
        console.log("✓ WebSocket connected, sending handshake...");
        console.log("👀 Check your TV screen for a pairing prompt!");
        ws.send(JSON.stringify(getHandshakePayload(existingKey)));
      });

      ws.on("message", (data: RawData) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === "registered") {
            clearTimeout(timeoutId);
            const clientKey = msg.payload?.["client-key"];

            if (clientKey) {
              fs.writeFileSync(KEY_FILE_PATH, clientKey);
              console.log("✓ Pairing successful!");
              ws.close();
              resolve(`TV paired successfully! Key saved to: ${KEY_FILE_PATH}`);
            } else {
              ws.close();
              resolve(`TV connected (using existing key). Key file: ${KEY_FILE_PATH}`);
            }
          } else if (msg.type === "error") {
            clearTimeout(timeoutId);
            ws.close();
            reject(new Error(`TV error: ${msg.error || "Unknown error"}`));
          }
        } catch {
          console.log("Raw message:", data.toString().substring(0, 200));
        }
      });

      ws.on("error", (err: Error) => {
        clearTimeout(timeoutId);
        console.error("Setup error:", err);
        reject(err);
      });

      ws.on("close", () => {
        clearTimeout(timeoutId);
      });
    });
  } catch (error) {
    return `Failed to setup TV: ${error instanceof Error ? error.message : String(error)}`;
  }
};
