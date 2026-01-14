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

