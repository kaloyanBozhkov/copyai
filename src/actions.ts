import { state } from "./state";

export const closeActiveWindow = () => {
  state.isInputWindowOpen = false;
  if (state.activeWindowRef && !state.activeWindowRef.isDestroyed()) {
    state.activeWindowRef.close();
  }
  state.activeWindowRef = null;
};
