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
    width: 900,
    height: 650,
    minWidth: 700,
    minHeight: 500,
    resizable: true,
    movable: true,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    vibrancy: "under-window",
    visualEffectState: "active",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
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

  ipcMain.removeAllListeners("grimoire-mounted");

  return new Promise((resolve) => {
    ipcMain.once("grimoire-mounted", () => {
      if (!browserWindow || browserWindow.isDestroyed()) return;
      browserWindow.webContents.send("grimoire-init", {
        commands: getCommandsData(),
        isDevMode,
      });
      browserWindow.show();
      resolve();
    });

    browserWindow!.loadFile(appPath, { query: { route: "grimoire" } });

    browserWindow!.on("closed", () => {
      browserWindow = null;
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
      
      // Build values map from args array
      const valuesMap: Record<string, string> = {};
      placeholders.forEach((placeholder, index) => {
        if (args && args[index] !== undefined) {
          valuesMap[placeholder] = args[index];
        }
      });
      
      const result = replacePlaceholders(text, valuesMap);
      event.reply("grimoire-template-result", result);
    }
  );
};

const cleanupCommandBrowserIPC = () => {
  ipcMain.removeAllListeners("grimoire-get-commands");
  ipcMain.removeAllListeners("grimoire-add-template");
  ipcMain.removeAllListeners("grimoire-remove-template");
  ipcMain.removeAllListeners("grimoire-update-template");
  ipcMain.removeAllListeners("grimoire-close");
  ipcMain.removeAllListeners("grimoire-minimize");
  ipcMain.removeAllListeners("grimoire-execute-template");
};

export const closeCommandBrowser = () => {
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.close();
  }
  browserWindow = null;
};


