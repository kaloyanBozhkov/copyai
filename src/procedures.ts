import { cmdKitchen } from "./cmdKitchen";
import { closeActiveWindow } from "./actions";
import { showInput } from "./form";
import { state } from "./state";

export const showInputWindowListener = async (isDevMode = false) => {
  closeActiveWindow();
  const input = await showInput(isDevMode);
  state.isInputWindowOpen = true;
  let args: string[] = [];
  let cmdAccessor = "";

  const firstSpace = ~input.indexOf(" ") ? input.indexOf(" ") : input.length;
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
  await cmdKitchen(cmdAccessor, args);
};

export const closeActiveWindowListener = () => {
  closeActiveWindow();
};
