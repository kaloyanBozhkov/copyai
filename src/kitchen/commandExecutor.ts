type Args = string[];
export type CommandExecutor = [
  (builderArgs?: Args) => string | void | null | Promise<string | void | null>,
  ...Args
];
