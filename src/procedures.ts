import { copyCommand } from "./copyCommand";
import { closeActiveWindow } from "./actions";
import { showInput } from "./form";
import { state } from "./state";

export const showInputWindowListener = async () => {
  closeActiveWindow();
  const input = await showInput();
  state.isInputWindowOpen = true;
  let args: string[] = [];
  let cmdAccessor = "";

  const firstSpace = input.indexOf(" ");
  if (!firstSpace) {
    cmdAccessor = input;
    args = [];
  } else {
    cmdAccessor = input.slice(0, firstSpace);
    args = input.slice(firstSpace + 1).split(", ");
  }

  console.info({
    cmdAccessor,
    cmdArgs: JSON.stringify(args),
  });
  await copyCommand(cmdAccessor, args);
};

export const closeActiveWindowListener = () => {
  closeActiveWindow();
};