import { BrowserWindow, ipcMain } from "electron";
import path from "path";
import { execsPerCategory } from "../kitchen/recipes/execs";
import {
  getCustomTemplates,
  addCustomTemplate,
  removeCustomTemplate,
  updateCustomTemplate,
  CustomTemplate,
} from "../kitchen/customTemplates";
import { templateRecipes } from "../kitchen/recipes/templateCommands";
import { extractPlaceholders, replacePlaceholders } from "../kitchen/helpers";
import {
  getSettings,
  updateSettings,
  setApiKey,
  setBookField,
  removeBookField,
  getBook,
  GrimoireSettings,
} from "../kitchen/grimoireSettings";

interface CommandInfo {
  name: string;
  fullKey: string;
  category: string;
  subcategory?: string;
  type: "exec" | "template" | "custom-template";
  args: string[];
  messageRecipe?: string[];
  isCustom?: boolean;
}

interface CategoryGroup {
  name: string;
  commands: CommandInfo[];
  subcategories?: Record<string, CommandInfo[]>;
}

// Build structured command data
export const getCommandsData = (): {
  execs: Record<string, CategoryGroup>;
  templates: Record<string, CategoryGroup>;
  customTemplates: CustomTemplate[];
} => {
  const execCategories: Record<string, CategoryGroup> = {};
  const templateCategories: Record<string, CategoryGroup> = {};

  // Process execs
  for (const [category, commands] of Object.entries(execsPerCategory)) {
    execCategories[category] = {
      name: category,
      commands: [],
      subcategories: {},
    };

    for (const [key, value] of Object.entries(commands)) {
      if (Array.isArray(value)) {
        // Direct command
        const [, ...argDefs] = value;
        execCategories[category].commands.push({
          name: key,
          fullKey: `${category}.${key}`,
          category,
          type: "exec",
          args: argDefs.flat().map(String),
        });
      } else if (typeof value === "object" && value !== null) {
        // Subcategory
        execCategories[category].subcategories![key] = [];
        for (const [subKey, subValue] of Object.entries(value)) {
          if (Array.isArray(subValue)) {
            const [, ...argDefs] = subValue;
            execCategories[category].subcategories![key].push({
              name: subKey,
              fullKey: `${category}.${key}.${subKey}`,
              category,
              subcategory: key,
              type: "exec",
              args: argDefs.flat().map(String),
            });
          }
        }
      }
    }
  }

  // Process templates
  for (const [category, commands] of Object.entries(templateRecipes)) {
    templateCategories[category] = {
      name: category,
      commands: [],
    };

    for (const [key, recipe] of Object.entries(commands)) {
      templateCategories[category].commands.push({
        name: key,
        fullKey: `${category}.${key}`,
        category,
        type: "template",
        args: extractTemplateArgs(recipe),
        messageRecipe: recipe,
      });
    }
  }

  return {
    execs: execCategories,
    templates: templateCategories,
    customTemplates: getCustomTemplates(),
  };
};

// Extract all placeholders from template (supports $0, ${0}, ${named})
const extractTemplateArgs = (recipe: string[]): string[] => {
  const text = recipe.join("\n");
  const placeholders = extractPlaceholders(text);
  // Return formatted arg definitions
  return placeholders.map((p) => 
    /^\d+$/.test(p) ? `$${p}: string` : `${p}: string`
  );
};

// Window management
let browserWindow: BrowserWindow | null = null;

export const showCommandBrowser = async (isDevMode = false): Promise<void> => {
  // If window exists and is valid, focus it
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.focus();
    return;
  }

  browserWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 1200,
    minHeight: 700,
    resizable: true,
    movable: true,
    show: false,
    frame: false,
    transparent: false,
    hasShadow: true,
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false, // Allow loading external resources like Google Fonts
    },
  });

  const appPath = path.join(
    __dirname,
    "..",
    "..",
    "src",
    "app",
    "dist",
    "index.html"
  );

  // Setup IPC handlers
  setupCommandBrowserIPC();

  // Set up grimoire-mounted handler (for hot reloads too)
  ipcMain.removeAllListeners("grimoire-mounted");
  ipcMain.on("grimoire-mounted", () => {
    if (!browserWindow || browserWindow.isDestroyed()) return;
    browserWindow.webContents.send("grimoire-init", {
      commands: getCommandsData(),
      settings: getSettings(),
      isDevMode,
    });
  });

  return new Promise((resolve) => {
    browserWindow!.loadFile(appPath, { query: { route: "grimoire" } });

    // Show window after it loads
    browserWindow!.once("ready-to-show", () => {
      browserWindow?.show();
      resolve();
    });

    browserWindow!.on("closed", () => {
      browserWindow = null;
      ipcMain.removeAllListeners("grimoire-mounted");
      cleanupCommandBrowserIPC();
    });
  });
};

const setupCommandBrowserIPC = () => {
  ipcMain.on("grimoire-get-commands", (event) => {
    event.reply("grimoire-commands-data", getCommandsData());
  });

  ipcMain.on(
    "grimoire-add-template",
    (event, template: Omit<CustomTemplate, "id" | "createdAt">) => {
      const newTemplate = addCustomTemplate(template);
      event.reply("grimoire-template-added", newTemplate);
      // Broadcast update
      if (browserWindow && !browserWindow.isDestroyed()) {
        browserWindow.webContents.send("grimoire-commands-data", getCommandsData());
      }
    }
  );

  ipcMain.on("grimoire-remove-template", (event, id: string) => {
    const success = removeCustomTemplate(id);
    event.reply("grimoire-template-removed", { id, success });
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.send("grimoire-commands-data", getCommandsData());
    }
  });

  ipcMain.on(
    "grimoire-update-template",
    (event, { id, updates }: { id: string; updates: Partial<CustomTemplate> }) => {
      const updated = updateCustomTemplate(id, updates);
      event.reply("grimoire-template-updated", updated);
      if (browserWindow && !browserWindow.isDestroyed()) {
        browserWindow.webContents.send("grimoire-commands-data", getCommandsData());
      }
    }
  );

  ipcMain.on("grimoire-close", () => {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.close();
    }
  });

  ipcMain.on("grimoire-minimize", () => {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.minimize();
    }
  });

  // Execute/copy a template to test it
  ipcMain.on(
    "grimoire-execute-template",
    (event, { messageRecipe, args }: { messageRecipe: string[]; args: string[] }) => {
      const text = messageRecipe.join("\n");
      const placeholders = extractPlaceholders(text);
      const bookValues = getBook();
      
      // Build values map from args array
      const valuesMap: Record<string, string> = {};
      placeholders.forEach((placeholder, index) => {
        if (args && args[index] !== undefined) {
          valuesMap[placeholder] = args[index];
        }
      });
      
      const result = replacePlaceholders(text, valuesMap, bookValues);
      event.reply("grimoire-template-result", result);
    }
  );

  // Settings IPC handlers
  ipcMain.on("grimoire-get-settings", (event) => {
    event.reply("grimoire-settings-data", getSettings());
  });

  ipcMain.on(
    "grimoire-update-settings",
    (event, updates: Partial<GrimoireSettings>) => {
      const updated = updateSettings(updates);
      event.reply("grimoire-settings-updated", updated);
    }
  );

  ipcMain.on(
    "grimoire-set-api-key",
    (event, { key, value }: { key: "OPENAI_API_KEY" | "OPENROUTER_API_KEY"; value: string }) => {
      setApiKey(key, value);
      event.reply("grimoire-settings-data", getSettings());
    }
  );

  ipcMain.on(
    "grimoire-set-book-field",
    (event, { field, value }: { field: string; value: string }) => {
      setBookField(field, value);
      event.reply("grimoire-settings-data", getSettings());
    }
  );

  ipcMain.on("grimoire-remove-book-field", (event, field: string) => {
    removeBookField(field);
    event.reply("grimoire-settings-data", getSettings());
  });
};

const cleanupCommandBrowserIPC = () => {
  ipcMain.removeAllListeners("grimoire-get-commands");
  ipcMain.removeAllListeners("grimoire-add-template");
  ipcMain.removeAllListeners("grimoire-remove-template");
  ipcMain.removeAllListeners("grimoire-update-template");
  ipcMain.removeAllListeners("grimoire-close");
  ipcMain.removeAllListeners("grimoire-minimize");
  ipcMain.removeAllListeners("grimoire-execute-template");
  ipcMain.removeAllListeners("grimoire-get-settings");
  ipcMain.removeAllListeners("grimoire-update-settings");
  ipcMain.removeAllListeners("grimoire-set-api-key");
  ipcMain.removeAllListeners("grimoire-set-book-field");
  ipcMain.removeAllListeners("grimoire-remove-book-field");
};

export const closeCommandBrowser = () => {
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.close();
  }
  browserWindow = null;
};


