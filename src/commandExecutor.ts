type Args = string[];
export type CommandExecutor = [(builderArgs?: Args) => string, ...Args];