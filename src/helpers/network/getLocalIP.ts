import os from "os";
import { getSettings } from "../../kitchen/grimoireSettings";

export const getLocalIP = () => {
  // Check if LOCAL_DOMAIN is set in grimoire settings
  try {
    const settings = getSettings();
    if (settings.localDomain && settings.localDomain.trim()) {
      return settings.localDomain.trim();
    }
  } catch (error) {
    // Settings not available, continue with default logic
  }

  // Fallback to network interface detection
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
};
