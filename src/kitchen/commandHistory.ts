import fs from "fs";
import path from "path";
import os from "os";

const HISTORY_FILE = path.join(os.homedir(), ".copyai-command-history.json");
const MAX_HISTORY = 3;

interface CommandHistory {
  commands: string[];
}

let historyCache: string[] | null = null;

/**
 * Load command history from file
 */
const loadHistory = (): string[] => {
  if (historyCache) return historyCache;

  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      const parsed: CommandHistory = JSON.parse(data);
      historyCache = parsed.commands || [];
      return historyCache;
    }
  } catch (error) {
    console.error("Failed to load command history:", error);
  }

  historyCache = [];
  return historyCache;
};

/**
 * Save command history to file
 */
const saveHistory = (commands: string[]): void => {
  try {
    const data: CommandHistory = { commands };
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf-8");
    historyCache = commands;
  } catch (error) {
    console.error("Failed to save command history:", error);
  }
};

/**
 * Add a command to history (most recent first)
 */
export const addToHistory = (command: string): void => {
  const history = loadHistory();
  
  // Remove if already exists
  const filtered = history.filter((cmd) => cmd !== command);
  
  // Add to front
  const newHistory = [command, ...filtered].slice(0, MAX_HISTORY);
  
  saveHistory(newHistory);
};

/**
 * Get recent command history
 */
export const getCommandHistory = (): string[] => {
  return loadHistory();
};

/**
 * Clear command history
 */
export const clearHistory = (): void => {
  saveHistory([]);
};

