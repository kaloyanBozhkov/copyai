import { existsSync } from "fs";
import { execSync } from "child_process";

const CHROME_PATHS: Record<string, string[]> = {
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  win32: [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ],
  linux: [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
  ],
};

let cached: string | undefined;

export const getChromePath = (): string => {
  if (cached) return cached;

  const candidates = CHROME_PATHS[process.platform] ?? [];
  for (const p of candidates) {
    if (existsSync(p)) {
      cached = p;
      return p;
    }
  }

  // fallback: try `which` on unix
  if (process.platform !== "win32") {
    try {
      const found = execSync("which google-chrome || which chromium", {
        encoding: "utf-8",
      }).trim();
      if (found) {
        cached = found;
        return found;
      }
    } catch {
      // ignore
    }
  }

  throw new Error(
    "Could not find Chrome/Chromium. Install Google Chrome or set CHROME_PATH env var."
  );
};
