import { allCategoryCommandsNameHashTable } from "./templateCommands";

export const allCommandKeys = Object.keys(allCategoryCommandsNameHashTable);
export const getClosestCommandKey = (input: string) => {
  const key = allCommandKeys.find((key) => key.startsWith(input) && input !== key) ?? "";
  if (!key) {
    return {
      key: "",
      args: [],
    };
  }

  const argsCount = allCategoryCommandsNameHashTable[key].messageRecipe
    .join("")
    .split(/^\$[0-9]/).length;
  const args = Array.from(
    { length: argsCount },
    (_, index) => `arg${index + 1}`
  );
  return { key, args };
};
export type AutocompleteResult = {
  key: string;
  args: string[];
};

