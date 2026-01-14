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
