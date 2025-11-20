import { messageBuilder, msgCategory, type MessageComposer } from "./copier";

export const MessageComposers: Record<
  msgCategory,
  Record<string, MessageComposer>
> = {
  comments: {
    comment_frame: {
      messageRecipe: [
        "/* --------------------------------",
        "/*   $0",
        "/* -------------------------------- */",
      ],
      ...messageBuilder(),
    },
    comment_frame_full: {
      messageRecipe: [
        "/* --------------------------------",
        "/*   $0",
        "/* -------------------------------- */",
        "",
        "",
        "",
        "/* --------------------------------",
        "/*   $0",
        "/* -------------------------------- */",
      ],
      ...messageBuilder(),
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
