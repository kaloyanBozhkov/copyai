import CommandInput from "./components/CommandInput";
import { useInit } from "./hooks/useInit";
import { useRouteStore } from "./store/useRouteStore";
import { Thinking } from "./components/Thinking";

export default function App() {
  useInit();
  const { route } = useRouteStore();
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
        }
      })()}
    </div>
  );
}
