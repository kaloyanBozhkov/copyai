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

  // Try v1 device list
  console.log("[ThinQ] Trying v1 device list...");
  try {
    const v1Headers = {
      "x-thinq-token": token,
      "x-thinq-application-key": "wideq",
      "x-thinq-security-key": "nuts_securitykey",
      "x-country-code": gateway.countryCode,
      "x-language-code": gateway.languageCode,
      Accept: "application/json",
    };
    const v1Res = await axios.get(`${gateway.thinq1Uri}/service/application/dashboard`, { headers: v1Headers });
    console.log("[ThinQ] v1 dashboard:", JSON.stringify(v1Res.data).substring(0, 1000));
  } catch (e: any) {
    console.log("[ThinQ] v1 dashboard failed:", e.response?.status, JSON.stringify(e.response?.data).substring(0, 500));
  }

  // Try v2 user devices (no home filter)
  console.log("[ThinQ] Trying v2 user devices...");
  try {
    const userDevRes = await axios.get(`${gateway.thinq2Uri}/service/users/${userNumber}/devices`, { headers });
    console.log("[ThinQ] user devices:", JSON.stringify(userDevRes.data).substring(0, 1000));
  } catch (e: any) {
    console.log("[ThinQ] user devices failed:", e.response?.status);
  }

  // Try v2 single device list endpoint
  console.log("[ThinQ] Trying v2 /service/devices ...");
  try {
    const devListRes = await axios.get(`${gateway.thinq2Uri}/service/devices`, { headers });
    console.log("[ThinQ] devices list:", JSON.stringify(devListRes.data).substring(0, 1000));
  } catch (e: any) {
    console.log("[ThinQ] devices list failed:", e.response?.status);
  }

  // Try v2 with different auth header format
  console.log("[ThinQ] Trying v2 with Authorization Bearer...");
  try {
    const bearerHeaders = {
      ...headers,
      "Authorization": `Bearer ${token}`,
    };
    const bearerRes = await axios.get(`${gateway.thinq2Uri}/service/application/dashboard`, { headers: bearerHeaders });
    const bearerItems = bearerRes.data?.result?.item || [];
    console.log("[ThinQ] Bearer dashboard devices:", bearerItems.length);
    if (bearerItems.length > 0) {
      for (const d of bearerItems) {
        console.log("[ThinQ] device:", d.alias, "type:", d.deviceType, "id:", d.deviceId);
      }
    }
  } catch (e: any) {
    console.log("[ThinQ] Bearer dashboard failed:", e.response?.status);
  }

  // Try the IoT service endpoint (TVs sometimes use this)
  console.log("[ThinQ] Trying IoT service...");
  try {
    const iotRes = await axios.get("https://eic-iotservice.lgthinq.com/v1/service/devices", { headers });
    console.log("[ThinQ] IoT devices:", JSON.stringify(iotRes.data).substring(0, 500));
  } catch (e: any) {
    console.log("[ThinQ] IoT failed:", e.response?.status);
  }

  // Try v2 dashboard endpoint
  console.log("[ThinQ] Trying dashboard endpoint...");
  try {
    const dashRes = await axios.get(`${gateway.thinq2Uri}/service/application/dashboard`, { headers });
    console.log("[ThinQ] Dashboard response keys:", JSON.stringify(Object.keys(dashRes.data?.result || {})));
    const dashItems = dashRes.data?.result?.item || [];
    console.log("[ThinQ] Dashboard devices:", dashItems.length);
    if (dashItems.length > 0) {
      for (const d of dashItems) {
        console.log("[ThinQ] device:", d.alias, "type:", d.deviceType, "model:", d.modelName, "id:", d.deviceId);
      }
      return dashItems.map((d: any) => ({
        deviceId: d.deviceId,
        alias: d.alias || d.deviceId,
        deviceType: d.deviceType,
        modelName: d.modelName || "",
      }));
    }
  } catch (e: any) {
    console.log("[ThinQ] Dashboard failed:", e.response?.status, JSON.stringify(e.response?.data));
  }

  // Fallback: get homes list, then fetch each home's devices
  console.log("[ThinQ] Trying homes endpoint...");
  const res = await axios.get(`${gateway.thinq2Uri}/service/homes`, { headers });
  const homes = res.data?.result?.item || [];
  console.log("[ThinQ] Found", homes.length, "home(s)");

  const devices: ThinQDevice[] = [];
  for (const home of homes) {
    console.log("[ThinQ] Fetching devices for home:", home.homeName, home.homeId);
    try {
      const homeRes = await axios.get(
        `${gateway.thinq2Uri}/service/homes/${home.homeId}`,
        { headers }
      );
      console.log("[ThinQ] Home response keys:", JSON.stringify(Object.keys(homeRes.data?.result || {})));
      console.log("[ThinQ] Home raw:", JSON.stringify(homeRes.data?.result).substring(0, 1000));
      const homeDevices = homeRes.data?.result?.devices || homeRes.data?.result?.item || [];
      console.log("[ThinQ] Home has", homeDevices.length, "device(s)");
      for (const d of homeDevices) {
        console.log("[ThinQ] device:", d.alias, "type:", d.deviceType, "model:", d.modelName, "id:", d.deviceId);
        devices.push({
          deviceId: d.deviceId,
          alias: d.alias || d.deviceId,
          deviceType: d.deviceType,
          modelName: d.modelName || "",
        });
      }
    } catch (e: any) {
      console.log("[ThinQ] Failed to fetch home devices:", e.response?.status, JSON.stringify(e.response?.data));
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

  console.log("[ThinQ] TV found:", tv.alias, "id:", tv.deviceId, "type:", tv.deviceType);

  // Try v2 control
  try {
    const url1 = `${gateway.thinq2Uri}/service/devices/${tv.deviceId}/control-sync`;
    console.log("[ThinQ] Trying v2 control-sync:", url1);
    await axios.post(
      url1,
      { ctrlKey: "basicCtrl", command: "Set", dataKey: "airState.operation.power", dataValue: "1" },
      { headers }
    );
    return `TV '${tv.alias}' power-on sent via ThinQ cloud`;
  } catch (e1: any) {
    console.log("[ThinQ] v2 control-sync failed:", e1.response?.status, JSON.stringify(e1.response?.data));
    // Try WOL via v2
    try {
      const url2 = `${gateway.thinq2Uri}/service/devices/${tv.deviceId}/wol`;
      console.log("[ThinQ] Trying v2 WOL:", url2);
      await axios.post(url2, {}, { headers });
      return `TV '${tv.alias}' WOL sent via ThinQ cloud`;
    } catch (e2: any) {
      console.log("[ThinQ] v2 WOL failed:", e2.response?.status, JSON.stringify(e2.response?.data));
      // Try v1
      try {
        const url3 = `${gateway.thinq1Uri}/rti/rtiControl`;
        console.log("[ThinQ] Trying v1 rtiControl:", url3);
        await axios.post(
          url3,
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
      } catch (e3: any) {
        console.log("[ThinQ] v1 rtiControl failed:", e3.response?.status, JSON.stringify(e3.response?.data));
        throw new Error(`ThinQ cloud control failed: ${e3.response?.status} ${JSON.stringify(e3.response?.data) || e3.message}`);
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
