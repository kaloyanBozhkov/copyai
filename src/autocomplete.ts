import { allCategoryCommandsNameHashTable } from "./templateCommands";

export const allCommandKeys = Object.keys(allCategoryCommandsNameHashTable);
export const getClosestCommandKey = (input: string) => {
  const key = allCommandKeys.find((key) => key.startsWith(input)) ?? "";
  const isFullmatch = key === input;
  if (!key) {
    return {
      key: "",
      args: isFullmatch ? getArgs(input) : [],
    };
  }

  return { key, args: getArgs(key) };
};
export type AutocompleteResult = {
  key: string;
  args: string[];
};

const getArgs = (key: string) => {
  const argsCount = allCategoryCommandsNameHashTable[key].messageRecipe
    .join("")
    .split(/^\$[0-9]/).length;
  return Array.from({ length: argsCount }, (_, index) => `arg${index + 1}`);
};
