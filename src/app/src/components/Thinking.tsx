import { DotsLoader } from "@koko420/react-components";
import { CheckAnimated } from "./atoms/CheckAnimated.atom";
import { useElectronListener } from "@/hooks/useElectronListener";
import { useElectronActions } from "@/hooks/useElectronAction";
import { useState, useEffect } from "react";

type Status = "cooking" | "success" | "failed";

export const Thinking = () => {
  const [status, setStatus] = useState<Status>("cooking");
  const { requestWindowClose } = useElectronActions();

  // when processing is done, trigger checkbox animation flow
  useElectronListener("command-processing-completed", ({ success }) => {
    setStatus(success ? "success" : "failed");
  });

  // Auto-close on failure after delay
  useEffect(() => {
    if (status === "failed") {
      const timer = setTimeout(() => requestWindowClose(), 800);
      return () => clearTimeout(timer);
    }
  }, [status, requestWindowClose]);

  return (
    <div className="flex flex-col items-center justify-center">
      {status === "cooking" ? (
        <DotsLoader
          size="sm"
          modifier="primary"
          className="[&>div]:shadow-layered!"
        />
      ) : status === "success" ? (
        <CheckAnimated
          onAnimationComplete={() => {
            requestWindowClose();
          }}
        />
      ) : (
        <div className="text-red-500 text-4xl animate-in fade-in zoom-in duration-300">
          ✕
        </div>
      )}
    </div>
  );
};
