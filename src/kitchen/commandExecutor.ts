type Args = string[];
export type CommandExecutor = [
  (builderArgs?: Args) => string | void | Promise<string | void>,
  ...Args
];
