import { create } from "zustand";

export type Route = "command-input" | "processing-command";

interface RouteState {
  route: Route;
  setRoute: (route: Route) => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  route: "command-input",
  setRoute: (route) => set({ route }),
}));

