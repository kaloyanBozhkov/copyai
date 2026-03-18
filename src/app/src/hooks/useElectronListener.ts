import { useEffect, useRef } from "react";
import { ipcRenderer } from "../utils/electron";

import type { Route } from "../store/useRouteStore";

export type FormField = {
  name: string;
  label: string;
  type: "text" | "password" | "select";
  placeholder?: string;
  defaultValue?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
};

type EventPayloads = {
  "autocomplete-result": { key: string; args: string[]; isTabPress: boolean };
  "app-init": { route: Route; isDevMode: boolean };
  "command-processing-completed": { success: boolean };
  "command-form-init": { title: string; fields: FormField[] };
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

