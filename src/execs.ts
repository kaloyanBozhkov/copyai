import { CommandExecutor } from "./commandExecutor";
import { flattenObjectDot } from "./helpers";
import { v4 as uuidv4 } from 'uuid';


export const execsPerCategory: Record<
  string,
  Record<string, CommandExecutor>
> = {
  generate: {
    uuid: [() => uuidv4()],
  },
};

export const execs = flattenObjectDot(execsPerCategory);
