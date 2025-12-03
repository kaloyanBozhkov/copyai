import { useAppStore } from "@/store/useAppStore";
import { useRouteStore } from "@/store/useRouteStore";
import { useElectronListener } from "./useElectronListener";
import { useEffect, useRef } from "react";
import { ipcRenderer } from "@/utils/electron";

export const useInit = () => {
  const { setIsDevMode } = useAppStore();
  const { setRoute } = useRouteStore();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      ipcRenderer.send("app-mounted");
    }
    return () => {
      console.log("SPA unmounting, sending app-unmounted event");
    };
  }, []);

  useElectronListener("app-init", ({ route, isDevMode }) => {
    console.log("Received app-init event:", { route, isDevMode });
    setIsDevMode(isDevMode);
    setRoute(route);
  });
};
