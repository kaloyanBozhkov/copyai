import dgram from "dgram";
import { getWizGroups } from "../../kitchen/grimoireSettings";

const WIZ_PORT = 38899;
const BROADCAST_ADDR = "255.255.255.255";
const DISCOVERY_TIMEOUT = 2000;

export interface WizDevice {
  ip: string;
  roomId?: number;
  moduleName?: string;
}

const createBroadcastClient = (): Promise<dgram.Socket> => {
  return new Promise((resolve, reject) => {
    const client = dgram.createSocket("udp4");
    client.on("error", (err) => {
      client.close();
      reject(err);
    });
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

export const setDeviceState = async (ip: string, state: boolean): Promise<void> => {
  const client = await createBroadcastClient();
  const message = Buffer.from(
    JSON.stringify({ method: "setPilot", params: { state } })
  );
  try {
    await sendUdp(client, message, WIZ_PORT, ip);
  } finally {
    client.close();
  }
};

export const getDeviceStates = async (ips: string[]): Promise<Record<string, boolean>> => {
  if (ips.length === 0) return {};
  const client = await createBroadcastClient();
  const message = Buffer.from(
    JSON.stringify({ method: "getPilot", params: {} })
  );
  const states: Record<string, boolean> = {};

  return new Promise((resolve) => {
    setTimeout(() => {
      client.close();
      resolve(states);
    }, DISCOVERY_TIMEOUT);

    client.on("message", (msg, rinfo) => {
      try {
        const response = JSON.parse(msg.toString());
        if (ips.includes(rinfo.address) && response.result) {
          states[rinfo.address] = response.result.state ?? false;
        }
      } catch { /* ignore */ }
    });

    for (const ip of ips) {
      sendUdp(client, message, WIZ_PORT, ip).catch(() => {});
    }
  });
};

export const listRooms = async (): Promise<string> => {
  const groups = getWizGroups();
  if (groups.length === 0) return "No Wiz groups configured. Use wiz.setup to open the setup UI.";

  const lines: string[] = [];
  for (const group of groups) {
    lines.push(`${group.name}: ${group.deviceIps.length} device(s)`);
    for (const ip of group.deviceIps) {
      lines.push(`  ${ip}`);
    }
  }
  return lines.join("\n");
};

export const discoverLights = (): Promise<WizDevice[]> => {
  // eslint-disable-next-line no-async-promise-executor
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
          moduleName: response.result?.moduleName,
        });
      } catch { /* ignore parse errors */ }
    });

    await sendUdp(client, discoveryMessage, WIZ_PORT, BROADCAST_ADDR);
  });
};

const sendToDeviceIps = async (
  ips: string[],
  params: Record<string, unknown>
): Promise<number> => {
  const client = await createBroadcastClient();
  const message = Buffer.from(
    JSON.stringify({ method: "setPilot", params })
  );
  try {
    for (const ip of ips) {
      await sendUdp(client, message, WIZ_PORT, ip);
    }
    return ips.length;
  } finally {
    client.close();
  }
};

const findGroupIps = (groupName: string): string[] | null => {
  const groups = getWizGroups();
  const group = groups.find(
    (g) => g.name.toLowerCase() === groupName.toLowerCase()
  );
  return group && group.deviceIps.length > 0 ? group.deviceIps : null;
};

export const setRoomLightsState = async (
  roomName: string,
  state: boolean
): Promise<string> => {
  const ips = findGroupIps(roomName);
  if (!ips) return `No devices found in group: ${roomName}`;

  const count = await sendToDeviceIps(ips, { state });
  const action = state ? "Turned on" : "Turned off";
  return `${action} ${count} light(s) in ${roomName}`;
};

export const setAllLightsBrightness = async (
  brightness?: number,
  color?: string
): Promise<string> => {
  const client = await createBroadcastClient();
  const params: Record<string, unknown> = {
    state: true,
  };

  if (brightness !== undefined) {
    params.dimming = Math.max(0, Math.min(100, brightness));
  }

  if (color) {
    const colorResult = parseColor(color);
    if (colorResult.type === "rgb" && colorResult.value) {
      params.r = colorResult.value.r;
      params.g = colorResult.value.g;
      params.b = colorResult.value.b;
    } else if (colorResult.type === "scene" && colorResult.value) {
      params.sceneId = colorResult.value;
    } else if (colorResult.type === "temp" && colorResult.value) {
      params.temp = colorResult.value;
    } else {
      return `Invalid color: ${color}`;
    }
  }

  const message = Buffer.from(JSON.stringify({ method: "setPilot", params }));

  try {
    await sendUdp(client, message, WIZ_PORT, BROADCAST_ADDR);
    let msg = "All lights";
    if (brightness !== undefined) msg += ` set to ${brightness}%`;
    if (color) msg += ` with ${color}`;
    if (brightness === undefined && !color) msg += " reset to defaults";
    return msg;
  } catch (err) {
    return `Error: ${(err as Error).message}`;
  } finally {
    client.close();
  }
};

export const setRoomLightsBrightness = async (
  roomName: string,
  brightness?: number,
  color?: string
): Promise<string> => {
  const ips = findGroupIps(roomName);
  if (!ips) return `No devices found in group: ${roomName}`;

  const params: Record<string, unknown> = { state: true };

  if (brightness !== undefined) {
    params.dimming = Math.max(0, Math.min(100, brightness));
  }

  if (color) {
    const colorResult = parseColor(color);
    if (colorResult.type === "rgb" && colorResult.value) {
      params.r = colorResult.value.r;
      params.g = colorResult.value.g;
      params.b = colorResult.value.b;
    } else if (colorResult.type === "scene" && colorResult.value) {
      params.sceneId = colorResult.value;
    } else if (colorResult.type === "temp" && colorResult.value) {
      params.temp = colorResult.value;
    } else {
      return `Invalid color: ${color}`;
    }
  }

  const count = await sendToDeviceIps(ips, params);
  let msg = `Set ${count} light(s) in ${roomName}`;
  if (brightness !== undefined) msg += ` to ${brightness}%`;
  if (color) msg += ` with ${color}`;
  if (brightness === undefined && !color) msg += " to defaults";
  return msg;
};

type ColorResult =
  | { type: "rgb"; value: { r: number; g: number; b: number } }
  | { type: "scene"; value: number }
  | { type: "temp"; value: number }
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

  // Color temperature presets (in Kelvin, 2200-6500)
  const tempMap: Record<string, number> = {
    "warm-koko": 3000,
    "white-koko": 5500,
    default: 3000,
    reset: 3000,
    warmest: 2200,
    warmer: 2700,
    "warm-white": 3000,
    neutral: 4000,
    "cool-white-temp": 5000,
    daylight: 5500,
    coolest: 6500,
    quiet: 2200,
  };

  if (tempMap[colorLower] !== undefined) {
    return { type: "temp", value: tempMap[colorLower] };
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
 * @param allowEmpty - If true, allows both brightness and color to be optional
 * @returns Object with optional brightness and color, or error string
 */
export const parseBrightnessAndColor = (
  parts: string[],
  allowEmpty: boolean = false
): { brightness?: number; color?: string } | string => {
  if (parts.length === 0 && !allowEmpty)
    return "no brightness or color provided";

  let brightness: number | undefined;
  let color: string | undefined;

  for (const part of parts) {
    const num = parseInt(part, 10);
    if (!isNaN(num) && brightness === undefined) {
      brightness = num;
    } else if (part.trim() !== "") {
      // It's likely a color
      if (!color) {
        color = part;
      }
    }
  }

  if (brightness !== undefined && (brightness < 0 || brightness > 100)) {
    return "brightness must be 0-100";
  }

  return { brightness, color };
};
