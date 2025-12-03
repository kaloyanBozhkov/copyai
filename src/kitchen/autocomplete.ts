import { getArgs, utensilsKeys } from "./cmdKitchen";

export const getClosestCommandKey = (input: string) => {
  const key = utensilsKeys.find((key) => key.startsWith(input)) ?? "";
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
