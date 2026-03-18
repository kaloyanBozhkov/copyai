import { useEffect, useState } from "react";
import CommandInput from "./components/CommandInput";
import { useInit } from "./hooks/useInit";
import { useRouteStore } from "./store/useRouteStore";
import { Thinking } from "./components/Thinking";
import { CommandGrimoire } from "./components/grimoire";
import { WatchHistory } from "./components/WatchHistory";
import { WizSetup } from "./components/WizSetup";
import { WizControl } from "./components/WizControl";
import { CommandForm } from "./components/CommandForm";

export default function App() {
  useInit();
  const { route, setRoute } = useRouteStore();
  const [fullscreenRoute, setFullscreenRoute] = useState<string | null>(null);

  // Check URL for special routes on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoute = urlParams.get("route");
    if (urlRoute === "grimoire" || urlRoute === "watch-history" || urlRoute === "wiz-setup" || urlRoute === "wiz-control") {
      setFullscreenRoute(urlRoute);
      setRoute(urlRoute);
    }
  }, [setRoute]);

  // Full-screen routes have their own layouts
  if (fullscreenRoute === "grimoire" || route === "grimoire") {
    return <CommandGrimoire />;
  }

  if (fullscreenRoute === "watch-history" || route === "watch-history") {
    return <WatchHistory />;
  }

  if (fullscreenRoute === "wiz-setup" || route === "wiz-setup") {
    return <WizSetup />;
  }

  if (fullscreenRoute === "wiz-control" || route === "wiz-control") {
    return <WizControl />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-fit">
      {(() => {
        switch (route) {
          case "command-input":
            return (
              <div className="flex flex-col items-end w-full">
                <CommandInput />
                <p className="text-xs text-gray-500 mt-2 font-light pointer-events-none">
                  Made with ♥ by Koko
                </p>
              </div>
            );
          case "processing-command":
            return (
              <div className="pointer-events-none pointer-none">
                <Thinking />
              </div>
            );
          case "command-form":
            return <CommandForm />;
          default:
            return null;
        }
      })()}
    </div>
  );
}
