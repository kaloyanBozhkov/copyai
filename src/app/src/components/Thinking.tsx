import { DotsLoader } from "@koko420/react-components";
import { CheckAnimated } from "./atoms/CheckAnimated.atom";
import { useElectronListener } from "@/hooks/useElectronListener";
import { useElectronActions } from "@/hooks/useElectronAction";
import { useState } from "react";

export const Thinking = () => {
  const [isCooking, setIsCooking] = useState(true);
  const { requestWindowClose } = useElectronActions();

  // when processing is done, trigger checkbox animation flow
  useElectronListener("command-processing-completed", () => {
    setIsCooking(false);
  });

  return (
    <div className="flex flex-col items-center justify-center">
      {isCooking ? (
        <DotsLoader size="sm" modifier="primary" className="[&>div]:shadow-layered!" />
      ) : (
        <CheckAnimated
          onAnimationComplete={() => {
            requestWindowClose();
          }}
        />
      )}
    </div>
  );
};
