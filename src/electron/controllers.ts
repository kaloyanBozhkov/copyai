import { cmdKitchen } from "../kitchen/cmdKitchen";
import { closeActiveWindow } from "./actions";
import { showCommandAutocompleteInput } from "../views/commandAutocompleteInput";
import { showProcessingCommandView } from "../views/processingCommand";

let isProcessingCommand = false;

export const showInputWindowListener = async (isDevMode = false) => {
  // Prevent race condition: don't show input while command is processing
  if (isProcessingCommand) {
    console.log("Command already processing, ignoring shortcut");
    return;
  }

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

  isProcessingCommand = true;
  try {
    const onCompletedProcessing = await showProcessingCommandView();
    const success = await cmdKitchen(cmdAccessor, args);
    onCompletedProcessing(success !== false);
  } finally {
    isProcessingCommand = false;
  }
};

export const closeActiveWindowListener = () => {
  closeActiveWindow();
};
