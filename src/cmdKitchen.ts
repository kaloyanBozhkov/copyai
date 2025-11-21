import { clipboard } from "electron";
import { messageComposers } from "./templateCommands";
import { MessageComposer } from "./messageComposer";
import { CommandExecutor } from "./commandExecutor";
import { execs } from "./execs";
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
  const [categoryKey, commandKey] = cmdAccessor.split(".") as [
    keyof typeof utensils,
    keyof (typeof utensils)[keyof typeof utensils]
  ];

  let recipe: Recipe | null = null;
  if (categoryKey && commandKey) {
    recipe = utensils[categoryKey + "." + commandKey] as TRecipe;
  }
  if (!recipe && categoryKey) {
    recipe = utensils[categoryKey] as TRecipe;
  }
  if (!recipe) {
    throw Error(`Unknown command: ${categoryKey} ${commandKey}`);
  }

  const message = Array.isArray(recipe)
    ? recipe[0](builderArgs)
    : recipe!.build(builderArgs);
  clipboard.writeText(message);
  console.info("Copied:\n", message);
};

export const copyCommand = cmdKitchen<MessageComposer>;
export const executeCmdCommand = cmdKitchen<CommandExecutor>;

export const getArgs = (key: string) => {
  const composer = utensils[key] as Recipe;
  if (Array.isArray(composer)) {
    const [_fn, ...argNames] = composer;
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
