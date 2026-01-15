import fs from "fs";
import path from "path";
import os from "os";

const SETTINGS_FILE = path.join(os.homedir(), ".copyai-grimoire-settings.json");

export interface AlchemyPotion {
  id: string;
  name: string;
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: string;
  contentType?: "none" | "application/json" | "application/x-www-form-urlencoded" | "text/plain";
  responseType?: "text" | "json" | "json-path"; // json-path extracts a specific field
  jsonPath?: string; // For json-path type, e.g., "data.result" or "choices[0].message.content"
  lastValue?: string;
  lastFetched?: number;
}

export interface GrimoireSettings {
  apiKeys: Record<string, string>; // Dynamic API keys (e.g., OPENAI_API_KEY, OPENROUTER_API_KEY, custom keys)
  book: Record<string, string>; // Custom dictionary fields
  alchemy: AlchemyPotion[]; // Dynamic API-fetched values
}

const DEFAULT_SETTINGS: GrimoireSettings = {
  apiKeys: {
    OPENAI_API_KEY: "",
    OPENROUTER_API_KEY: "",
  },
  book: {},
  alchemy: [],
};

let settingsCache: GrimoireSettings | null = null;

// Callbacks to notify when settings change
const changeListeners: Array<() => void> = [];

export const onSettingsChange = (callback: () => void) => {
  changeListeners.push(callback);
  return () => {
    const index = changeListeners.indexOf(callback);
    if (index > -1) changeListeners.splice(index, 1);
  };
};

const notifyChange = () => {
  changeListeners.forEach((cb) => cb());
};

const loadSettings = (): GrimoireSettings => {
  if (settingsCache) return settingsCache;

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      const loaded: GrimoireSettings = { 
        ...DEFAULT_SETTINGS, 
        ...parsed,
        apiKeys: { ...DEFAULT_SETTINGS.apiKeys, ...parsed?.apiKeys },
        alchemy: parsed?.alchemy || [],
      };
      settingsCache = loaded;
      return loaded;
    }
  } catch (error) {
    console.error("Failed to load grimoire settings:", error);
  }

  const defaults = { ...DEFAULT_SETTINGS };
  settingsCache = defaults;
  return defaults;
};

const saveSettings = (settings: GrimoireSettings): void => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
    settingsCache = settings;
    notifyChange();
  } catch (error) {
    console.error("Failed to save grimoire settings:", error);
  }
};

export const getSettings = (): GrimoireSettings => {
  return loadSettings();
};

export const updateSettings = (
  updates: Partial<GrimoireSettings>
): GrimoireSettings => {
  const current = loadSettings();
  const updated = {
    ...current,
    ...updates,
    apiKeys: { ...current.apiKeys, ...updates.apiKeys },
    book: updates.book !== undefined ? updates.book : current.book,
    alchemy: updates.alchemy !== undefined ? updates.alchemy : current.alchemy,
  };
  saveSettings(updated);
  return updated;
};

// API Key management
export const getApiKey = (key: string): string => {
  return loadSettings().apiKeys[key] || "";
};

export const setApiKey = (key: string, value: string): void => {
  const current = loadSettings();
  current.apiKeys[key] = value;
  saveSettings(current);
};

export const removeApiKey = (key: string): void => {
  const current = loadSettings();
  delete current.apiKeys[key];
  saveSettings(current);
};

// Book (custom dictionary) management
export const getBook = (): Record<string, string> => {
  return loadSettings().book;
};

export const getBookField = (field: string): string | undefined => {
  return loadSettings().book[field];
};

export const setBookField = (field: string, value: string): void => {
  const current = loadSettings();
  current.book[field] = value;
  saveSettings(current);
};

export const removeBookField = (field: string): void => {
  const current = loadSettings();
  delete current.book[field];
  saveSettings(current);
};

export const clearSettingsCache = (): void => {
  settingsCache = null;
};

/**
 * Get all book fields formatted for use in placeholder replacement
 * Returns object like { "book.name": "John", "book.company": "Acme" }
 */
export const getBookPlaceholders = (): Record<string, string> => {
  const book = getBook();
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(book)) {
    result[`book.${key}`] = value;
  }
  return result;
};

// Alchemy (dynamic API values) management
export const getAlchemy = (): AlchemyPotion[] => {
  return loadSettings().alchemy;
};

export const getPotion = (id: string): AlchemyPotion | undefined => {
  return loadSettings().alchemy.find((p) => p.id === id);
};

export const addPotion = (potion: AlchemyPotion): void => {
  const current = loadSettings();
  current.alchemy.push(potion);
  saveSettings(current);
};

export const updatePotion = (potion: AlchemyPotion): void => {
  const current = loadSettings();
  const index = current.alchemy.findIndex((p) => p.id === potion.id);
  if (index !== -1) {
    current.alchemy[index] = potion;
    saveSettings(current);
  }
};

export const removePotion = (id: string): void => {
  const current = loadSettings();
  current.alchemy = current.alchemy.filter((p) => p.id !== id);
  saveSettings(current);
};

/**
 * Replace ${env.VAR} placeholders in a string with values from apiKeys
 */
const replaceEnvPlaceholders = (text: string, apiKeys: Record<string, string>): string => {
  return text.replace(/\$\{env\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (match, key) => {
    const value = apiKeys[key];
    return value !== undefined ? value : match;
  });
};

/**
 * Extract a value from an object using a JSON path like "data.result" or "choices[0].message.content"
 */
const extractJsonPath = (obj: unknown, path: string): string => {
  const parts = path.split(/\.|\[|\]/).filter(Boolean);
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return "";
    if (typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return "";
    }
  }
  
  if (current === null || current === undefined) return "";
  if (typeof current === "string") return current;
  return JSON.stringify(current);
};

/**
 * Execute a potion (fetch its value from the API)
 */
export const executePotion = async (potion: AlchemyPotion): Promise<string> => {
  try {
    const settings = loadSettings();
    
    // Replace ${env.VAR} in headers
    const processedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(potion.headers)) {
      processedHeaders[key] = replaceEnvPlaceholders(value, settings.apiKeys);
    }
    
    // Add Content-Type header if specified
    if (potion.contentType && potion.contentType !== "none") {
      processedHeaders["Content-Type"] = potion.contentType;
    }
    
    // Add Accept header for JSON response types
    const responseType = potion.responseType || "text";
    if (responseType === "json" || responseType === "json-path") {
      processedHeaders["Accept"] = "application/json";
    }
    
    // Replace ${env.VAR} in URL and body
    const processedUrl = replaceEnvPlaceholders(potion.url, settings.apiKeys);
    const processedBody = potion.body ? replaceEnvPlaceholders(potion.body, settings.apiKeys) : undefined;

    const fetchOptions: RequestInit = {
      method: potion.method,
      headers: processedHeaders,
    };

    if (potion.method === "POST" && processedBody) {
      fetchOptions.body = processedBody;
    }

    const response = await fetch(processedUrl, fetchOptions);
    
    // Parse response based on responseType
    let result: string;
    
    if (responseType === "json") {
      const json = await response.json();
      result = JSON.stringify(json);
    } else if (responseType === "json-path" && potion.jsonPath) {
      const json = await response.json();
      result = extractJsonPath(json, potion.jsonPath);
    } else {
      result = await response.text();
    }

    // Update last value and timestamp
    potion.lastValue = result;
    potion.lastFetched = Date.now();
    updatePotion(potion);

    return result;
  } catch (error) {
    console.error(`Failed to execute potion ${potion.name}:`, error);
    throw error;
  }
};

/**
 * Get all alchemy placeholders by executing all potions
 * Returns object like { "alchemy.weather": "sunny", "alchemy.time": "10:30" }
 */
export const getAlchemyPlaceholders = async (): Promise<Record<string, string>> => {
  const potions = getAlchemy();
  const result: Record<string, string> = {};

  // Execute all potions in parallel
  await Promise.all(
    potions.map(async (potion) => {
      try {
        const value = await executePotion(potion);
        result[`alchemy.${potion.name}`] = value;
      } catch (error) {
        console.error(`Failed to fetch potion ${potion.name}:`, error);
        result[`alchemy.${potion.name}`] = `[Error: ${error}]`;
      }
    })
  );

  return result;
};

