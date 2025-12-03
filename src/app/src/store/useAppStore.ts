import { create } from "zustand";

interface AppState {
  searchValue: string;
  autocompleteValue: string;
  argsValue: string;
  isDevMode: boolean;
  tabsCount: number;
  setSearchValue: (value: string) => void;
  setAutocompleteValue: (value: string) => void;
  setArgsValue: (value: string) => void;
  setIsDevMode: (value: boolean) => void;
  incrementTabsCount: () => void;
  resetTabsCount: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  searchValue: "",
  autocompleteValue: "",
  argsValue: "",
  isDevMode: false,
  tabsCount: 0,
  setSearchValue: (value) => set({ searchValue: value }),
  setAutocompleteValue: (value) => set({ autocompleteValue: value }),
  setArgsValue: (value) => set({ argsValue: value }),
  setIsDevMode: (value) => set({ isDevMode: value }),
  incrementTabsCount: () =>
    set((state) => ({ tabsCount: state.tabsCount + 1 })),
  resetTabsCount: () => set({ tabsCount: 0 }),
  reset: () =>
    set({
      searchValue: "",
      autocompleteValue: "",
      argsValue: "",
      tabsCount: 0,
    }),
}));
