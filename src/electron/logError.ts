import { join } from "path";
import { appendFileSync, mkdirSync } from "fs";
import { homedir } from "os";

const logDir = join(homedir(), "copyai");
const logFile = join(logDir, "debug.log");

// Always log for now to debug
export const log = (msg: string, ...args: unknown[]) => {
  const line = `[${new Date().toISOString()}] ${msg} ${args.join(" ")}\n`;
  try {
    mkdirSync(logDir, { recursive: true });
    appendFileSync(logFile, line);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    // Can't log the logging error
  }
};
