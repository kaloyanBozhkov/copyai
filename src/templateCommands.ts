import { messageBuilder, msgCategory, type MessageComposer } from "./copier";

export const MessageComposers: Record<
  msgCategory,
  Record<string, MessageComposer>
> = {
  comments: {
    comment_top: {
      messageRecipe: [
        "/* --------------------------------",
        "/*   $0",
        "/* -------------------------------- */",
      ],
      ...messageBuilder(3),
    },
  },
} as const;

export const allCategoryCommandsNameHashTable = Object.values(
  MessageComposers
).reduce(
  (acc, categoryCommands) => ({
    ...acc,
    ...Object.keys(categoryCommands).reduce(
      (acc, command) => ({ ...acc, [command]: categoryCommands[command] }),
      {}
    ),
  }),
  {}
);
