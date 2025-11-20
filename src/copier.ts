export type MessageComposer = {
  messageRecipe: string[];
  build: (builderArgs?: string[]) => string;
};
export type msgCategory = string;
export const messageBuilder = (stopAt?: number) => {
  return {
    build(builderArgs: string[] = []) {
      if (!stopAt) {
        return "";
      }
      const thisBound = this as unknown as MessageComposer;
      const { messageRecipe } = thisBound ?? {};
      if (stopAt > messageRecipe.length) {
        throw Error("config is odd");
      }
      const limited = Math.min(stopAt, messageRecipe.length);
      let text = messageRecipe.slice(0, limited).join("\n");
      for (let i = 0; i < limited; i++) {
        text = text.replace(`$${i}`, builderArgs[i]);
      }
      return text;
    },
  };
};
