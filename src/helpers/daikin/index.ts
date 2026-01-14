import * as cloud from "./cloud";
import { getAuthorizationUrl, exchangeCodeForTokens } from "./auth";

// Device name to ID mapping (populated after first API call)
let deviceCache: Array<{ name: string; id: string; mpId: string }> = [];

/**
 * Get device by room name
 */
const getDeviceByRoom = async (
  room: string
): Promise<{ id: string; mpId: string } | null> => {
  // Refresh cache if empty
  if (deviceCache.length === 0) {
    const devices = await cloud.getDevices();
    deviceCache = devices.flatMap((device) =>
      device.managementPoints.map((mp) => ({
        name: device.name.toLowerCase(),
        id: device.id,
        mpId: mp.embeddedId,
      }))
    );
  }

  const normalizedRoom = room.toLowerCase().trim();
  return deviceCache.find((d) => d.name.includes(normalizedRoom)) || null;
};

/**
 * Get all devices
 */
const getAllDevices = async (): Promise<
  Array<{ id: string; mpId: string }>
> => {
  if (deviceCache.length === 0) {
    const devices = await cloud.getDevices();
    deviceCache = devices.flatMap((device) =>
      device.managementPoints.map((mp) => ({
        name: device.name.toLowerCase(),
        id: device.id,
        mpId: mp.embeddedId,
      }))
    );
  }

  return deviceCache.map((d) => ({ id: d.id, mpId: d.mpId }));
};

/**
 * List all devices
 */
export const listDevices = async (): Promise<string> => {
  try {
    const devices = await cloud.getDevices();

    if (devices.length === 0) {
      return "No devices found";
    }

    const list = devices
      .map((device) => {
        const mps = device.managementPoints
          .map((mp) => `  - ${mp.name} (${mp.embeddedId})`)
          .join("\n");
        return `${device.name} (${device.id})\n${mps}`;
      })
      .join("\n\n");

    return `Found ${devices.length} device(s):\n${list}`;
  } catch (error: any) {
    return `Failed to list devices: ${error.message}`;
  }
};

/**
 * Turn AC on
 */
export const turnOnAC = async (room?: string): Promise<string> => {
  try {
    const devices = room
      ? [await getDeviceByRoom(room)].filter(Boolean)
      : await getAllDevices();

    if (devices.length === 0) {
      return room ? `Unknown room: ${room}` : "No devices found";
    }

    await Promise.all(
      devices.map((device) =>
        device ? cloud.setOnOff(device.id, device.mpId, true) : null
      )
    );

    return room
      ? `Turned on AC: ${room}`
      : `Turned on all ACs (${devices.length})`;
  } catch (error: any) {
    return `Failed to turn on AC: ${error.message}`;
  }
};

/**
 * Turn AC off
 */
export const turnOffAC = async (room?: string): Promise<string> => {
  try {
    const devices = room
      ? [await getDeviceByRoom(room)].filter(Boolean)
      : await getAllDevices();

    if (devices.length === 0) {
      return room ? `Unknown room: ${room}` : "No devices found";
    }

    await Promise.all(
      devices.map((device) =>
        device ? cloud.setOnOff(device.id, device.mpId, false) : null
      )
    );

    return room
      ? `Turned off AC: ${room}`
      : `Turned off all ACs (${devices.length})`;
  } catch (error: any) {
    return `Failed to turn off AC: ${error.message}`;
  }
};

/**
 * Set AC temperature
 */
export const setACTemp = async (
  room: string | undefined,
  temp: number
): Promise<string> => {
  if (temp < 16 || temp > 32) {
    return "Temperature must be between 16°C and 32°C";
  }

  try {
    const devices = room
      ? [await getDeviceByRoom(room)].filter(Boolean)
      : await getAllDevices();

    if (devices.length === 0) {
      return room ? `Unknown room: ${room}` : "No devices found";
    }

    await Promise.all(
      devices.map((device) =>
        device ? cloud.setTemperature(device.id, device.mpId, temp) : null
      )
    );

    return room
      ? `Set ${room} to ${temp}°C`
      : `Set all ACs to ${temp}°C (${devices.length})`;
  } catch (error: any) {
    return `Failed to set temperature: ${error.message}`;
  }
};

/**
 * Set AC mode
 */
type Mode = "cool" | "heat" | "auto" | "dry" | "fan";
const MODE_MAP: Record<
  Mode,
  "cooling" | "heating" | "auto" | "dry" | "fanOnly"
> = {
  cool: "cooling",
  heat: "heating",
  auto: "auto",
  dry: "dry",
  fan: "fanOnly",
};

export const setACMode = async (
  room: string | undefined,
  mode: Mode
): Promise<string> => {
  const apiMode = MODE_MAP[mode];
  if (!apiMode) {
    return `Invalid mode: ${mode}. Use: cool, heat, auto, dry, or fan`;
  }

  try {
    const devices = room
      ? [await getDeviceByRoom(room)].filter(Boolean)
      : await getAllDevices();

    if (devices.length === 0) {
      return room ? `Unknown room: ${room}` : "No devices found";
    }

    await Promise.all(
      devices.map((device) =>
        device ? cloud.setMode(device.id, device.mpId, apiMode) : null
      )
    );

    return room
      ? `Set ${room} mode to ${mode}`
      : `Set all ACs to ${mode} (${devices.length})`;
  } catch (error: any) {
    return `Failed to set mode: ${error.message}`;
  }
};

/**
 * Set AC fan rate
 */
export const setACFanRate = async (
  room: string | undefined,
  rate: number
): Promise<string> => {
  if (rate < 1 || rate > 5) {
    return "Fan rate must be between 1 and 5";
  }

  try {
    const devices = room
      ? [await getDeviceByRoom(room)].filter(Boolean)
      : await getAllDevices();

    if (devices.length === 0) {
      return room ? `Unknown room: ${room}` : "No devices found";
    }

    await Promise.all(
      devices.map((device) =>
        device ? cloud.setFanSpeed(device.id, device.mpId, rate) : null
      )
    );

    return room
      ? `Set ${room} fan to ${rate}`
      : `Set all ACs fan to ${rate} (${devices.length})`;
  } catch (error: any) {
    return `Failed to set fan rate: ${error.message}`;
  }
};

/**
 * Set AC fan direction
 */
export const setACFanDirection = async (
  room: string | undefined,
  direction: number
): Promise<string> => {
  if (direction < 0 || direction > 5) {
    return "Fan direction must be between 0 and 5";
  }

  try {
    const devices = room
      ? [await getDeviceByRoom(room)].filter(Boolean)
      : await getAllDevices();

    if (devices.length === 0) {
      return room ? `Unknown room: ${room}` : "No devices found";
    }

    await Promise.all(
      devices.map((device) =>
        device ? cloud.setFanDirection(device.id, device.mpId, direction) : null
      )
    );

    return room
      ? `Set ${room} fan direction to ${direction}`
      : `Set all ACs fan direction to ${direction} (${devices.length})`;
  } catch (error: any) {
    return `Failed to set fan direction: ${error.message}`;
  }
};

/**
 * Get authorization URL
 */
export const getAuthUrl = (): string => {
  try {
    const url = getAuthorizationUrl();
    return `Open this URL in your browser to authorize:\n\n${url}\n\nAfter authorizing, copy the 'code' parameter from the redirect URL and run:\nhome.aircon_code <code>`;
  } catch (error: any) {
    return `Failed to generate auth URL: ${error.message}\n\nMake sure DAIKIN_CLIENT_ID is set in environment variables.`;
  }
};

/**
 * Exchange authorization code for tokens
 */
export const authorizeWithCode = async (code: string): Promise<string> => {
  try {
    await exchangeCodeForTokens(code);
    return "✓ Authorization successful! You can now use aircon commands.";
  } catch (error: any) {
    return `Failed to authorize: ${error.message}`;
  }
};
