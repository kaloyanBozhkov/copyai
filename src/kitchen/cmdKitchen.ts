import { clipboard } from "electron";
import { messageComposers } from "./recipes/templateCommands";
import { MessageComposer } from "./messageComposer";
import { CommandExecutor } from "./commandExecutor";
import { execs } from "./recipes/execs";
import { countUniqueArgs } from "./helpers";

const utensils = {
  ...execs,
  ...messageComposers,
};

export const utensilsKeys = [
  ...Object.keys(messageComposers),
  ...Object.keys(execs),
];

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
  return true;
};

export const copyCommand = cmdKitchen<MessageComposer>;
export const executeCmdCommand = cmdKitchen<CommandExecutor>;

export const getArgs = (key: string) => {
  const composer = utensils[key] as Recipe;
  if (Array.isArray(composer)) {
    const [, ...argNames] = composer;
    const argNamesList = argNames.flat();
    return createArgsTemplate(argNamesList.length, argNamesList);
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
