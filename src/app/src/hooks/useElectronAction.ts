import { ipcRenderer } from "../utils/electron";

export const electronActions = {
  mouseEnter: () => ipcRenderer.send("mouse-enter"),
  mouseLeave: () => ipcRenderer.send("mouse-leave"),
  autocompleteRequest: (payload: {
    searchValue: string;
    isTabPress?: boolean;
  }) => ipcRenderer.send("autocomplete-request", payload),
  inputValue: (payload: string | null) =>
    ipcRenderer.send("input-value", payload),
  requestWindowClose: () => ipcRenderer.send("request-window-close"),
};

// TODO no need 2 b hook
export function useElectronActions() {
  return electronActions;
}
