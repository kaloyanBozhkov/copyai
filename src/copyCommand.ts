import { clipboard } from "electron";
import {
  allCategoryCommandsNameHashTable,
  MessageComposers,
} from "./templateCommands";
import { MessageComposer } from "./copier";

export const copyCommand = async (
  cmdAccessor: string,
  builderArgs?: string[]
) => {
  const [categoryKey, commandKey] = cmdAccessor.split(".");

  let recipe: MessageComposer | null = null;
  if (categoryKey && commandKey) {
    recipe = MessageComposers[categoryKey][commandKey];
  }
  if (!recipe && categoryKey) {
    recipe = allCategoryCommandsNameHashTable[categoryKey];
  }
  if (!recipe) {
    throw Error(`Unknown command: ${categoryKey} ${commandKey}`);
  }

  const message = recipe!.build(builderArgs);
  clipboard.writeText(message);
  console.info("Copied:\n", message);
};
