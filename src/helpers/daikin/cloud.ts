import axios from "axios";
import { getAccessToken } from "./auth";

const API_BASE = "https://api.onecta.daikineurope.com/v1";

interface Device {
  id: string;
  name: string;
  managementPoints: Array<{
    embeddedId: string;
    name: string;
  }>;
}

/**
 * Get all gateway devices
 */
export const getDevices = async (): Promise<Device[]> => {
  const token = await getAccessToken();

  const response = await axios.get(`${API_BASE}/gateway-devices`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data.map((device: any) => ({
    id: device.id,
    name: device.name || device.id,
    managementPoints: device.managementPoints || [],
  }));
};

/**
 * Get device details with management points
 */
export const getDevice = async (deviceId: string): Promise<any> => {
  const token = await getAccessToken();

  const response = await axios.get(
    `${API_BASE}/gateway-devices/${deviceId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};

/**
 * Update device characteristic
 */
export const updateCharacteristic = async (
  deviceId: string,
  managementPointId: string,
  characteristic: string,
  value: any
): Promise<void> => {
  const token = await getAccessToken();

  await axios.patch(
    `${API_BASE}/gateway-devices/${deviceId}/management-points/${managementPointId}/characteristics/${characteristic}`,
    { value },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );
};

/**
 * Turn device on/off
 */
export const setOnOff = async (
  deviceId: string,
  managementPointId: string,
  on: boolean
): Promise<void> => {
  await updateCharacteristic(
    deviceId,
    managementPointId,
    "onOffMode",
    on ? "on" : "off"
  );
};

/**
 * Set temperature
 */
export const setTemperature = async (
  deviceId: string,
  managementPointId: string,
  temp: number
): Promise<void> => {
  await updateCharacteristic(
    deviceId,
    managementPointId,
    "setpoint",
    temp
  );
};

/**
 * Set operation mode
 */
export const setMode = async (
  deviceId: string,
  managementPointId: string,
  mode: "cooling" | "heating" | "auto" | "dry" | "fanOnly"
): Promise<void> => {
  await updateCharacteristic(
    deviceId,
    managementPointId,
    "operationMode",
    mode
  );
};

/**
 * Set fan speed
 */
export const setFanSpeed = async (
  deviceId: string,
  managementPointId: string,
  speed: number
): Promise<void> => {
  // Daikin API typically uses fixed, 1-5, or auto
  const speedMap: Record<number, string> = {
    1: "quiet",
    2: "fixed1",
    3: "fixed3",
    4: "fixed4",
    5: "fixed5",
  };

  await updateCharacteristic(
    deviceId,
    managementPointId,
    "fanSpeed",
    speedMap[speed] || "auto"
  );
};

/**
 * Set fan direction
 */
export const setFanDirection = async (
  deviceId: string,
  managementPointId: string,
  direction: number
): Promise<void> => {
  // Daikin API uses: stop, vertical, horizontal, 3dSwing
  const dirMap: Record<number, string> = {
    0: "stop",
    1: "vertical",
    2: "horizontal",
    3: "3dSwing",
    4: "swing",
    5: "auto",
  };

  await updateCharacteristic(
    deviceId,
    managementPointId,
    "fanDirection",
    dirMap[direction] || "stop"
  );
};

