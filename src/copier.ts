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
      const limited = Math.min(stopAt, messageRecipe.length);
      let text = messageRecipe.slice(0, limited).join("\n");
      for (let i = 0; i < limited; i++) {
        text = text.replaceAll(`$${i}`, builderArgs[i]);
      }
      return text;
    },
  };
};