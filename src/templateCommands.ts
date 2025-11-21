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

export const messageComposers = flattenObjectDot(messageComposersPerCategory);
