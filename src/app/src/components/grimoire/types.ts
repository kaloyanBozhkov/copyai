export interface CommandInfo {
  name: string;
  fullKey: string;
  category: string;
  subcategory?: string;
  type: "exec" | "template" | "custom-template";
  args: string[];
  messageRecipe?: string[];
  isCustom?: boolean;
}

export interface CategoryGroup {
  name: string;
  commands: CommandInfo[];
  subcategories?: Record<string, CommandInfo[]>;
}

export interface CustomTemplate {
  id: string;
  name: string;
  category: string;
  messageRecipe: string[];
  createdAt: number;
}

export interface CommandsData {
  execs: Record<string, CategoryGroup>;
  templates: Record<string, CategoryGroup>;
  customTemplates: CustomTemplate[];
}

export interface GrimoireSettings {
  apiKeys: {
    OPENAI_API_KEY: string;
    OPENROUTER_API_KEY: string;
  };
  book: Record<string, string>;
}

