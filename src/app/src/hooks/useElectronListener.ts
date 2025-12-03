import { useEffect, useRef } from "react";
import { ipcRenderer } from "../utils/electron";

import type { Route } from "../store/useRouteStore";

type EventPayloads = {
  "autocomplete-result": { key: string; args: string[]; isTabPress: boolean };
  "app-init": { route: Route; isDevMode: boolean };
  "command-processing-completed": void;
};

type EventName = keyof EventPayloads;

export function useElectronListener<T extends EventName>(
  event: T,
  callback: (payload: EventPayloads[T]) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const handler = (_event: unknown, payload: EventPayloads[T]) => {
      callbackRef.current(payload);
    };

    ipcRenderer.on(event, handler);

    return () => {
      ipcRenderer.removeListener(event, handler);
    };
  }, [event]);
}

