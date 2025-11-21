import { flattenObjectDot } from "./helpers";
import {
  messageBuilder,
  msgCategory,
  type MessageComposer,
} from "./messageComposer";

const messageComposersPerCategory: Record<
  msgCategory,
  Record<string, MessageComposer>
> = {
  comments: {
    frame: {
      messageRecipe: [
        "/* --------------------------------",
        "/*   $0",
        "/* -------------------------------- */",
      ],
      ...messageBuilder(),
    },
    full_frame: {
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
    tag: {
      messageRecipe: [
        "<$0>$1<$0>",
      ],
      ...messageBuilder(),
    },
  },
} as const;

export const messageComposers = flattenObjectDot(messageComposersPerCategory);