import { BrowserWindow } from "electron";

export const state = {
  isInputWindowOpen: true,
  activeWindowRef: null as BrowserWindow | null,
};
