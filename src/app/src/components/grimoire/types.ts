export interface CommandInfo {
  name: string;
  fullKey: string;
  category: string;
  subcategory?: string;
  type: "exec" | "template" | "custom-template" | "custom-spell";
  args: string[];
  messageRecipe?: string[];
  systemMessageTemplate?: string;
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

export interface CustomSpell {
  id: string;
  name: string;
  category: string;
  systemMessageTemplate: string;
  retryCount: number;
  createdAt: number;
}

export interface CommandsData {
  execs: Record<string, CategoryGroup>;
  templates: Record<string, CategoryGroup>;
  customTemplates: CustomTemplate[];
  customSpells: CustomSpell[];
}

export interface AlchemyPotion {
  id: string;
  name: string;
  method: "GET" | "POST";
  url: string;
  headers: Record<string, string>;
  body?: string;
  lastValue?: string;
  lastFetched?: number;
}

export interface GrimoireSettings {
  apiKeys: {
    OPENAI_API_KEY: string;
    OPENROUTER_API_KEY: string;
  };
  book: Record<string, string>;
  alchemy: AlchemyPotion[];
}

