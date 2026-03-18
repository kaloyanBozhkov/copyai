/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import { API_KEY } from "./constants";
import { getAccessToken } from "./auth";

const DEVICE_CACHE_FILE = path.join(
  os.homedir(),
  ".copyai",
  "lg-thinq-tv-device.json"
);

interface ThinQDevice {
  deviceId: string;
  alias: string;
  deviceType: number;
  modelName: string;
}

/**
 * Headers for ThinQ v2 API
 */
const getHeaders = (token: string, userNumber: string, country: string, language: string) => ({
  "x-api-key": API_KEY,
  "x-emp-token": token,
  "x-user-no": userNumber,
  "x-client-id": crypto.createHash("sha256").update(`${userNumber}${Date.now()}`).digest("hex"),
  "x-country-code": country,
  "x-language-code": language,
  "x-message-id": crypto.randomUUID(),
  "x-service-code": "SVC202",
  "x-service-phase": "OP",
  "x-thinq-app-level": "PRD",
  "x-thinq-app-os": "ANDROID",
  "x-thinq-app-type": "NUTS",
  "x-thinq-app-ver": "5.0.1200",
  Accept: "application/json",
  "Content-Type": "application/json",
});

/**
 * List all devices
 */
export const listDevices = async (): Promise<ThinQDevice[]> => {
  const { token, userNumber, gateway } = await getAccessToken();
  const headers = getHeaders(token, userNumber, gateway.countryCode, gateway.languageCode);

  const res = await axios.get(`${gateway.thinq2Uri}/service/homes`, { headers });
  const homes = res.data?.result?.item || [];

  const devices: ThinQDevice[] = [];
  for (const home of homes) {
    if (home.devices) {
      for (const d of home.devices) {
        devices.push({
          deviceId: d.deviceId,
          alias: d.alias || d.deviceId,
          deviceType: d.deviceType,
          modelName: d.modelName || "",
        });
      }
    }
  }
  return devices;
};

/**
 * Find the TV device (type 401)
 */
export const findTVDevice = async (): Promise<ThinQDevice | null> => {
  try {
    if (fs.existsSync(DEVICE_CACHE_FILE)) {
      const cached = JSON.parse(fs.readFileSync(DEVICE_CACHE_FILE, "utf8"));
      if (cached?.deviceId) return cached;
    }
  } catch { /* ignore */ }

  const devices = await listDevices();
  const tv = devices.find((d) => d.deviceType === 401);
  if (!tv) return null;

  const dir = path.dirname(DEVICE_CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DEVICE_CACHE_FILE, JSON.stringify(tv, null, 2));
  return tv;
};

/**
 * Turn on TV via ThinQ cloud
 */
export const turnOnViaCloud = async (): Promise<string> => {
  const { token, userNumber, gateway } = await getAccessToken();
  const tv = await findTVDevice();

  if (!tv) {
    return "No TV found on your ThinQ account. Make sure your TV is registered in the LG ThinQ app.";
  }

  const headers = getHeaders(token, userNumber, gateway.countryCode, gateway.languageCode);

  // Try v2 control
  try {
    await axios.post(
      `${gateway.thinq2Uri}/service/devices/${tv.deviceId}/control-sync`,
      { ctrlKey: "basicCtrl", command: "Set", dataKey: "airState.operation.power", dataValue: "1" },
      { headers }
    );
    return `TV '${tv.alias}' power-on sent via ThinQ cloud`;
  } catch {
    // Try WOL via v2
    try {
      await axios.post(
        `${gateway.thinq2Uri}/service/devices/${tv.deviceId}/wol`,
        {},
        { headers }
      );
      return `TV '${tv.alias}' WOL sent via ThinQ cloud`;
    } catch {
      // Try v1
      try {
        await axios.post(
          `${gateway.thinq1Uri}/rti/rtiControl`,
          { cmd: "Control", cmdOpt: "WOL", deviceId: tv.deviceId, workId: crypto.randomUUID() },
          {
            headers: {
              "x-thinq-token": token,
              "x-thinq-application-key": API_KEY,
              "x-country-code": gateway.countryCode,
              "x-language-code": gateway.languageCode,
              "Content-Type": "application/json",
            },
          }
        );
        return `TV '${tv.alias}' WOL sent via ThinQ v1`;
      } catch (err: any) {
        throw new Error(`ThinQ cloud control failed: ${err.message || err}`);
      }
    }
  }
};

/**
 * List all devices for debugging
 */
export const listAllDevices = async (): Promise<string> => {
  const devices = await listDevices();
  if (devices.length === 0) return "No devices found on your ThinQ account.";

  const list = devices
    .map((d) => `${d.alias} (type: ${d.deviceType}, model: ${d.modelName}, id: ${d.deviceId})`)
    .join("\n");
  return `Found ${devices.length} device(s):\n${list}`;
};

/**
 * Clear cached TV device
 */
export const clearDeviceCache = (): void => {
  try {
    if (fs.existsSync(DEVICE_CACHE_FILE)) fs.unlinkSync(DEVICE_CACHE_FILE);
  } catch { /* ignore */ }
};
