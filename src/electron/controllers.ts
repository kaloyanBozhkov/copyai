import { cmdKitchen } from "../kitchen/cmdKitchen";
import { closeActiveWindow } from "./actions";
import { showCommandAutocompleteInput } from "../views/commandAutocompleteInput";
import { showProcessingCommandView } from "../views/processingCommand";

export const showInputWindowListener = async (isDevMode = false) => {
  closeActiveWindow();
  const input = await showCommandAutocompleteInput(isDevMode);
  if (!input) return;
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

  const onCompletedProcessing = await showProcessingCommandView();
  const success = await cmdKitchen(cmdAccessor, args);
  onCompletedProcessing(success !== false);
};

export const closeActiveWindowListener = () => {
  closeActiveWindow();
};
