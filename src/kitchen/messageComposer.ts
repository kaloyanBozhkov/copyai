export type MessageComposer = {
  messageRecipe: string[];
  build: (builderArgs?: string[]) => string;
};
export type msgCategory = string;
export const messageBuilder = (stopAtOverwrite?: number) => {
  return {
    build(builderArgs: string[] = []) {
      const thisBound = this as unknown as MessageComposer;
      const { messageRecipe } = thisBound ?? {};

      const stopAt = stopAtOverwrite ?? messageRecipe.length;
      if (stopAt > messageRecipe.length) {
        throw Error("config is odd");
      }
      const untilLine = Math.min(stopAt, messageRecipe.length);
      let text = messageRecipe.slice(0, untilLine).join("\n");
      for (let i = 0; i < builderArgs.length; i++) {
        if (!builderArgs[i]) break;
        text = text.replaceAll(`$${i}`, builderArgs[i]);
      }

      return text;
    },
  };
};