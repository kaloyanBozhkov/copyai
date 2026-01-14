import fs from "fs";
import path from "path";
import os from "os";
import { CommandExecutor } from "./commandExecutor";
import { extractPlaceholders, replacePlaceholders } from "./helpers";

const CUSTOM_TEMPLATES_FILE = path.join(
  os.homedir(),
  ".copyai-custom-templates.json"
);

export interface CustomTemplate {
  id: string;
  name: string;
  category: string;
  messageRecipe: string[];
  createdAt: number;
}

interface CustomTemplatesData {
  templates: CustomTemplate[];
}

let templatesCache: CustomTemplate[] | null = null;

// Callbacks to notify when templates change
const changeListeners: Array<() => void> = [];

export const onCustomTemplatesChange = (callback: () => void) => {
  changeListeners.push(callback);
  return () => {
    const index = changeListeners.indexOf(callback);
    if (index > -1) changeListeners.splice(index, 1);
  };
};

const notifyChange = () => {
  changeListeners.forEach((cb) => cb());
};

const loadTemplates = (): CustomTemplate[] => {
  if (templatesCache) return templatesCache;

  try {
    if (fs.existsSync(CUSTOM_TEMPLATES_FILE)) {
      const data = fs.readFileSync(CUSTOM_TEMPLATES_FILE, "utf-8");
      const parsed: CustomTemplatesData = JSON.parse(data);
      templatesCache = parsed.templates || [];
      return templatesCache;
    }
  } catch (error) {
    console.error("Failed to load custom templates:", error);
  }

  templatesCache = [];
  return templatesCache;
};

const saveTemplates = (templates: CustomTemplate[]): void => {
  try {
    const data: CustomTemplatesData = { templates };
    fs.writeFileSync(CUSTOM_TEMPLATES_FILE, JSON.stringify(data, null, 2), "utf-8");
    templatesCache = templates;
    notifyChange();
  } catch (error) {
    console.error("Failed to save custom templates:", error);
  }
};

export const getCustomTemplates = (): CustomTemplate[] => {
  return loadTemplates();
};

export const addCustomTemplate = (
  template: Omit<CustomTemplate, "id" | "createdAt">
): CustomTemplate => {
  const templates = loadTemplates();
  const newTemplate: CustomTemplate = {
    ...template,
    id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: Date.now(),
  };
  templates.push(newTemplate);
  saveTemplates(templates);
  return newTemplate;
};

export const removeCustomTemplate = (id: string): boolean => {
  const templates = loadTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  if (filtered.length !== templates.length) {
    saveTemplates(filtered);
    return true;
  }
  return false;
};

export const updateCustomTemplate = (
  id: string,
  updates: Partial<Omit<CustomTemplate, "id" | "createdAt">>
): CustomTemplate | null => {
  const templates = loadTemplates();
  const index = templates.findIndex((t) => t.id === id);
  if (index === -1) return null;

  templates[index] = { ...templates[index], ...updates };
  saveTemplates(templates);
  return templates[index];
};

export const clearTemplatesCache = (): void => {
  templatesCache = null;
};

// Helper to create a CommandExecutor from recipe
const templateToExecutor = (recipe: string[]): CommandExecutor => {
  const text = recipe.join("\n");
  const placeholders = extractPlaceholders(text);
  
  // Create arg definitions - numbered ones just show the number, named show the name
  const argDefs = placeholders.map((p) => 
    /^\d+$/.test(p) ? `$${p}: string` : `${p}: string`
  );

  const buildFn = (args?: string[]) => {
    if (!args || args.length === 0) return text;
    
    // Build a map of placeholder names to provided values
    const valuesMap: Record<string, string> = {};
    placeholders.forEach((placeholder, index) => {
      if (args[index] !== undefined) {
        valuesMap[placeholder] = args[index];
      }
    });
    
    return replacePlaceholders(text, valuesMap);
  };

  return [buildFn, ...argDefs];
};

/**
 * Convert custom templates to CommandExecutor format for use in cmdKitchen
 * Returns a flattened object with keys like "custom.category.name" and shortcut "name"
 */
export const getCustomTemplatesAsComposers = (): Record<string, CommandExecutor> => {
  const templates = loadTemplates();
  const result: Record<string, CommandExecutor> = {};

  for (const template of templates) {
    const executor = templateToExecutor(template.messageRecipe);

    // Add with full key (custom.category.name)
    const fullKey = `custom.${template.category}.${template.name}`;
    result[fullKey] = executor;

    // Add shortcut (just name) if not conflicting
    result[template.name] = executor;
  }

  return result;
};
