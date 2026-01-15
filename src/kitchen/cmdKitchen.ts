import { clipboard } from "electron";
import { messageComposers } from "./recipes/templateCommands";
import { CommandExecutor } from "./commandExecutor";
import { execs } from "./recipes/execs";
import { addToHistory, getCommandHistory, clearHistory } from "./commandHistory";
import {
  getCustomTemplatesAsComposers,
  onCustomTemplatesChange,
} from "./customTemplates";
import {
  getCustomSpellsAsExecutors,
  onCustomSpellsChange,
} from "./customSpells";

export { clearHistory };

// Get current utensils (always fresh, includes custom templates and spells)
const getUtensils = () => ({
  ...execs,
  ...messageComposers,
  ...getCustomTemplatesAsComposers(),
  ...getCustomSpellsAsExecutors(),
} as Record<string, CommandExecutor | Record<string, unknown>>);

// Subscribe to custom template/spell changes to refresh keys
onCustomTemplatesChange(() => refreshCommandKeys());
onCustomSpellsChange(() => refreshCommandKeys());

// Filter out non-executable keys (subcategories)
const isExecutable = (key: string): boolean => {
  const utensils = getUtensils();
  const item = utensils[key];
  if (!item) return false;
  // CommandExecutor is an array with function as first element
  if (Array.isArray(item) && typeof item[0] === "function") return true;
  return false;
};

const getBaseKeys = () => [
  ...Object.keys(messageComposers),
  ...Object.keys(execs),
  ...Object.keys(getCustomTemplatesAsComposers()),
  ...Object.keys(getCustomSpellsAsExecutors()),
].filter(isExecutable);

export const utensilsKeys = getSortedKeys();

/**
 * Get command keys sorted alphabetically but with recent history prioritized
 */
function getSortedKeys(): string[] {
  const history = getCommandHistory();
  const allKeys = getBaseKeys();
  
  // Sort alphabetically
  const sorted = allKeys.sort((a, b) => a.localeCompare(b));
  
  // Filter history to only include valid commands that still exist
  const recentCommands = history.filter((cmd) => sorted.includes(cmd));
  const otherCommands = sorted.filter((cmd) => !recentCommands.includes(cmd));
  
  return [...recentCommands, ...otherCommands];
}

/**
 * Refresh the sorted keys list (call after command execution)
 */
export const refreshCommandKeys = (): void => {
  const newKeys = getSortedKeys();
  utensilsKeys.length = 0;
  utensilsKeys.push(...newKeys);
};

export const cmdKitchen = async (
  cmdAccessor: string,
  builderArgs?: string[]
) => {
  const utensils = getUtensils();
  const parts = cmdAccessor.split(".");
  
  let recipe: CommandExecutor | null = null;
  
  // Try full accessor first (category.subcategory.command or category.command)
  if (utensils[cmdAccessor] && Array.isArray(utensils[cmdAccessor])) {
    recipe = utensils[cmdAccessor] as CommandExecutor;
  }
  
  // Try without first part (for shortcuts like living-room.to)
  if (!recipe && parts.length > 1) {
    const withoutCategory = parts.slice(1).join(".");
    if (utensils[withoutCategory] && Array.isArray(utensils[withoutCategory])) {
      recipe = utensils[withoutCategory] as CommandExecutor;
    }
  }
  
  // Try just the command part (backwards compatibility)
  if (!recipe && parts.length > 0) {
    const commandOnly = parts[parts.length - 1];
    if (utensils[commandOnly] && Array.isArray(utensils[commandOnly])) {
      recipe = utensils[commandOnly] as CommandExecutor;
    }
  }
  
  if (!recipe) {
    console.info(`Unknown command: ${cmdAccessor}`);
    return;
  }

  const message = await recipe[0](builderArgs);

  // null signals failure - don't copy, return false
  if (message === null) {
    console.info("Command failed");
    return false;
  }

  if (typeof message === "string") {
    clipboard.writeText(message);
    console.info("Copied:\n", message);
  }
  
  // Add to history and refresh keys
  addToHistory(cmdAccessor);
  refreshCommandKeys();
  
  // Return the message if it's a string, otherwise true
  return typeof message === "string" ? message : true;
};

export const getArgs = (key: string) => {
  const utensils = getUtensils();
  const command = utensils[key];
  
  // Return empty array if command doesn't exist or is not a CommandExecutor
  if (!command || !Array.isArray(command)) {
    return [];
  }
  
  const [, ...argNames] = command;
  const argNamesList = argNames.flat();
  return createArgsTemplate(argNamesList.length, argNamesList);
};

const createArgsTemplate = (argsCount: number, names?: string[]) => {
  return Array.from(
    { length: argsCount },
    (_, index) => names?.[index] ?? `arg${index + 1}`
  );
};
