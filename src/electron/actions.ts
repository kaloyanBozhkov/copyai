import { state } from "./state";

export const closeActiveWindow = () => {
  if (state.activeWindowRef && !state.activeWindowRef.isDestroyed()) {
    state.activeWindowRef.close();
  }
  state.activeWindowRef = null;
};

// IPC channel payloads
export type AutocompleteResultPayload = {
  key: string;
  args: string[];
  isTabPress: boolean;
};

export type AppInitPayload = {
  route: "command-input" | "processing-command";
  isDevMode?: boolean;
};

export type IPCActions = {
  "autocomplete-result": AutocompleteResultPayload;
  "app-init": AppInitPayload;
  "command-processing-completed": void;
};
/**
 * send event to SPA
 */
export const sendToActiveWindow = <T extends keyof IPCActions>(
  channel: T,
  payload: IPCActions[T]
) => {
  if (state.activeWindowRef && !state.activeWindowRef.isDestroyed()) {
    console.log(
      "Action event sent to SPA:",
      channel,
      JSON.stringify(payload, null, 2)
    );
    state.activeWindowRef.webContents.send(channel, payload);
  }
};
