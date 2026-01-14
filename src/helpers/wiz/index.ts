import dgram from "dgram";

const WIZ_PORT = 38899;
const BROADCAST_ADDR = "255.255.255.255";
const DISCOVERY_TIMEOUT = 2000;

// Map your Wiz roomId to human-readable names
const ROOM_CONFIG: Record<string, string> = {
  "32496282": "office", // 1
  "26395375": "living room", // 4
  "26395705": "kitchen", // 3
  "26395373": "bedroom", // 1
  "32496092": "hallway", // 3,
  "26395374": "balcony", // 1
};

interface WizDevice {
  ip: string;
  roomId?: number;
  roomName?: string;
  moduleName?: string;
}

const createBroadcastClient = (): Promise<dgram.Socket> => {
  return new Promise((resolve) => {
    const client = dgram.createSocket("udp4");
    client.bind(() => {
      client.setBroadcast(true);
      resolve(client);
    });
  });
};

const sendUdp = (
  client: dgram.Socket,
  message: Buffer,
  port: number,
  address: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    client.send(message, 0, message.length, port, address, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

export const setAllLightsState = async (state: boolean): Promise<string> => {
  const client = await createBroadcastClient();
  const message = Buffer.from(
    JSON.stringify({ method: "setPilot", params: { state } })
  );

  try {
    await sendUdp(client, message, WIZ_PORT, BROADCAST_ADDR);
    return state ? "All lights turned on" : "All lights turned off";
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  } finally {
    client.close();
  }
};

export const listRooms = async (): Promise<string> => {
  const devices = await discoverLights();
  if (devices.length === 0) return "No Wiz devices found";

  const roomMap = new Map<
    string,
    { count: number; ips: string[]; name?: string }
  >();
  for (const d of devices) {
    const id = d.roomId?.toString() ?? "unknown";
    const existing = roomMap.get(id) ?? { count: 0, ips: [], name: d.roomName };
    existing.count++;
    existing.ips.push(d.ip);
    roomMap.set(id, existing);
  }

  const lines = Array.from(roomMap.entries()).map(([id, { count, name }]) => {
    const label = name ? `${name} (${id})` : id;
    return `${label}: ${count} device(s)`;
  });

  return lines.join("\n");
};

export const discoverLights = (): Promise<WizDevice[]> => {
  return new Promise(async (resolve) => {
    const client = await createBroadcastClient();
    const devices: WizDevice[] = [];
    const discoveryMessage = Buffer.from(
      JSON.stringify({ method: "getSystemConfig", params: {} })
    );

    setTimeout(() => {
      client.close();
      resolve(devices);
    }, DISCOVERY_TIMEOUT);

    client.on("message", (msg, rinfo) => {
      try {
        const response = JSON.parse(msg.toString());
        const roomId = response.result?.roomId;
        devices.push({
          ip: rinfo.address,
          roomId,
          roomName: roomId ? ROOM_CONFIG[roomId.toString()] : undefined,
          moduleName: response.result?.moduleName,
        });
      } catch {}
    });

    await sendUdp(client, discoveryMessage, WIZ_PORT, BROADCAST_ADDR);
  });
};

export const setRoomLightsState = async (
  roomName: string,
  state: boolean
): Promise<string> => {
  const client = await createBroadcastClient();
  const foundLights: string[] = [];
  const roomLower = roomName.toLowerCase();
  const discoveryMessage = Buffer.from(
    JSON.stringify({ method: "getSystemConfig", params: {} })
  );
  const stateMessage = Buffer.from(
    JSON.stringify({ method: "setPilot", params: { state } })
  );

  return new Promise((resolve) => {
    setTimeout(() => {
      client.close();
      if (foundLights.length === 0) {
        resolve(`No lights found in room: ${roomName}`);
      } else {
        const action = state ? "Turned on" : "Turned off";
        resolve(`${action} ${foundLights.length} light(s) in ${roomName}`);
      }
    }, DISCOVERY_TIMEOUT);

    client.on("message", (msg, rinfo) => {
      try {
        const response = JSON.parse(msg.toString());
        const roomId = response.result?.roomId?.toString() ?? "";
        const roomName = ROOM_CONFIG[roomId]?.toLowerCase() ?? "";

        // Match by room name (from config) or by roomId directly
        const matches =
          (roomName && roomName.includes(roomLower)) ||
          (roomName && roomLower.includes(roomName)) ||
          roomId === roomLower;

        if (matches) {
          foundLights.push(rinfo.address);
          client.send(
            stateMessage,
            0,
            stateMessage.length,
            WIZ_PORT,
            rinfo.address
          );
        }
      } catch {}
    });

    sendUdp(client, discoveryMessage, WIZ_PORT, BROADCAST_ADDR);
  });
};

export const setAllLightsBrightness = async (
  brightness: number,
  color?: string
): Promise<string> => {
  const client = await createBroadcastClient();
  const params: any = {
    state: true,
    dimming: Math.max(0, Math.min(100, brightness)),
  };

  if (color) {
    const colorResult = parseColor(color);
    if (colorResult.type === "rgb" && colorResult.value) {
      params.r = colorResult.value.r;
      params.g = colorResult.value.g;
      params.b = colorResult.value.b;
    } else if (colorResult.type === "scene" && colorResult.value) {
      params.sceneId = colorResult.value;
    } else {
      return `Invalid color: ${color}`;
    }
  }

  const message = Buffer.from(JSON.stringify({ method: "setPilot", params }));

  try {
    await sendUdp(client, message, WIZ_PORT, BROADCAST_ADDR);
    let msg = `All lights set to ${brightness}%`;
    if (color) msg += ` with ${color}`;
    return msg;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  } finally {
    client.close();
  }
};

export const setRoomLightsBrightness = async (
  roomName: string,
  brightness: number,
  color?: string
): Promise<string> => {
  const client = await createBroadcastClient();
  const foundLights: string[] = [];
  const roomLower = roomName.toLowerCase();
  const discoveryMessage = Buffer.from(
    JSON.stringify({ method: "getSystemConfig", params: {} })
  );

  const params: any = {
    state: true,
    dimming: Math.max(0, Math.min(100, brightness)),
  };

  if (color) {
    const colorResult = parseColor(color);
    if (colorResult.type === "rgb" && colorResult.value) {
      params.r = colorResult.value.r;
      params.g = colorResult.value.g;
      params.b = colorResult.value.b;
    } else if (colorResult.type === "scene" && colorResult.value) {
      params.sceneId = colorResult.value;
    } else {
      return `Invalid color: ${color}`;
    }
  }

  const brightnessMessage = Buffer.from(
    JSON.stringify({ method: "setPilot", params })
  );

  return new Promise((resolve) => {
    setTimeout(() => {
      client.close();
      if (foundLights.length === 0) {
        resolve(`No lights found in room: ${roomName}`);
      } else {
        let msg = `Set ${foundLights.length} light(s) in ${roomName} to ${brightness}%`;
        if (color) msg += ` with ${color}`;
        resolve(msg);
      }
    }, DISCOVERY_TIMEOUT);

    client.on("message", (msg, rinfo) => {
      try {
        const response = JSON.parse(msg.toString());
        const roomId = response.result?.roomId?.toString() ?? "";
        const roomName = ROOM_CONFIG[roomId]?.toLowerCase() ?? "";

        const matches =
          (roomName && roomName.includes(roomLower)) ||
          (roomName && roomLower.includes(roomName)) ||
          roomId === roomLower;

        if (matches) {
          foundLights.push(rinfo.address);
          client.send(
            brightnessMessage,
            0,
            brightnessMessage.length,
            WIZ_PORT,
            rinfo.address
          );
        }
      } catch {}
    });

    sendUdp(client, discoveryMessage, WIZ_PORT, BROADCAST_ADDR);
  });
};

type ColorResult =
  | { type: "rgb"; value: { r: number; g: number; b: number } }
  | { type: "scene"; value: number }
  | { type: "invalid"; value: null };

const parseColor = (color: string): ColorResult => {
  const colorLower = color.toLowerCase();

  // Wiz scene presets
  const sceneMap: Record<string, number> = {
    ocean: 1,
    romance: 2,
    sunset: 3,
    party: 4,
    fireplace: 5,
    cozy: 6,
    "warm-light": 6,
    "warm light": 6,
    "default": 6,
    "reset": 6,
    forest: 7,
    pastel: 8,
    "pastel-colors": 8,
    "pastel colors": 8,
    "wake-up": 9,
    "wake up": 9,
    wakeup: 9,
    "bed-time": 10,
    "bed time": 10,
    bedtime: 10,
    warm: 11,
    "warm-white": 11,
    "warm white": 11,
    day: 12,
    daylight: 12,
    cool: 13,
    "cool-white": 13,
    "cool white": 13,
    night: 14,
    "night-light": 14,
    "night light": 14,
    nightlight: 14,
    focus: 15,
    relax: 16,
    "true-colors": 17,
    "true colors": 17,
    truecolors: 17,
    "tv-time": 18,
    "tv time": 18,
    tvtime: 18,
    "plant-growth": 19,
    "plant growth": 19,
    plantgrowth: 19,
    spring: 20,
    summer: 21,
    fall: 22,
    "deep-dive": 23,
    "deep dive": 23,
    deepdive: 23,
    jungle: 24,
    mojito: 25,
    club: 26,
    christmas: 27,
    halloween: 28,
    candlelight: 29,
    "golden-white": 30,
    "golden white": 30,
    pulse: 31,
    steampunk: 32,
  };

  if (sceneMap[colorLower] !== undefined) {
    return { type: "scene", value: sceneMap[colorLower] };
  }

  // RGB color names
  const colorMap: Record<string, { r: number; g: number; b: number }> = {
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 255, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    white: { r: 255, g: 255, b: 255 },
    yellow: { r: 255, g: 255, b: 0 },
    purple: { r: 128, g: 0, b: 128 },
    orange: { r: 255, g: 165, b: 0 },
    pink: { r: 255, g: 192, b: 203 },
    cyan: { r: 0, g: 255, b: 255 },
    magenta: { r: 255, g: 0, b: 255 },
  };

  if (colorMap[colorLower]) {
    return { type: "rgb", value: colorMap[colorLower] };
  }

  // Try parsing hex color (#RRGGBB or RRGGBB)
  const hexMatch = color.match(/^#?([0-9a-fA-F]{6})$/);
  if (hexMatch) {
    const hex = hexMatch[1];
    return {
      type: "rgb",
      value: {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16),
      },
    };
  }

  return { type: "invalid", value: null };
};

/**
 * Parse brightness and color from parts in any order
 * @param parts - Array of strings that may contain brightness (number) and color
 * @returns Object with brightness and optional color, or error string
 */
export const parseBrightnessAndColor = (
  parts: string[]
): { brightness: number; color?: string } | string => {
  if (parts.length === 0) return "no brightness or color provided";

  let brightness: number | undefined;
  let color: string | undefined;

  for (const part of parts) {
    const num = parseInt(part, 10);
    if (!isNaN(num) && brightness === undefined) {
      brightness = num;
    } else {
      // It's likely a color
      if (!color) {
        color = part;
      }
    }
  }

  if (brightness === undefined) return "no brightness provided";
  if (brightness < 0 || brightness > 100) return "brightness must be 0-100";

  return { brightness, color };
};
