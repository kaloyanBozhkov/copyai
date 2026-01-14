import fs from "fs";
import path from "path";
import os from "os";

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

