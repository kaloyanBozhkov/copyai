import { clipboard } from "electron";
import { messageComposers } from "./recipes/templateCommands";
import { MessageComposer } from "./messageComposer";
import { CommandExecutor } from "./commandExecutor";
import { execs } from "./recipes/execs";
import { countUniqueArgs } from "./helpers";
import { addToHistory, getCommandHistory, clearHistory } from "./commandHistory";

export { clearHistory };

const utensils = {
  ...execs,
  ...messageComposers,
};

// Filter out non-executable keys (subcategories)
const isExecutable = (key: string): boolean => {
  const item = utensils[key];
  if (!item) return false;
  if (Array.isArray(item)) return true; // CommandExecutor
  // Check for MessageComposer
  const composer = item as any;
  if (composer.messageRecipe && Array.isArray(composer.messageRecipe)) return true;
  return false;
};

const baseKeys = [
  ...Object.keys(messageComposers),
  ...Object.keys(execs),
].filter(isExecutable);

export const utensilsKeys = getSortedKeys();

/**
 * Get command keys sorted alphabetically but with recent history prioritized
 */
function getSortedKeys(): string[] {
  const history = getCommandHistory();
  const allKeys = [...baseKeys];
  
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

export type Recipe = MessageComposer | CommandExecutor;
export const cmdKitchen = async <TRecipe extends Recipe>(
  cmdAccessor: string,
  builderArgs?: string[]
) => {
  const parts = cmdAccessor.split(".");
  
  let recipe: Recipe | null = null;
  
  // Try full accessor first (category.subcategory.command or category.command)
  if (utensils[cmdAccessor]) {
    recipe = utensils[cmdAccessor] as TRecipe;
  }
  
  // Try without first part (for shortcuts like living-room.to)
  if (!recipe && parts.length > 1) {
    const withoutCategory = parts.slice(1).join(".");
    recipe = utensils[withoutCategory] as TRecipe;
  }
  
  // Try just the command part (backwards compatibility)
  if (!recipe && parts.length > 0) {
    const commandOnly = parts[parts.length - 1];
    recipe = utensils[commandOnly] as TRecipe;
  }
  
  if (!recipe) {
    console.info(`Unknown command: ${cmdAccessor}`);
    return;
  }

  const message = await (Array.isArray(recipe)
    ? recipe[0](builderArgs)
    : recipe!.build(builderArgs));

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
  
  return true;
};

export const copyCommand = cmdKitchen<MessageComposer>;
export const executeCmdCommand = cmdKitchen<CommandExecutor>;

export const getArgs = (key: string) => {
  const composer = utensils[key] as Recipe;
  
  // Return empty array if command doesn't exist or is not a valid recipe
  if (!composer) {
    return [];
  }
  
  if (Array.isArray(composer)) {
    const [, ...argNames] = composer;
    const argNamesList = argNames.flat();
    return createArgsTemplate(argNamesList.length, argNamesList);
  }

  // Check if it has messageRecipe property (MessageComposer)
  if (!composer.messageRecipe || !Array.isArray(composer.messageRecipe)) {
    return [];
  }

  const uniqueArgsCount = countUniqueArgs(composer.messageRecipe.join(""));
  return createArgsTemplate(uniqueArgsCount);
};

const createArgsTemplate = (argsCount: number, names?: string[]) => {
  return Array.from(
    { length: argsCount },
    (_, index) => names?.[index] ?? `arg${index + 1}`
  );
};
